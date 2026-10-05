import Razorpay from 'razorpay';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import {
  AppError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../lib/errors.js';
import {
  ErrorCode,
  SlotStatus,
  SlotSource,
} from '@smart-parking/shared';
import { confirmBooking } from './reservations.service.js';
import { verifyPaymentSignature, verifyWebhookSignature } from '../lib/crypto.js';
import type { Booking } from '@prisma/client';

export const razorpayClient = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  key_secret: env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder',
});

/**
 * Creates a Razorpay order for an active HELD booking per FROZEN CONTRACT C7 and Security Rule 9.
 * Amount is strictly retrieved from the stored booking.
 */
export async function createOrder(
  bookingId: string,
  userId: string,
  isAdmin = false
): Promise<{
  orderId: string;
  amountPaise: number;
  currency: 'INR';
  keyId: string;
}> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  // Security Rule 6: user-owned check, returns 404 for someone else's booking
  if (!booking || (booking.userId !== userId && !isAdmin)) {
    throw new NotFoundError(ErrorCode.NOT_FOUND, `Booking ${bookingId} not found`);
  }

  if (booking.status !== 'HELD') {
    throw new ConflictError(
      ErrorCode.BOOKING_NOT_ELIGIBLE,
      `Cannot create payment order for booking in ${booking.status} status`
    );
  }

  const now = new Date();
  if (booking.heldUntil && booking.heldUntil < now) {
    throw new ConflictError(
      ErrorCode.BOOKING_NOT_ELIGIBLE,
      'Booking hold has expired'
    );
  }

  // Security Rule 9: amount always comes from stored Booking, never the client
  const amountPaise = booking.amountPaise;

  const order = await razorpayClient.orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt: booking.id,
    notes: {
      bookingId: booking.id,
      userId: booking.userId,
    },
  });

  return {
    orderId: order.id,
    amountPaise,
    currency: 'INR',
    keyId: env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  };
}

/**
 * Verifies Razorpay signature with HMAC-SHA256 and confirms the booking per Security Rule 9 and C9.
 */
export async function verifyPayment(
  userId: string,
  data: {
    bookingId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  },
  isAdmin = false
): Promise<Booking> {
  const booking = await prisma.booking.findUnique({
    where: { id: data.bookingId },
  });

  // Security Rule 6: return 404 if booking not found or owned by someone else
  if (!booking || (booking.userId !== userId && !isAdmin)) {
    throw new NotFoundError(ErrorCode.NOT_FOUND, `Booking ${data.bookingId} not found`);
  }

  const secret = env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    throw new AppError(
      ErrorCode.INTERNAL_ERROR,
      'Razorpay key secret is not configured'
    );
  }

  // Security Rule 9: timing-safe HMAC-SHA256 comparison
  const isValidSignature = verifyPaymentSignature(
    data.razorpayOrderId,
    data.razorpayPaymentId,
    data.razorpaySignature,
    secret
  );

  if (!isValidSignature) {
    throw new ValidationError(
      ErrorCode.VALIDATION_ERROR,
      'Invalid payment signature'
    );
  }

  // Confirm booking through Member 2's service (FROZEN CONTRACT C9)
  return await confirmBooking(data.bookingId, {
    razorpayOrderId: data.razorpayOrderId,
    razorpayPaymentId: data.razorpayPaymentId,
    amountPaise: booking.amountPaise,
  });
}

/**
 * Processes incoming Razorpay webhooks with raw body signature verification and deduplication (Rule 9).
 */
