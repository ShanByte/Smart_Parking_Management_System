import {
  User,
  ParkingLot,
  SlotView,
  Booking,
  LotStats,
  GuardBoard,
} from '../types/contract';

export const mockUsers: Record<string, User> = {
  driver: {
    id: 'usr-1',
    name: 'Rohan Sharma',
    email: 'driver@example.com',
    role: 'USER',
    createdAt: '2026-09-01T08:00:00.000Z',
  },
  guard: {
    id: 'grd-1',
    name: 'Ramesh Guard',
    email: 'guard@example.com',
    role: 'GUARD',
    assignedLotId: 'lot-1',
    createdAt: '2026-09-01T08:00:00.000Z',
  },
  admin: {
    id: 'adm-1',
    name: 'System Admin',
    email: 'admin@example.com',
    role: 'ADMIN',
    createdAt: '2026-09-01T08:00:00.000Z',
  },
};

export const mockParkingLots: ParkingLot[] = [
  {
    id: 'lot-1',
    name: 'FC Road Central Parking',
    address: 'Fergusson College Road, Shivajinagar, Pune',
    latitude: 18.5204,
    longitude: 73.8415,
    totalSlots: 20,
    freeCount: 12,
    pricePerHourPaise: 4000, // ₹40.00
  },
  {
    id: 'lot-2',
    name: 'JM Road Plaza',
    address: 'Jangali Maharaj Road, Deccan Gymkhana, Pune',
    latitude: 18.5285,
    longitude: 73.8471,
    totalSlots: 15,
    freeCount: 3,
    pricePerHourPaise: 5000, // ₹50.00
  },
  {
    id: 'lot-3',
    name: 'Koregaon Park North Bay',
    address: 'Lane 7, Koregaon Park, Pune',
    latitude: 18.5362,
    longitude: 73.894,
    totalSlots: 25,
    freeCount: 18,
    pricePerHourPaise: 6000, // ₹60.00
  },
];

export const mockSlotsByLot: Record<string, SlotView[]> = {
  'lot-1': [
    { id: 'slot-1-1', slotNumber: 'A1', status: 'AVAILABLE' },
    { id: 'slot-1-2', slotNumber: 'A2', status: 'AVAILABLE' },
    { id: 'slot-1-3', slotNumber: 'A3', status: 'OCCUPIED' },
    { id: 'slot-1-4', slotNumber: 'A4', status: 'AVAILABLE' },
    { id: 'slot-1-5', slotNumber: 'A5', status: 'AVAILABLE' },
    { id: 'slot-1-6', slotNumber: 'A6', status: 'HELD' },
    { id: 'slot-1-7', slotNumber: 'A7', status: 'RESERVED' },
    { id: 'slot-1-8', slotNumber: 'A8', status: 'OCCUPIED' },
    { id: 'slot-1-9', slotNumber: 'A9', status: 'AVAILABLE' },
    { id: 'slot-1-10', slotNumber: 'A10', status: 'AVAILABLE' },
    { id: 'slot-1-11', slotNumber: 'A11', status: 'AVAILABLE' },
    { id: 'slot-1-12', slotNumber: 'A12', status: 'OCCUPIED' },
    { id: 'slot-1-13', slotNumber: 'A13', status: 'AVAILABLE' },
    { id: 'slot-1-14', slotNumber: 'A14', status: 'AVAILABLE' },
    { id: 'slot-1-15', slotNumber: 'A15', status: 'AVAILABLE' },
    { id: 'slot-1-16', slotNumber: 'A16', status: 'OCCUPIED' },
    { id: 'slot-1-17', slotNumber: 'A17', status: 'OCCUPIED' },
    { id: 'slot-1-18', slotNumber: 'A18', status: 'AVAILABLE' },
    { id: 'slot-1-19', slotNumber: 'A19', status: 'AVAILABLE' },
    { id: 'slot-1-20', slotNumber: 'A20', status: 'AVAILABLE' },
  ],
  'lot-2': Array.from({ length: 15 }, (_, i) => ({
    id: `slot-2-${i + 1}`,
    slotNumber: `B${i + 1}`,
    status: i < 12 ? 'OCCUPIED' : 'AVAILABLE',
  })),
  'lot-3': Array.from({ length: 25 }, (_, i) => ({
    id: `slot-3-${i + 1}`,
    slotNumber: `C${i + 1}`,
    status: i < 7 ? 'OCCUPIED' : 'AVAILABLE',
  })),
};

export const mockBookings: Booking[] = [
  {
    id: 'bk-101',
    slotId: 'slot-1-7',
    status: 'CONFIRMED',
    startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    amountPaise: 8000,
    heldUntil: null,
    bookingCode: 'KP4M9X', // 6-char code per C3
    vehicleNumber: 'MH12AB1234',
    checkedInAt: null,
  },
  {
    id: 'bk-100',
    slotId: 'slot-1-3',
    status: 'COMPLETED',
    startTime: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    endTime: new Date(Date.now() - 22 * 3600 * 1000).toISOString(),
    amountPaise: 8000,
    heldUntil: null,
    bookingCode: 'BD7T2N',
    vehicleNumber: 'MH12AB1234',
    checkedInAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  },
];

export const mockLotStats: Record<string, LotStats> = {
  'lot-1': {
    parkingLotId: 'lot-1',
    totalSlots: 20,
    hours: [
      { hourOfDay: 8, averageOccupiedPercent: 35.0, samples: 12 },
      { hourOfDay: 9, averageOccupiedPercent: 65.5, samples: 14 },
      { hourOfDay: 10, averageOccupiedPercent: 88.0, samples: 15 },
      { hourOfDay: 11, averageOccupiedPercent: 92.5, samples: 15 },
      { hourOfDay: 12, averageOccupiedPercent: 75.0, samples: 13 },
      { hourOfDay: 13, averageOccupiedPercent: 70.0, samples: 12 },
      { hourOfDay: 14, averageOccupiedPercent: 72.0, samples: 12 },
      { hourOfDay: 15, averageOccupiedPercent: 80.0, samples: 14 },
      { hourOfDay: 16, averageOccupiedPercent: 85.0, samples: 15 },
      { hourOfDay: 17, averageOccupiedPercent: 95.0, samples: 15 },
      { hourOfDay: 18, averageOccupiedPercent: 90.0, samples: 15 },
      { hourOfDay: 19, averageOccupiedPercent: 60.0, samples: 11 },
      { hourOfDay: 20, averageOccupiedPercent: 40.0, samples: 10 },
    ],
  },
};

export const mockGuardBoard: GuardBoard = {
  lot: {
    id: 'lot-1',
    name: 'FC Road Central Parking',
    totalSlots: 20,
  },
  slots: [
    {
      slotId: 'slot-1-1',
      slotNumber: 'A1',
      status: 'AVAILABLE',
      source: 'SENSOR',
      booking: null,
    },
    {
      slotId: 'slot-1-7',
      slotNumber: 'A7',
      status: 'RESERVED',
      source: 'APP',
      booking: {
        bookingId: 'bk-101',
        bookingCode: 'KP4M9X',
        vehicleNumber: 'MH12AB1234',
        startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
        status: 'CONFIRMED',
        checkedInAt: null,
      },
    },
  ],
};
