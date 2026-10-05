import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { hashToken } from '../lib/crypto.js';
import { SlotSource } from '@smart-parking/shared';

function parseArgs(): { name: string; kind: SlotSource; lotId?: string } {
  const args = process.argv.slice(2);
  let name = 'Demo Simulation Device';
  let kind: SlotSource = SlotSource.SIM;
  let lotId: string | undefined = undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--name' && args[i + 1]) {
      name = args[++i]!;
    } else if (arg === '--kind' && args[i + 1]) {
      const k = args[++i]!.toUpperCase();
      if (k === 'SIM' || k === 'SENSOR') {
        kind = k as SlotSource;
      }
    } else if (arg === '--lot' && args[i + 1]) {
      lotId = args[++i]!;
    }
  }

  return { name, kind, lotId };
}

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL environment variable is missing.');
    process.exit(1);
  }

  try {
    const parsedUrl = new URL(dbUrl);
    const host = parsedUrl.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      console.error(
        `ERROR: Refusing to create device on remote database. Host '${host}' is not localhost or 127.0.0.1.`
      );
      process.exit(1);
    }
  } catch {
    console.error('ERROR: Could not parse DATABASE_URL hostname.');
    process.exit(1);
  }

  const { name, kind, lotId } = parseArgs();

  // Validate lot existence if lotId is specified
  if (lotId) {
    const lot = await prisma.parkingLot.findUnique({ where: { id: lotId } });
    if (!lot) {
      console.error(`ERROR: Specified parking lot ID '${lotId}' does not exist.`);
      process.exit(1);
    }
  }

  const rawKey = crypto.randomBytes(32).toString('hex');
  const keyHash = hashToken(rawKey);

  const device = await prisma.device.create({
    data: {
      name,
      kind,
      parkingLotId: lotId ?? null,
      keyHash,
      isActive: true,
    },
  });

  console.log('================================================================');
  console.log('Device Registered Successfully:');
  console.log(`  Device ID:      ${device.id}`);
  console.log(`  Device Name:    ${device.name}`);
  console.log(`  Device Kind:    ${device.kind}`);
  console.log(`  Assigned Lot:   ${device.parkingLotId ?? 'None (Global)'}`);
  console.log('================================================================');
  console.log(`SIM_DEVICE_KEY=${rawKey}`);
  console.log('================================================================');
  console.log('Copy the SIM_DEVICE_KEY above into your .env file.');
  console.log('The raw key is shown exactly once and cannot be retrieved again.');
  console.log('================================================================');
}

main()
  .catch((err) => {
    console.error('Failed to create device:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