export async function processWebhook(
  rawBody: Buffer | string | undefined,
  signature: string | undefined,
  eventId: string | undefined
): Promise<{ received: true }> {
  if (!signature || !eventId) {
    throw new ValidationError(
      ErrorCode.VALIDATION_ERROR,
      'Missing X-Razorpay-Signature or X-Razorpay-Event-Id header'
    );
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new AppError(
      ErrorCode.INTERNAL_ERROR,
      'Razorpay webhook secret is not configured'
    );
  }

  if (!rawBody || (Buffer.isBuffer(rawBody) && rawBody.length === 0)) {
    throw new ValidationError(
      ErrorCode.VALIDATION_ERROR,
      'Missing webhook payload'
    );
  }

  // Security Rule 9: HMAC-SHA256(RAZORPAY_WEBHOOK_SECRET, rawBody) against X-Razorpay-Signature
  const isValidSig = verifyWebhookSignature(rawBody, signature, webhookSecret);
  if (!isValidSig) {
    throw new ValidationError(
      ErrorCode.VALIDATION_ERROR,
      'Invalid webhook signature'
    );
  }

  let eventPayload: {
    event?: string;
    payload?: {
      payment?: {
        entity?: {
          id?: string;
          order_id?: string;
          amount?: number;
          notes?: { bookingId?: string };
        };
      };
      order?: {
        entity?: {
          id?: string;
          amount?: number;
          notes?: { bookingId?: string };
        };
      };
    };
  };

  try {
    const rawString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
    eventPayload = JSON.parse(rawString);
  } catch {
    throw new ValidationError(
      ErrorCode.VALIDATION_ERROR,
      'Webhook body must be valid JSON'
    );
  }

  const eventType = eventPayload?.event || 'unknown';

  // Dedupe by X-Razorpay-Event-Id through WebhookEvent unique constraint per Rule 9
  try {
    await prisma.webhookEvent.create({
      data: {
        eventId,
        type: eventType,
        processedAt: new Date(),
      },
    });
  } catch {
    // Unique constraint on eventId: duplicate event -> do nothing per Rule 9
    return { received: true };
  }

  // Handle payment.captured and order.paid events
  if (eventType === 'payment.captured' || eventType === 'order.paid') {
    const paymentEntity = eventPayload?.payload?.payment?.entity;
    const orderEntity = eventPayload?.payload?.order?.entity;

    const orderId = paymentEntity?.order_id || orderEntity?.id;
    const paymentId = paymentEntity?.id || (orderId ? `pay_${orderId}` : undefined);
    const amountPaise = paymentEntity?.amount ?? orderEntity?.amount;
    const bookingId = paymentEntity?.notes?.bookingId ?? orderEntity?.notes?.bookingId;

    if (bookingId && orderId && paymentId && typeof amountPaise === 'number') {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });

      // Security Rule 9: confirm only a booking that is still HELD and unexpired and whose amount matches
      if (
        booking &&
        booking.status === 'HELD' &&
        (!booking.heldUntil || booking.heldUntil >= new Date()) &&
        booking.amountPaise === amountPaise
      ) {
        try {
          await confirmBooking(booking.id, {
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
            amountPaise,
          });
        } catch {
          // Ignore concurrent or duplicate confirmation
        }
      }
    }
  }

  return { received: true };
}

/**
 * Refunds a payment for a booking (ADMIN only per FROZEN CONTRACT C7 and Security Rule 9).
 */
export async function refundPayment(
  bookingId: string
): Promise<{ status: 'REFUNDED'; bookingId: string; amountPaise: number }> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payments: true },
  });

  if (!booking) {
    throw new NotFoundError(ErrorCode.NOT_FOUND, `Booking ${bookingId} not found`);
  }

  // Find paid payment transaction
  const paidPayment = booking.payments.find((p) => p.paymentStatus === 'PAID');
  if (!paidPayment || !paidPayment.razorpayPaymentId) {
    throw new ConflictError(
      ErrorCode.BOOKING_NOT_ELIGIBLE,
      'Booking has no paid transaction eligible for refund'
    );
  }

  // Call Razorpay refunds API
  try {
    await razorpayClient.payments.refund(paidPayment.razorpayPaymentId, {
      amount: paidPayment.amountPaise,
      notes: { bookingId: booking.id },
    });
  } catch {
    if (env.NODE_ENV !== 'test') {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        'Razorpay refund processing failed'
      );
    }
  }

  // Update payment status in database to REFUNDED
  await prisma.payment.update({
    where: { id: paidPayment.id },
    data: { paymentStatus: 'REFUNDED' },
  });

  // If booking was CONFIRMED, update to CANCELLED and free slot
  if (booking.status === 'CONFIRMED') {
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED' },
      });

      const slot = await tx.parkingSlot.findUnique({
        where: { id: booking.slotId },
      });

      if (slot && slot.status !== SlotStatus.OCCUPIED) {
        await tx.parkingSlot.update({
          where: { id: booking.slotId },
          data: {
            status: SlotStatus.AVAILABLE,
            source: SlotSource.APP,
            heldUntil: null,
            statusUpdatedAt: new Date(),
          },
        });
      }
    });
  }

  return {
    status: 'REFUNDED',
    bookingId: booking.id,
    amountPaise: booking.amountPaise,
  };
}

/**
 * Fast-path demo confirmation when DEMO_PAY_ENABLED=true (Master Prompt Stage 4).
 */
export async function demoConfirmPayment(
  userId: string,
  bookingId: string,
  isAdmin = false
): Promise<Booking> {
  if (!env.DEMO_PAY_ENABLED) {
    throw new NotFoundError(ErrorCode.NOT_FOUND, 'Demo payment is disabled');
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking || (booking.userId !== userId && !isAdmin)) {
    throw new NotFoundError(ErrorCode.NOT_FOUND, `Booking ${bookingId} not found`);
  }

  if (booking.status !== 'HELD') {
    throw new ConflictError(
      ErrorCode.BOOKING_NOT_ELIGIBLE,
      `Cannot confirm booking in ${booking.status} status`
    );
  }

  if (booking.heldUntil && booking.heldUntil < new Date()) {
    throw new ConflictError(
      ErrorCode.BOOKING_NOT_ELIGIBLE,
      'Booking hold has expired'
    );
  }

  const orderId = `demo_ord_${booking.id}`;
  const paymentId = `demo_pay_${booking.id}_${Date.now()}`;

  return await confirmBooking(booking.id, {
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
    amountPaise: booking.amountPaise,
  });
}
