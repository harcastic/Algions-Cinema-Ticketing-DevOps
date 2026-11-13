# Cinema Ticketing API — Simple MVC Backend

A lightweight, clean, and robust Cinema Show and Seat Reservation API built with **Node.js**, **Express**, and **MongoDB (Mongoose)** for a DevOps and Cloud Engineering assessment.

---

## 1. Architecture & Design Principles

The backend follows a clean, single-responsibility **MVC + Service Layer** pattern without unnecessary abstractions or bloat:

- **Models (`src/models/`)**: Mongoose schemas defining database structure, indexes, and document-level validations.
- **Controllers (`src/controllers/`)**: Handle incoming HTTP requests, route parameters, status codes, and JSON responses.
- **Services (`src/services/`)**: Encapsulate all core business logic, atomic updates, and transactional operations.
- **Routes (`src/routes/`)**: Map endpoints and bind authentication middleware to controllers.
- **Middleware (`src/middleware/`)**: Centralized error handling and JWT authentication.
- **Config (`src/config/`)**: MongoDB connection management with graceful connection handling.
- **Utils (`src/utils/`)**: Small reusable utilities such as ticket ID generation.

---

## 2. Technology Stack

- **Runtime**: Node.js (CommonJS)
- **Framework**: Express.js
- **Database & ODM**: MongoDB & Mongoose
- **Authentication**: JSON Web Tokens (`jsonwebtoken`) & `bcrypt`
- **Configuration**: `dotenv`
- **Development Tooling**: `nodemon`
- **Testing**: `jest`, `supertest`, and `mongodb-memory-server` (for in-memory single-node replica set testing)

---

## 3. Project Structure

```
cinema-ticketing-api/
├── src/
│   ├── config/
│   │   └── db.js                 # MongoDB connection & disconnection logic
│   ├── models/
│   │   ├── User.js               # User schema with bcrypt password hashing
│   │   ├── Show.js               # Show schema with endsAt > startsAt validator
│   │   ├── Seat.js               # Seat schema with compound index (showId + row + seatNumber)
│   │   └── Booking.js            # Booking schema with partial unique index on seatId (CONFIRMED)
│   ├── controllers/
│   │   ├── authController.js     # User registration and login handlers
│   │   ├── showController.js     # Show listing, show creation, seat batch creation
│   │   ├── seatController.js     # Seat map retrieval and atomic hold handler
│   │   └── bookingController.js  # Booking confirmation, cancellation, and retrieval
│   ├── services/
│   │   ├── authService.js        # Authentication & JWT generation logic
│   │   ├── showService.js        # Show and seat layout business logic
│   │   ├── seatService.js        # Atomic conditional seat hold logic
│   │   └── bookingService.js     # Multi-document transactional booking and cancellation
│   ├── routes/
│   │   ├── authRoutes.js         # /api/auth routes
│   │   ├── showRoutes.js         # /api/shows routes
│   │   ├── seatRoutes.js         # /api/seats routes
│   │   └── bookingRoutes.js      # /api/bookings routes
│   ├── middleware/
│   │   ├── authMiddleware.js     # JWT Bearer token verification
│   │   └── errorMiddleware.js    # Centralized error handler & 404 handler
│   ├── utils/
│   │   └── generateTicketId.js   # Unique ticket ID generator (TCK-<TIMESTAMP>-<RANDOM>)
│   ├── app.js                    # Express application setup and route mounting
│   └── server.js                 # HTTP server bootstrap and graceful shutdown
├── scripts/
│   └── seed.js                   # Idempotent database seeder
├── tests/
│   ├── setup.js                  # Test database lifecycle (single-node replica set)
│   ├── auth.test.js              # Auth registration and login tests
│   ├── shows.test.js             # Shows and seat layout tests
│   ├── seats.test.js             # Seat map, seat hold, and health check tests
│   └── bookings.test.js          # Confirm, cancel, rebooking & concurrency tests
├── .env.example                  # Template for required environment variables
├── .gitignore
├── jest.config.js
├── nodemon.json
├── package.json
└── README.md
```

---

## 4. Concurrency Protection & Architectural Decisions

Concurrency control is the single most critical business requirement in reservation systems: **two users must never successfully hold or book the same seat simultaneously**.

### 1. Atomic Conditional Updates for Seat Holds
Instead of an unsafe "read-then-write" pattern, seat holds are acquired using a single atomic MongoDB `findOneAndUpdate` operation:

```javascript
const updatedSeat = await Seat.findOneAndUpdate(
  {
    _id: seatId,
    $or: [
      { status: 'AVAILABLE' },
      { status: 'HELD', holdExpiresAt: { $lte: now } }
    ]
  },
  {
    $set: {
      status: 'HELD',
      holdToken: holdToken,
      holdExpiresAt: holdExpiresAt,
      userId: userId,
      bookingId: null
    }
  },
  { new: true }
);
```

- MongoDB locks the document at the WiredTiger storage layer during the atomic find-and-update.
- If two requests arrive at the exact same millisecond, the first matching update flips the seat status to `HELD` with an expiration timestamp in the future.
- The second request's filter condition (`status: 'AVAILABLE'` or expired hold) immediately evaluates to `false` and returns `null`.
- The API responds to the second request with **HTTP 409 Conflict**.

### 2. Multi-Document Transactions for Confirmation and Cancellation
MongoDB transactions (`session.startTransaction()`) are utilized during booking confirmation and cancellation:
- **Confirmation**: Atomically creates the `Booking` document and updates the `Seat` document (`status: 'BOOKED'`, `bookingId: booking._id`, hold fields cleared). If any error occurs or the hold has expired in the interim, the transaction rolls back cleanly.
- **Cancellation**: Atomically marks the `Booking` document as `CANCELLED` (storing `cancelledAt`) and resets the `Seat` back to `AVAILABLE` (`bookingId: null`, `userId: null`).

### 3. Partial Unique Index on Confirmed Bookings
To preserve audit and booking history while guaranteeing that a seat cannot be doubly booked:
```javascript
bookingSchema.index(
  { seatId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'CONFIRMED' }
  }
);
```
- Only bookings with `status: 'CONFIRMED'` participate in this uniqueness constraint.
- Cancelled bookings (`status: 'CANCELLED'`) remain stored for historical audit, and the seat can immediately be booked again without index collision.

### 4. Dynamic Hold Expiration without `setTimeout`
- Expiry timestamps (`holdExpiresAt`) are persisted in MongoDB.
- Expiration is evaluated dynamically when querying seats and when attempting to hold or confirm.
- Avoids fragile in-memory timers (`setTimeout`) that would be lost on server restarts or horizontal scaling.

---

## 5. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP port for Express server | `5000` |
| `NODE_ENV` | Environment mode (`development`, `production`, `test`) | `development` |
| `MONGODB_URI` | MongoDB connection URI (replica set required for transactions) | `mongodb://localhost:27017/cinema_ticketing?replicaSet=rs0` |
| `HOLD_DURATION_MINUTES` | Temporary hold window duration in minutes | `3` |
| `JWT_SECRET` | Secret key for signing and verifying JWT tokens | `cinema_dev_secret_key_1234567890` |
| `JWT_EXPIRES_IN` | Token expiration period | `1d` |
| `BCRYPT_SALT_ROUNDS` | Number of salt rounds for bcrypt password hashing | `10` |

---

## 6. Installation & Running

### Install Dependencies
```bash
npm install
```

### Run in Development Mode (Nodemon)
```bash
npm run dev
```

### Run in Production Mode
```bash
npm start
```

### Seed Database
```bash
npm run seed
```
*Note: The seed script is completely idempotent and safe to run multiple times without duplicating data.*

### Run Automated Tests
```bash
npm test
```
*Note: Tests run with Jest against an in-memory single-node MongoDB replica set created on-the-fly (`mongodb-memory-server`), ensuring real transactions and concurrency behaviors are verified without any external services.*

---

## 7. API Endpoints & Usage Examples

### 7.1 Health & Readiness

#### `GET /health`
Liveness probe checking if the Node.js process is active.
- **Response (200 OK):**
```json
{
  "status": "UP",
  "timestamp": "2026-11-12T13:30:00.000Z"
}
```

#### `GET /ready`
Readiness probe checking MongoDB connectivity.
- **Response (200 OK):**
```json
{
  "status": "READY",
  "database": "connected"
}
```
- **Response (503 Service Unavailable):**
```json
{
  "status": "NOT_READY",
  "database": "disconnected"
}
```

---

### 7.2 Authentication

#### `POST /api/auth/register`
- **Request Body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "SecurePassword123!"
}
```
- **Response (201 Created):**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "67335d1f85b3ec0a4b7a1122",
    "name": "Jane Doe",
    "email": "jane@example.com"
  }
}
```

