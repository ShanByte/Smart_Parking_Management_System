import { describe, it, expect } from 'vitest';
import { checkInBooking, guardSetSlotStatus } from './guard.service.js';
import { ValidationError } from '../lib/errors.js';

describe('Stage 4 Guard Domain Unit Tests', () => {
  it('checkInBooking throws ValidationError for empty or missing bookingCode', async () => {
    await expect(checkInBooking('usr_1', '')).rejects.toThrow(ValidationError);
    await expect(checkInBooking('usr_1', '   ')).rejects.toThrow(ValidationError);
  });

  it('guardSetSlotStatus throws ValidationError for invalid status string', async () => {
    await expect(
      guardSetSlotStatus('usr_1', 'slot_1', 'HELD' as unknown as 'OCCUPIED')
    ).rejects.toThrow(ValidationError);

    await expect(
      guardSetSlotStatus('usr_1', 'slot_1', 'RESERVED' as unknown as 'OCCUPIED')
    ).rejects.toThrow(ValidationError);

    await expect(
      guardSetSlotStatus('usr_1', 'slot_1', 'INVALID' as unknown as 'OCCUPIED')
    ).rejects.toThrow(ValidationError);
  });
});
