import fs from 'fs';
import path from 'path';
import { PrismaClient, Role, SlotStatus, SlotSource } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Parse root .env using built-in fs if DATABASE_URL is not yet in process.env
if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const prisma = new PrismaClient();

interface DemoLotConfig {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  totalSlots: number;
  pricePerHourPaise: number;
}

const DEMO_LOTS: DemoLotConfig[] = [
  {
    name: 'FC Road Smart Lot [Demo]',
    address: 'Fergusson College Road, Shivajinagar, Pune, Maharashtra 411004',
    latitude: 18.52043,
    longitude: 73.84362,
    totalSlots: 25,
    pricePerHourPaise: 4000,
  },
  {
    name: 'MG Road Central Parking [Demo]',
    address: 'Camp, MG Road, Pune, Maharashtra 411001',
    latitude: 18.51582,
    longitude: 73.87854,
    totalSlots: 30,
    pricePerHourPaise: 5000,
  },
  {
    name: 'Koregaon Park Plaza [Demo]',
    address: 'North Main Road, Koregaon Park, Pune, Maharashtra 411001',
    latitude: 18.53621,
    longitude: 73.89412,
    totalSlots: 20,
    pricePerHourPaise: 6000,
  },
  {
    name: 'Viman Nagar Airport Hub [Demo]',
    address: 'Symbiosis Road, Viman Nagar, Pune, Maharashtra 411014',
    latitude: 18.56792,
    longitude: 73.91435,
    totalSlots: 28,
    pricePerHourPaise: 4500,
  },
];

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Security Violation: Seed refuses to execute when NODE_ENV=production');
  }

  console.log('--- Starting Database Seed ---');

  // 1. Seed Demo Parking Lots & Slots
  const createdLots = [];
  for (const lotConfig of DEMO_LOTS) {
    let lot = await prisma.parkingLot.findFirst({
      where: { name: lotConfig.name },
    });

    if (!lot) {
      lot = await prisma.parkingLot.create({
        data: {
          name: lotConfig.name,
          address: lotConfig.address,
          latitude: lotConfig.latitude,
          longitude: lotConfig.longitude,
          totalSlots: lotConfig.totalSlots,
          pricePerHourPaise: lotConfig.pricePerHourPaise,
          isActive: true,
        },
      });
      console.log(`Created demo lot: ${lot.name} (${lot.id})`);
    } else {
      console.log(`Demo lot exists: ${lot.name} (${lot.id})`);
    }

    // Ensure all slots exist (A1, A2, ..., A{totalSlots})
    const existingSlotCount = await prisma.parkingSlot.count({
      where: { parkingLotId: lot.id },
    });

    if (existingSlotCount < lotConfig.totalSlots) {
      for (let i = 1; i <= lotConfig.totalSlots; i++) {
        const slotNumber = `A${i}`;
        await prisma.parkingSlot.upsert({
          where: {
            parkingLotId_slotNumber: {
              parkingLotId: lot.id,
              slotNumber,
            },
          },
          update: {},
          create: {
            parkingLotId: lot.id,
            slotNumber,
            status: SlotStatus.AVAILABLE,
            source: SlotSource.APP,
            statusUpdatedAt: new Date(),
          },
        });
      }
      console.log(`Populated ${lotConfig.totalSlots} slots for ${lot.name}`);
    }

    createdLots.push(lot);
  }

  const firstLot = createdLots[0];

  // 2. Seed Admin User
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (adminEmail && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const adminUser = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        role: Role.ADMIN,
        passwordHash,
      },
      create: {
        email: adminEmail,
        name: 'System Admin',
        passwordHash,
        role: Role.ADMIN,
      },
    });
    console.log(`Seeded Admin User: ${adminUser.email}`);
  } else {
    console.log('Skipping Admin user seed: SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD not set');
  }

  // 3. Seed Guard User (assigned to first demo lot)
  const guardEmail = process.env.SEED_GUARD_EMAIL?.trim().toLowerCase();
  const guardPassword = process.env.SEED_GUARD_PASSWORD;

  if (guardEmail && guardPassword) {
    const passwordHash = await bcrypt.hash(guardPassword, 12);
    const guardUser = await prisma.user.upsert({
      where: { email: guardEmail },
      update: {
        role: Role.GUARD,
        assignedLotId: firstLot.id,
        passwordHash,
      },
      create: {
        email: guardEmail,
        name: 'Gate Guard 1',
        passwordHash,
        role: Role.GUARD,
        assignedLotId: firstLot.id,
      },
    });
    console.log(`Seeded Guard User: ${guardUser.email} assigned to ${firstLot.name}`);
  } else {
    console.log('Skipping Guard user seed: SEED_GUARD_EMAIL or SEED_GUARD_PASSWORD not set');
  }

  // 4. Seed 7 Days of Deterministic OccupancyRecord History
  console.log('Seeding 7 days of historical occupancy records for demo lots...');
  const now = new Date();
  const totalHours = 7 * 24; // 168 hours

  for (const lot of createdLots) {
    const existingRecords = await prisma.occupancyRecord.count({
      where: { parkingLotId: lot.id },
    });

    if (existingRecords < totalHours) {
      const recordsToInsert = [];

      for (let h = totalHours; h >= 1; h--) {
        const recordTime = new Date(now.getTime() - h * 60 * 60 * 1000);
        // Truncate to start of hour in UTC
        recordTime.setUTCMinutes(0, 0, 0);

        // Calculate India-time hour of day (UTC + 5:30)
        const indiaTime = new Date(recordTime.getTime() + (5 * 60 + 30) * 60 * 1000);
        const hourOfDay = indiaTime.getUTCHours();
        const dayOfWeek = indiaTime.getUTCDay();

        // Deterministic occupancy pattern: peak during 10:00 - 20:00
        let occupancyRatio = 0.2;
        if (hourOfDay >= 9 && hourOfDay <= 13) {
          occupancyRatio = 0.65 + ((h % 5) * 0.05);
        } else if (hourOfDay > 13 && hourOfDay <= 17) {
          occupancyRatio = 0.8 + ((h % 4) * 0.04);
        } else if (hourOfDay > 17 && hourOfDay <= 21) {
          occupancyRatio = 0.7 + ((h % 3) * 0.05);
        } else if (hourOfDay >= 22 || hourOfDay <= 6) {
          occupancyRatio = 0.1 + ((h % 3) * 0.03);
        }

        const occupiedCount = Math.min(
          lot.totalSlots,
          Math.max(1, Math.round(lot.totalSlots * occupancyRatio))
        );
        const availableCount = lot.totalSlots - occupiedCount;

        recordsToInsert.push({
          parkingLotId: lot.id,
          hourStart: recordTime,
          hourOfDay,
          dayOfWeek,
          occupiedCount,
          availableCount,
          totalSlots: lot.totalSlots,
        });
      }

      // Batch upsert / createMany
      for (const rec of recordsToInsert) {
        await prisma.occupancyRecord.upsert({
          where: {
            parkingLotId_hourStart: {
              parkingLotId: rec.parkingLotId,
              hourStart: rec.hourStart,
            },
          },
          update: {
            occupiedCount: rec.occupiedCount,
            availableCount: rec.availableCount,
          },
          create: rec,
        });
      }
      console.log(`Created/updated ${recordsToInsert.length} occupancy records for ${lot.name}`);
    } else {
      console.log(`Occupancy history already complete for ${lot.name} (${existingRecords} records)`);
    }
  }

  console.log('--- Database Seed Completed Successfully ---');
}

main()
  .catch((e) => {
    console.error('Seed Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