#### `POST /api/auth/login`
- **Request Body:**
```json
{
  "email": "jane@example.com",
  "password": "SecurePassword123!"
}
```
- **Response (200 OK):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "67335d1f85b3ec0a4b7a1122",
    "name": "Jane Doe",
    "email": "jane@example.com"
  }
}
```

---

### 7.3 Shows

#### `GET /api/shows` *(Public)*
Retrieves all scheduled shows.
- **Response (200 OK):**
```json
[
  {
    "_id": "67335d1f85b3ec0a4b7a3344",
    "movieName": "Inception (2010)",
    "screenName": "Screen 1 - IMAX",
    "startsAt": "2026-11-12T15:00:00.000Z",
    "endsAt": "2026-11-12T17:30:00.000Z",
    "status": "SCHEDULED"
  }
]
```

#### `GET /api/shows/:showId` *(Public)*
Retrieves details of a specific show.

#### `POST /api/shows` *(Protected: Bearer Token)*
Creates a new show. Validates that `endsAt` is strictly after `startsAt`.
- **Request Body:**
```json
{
  "movieName": "Interstellar",
  "screenName": "Screen 2 - Dolby",
  "startsAt": "2026-11-12T18:00:00.000Z",
  "endsAt": "2026-11-12T21:00:00.000Z",
  "status": "SCHEDULED"
}
```
- **Response (201 Created):**
```json
{
  "message": "Show created successfully",
  "show": {
    "_id": "67335d1f85b3ec0a4b7a5566",
    "movieName": "Interstellar",
    "screenName": "Screen 2 - Dolby",
    "startsAt": "2026-11-12T18:00:00.000Z",
    "endsAt": "2026-11-12T21:00:00.000Z",
    "status": "SCHEDULED"
  }
}
```

#### `POST /api/shows/:showId/seats` *(Protected: Bearer Token)*
Generates seat layout for a show. Supports grid generation (`rows` + `seatsPerRow`) or explicit seat array.
- **Request Body:**
```json
{
  "rows": ["A", "B", "C"],
  "seatsPerRow": 6
}
```
- **Response (201 Created):**
```json
{
  "message": "Successfully created 18 seats for show",
  "count": 18,
  "seats": [
    {
      "_id": "67335d1f85b3ec0a4b7a7788",
      "showId": "67335d1f85b3ec0a4b7a5566",
      "row": "A",
      "seatNumber": 1,
      "status": "AVAILABLE"
    }
  ]
}
```

---

### 7.4 Seats

#### `GET /api/shows/:showId/seats` *(Public)*
Retrieves all seats for a given show with their real-time availability status.
- **Response (200 OK):**
```json
[
  {
    "_id": "67335d1f85b3ec0a4b7a7788",
    "showId": "67335d1f85b3ec0a4b7a5566",
    "row": "A",
    "seatNumber": 1,
    "status": "AVAILABLE"
  }
]
```

#### `POST /api/seats/:seatId/hold` *(Protected: Bearer Token)*
Places an atomic temporary hold on a seat for the configured duration (default 3 minutes).
- **Response (200 OK):**
```json
{
  "message": "Seat held successfully",
  "seatId": "67335d1f85b3ec0a4b7a7788",
  "showId": "67335d1f85b3ec0a4b7a5566",
  "row": "A",
  "seatNumber": 1,
  "holdToken": "7b0a7905-ebad-47cf-b0d3-57f4958f27ea",
  "holdExpiresAt": "2026-11-12T13:33:00.000Z"
}
```
- **Conflict Response (409 Conflict):**
```json
{
  "error": "Seat is currently unavailable (already booked or actively held)"
}
```

---

### 7.5 Bookings

#### `POST /api/seats/:seatId/confirm` *(Protected: Bearer Token)*
Confirms reservation of a held seat within a MongoDB transaction.
- **Request Body:**
```json
{
  "holdToken": "7b0a7905-ebad-47cf-b0d3-57f4958f27ea"
}
```
- **Response (201 Created):**
```json
{
  "message": "Booking confirmed successfully",
  "booking": {
    "_id": "67335d1f85b3ec0a4b7a9900",
    "ticketId": "TCK-M1A2B3C-4DF7",
    "showId": "67335d1f85b3ec0a4b7a5566",
    "seatId": "67335d1f85b3ec0a4b7a7788",
    "userId": "67335d1f85b3ec0a4b7a1122",
    "status": "CONFIRMED",
    "bookedAt": "2026-11-12T13:31:00.000Z",
    "cancelledAt": null
  }
}
```
- **Expired Hold Response (410 Gone):**
```json
{
  "error": "Seat hold has expired. Please acquire a new hold"
}
```

#### `POST /api/bookings/:bookingId/cancel` *(Protected: Bearer Token, Owner Only)*
Cancels an existing booking and atomically releases the seat back to `AVAILABLE`.
- **Response (200 OK):**
```json
{
  "message": "Booking cancelled successfully. Seat is now available.",
  "booking": {
    "_id": "67335d1f85b3ec0a4b7a9900",
    "ticketId": "TCK-M1A2B3C-4DF7",
    "status": "CANCELLED",
    "cancelledAt": "2026-11-12T13:35:00.000Z"
  }
}
```

#### `GET /api/bookings/:bookingId` *(Protected: Bearer Token, Owner Only)*
Retrieves booking details populated with show and seat data.
- **Response (200 OK):**
```json
{
  "_id": "67335d1f85b3ec0a4b7a9900",
  "ticketId": "TCK-M1A2B3C-4DF7",
  "status": "CONFIRMED",
  "bookedAt": "2026-11-12T13:31:00.000Z",
  "cancelledAt": null,
  "showId": {
    "_id": "67335d1f85b3ec0a4b7a5566",
    "movieName": "Interstellar",
    "screenName": "Screen 2 - Dolby",
    "startsAt": "2026-11-12T18:00:00.000Z",
    "endsAt": "2026-11-12T21:00:00.000Z",
    "status": "SCHEDULED"
  },
  "seatId": {
    "_id": "67335d1f85b3ec0a4b7a7788",
    "row": "A",
    "seatNumber": 1,
    "status": "BOOKED"
  }
}
```

---

## 8. Automated Test Results

The test suite covers all requirements including concurrent hold resolution, transactional rollback, expired hold rejection, authentication/authorization checks, and rebooking.

```
PASS tests/bookings.test.js
  Bookings and Concurrency API Tests
    POST /api/seats/:seatId/confirm
      √ should successfully confirm booking with valid holdToken
      √ should reject confirmation with invalid holdToken (409)
      √ should reject confirmation if hold has expired (410)
      √ should prevent confirmation by a user other than the hold owner (403)
    POST /api/bookings/:bookingId/cancel and Rebooking
      √ should cancel booking and release seat back to AVAILABLE
      √ should reject cancellation by a different user (403)
      √ should allow rebooking a cancelled seat by another user
      √ should reject cancelling an already cancelled booking (400)
    GET /api/bookings/:bookingId
      √ should allow owner to retrieve booking details
      √ should reject retrieval by unauthorized non-owner (403)
    CONCURRENCY TEST: Simultaneous Holds on Same Seat
      √ should allow exactly one hold to succeed and reject the other with 409

