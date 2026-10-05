import {
  mockUsers,
  mockParkingLots,
  mockSlotsByLot,
  mockBookings,
  mockLotStats,
  mockGuardBoard,
} from './mockData';
import {
  Booking,
  SlotView,
  SlotStatus,
  SlotSource,
} from '../types/contract';

interface MockResponse {
  status: number;
  data: unknown;
}

// In-memory mutable state for mock session
let activeBookings = [...mockBookings];
const mutableSlots: Record<string, SlotView[]> = JSON.parse(
  JSON.stringify(mockSlotsByLot)
);

export function handleMockRequest(
  method: string,
  url: string,
  body?: unknown,
  _headers?: Record<string, string>
): MockResponse | null {
  const normalizedMethod = method.toUpperCase();
  // Strip baseURL if present to get path
  const path = url.replace(/^https?:\/\/[^/]+(\/api\/v1)?/, '').replace(/^\/api\/v1/, '');

  // 1. POST /auth/login
  if (normalizedMethod === 'POST' && path === '/auth/login') {
    const creds = (body as { email?: string }) || {};
    const email = creds.email?.toLowerCase() || '';

    let user = mockUsers.driver;
    if (email.includes('guard')) user = mockUsers.guard;
    if (email.includes('admin')) user = mockUsers.admin;

    return {
      status: 200,
      data: {
        success: true,
        data: {
          accessToken: 'mock_jwt_token_' + user.role.toLowerCase(),
          expiresInSeconds: 900,
          user,
        },
      },
    };
  }

  // 2. POST /auth/register
  if (normalizedMethod === 'POST' && path === '/auth/register') {
    const data = (body as { name?: string; email?: string }) || {};
    return {
      status: 201,
      data: {
        success: true,
        data: {
          user: {
            id: 'usr-' + Date.now(),
            name: data.name || 'New User',
            email: data.email?.toLowerCase() || 'user@example.com',
            role: 'USER',
          },
        },
      },
    };
  }

  // 3. POST /auth/refresh
  if (normalizedMethod === 'POST' && path === '/auth/refresh') {
    return {
      status: 200,
      data: {
        success: true,
        data: {
          accessToken: 'mock_refreshed_jwt_token',
          expiresInSeconds: 900,
          user: mockUsers.driver,
        },
      },
    };
  }

  // 4. POST /auth/logout
  if (normalizedMethod === 'POST' && path === '/auth/logout') {
    return {
      status: 200,
      data: {
        success: true,
        data: null,
      },
    };
  }

  // 5. GET /auth/me
  if (normalizedMethod === 'GET' && path === '/auth/me') {
    return {
      status: 200,
      data: {
        success: true,
        data: { user: mockUsers.driver },
      },
    };
  }

  // 6. GET /parking-lots
  if (normalizedMethod === 'GET' && (path === '/parking-lots' || path === '/parking-lots/')) {
    return {
      status: 200,
      data: {
        success: true,
        data: mockParkingLots,
      },
    };
  }

  // 7. GET /parking-lots/:id/stats
  const statsMatch = path.match(/^\/parking-lots\/([^/]+)\/stats/);
  if (normalizedMethod === 'GET' && statsMatch) {
    const lotId = statsMatch[1];
    const stats = mockLotStats[lotId] || mockLotStats['lot-1'];
    return {
      status: 200,
      data: {
        success: true,
        data: stats,
      },
    };
  }

  // 8. GET /parking-lots/:id/slots
  const slotsMatch = path.match(/^\/parking-lots\/([^/]+)\/slots/);
  if (normalizedMethod === 'GET' && slotsMatch) {
    const lotId = slotsMatch[1];
    const slots = mutableSlots[lotId] || mutableSlots['lot-1'];
    return {
      status: 200,
      data: {
        success: true,
        data: slots,
      },
    };
  }

  // 9. GET /parking-lots/:id
  const lotMatch = path.match(/^\/parking-lots\/([^/]+)$/);
  if (normalizedMethod === 'GET' && lotMatch) {
    const lotId = lotMatch[1];
    const lot = mockParkingLots.find((l) => l.id === lotId) || mockParkingLots[0];
    return {
      status: 200,
      data: {
        success: true,
        data: lot,
      },
    };
  }

  // 10. POST /bookings (holdSlot)
  if (normalizedMethod === 'POST' && path === '/bookings') {
    const req = (body as { slotId: string; startTime: string; endTime: string; vehicleNumber?: string }) || {};
    const bookingCode = 'BK' + Math.floor(1000 + Math.random() * 9000);

    const newBooking: Booking = {
      id: 'bk-' + Date.now(),
      slotId: req.slotId || 'slot-1-5',
      status: 'HELD',
      startTime: req.startTime || new Date().toISOString(),
      endTime: req.endTime || new Date(Date.now() + 3600000).toISOString(),
      amountPaise: 4000,
      heldUntil: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      bookingCode,
      vehicleNumber: req.vehicleNumber || null,
      checkedInAt: null,
    };

    activeBookings.unshift(newBooking);

    // Update slot status in mock state
    for (const lotId of Object.keys(mutableSlots)) {
      const slot = mutableSlots[lotId].find((s) => s.id === req.slotId);
      if (slot) {
        slot.status = 'HELD';
      }
    }

    return {
      status: 201,
      data: {
        success: true,
        data: newBooking,
      },
    };
  }

  // 11. GET /bookings/my
  if (normalizedMethod === 'GET' && path === '/bookings/my') {
    return {
      status: 200,
      data: {
        success: true,
        data: activeBookings,
      },
    };
  }

  // 12. DELETE /bookings/:id (cancel booking)
  const cancelBookingMatch = path.match(/^\/bookings\/([^/]+)$/);
  if (normalizedMethod === 'DELETE' && cancelBookingMatch) {
    const bookingId = cancelBookingMatch[1];
    const booking = activeBookings.find((b) => b.id === bookingId);
    if (booking) {
      booking.status = 'CANCELLED';
      // Release slot
      for (const lotId of Object.keys(mutableSlots)) {
        const slot = mutableSlots[lotId].find((s) => s.id === booking.slotId);
        if (slot) slot.status = 'AVAILABLE';
      }
      return {
        status: 200,
        data: { success: true, data: booking },
      };
    }
  }

  // 13. POST /payments/create-order
  if (normalizedMethod === 'POST' && path === '/payments/create-order') {
    return {
      status: 200,
      data: {
        success: true,
        data: {
          orderId: 'order_mock_' + Date.now(),
          amountPaise: 4000,
          currency: 'INR',
          keyId: 'rzp_test_mock_12345',
        },
      },
    };
  }

  // 14. POST /payments/demo-confirm
  if (normalizedMethod === 'POST' && path === '/payments/demo-confirm') {
    const req = (body as { bookingId: string }) || {};
    const booking = activeBookings.find((b) => b.id === req.bookingId);
    if (booking) {
      booking.status = 'CONFIRMED';
      booking.heldUntil = null;
      for (const lotId of Object.keys(mutableSlots)) {
        const slot = mutableSlots[lotId].find((s) => s.id === booking.slotId);
        if (slot) slot.status = 'RESERVED';
      }
      return {
        status: 200,
        data: { success: true, data: booking },
      };
    }
  }

  // 15. GET /guard/lots/:lotId/board
  const guardBoardMatch = path.match(/^\/guard\/lots\/([^/]+)\/board/);
  if (normalizedMethod === 'GET' && guardBoardMatch) {
    return {
      status: 200,
      data: {
        success: true,
        data: mockGuardBoard,
      },
    };
  }

  // 16. POST /guard/check-in
  if (normalizedMethod === 'POST' && path === '/guard/check-in') {
    const req = (body as { bookingCode: string }) || {};
    const booking = activeBookings.find(
      (b) => b.bookingCode.toUpperCase() === req.bookingCode?.toUpperCase()
    );
    if (!booking) {
      return {
        status: 404,
        data: {
          success: false,
          code: 'NOT_FOUND',
          message: 'Booking code not found',
        },
      };
    }
    booking.checkedInAt = new Date().toISOString();
    return {
      status: 200,
      data: { success: true, data: booking },
    };
  }

  // 17. POST /guard/slots/:slotId/walk-in
  const walkInMatch = path.match(/^\/guard\/slots\/([^/]+)\/walk-in/);
  if (normalizedMethod === 'POST' && walkInMatch) {
    const slotId = walkInMatch[1];
    const req = (body as { status: 'OCCUPIED' | 'AVAILABLE' }) || {};
    for (const lotId of Object.keys(mutableSlots)) {
      const slot = mutableSlots[lotId].find((s) => s.id === slotId);
      if (slot) slot.status = req.status;
    }
    return {
      status: 200,
      data: {
        success: true,
        data: {
          slotId,
          status: req.status as SlotStatus,
          source: 'GUARD' as SlotSource,
        },
      },
    };
  }

  // Unhandled path
  return null;
}
