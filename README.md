# 🅿️ Smart Parking Management System

> **A real-time, intelligent parking management platform that helps drivers discover, reserve, navigate to, and manage parking spaces with greater convenience and efficiency.**

---

## 📌 Overview

Finding a parking space in busy areas is often frustrating, time-consuming, and inefficient. Drivers may spend several minutes circling streets or parking lots searching for an available space, resulting in:

- Unnecessary fuel consumption
- Increased traffic congestion
- Wasted time
- Driver frustration
- Poor utilization of available parking infrastructure

The **Smart Parking Management System** addresses this problem by providing a centralized platform where users can view parking availability, select individual parking slots, reserve them, make payments, and navigate to the selected parking location.

The system is designed around **real-time parking information**, allowing parking-slot availability to be updated dynamically rather than relying on static information.

---

# 🎯 Problem Statement

Traditional parking systems generally provide little or no information about the availability of individual parking spaces.

A driver may reach a parking area only to discover that:

- The parking lot is full.
- Available spaces are difficult to locate.
- Another vehicle has already taken the desired space.
- There is no convenient way to reserve a slot in advance.
- Parking availability changes without being reflected to the user.

This creates unnecessary movement inside and around parking areas.

### Our goal

> **Reduce the time and effort required to find and secure a parking space by providing slot-level parking visibility, reservation, payment, and navigation through a single platform.**

---

# 💡 Our Solution

The Smart Parking Management System provides a web-based platform where users can:

1. View parking locations on an interactive map.
2. Check parking availability.
3. Select a parking lot.
4. View individual parking slots.
5. Select an available slot.
6. Specify the required parking duration.
7. Temporarily hold the selected slot.
8. Confirm the booking.
9. Complete payment.
10. Receive a booking confirmation.
11. Navigate to the parking location.
12. View and manage previous bookings.

The system also supports real-time updates so that parking-slot status can change without requiring the user to manually refresh the page.

---

# ✨ Key Features

## 🗺️ Interactive Parking Map

Users can view available parking locations through an interactive map.

Parking lots are represented using availability-based indicators so users can quickly understand the current parking situation.

### Availability indicators

| Indicator | Meaning |
|---|---|
| 🟢 Green | More than 50% slots available |
| 🟠 Orange | 20%–50% slots available |
| 🔴 Red | Less than 20% slots available |

The map uses **Leaflet + React-Leaflet** with map tiles provided through the configured map tile provider.

---

## 🅿️ Slot-Level Parking

Instead of displaying only the total number of available spaces, the system provides visibility into individual parking slots.

Each slot has a status such as:

- `AVAILABLE`
- `HELD`
- `RESERVED`
- `OCCUPIED`

This allows users to select a specific available slot.

---

## ⏱️ Parking Duration Selection

Users can select their expected parking duration.

The system supports configurable time windows with the current frontend implementation providing duration options such as:

- 1 hour
- 2 hours
- 3 hours
- 4 hours
- 8 hours

The system also supports the contract requirement of parking windows between **15 minutes and 24 hours**.

The estimated parking fee is calculated based on the selected duration.

---

## 🔒 Temporary Slot Hold

When a user selects a slot for booking, the system can temporarily hold that slot.

The current booking flow uses a **5-minute hold period**.

This prevents the user from losing the selected slot while completing the booking/payment process.

Once the hold expires, the slot can become available again according to the booking system.

---

# 📅 Booking & Reservation

Users can reserve a specific parking slot.

The booking flow is designed to prevent two users from successfully reserving the same slot.

The frontend sends an **Idempotency-Key** with booking requests to help prevent duplicate booking operations.

The system also handles booking conflicts.

If another user takes the selected slot before the booking is completed, the user receives a message such as:

> **Slot just taken. Please select another slot.**

The user can then select another available slot.

---

# 💳 Payment System

The project supports an integrated payment flow using **Razorpay**.

The payment process follows a server-controlled flow:

```text
User
 │
 ▼
Create Booking / Hold Slot
 │
 ▼
Create Payment Order
 │
 ▼
Razorpay Checkout
 │
 ▼
Payment Completed
 │
 ▼
Server-side Payment Verification
 │
 ▼
Booking Confirmed
