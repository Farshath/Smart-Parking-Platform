# Smart Parking Slot Rental & Availability Platform

Full-stack monorepo application for the **Unified Mentor Internship**. This platform is a modern, enterprise-grade parking spot rental and real-time availability tracking solution, featuring automated slot reservations, concurrency-safe capacity management, role-based dashboards, simulated payment processing, and comprehensive administrative controls.

---

## 🏛 Architecture Overview

The repository is organized as a clean full-stack monorepo:

```
Smart-Parking-Platform/
├── .gitignore              # Monorepo root gitignore (secrets, node_modules, build outputs)
├── package.json            # Root convenience scripts for running services
├── README.md               # Platform documentation and setup guide
├── backend/                # Node.js + Express + TypeScript + MongoDB Atlas REST API
│   ├── .env.example        # Backend environment variables template
│   ├── .gitignore          # Backend specific ignore rules
│   ├── package.json        # Backend dependencies and scripts
│   ├── tsconfig.json       # Backend TypeScript configuration (ES2022 / CommonJS)
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.ts       # Mongoose connection handling & graceful fallback
│   │   │   └── env.ts      # Strongly typed environment configuration (cwd & parent lookup)
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts    # User register, login, profile & password change
│   │   │   ├── booking.controller.ts # Concurrency-safe slot booking & status transitions
│   │   │   ├── listing.controller.ts # Search, pagination, owner spot CRUD & analytics
│   │   │   ├── payment.controller.ts # Payment simulation, gateway audit & user payments
│   │   │   └── admin.controller.ts   # Platform KPI metrics, user moderation & listing governance
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts    # JWT verification & role-based guards
│   │   │   ├── errorHandler.ts       # Centralized error handler & 404 middleware
│   │   │   └── validate.ts           # Zod request validation foundation
│   │   ├── models/
│   │   │   ├── User.ts          # User model (roles: customer, parking_owner, admin; bcrypt hash)
│   │   │   ├── ParkingListing.ts # Listing model (daily rate, parkingType, hours, images, GeoJSON)
│   │   │   ├── Booking.ts       # Booking model (unique BK-... reference, vehicle number, payment tracking)
│   │   │   ├── Payment.ts       # Payment model (transactionId, amount, status, audit trail)
│   │   │   └── index.ts         # Central models export
│   │   ├── routes/
│   │   │   ├── auth.routes.ts   # POST /register, /login, GET /me, PATCH /profile, /change-password
│   │   │   ├── booking.routes.ts# POST /, GET /my-bookings, GET /:id, PATCH /:id/cancel, /:id/status
│   │   │   ├── listing.routes.ts# GET /, GET /my-listings, GET /analytics, GET /:id, POST /, PATCH /:id, DELETE /:id
│   │   │   ├── payment.routes.ts# POST /process, GET /my-payments, GET /:id
│   │   │   ├── admin.routes.ts  # GET /stats, /users, PATCH /users/:id/role, /listings, /bookings
│   │   │   ├── health.routes.ts # GET /api/health endpoint
│   │   │   └── index.ts         # REST API root router
│   │   ├── utils/
│   │   │   ├── AppError.ts      # Operational error class
│   │   │   └── auth.ts          # bcryptjs hashing & JWT sign/verify utilities
│   │   ├── validators/
│   │   │   ├── auth.validator.ts    # Zod schemas for register, login, profile & password
│   │   │   ├── booking.validator.ts # Zod schemas for booking creation & status changes
│   │   │   ├── listing.validator.ts # Zod schemas for listing create & update
│   │   │   └── payment.validator.ts # Zod schemas for payment processing
│   │   ├── tests/
│   │   │   └── runAllTests.ts  # Automated 29-test test suite across all modules
│   │   ├── app.ts          # Express app factory (CORS, Morgan, JSON parsing)
│   │   └── server.ts       # HTTP server bootstrap & graceful shutdown
│   └── dist/               # Compiled TypeScript build output
└── frontend/               # Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS
    ├── .env.example        # Frontend environment variables template
    ├── .gitignore          # Frontend ignore rules
    ├── package.json        # Next.js dependencies and scripts
    ├── tsconfig.json       # Frontend TypeScript configuration
    ├── next.config.ts      # Next.js configuration
    └── src/
        ├── app/
        │   ├── layout.tsx             # Root layout with AuthProvider & Navbar
        │   ├── page.tsx               # Home landing page with platform CTAs & features
        │   ├── globals.css            # Tailwind CSS styling
        │   ├── login/page.tsx         # User login form with role redirect & error alerts
        │   ├── register/page.tsx      # Registration with role selector (Customer / Owner)
        │   ├── dashboard/page.tsx     # Customer Dashboard with KPIs, bookings & quick actions
        │   ├── owner/page.tsx         # Parking Owner Hub (revenue, spots, booking approvals)
        │   ├── admin/page.tsx         # Admin Command Center (KPIs, user management, listings)
        │   ├── listings/page.tsx      # Spot search & multi-filter grid with photos & badges
        │   ├── listings/[id]/page.tsx # Spot details, hours, capacity & booking widget
        │   ├── listings/new/page.tsx  # Add Parking Listing with photos, hours & capacity
        │   ├── listings/[id]/edit/page.tsx # Edit Parking Listing with existing data
        │   ├── bookings/page.tsx      # Customer Reservations portal with cancellation modal
        │   ├── bookings/[id]/checkout/page.tsx     # Checkout portal with simulation options
        │   ├── bookings/[id]/confirmation/page.tsx # Digital printable booking receipt
        │   ├── payments/page.tsx      # Transaction History with receipt links
        │   └── profile/page.tsx       # Profile details & password management
        ├── components/
        │   └── Navbar.tsx             # Role-aware responsive navigation header
        ├── context/
        │   └── AuthContext.tsx        # React Auth Context for JWT session state
        ├── lib/
        │   └── api.ts                 # Strongly typed centralized API client
        └── types/
            └── index.ts               # Shared TypeScript domain interfaces
```

