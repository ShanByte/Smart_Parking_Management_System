🅿️ Smart Parking Management System
Find. Compare. Reserve. Pay. Park.

A real-time smart parking platform that helps drivers discover parking facilities, view slot-level availability, estimate availability at their arrival time, reserve parking spaces, make digital payments, and navigate to their selected parking location.
Team: CodeCrafters
Institution: AISSMS Institute of Information Technology, Pune
Project Type: Smart Mobility / Hackathon Project
Status: Prototype / Hackathon Build
📌 Overview
Finding parking in busy areas can be time-consuming and frustrating. Drivers often have to circle around parking facilities looking for an available space, resulting in wasted time, unnecessary fuel consumption, traffic congestion, and a poor parking experience.
The Smart Parking Management System addresses this problem by providing a centralized digital platform for discovering, comparing, reserving, and managing parking spaces.
The system provides slot-level parking availability, advance booking, temporary slot holds, digital payments, real-time updates, and an Arrival Availability Score based on historical occupancy patterns.
🎯 Problem Statement
Traditional parking systems often provide limited visibility into available parking spaces.
Drivers may:
- Spend unnecessary time searching for parking
- Consume additional fuel while circling parking areas
- Reach a parking lot only to find it full
- Have difficulty locating individual available slots
- Be unable to reserve a parking space in advance
- Face conflicts when multiple users attempt to reserve the same slot
Our goal is to reduce this uncertainty by allowing users to make an informed parking decision before they arrive.
💡 Our Solution
The Smart Parking Management System allows users to:
1. 🗺️ Discover parking locations through an interactive map
2. 🅿️ View individual parking slots
3. 📊 Check current parking availability
4. ⏱️ Select expected arrival time and parking duration
5. 📈 Compare estimated availability for their arrival time
6. 🔒 Temporarily hold a parking slot
7. 📅 Reserve a specific parking slot
8. 💳 Complete digital payment
9. 🎫 Receive booking confirmation and booking code
10. 🧭 Navigate to the selected parking location
11. 🔄 Receive real-time parking availability updates
⭐ Key Innovation — Arrival Availability Score
Most parking applications answer:
"Where is parking available right now?"

Our system goes one step further:
"Which parking lot is more likely to have availability when I actually arrive?"

Users provide their expected arrival time, and the system uses historical occupancy patterns to calculate an estimated Arrival Availability Score.
Example
A user plans to arrive at 7:00 PM.
Parking Lot	Available Now	Estimated Availability at 7 PM
Lot A	30 spaces	42%
Lot B	10 spaces	81%


Although Lot A has more spaces available at the current moment, the system may recommend Lot B because historical occupancy patterns indicate a higher likelihood of availability around the user's expected arrival time.
Note: The Arrival Availability Score is an estimate based on historical occupancy data and is not a guarantee of future availability.

✨ Key Features
🗺️ Interactive Parking Map
Users can discover parking facilities through an interactive map and view their current availability.
🅿️ Slot-Level Availability
The system provides individual parking-slot states instead of showing only the total number of available spaces.
Supported slot states include:
AVAILABLE
HELD
RESERVED
OCCUPIED

⏱️ Arrival Time & Parking Duration
Users can specify:
- Expected arrival time
- Parking duration
This allows the system to provide more relevant availability information for the user's planned visit.
🔒 Temporary Slot Hold
A selected slot can be temporarily held while the user completes the booking process.
The current system uses a 5-minute hold period.
📅 Advance Reservation
Users can reserve a specific parking slot before arriving.
The backend prevents conflicting reservations for the same slot.
💳 Digital Payment
The system supports a digital payment workflow using Razorpay in the supported test/demo environment.
🔄 Real-Time Updates
The system uses Socket.IO and Redis to provide real-time parking and booking updates across connected clients.
🛡️ Guard Verification
Authorized parking staff can use the Guard Console to verify booking information and manage the parking workflow.
🏗️ System Architecture
                       ┌──────────────────────┐
                       │    React Frontend    │
                       │ Map • Booking • Pay  │
                       └──────────┬───────────┘
                                  │
                           REST / Socket.IO
                                  │
                       ┌──────────▼───────────┐
                       │   Node.js + Express  │
                       │       Backend        │
                       └───────┬───────┬──────┘
                               │       │
                    ┌──────────┘       └──────────┐
                    ▼                             ▼
             ┌──────────────┐              ┌─────────────┐
             │ PostgreSQL   │              │    Redis    │
             │   + Prisma   │              │ Real-time   │
             └──────────────┘              └─────────────┘
                    │
                    ▼
             ┌──────────────┐
             │   Simulator  │
             │ Parking Data │
             └──────────────┘

🛠️ Technology Stack
Layer	Technology
Frontend	React, TypeScript
Styling	Tailwind CSS
Backend	Node.js, Express
Database	PostgreSQL, Prisma
Real-Time Communication	Socket.IO
Cache / Real-Time Infrastructure	Redis
Maps	Leaflet, React-Leaflet
Payment	Razorpay
Validation	Zod
Testing	Vitest, Playwright
Development	Docker, npm Workspaces
Parking Data	Simulator