PASS tests/shows.test.js
  Shows API Tests
    POST /api/shows
      √ should create a show successfully when authenticated
      √ should reject show creation if unauthenticated (401)
      √ should reject show creation if endsAt is before or equal to startsAt (400)
      √ should reject show creation if required fields are missing (400)
    GET /api/shows and GET /api/shows/:showId
      √ should retrieve all shows publicly without auth
      √ should retrieve single show by ID publicly
      √ should return 404 for non-existent show ID
    POST /api/shows/:showId/seats
      √ should generate seat layout for a show
      √ should reject creating duplicate seats for the same show (409 Conflict)

PASS tests/seats.test.js
  Seats and Health API Tests
    GET /health and GET /ready
      √ GET /health should return 200 and process status UP
      √ GET /ready should return 200 and database connected
    GET /api/shows/:showId/seats
      √ should retrieve all seats for a show publicly
      √ should return 404 if show does not exist
    POST /api/seats/:seatId/hold
      √ should hold an available seat successfully
      √ should reject unauthenticated hold attempts (401)
      √ should reject a second hold on an already held seat (409 Conflict)
      √ should allow holding a seat if previous hold has expired

PASS tests/auth.test.js
  Authentication API Tests
    POST /api/auth/register
      √ should register a new user successfully and return JWT
      √ should reject registration with existing email (409 Conflict)
      √ should reject registration with missing fields (400 Bad Request)
    POST /api/auth/login
      √ should log in successfully with valid credentials and return JWT
      √ should reject login with wrong password (401 Unauthorized)
      √ should reject login with non-existent email (401 Unauthorized)

Test Suites: 4 passed, 4 total
Tests:       34 passed, 34 total
Snapshots:   0 total
```