---

## 📦 Tech Stack & Stable Versions

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | Next.js (App Router) | `16.4.3` | React Server/Client Components, dynamic routing |
| **Frontend Styling** | Tailwind CSS | `^4.0.0` | Modern, responsive utility styling system |
| **Frontend Runtime** | React & React DOM | `19.3.0` | React 19 component architecture |
| **Backend Framework** | Express | `^4.21.2` | REST API routing and middleware pipeline |
| **Backend Language** | TypeScript | `^5.7.3` | End-to-end type safety |
| **Database ODM** | Mongoose | `^8.9.5` | ODM schemas, validation, transactions & indexing |
| **Database** | MongoDB Atlas | Cloud | Cloud document persistence |
| **Password Security** | bcryptjs | `^3.0.3` | Salted password hashing (cost factor 12) |
| **Session Security** | jsonwebtoken | `^9.0.3` | Cryptographically signed JWT access tokens |
| **Request Validation**| Zod | `^4.6.7` | Type-safe schema validation for all endpoints |
| **Logging** | Morgan | `^1.10.0` | HTTP request logging |
| **CORS** | cors | `^2.8.5` | Domain origin whitelisting & preflight handling |

---

## 🚗 Core Features & Modules

### 1. Authentication & Role-Based Access Control
- **Roles Supported**: `customer`, `parking_owner`, `admin`.
- **Registration**: Allows registration as `customer` or `parking_owner`. Direct registration as `admin` is blocked for security.
- **Security**: Passwords hashed with `bcryptjs` using 12 salt rounds. Access tokens signed via HMAC SHA-256 JWTs.
- **Protected Endpoints**: Verified through `authenticate` and `authorizeRoles(...)` middleware.
- **Profile & Password Management**: Users can update their profile information (name, phone) and securely change their password.

### 2. Parking Listings & Owner Management
- **Listing Properties**: Title, description, street address, city, state, postal code, parking type (`covered`, `open`, `underground`, `valet`), hourly & daily rates, total capacity, operating hours (`is24x7`, `openTime`, `closeTime`), images, and amenities.
- **Search & Filters**: Full-text keyword search, city filter, maximum hourly rate, and status filter (`active`, `maintenance`, `inactive`).
- **Owner Dashboard (`/owner`)**: Spot CRUD, quick active/maintenance toggling, revenue calculation, and incoming booking management.
- **Image Presets & Storage**: Integrated support for URL-based images and high-resolution presets (Airport, Underground, Covered Garage, Downtown Lot).

### 3. Concurrency-Safe Booking Engine
- **Slot Overlap Formula**:
  $$\text{existing.startTime} < \text{requested.endTime} \quad \text{AND} \quad \text{existing.endTime} > \text{requested.startTime}$$
- **Atomic Concurrency Protection**:
  1. *Pre-check*: Confirms overlapping active reservations do not exceed `listing.totalSlots`.
  2. *Atomic Write*: Persists the reservation with unique human-readable reference code (`BK-XXXXXX`).
  3. *Post-commit Rollback Invariant*: In high-concurrency race conditions, if simultaneous bookings violate total capacity, the newest reservation is automatically rolled back and `409 Conflict` is returned.
