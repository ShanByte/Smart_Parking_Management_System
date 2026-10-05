import { describe, it, expect } from 'vitest';
import { ingestSensorEvent } from './ingestion.service.js';
import { ValidationError } from '../lib/errors.js';

describe('Stage 3 Ingestion Service Unit Tests', () => {
  it('throws ValidationError for invalid status string', async () => {
    await expect(
      ingestSensorEvent('dev_1', 'slot_1', 'INVALID' as unknown as 'AVAILABLE', new Date())
    ).rejects.toThrow(ValidationError);

    await expect(
      ingestSensorEvent('dev_1', 'slot_1', 'HELD' as unknown as 'AVAILABLE', new Date())
    ).rejects.toThrow(ValidationError);

    await expect(
      ingestSensorEvent('dev_1', 'slot_1', 'RESERVED' as unknown as 'AVAILABLE', new Date())
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for invalid timestamp', async () => {
    await expect(
      ingestSensorEvent('dev_1', 'slot_1', 'AVAILABLE', new Date('invalid date'))
    ).rejects.toThrow(ValidationError);
  });

  it('ignores event with timestamp more than 60 seconds in the future', async () => {
    const futureTimestamp = new Date(Date.now() + 120 * 1000); // 2 minutes in future
    const result = await ingestSensorEvent('dev_1', 'slot_1', 'OCCUPIED', futureTimestamp);
    expect(result.applied).toBe(false);
  });
});