🔐 Security & Reliability
The project includes multiple mechanisms to improve security and booking reliability.
Authentication
- JWT-based authentication
- Refresh-token mechanism
- Secure refresh cookies
- Role-based access control
Booking Integrity
- Slot-level reservation
- Temporary slot holds
- Conflict detection
- Idempotency keys
- Protection against double booking
Payment
- Server-controlled payment order creation
- Server-side payment verification
Real-Time Reliability
- Socket.IO communication
- Redis-backed infrastructure
- Reconnection handling
- Real-time slot status updates
📂 Project Structure
Smart_Parking_Management_System/
│
├── shared/                 # Shared contracts and validation
│
├── backend/                # API, authentication, bookings, payments
│
├── frontend/               # React frontend application
│
├── simulator/              # Simulated parking/sensor data
│
├── docker-compose.yml
├── package.json
├── package-lock.json
└── README.md

🚀 Local Setup
Prerequisites
Make sure you have the following installed:
- Node.js 22.23.3
- npm
- Docker Desktop
- Git
1. Clone the Repository
git clone <REPOSITORY_URL>
cd Smart_Parking_Management_System

2. Configure Environment Variables
Create your local environment file:
cp .env.example .env

Configure the required local development values in .env.
Example:
DEMO_PAY_ENABLED=true
NO_SHOW_GRACE_MINUTES=1

SEED_ADMIN_EMAIL=admin@smartparking.local
SEED_ADMIN_PASSWORD=<your_local_password>

SEED_GUARD_EMAIL=guard1@smartparking.local
SEED_GUARD_PASSWORD=<your_local_password>

SIM_TARGET_URL=http://localhost:4000
SIM_ALLOWED_TARGETS=http://localhost:4000

⚠️ Never commit .env or real credentials, API keys, payment secrets, or passwords to the repository.

3. Start the Local Infrastructure
npm run demo:up

This starts the required local infrastructure and prepares the demo environment.
4. Create the Simulator Device
npm run device:create

Copy the generated simulator device key into your local .env as required.
5. Start the Backend
Open a new terminal:
npm run demo:api

The backend API runs on:
http://localhost:4000

6. Start the Parking Simulator
Open another terminal:
npm run demo:simulator

7. Start the Frontend
Open another terminal:
npm run dev -w @smart-parking/frontend

Vite normally starts the frontend at:
http://localhost:5173

If port 5173 is already occupied, Vite may automatically use another port such as 5174.
Use the URL displayed in the terminal.
🧪 Demo Workflow
The complete parking workflow can be demonstrated as follows:
Discover Parking
       ↓
Select Arrival Time
       ↓
Compare Availability
       ↓
Select Parking Lot
       ↓
Select Parking Slot
       ↓
Hold Slot
       ↓
Make Payment
       ↓
Booking Confirmed
       ↓
Receive Booking Code
       ↓
Navigate to Parking
       ↓
Guard Verification

Booking Conflict Test
The system can also demonstrate double-booking prevention:
1. User A selects a parking slot.
2. User A holds/reserves the slot.
3. User B attempts to reserve the same slot.
4. The backend detects the conflict.
5. User B is prevented from completing the conflicting reservation.
🧪 Testing
The project includes unit, integration, and end-to-end testing.
Important workflows covered include:
- User registration and login
- Session restoration
- Parking-slot booking
- Booking conflicts
- Payment success/failure
- Session refresh
- Real-time reconnection
- Guard routing
- Role-based access restrictions
- Booking confirmation
Run the project's configured test commands from the repository root.
For frontend end-to-end testing:
npm run test:e2e -w @smart-parking/frontend

🧹 Stop the Local Environment
When the demo is complete:
npm run demo:down

📊 Current Prototype
The current version is a hackathon prototype designed to demonstrate the complete digital parking workflow.
The prototype currently uses:
- Simulated parking occupancy data
- Local PostgreSQL and Redis infrastructure
- Test/demo payment flows
- Historical/demo occupancy data for the Arrival Availability Score
The system is not currently presented as a production-ready city-wide parking service.
🔮 Future Scope
🚗 Valet Parking
Introduce an optional valet workflow where users can:
- Book valet service
- Receive a digital valet ticket
- Hand over their vehicle
- Track vehicle status
- Request vehicle retrieval
- Collect the vehicle from a designated pickup zone
📡 Real IoT Parking Sensors
Replace simulated occupancy data with real-time parking sensors.
📷 Automatic Number Plate Recognition
Integrate ANPR for automated vehicle identification and improved parking verification.
🚧 Automated Parking Barriers
Connect reservations with entry and exit barriers for controlled parking access.
📊 Advanced Parking Analytics
Expand historical occupancy analysis into more advanced demand, utilization, and parking-pattern analytics.
🏙️ Municipal Integration
Integrate multiple parking facilities into larger smart-city parking networks.
🎯 Project Vision
Our vision is to make parking predictable, convenient, and digitally manageable.
Instead of:
Search → Drive Around → Hope for Parking

we aim for:
Predict → Compare → Reserve → Pay → Navigate → Park

👥 Team CodeCrafters
Developed by Team CodeCrafters
AISSMS Institute of Information Technology, Pune
📌 Project Status
Prototype / Hackathon Build
The current project demonstrates the core parking-management workflow, real-time software architecture, reservation system, payment flow, and arrival-time availability estimation.
Production deployment would require additional infrastructure, real-world parking data, physical sensor integration, operational validation, monitoring, security hardening, and integration with parking facilities.
⭐ Key Takeaway
Smart Parking Management System doesn't just show drivers where parking is available now — it helps them make a better parking decision for when they actu