- **Server-Side Pricing**:
  $$\text{durationHours} = \frac{\text{endTime} - \text{startTime}}{1000 \times 60 \times 60}$$
  $$\text{totalAmount} = \max\left(0.01, \text{round}(\text{durationHours} \times \text{hourlyRate}, 2)\right)$$
  Client-supplied amounts are strictly rejected.
- **Cancellation Rules**: Idempotent cancellation available for customers, owners, and admins before scheduled reservation completion.

### 4. Internship Demonstration Payment Module
- **Simulated Payment Gateway**: Clear demonstration workflow supporting multiple payment methods (`upi`, `card`, `netbanking`, `wallet`).
- **Audit Records**: Every transaction is saved to the `payments` collection with unique `TXN-...` reference, status (`completed`, `failed`, `pending`), gateway response metadata, and linked booking ID.
- **Failure Simulation Toggle**: Educational feature allowing evaluation of payment rejection states and booking payment status handling.
- **Digital Receipt & Invoicing**: Accessible at `/bookings/[id]/confirmation` with printable formatting and detailed breakdown.

### 5. Admin Command Center (`/admin`)
- **System KPIs**: Live metrics for total registered users, active parking listings, all-time bookings, and gross platform volume.
- **User Management**: Inspect user accounts, change roles (`customer`, `parking_owner`, `admin`), or delete malicious accounts.
- **Listing Moderation**: Override listing statuses to `active`, `maintenance`, or `inactive`.
- **Global Booking Supervision**: Real-time audit of all reservations, customer references, vehicle registration numbers, and payment statuses.

---

## 🌐 Complete API Endpoints Reference

### Authentication (`/api/auth`)
| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register new customer or parking_owner |
| `POST` | `/api/auth/login` | Public | Authenticate with credentials and receive JWT |
| `GET` | `/api/auth/me` | Private | Retrieve authenticated profile |
| `PATCH`| `/api/auth/profile` | Private | Update name and phone number |
| `PATCH`| `/api/auth/change-password` | Private | Verify current password and update to new password |

### Parking Listings (`/api/listings`)
| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/listings` | Public | Search and paginate spots (search, city, maxRate, status) |
| `GET` | `/api/listings/my-listings` | Private (Owner/Admin) | Get all spots owned by authenticated owner |
| `GET` | `/api/listings/analytics` | Private (Owner/Admin) | Get owner revenue and occupancy statistics |
| `GET` | `/api/listings/:id` | Public | Get single spot details with owner contact |
| `POST` | `/api/listings` | Private (Owner/Admin) | Create listing (owner derived securely from token) |
| `PATCH`| `/api/listings/:id` | Private (Owner/Admin) | Update listing details or toggle active status |
| `DELETE`| `/api/listings/:id` | Private (Owner/Admin) | Delete listing (if no active bookings exist) |

### Bookings (`/api/bookings`)
| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/bookings` | Private | Reserve slot with server pricing & atomic capacity checks |
| `GET` | `/api/bookings/my-bookings`| Private | Paginated reservations with status filtering |
| `GET` | `/api/bookings/:id` | Private | View booking details (Customer, Owner, or Admin) |
| `PATCH`| `/api/bookings/:id/cancel` | Private | Cancel active reservation (Idempotent) |
| `PATCH`| `/api/bookings/:id/status` | Private (Owner/Admin) | Approve, reject, or complete a booking |

### Payments (`/api/payments`)
| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/payments/process` | Private | Process simulated payment (Card, UPI, Netbanking) |
| `GET` | `/api/payments/my-payments`| Private | View personal transaction history with status filters |
| `GET` | `/api/payments/:id` | Private | Get single payment transaction receipt |

### Admin (`/api/admin`)
| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/stats` | Admin | Get platform-wide KPIs (users, listings, bookings, GMV) |
| `GET` | `/api/admin/users` | Admin | Paginated user accounts with search and role filters |
| `PATCH`| `/api/admin/users/:id/role`| Admin | Promote or demote user role |
| `DELETE`| `/api/admin/users/:id` | Admin | Remove user account from system |
| `GET` | `/api/admin/listings` | Admin | Platform-wide listing moderation list |
| `PATCH`| `/api/admin/listings/:id/status` | Admin | Force listing status to active/maintenance/inactive |
| `GET` | `/api/admin/bookings` | Admin | Platform-wide booking audit list |

### Health (`/api/health`)
| Method | Route | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | System uptime, node environment, and live MongoDB status |

---

## 💻 Frontend Application Pages (All Functional)

1. `/` — Modern landing page with interactive CTAs, platform metrics, and benefits.
2. `/login` — Secure sign-in form with automatic role-aware redirection.
3. `/register` — Account registration with role selector (`Customer` vs `Parking Owner`).
4. `/dashboard` — User Dashboard with quick reservation summary, quick links, and recommendations.
5. `/owner` — Parking Owner Hub with spot management, status toggle, booking approvals, and revenue KPIs.
6. `/admin` — Admin Command Center with system overview, user management, and moderation controls.
7. `/listings` — Real-time parking search and exploration grid with multi-filter query system.
8. `/listings/[id]` — Detailed parking view with operating hours, vehicle number input, and direct checkout booking widget.
9. `/listings/new` — Comprehensive Add Parking listing form with photo selector, rate configs, and capacity.
10. `/listings/[id]/edit` — Edit Parking form prefilled with existing spot metadata.
11. `/bookings` — Customer Reservations portal with status tabs, reservation cards, and cancellation modal.
12. `/bookings/[id]/checkout` — Payment Checkout interface with price summary, payment methods, and test failure simulation.
13. `/bookings/[id]/confirmation` — Printable Digital Booking Confirmation Receipt with reference numbers.
14. `/payments` — Transaction History ledger with status tags and receipts.
15. `/profile` — User Profile Management and Password Update form.

---

## 🗄️ Database Setup & Environment Configuration

### Backend Configuration (`backend/.env`)
Copy `backend/.env.example` to `backend/.env` (or configure existing `.env`):
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/smart_parking?retryWrites=true&w=majority
CORS_ORIGIN=http://localhost:3000
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters_long
JWT_EXPIRES_IN=7d
```

> **MongoDB Atlas IP Whitelist Notice**: Ensure your current public IP address is added to the MongoDB Atlas Network Access whitelist (or `0.0.0.0/0` for development). When the database is connecting or temporarily unreachable, the backend catches the event gracefully and responds with structured `503 Service Unavailable` without crashing the process.

### Frontend Configuration (`frontend/.env.local`)
Create `frontend/.env.local` if custom backend URL is desired:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```
*(Defaults automatically to `http://localhost:5000/api` if omitted)*

---

## 🚀 How to Run the Application

On Windows PowerShell, use `npm.cmd` to avoid script execution policy restrictions:

### 1. Run the Backend Server
```powershell
cd backend
npm.cmd run dev
```
*Backend runs at `http://localhost:5000` (Healthcheck: `http://localhost:5000/api/health`)*

### 2. Run the Frontend Application
```powershell
cd frontend
npm.cmd run dev
```
*Frontend runs at `http://localhost:3000`*

### 3. Run Root Monorepo Scripts
From the repository root:
```powershell
npm.cmd run dev:backend    # Starts backend in dev mode
npm.cmd run dev:frontend   # Starts frontend in dev mode
```

---

## 🧪 Testing & Verification Guide

### 1. Backend Automated Test Suite (29 Tests)
Run the automated test suite testing auth, crypto, slot overlap logic, pricing engine, input validation, and payment workflows:
```powershell
npm.cmd --prefix backend run test
```
Result: **29 / 29 Tests Passed** (0 failures).

### 2. Backend TypeScript Compilation
```powershell
npm.cmd --prefix backend run build
```
Result: Clean compilation to `dist/` with code 0 (`tsc`).

### 3. Frontend Linting
```powershell
npm.cmd --prefix frontend run lint
```
Result: Clean ESLint check with 0 errors and 0 warnings.

### 4. Frontend Production Build
```powershell
npm.cmd --prefix frontend run build
```
Result: Production build passes with code 0; all 16 static and dynamic routes compiled and optimized.

---

## 🔒 Security & Reliability Measures
- **Never Hardcode Secrets**: All secrets reside in `.env` and are excluded from Git.
- **Protected Database Models**: Client requests cannot alter database ownership or tamper with calculation formulas.
- **Server-Side Price Authority**: Durations and costs are strictly evaluated on the server using verified listing rates.
- **Atomic Concurrency Protection**: High-volume reservation requests cannot exceed physical slot capacity.
- **Zero Decorative UI**: Every button, link, status toggle, cancellation modal, and checkout option is connected to backend APIs.
