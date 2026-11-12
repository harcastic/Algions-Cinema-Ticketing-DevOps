const request = require('supertest');
const app = require('../src/app');
const Seat = require('../src/models/Seat');
const Booking = require('../src/models/Booking');
const { startTestDB, stopTestDB, clearTestDB, createTestUser } = require('./setup');

describe('Bookings and Concurrency API Tests', () => {
  let user1;
  let user2;
  let showId;
  let seatId;

  beforeAll(async () => {
    await startTestDB();
  });

  afterAll(async () => {
    await stopTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    user1 = await createTestUser('User One', 'user1@example.com');
    user2 = await createTestUser('User Two', 'user2@example.com');

    // Create a show
    const showRes = await request(app)
      .post('/api/shows')
      .set('Authorization', user1.authHeader)
      .send({
        movieName: 'Pulp Fiction',
        screenName: 'Auditorium 1',
        startsAt: new Date(Date.now() + 3600000).toISOString(),
        endsAt: new Date(Date.now() + 7200000).toISOString()
      });
    showId = showRes.body.show._id;

    // Create seat
    const seatRes = await request(app)
      .post(`/api/shows/${showId}/seats`)
      .set('Authorization', user1.authHeader)
      .send({
        seats: [{ row: 'A', seatNumber: 1 }]
      });
    seatId = seatRes.body.seats[0]._id;
  });

  describe('POST /api/seats/:seatId/confirm', () => {
    it('should successfully confirm booking with valid holdToken', async () => {
      // 1. Hold seat
      const holdRes = await request(app)
        .post(`/api/seats/${seatId}/hold`)
        .set('Authorization', user1.authHeader);
      expect(holdRes.status).toBe(200);
      const { holdToken } = holdRes.body;

      // 2. Confirm booking
      const confirmRes = await request(app)
        .post(`/api/seats/${seatId}/confirm`)
        .set('Authorization', user1.authHeader)
        .send({ holdToken });

      expect(confirmRes.status).toBe(201);
      expect(confirmRes.body.booking).toHaveProperty('ticketId');
      expect(confirmRes.body.booking.ticketId).toMatch(/^TCK-/);
      expect(confirmRes.body.booking.status).toBe('CONFIRMED');

      // 3. Verify seat status in DB
      const seat = await Seat.findById(seatId);
      expect(seat.status).toBe('BOOKED');
      expect(seat.holdToken).toBeNull();
      expect(seat.holdExpiresAt).toBeNull();
      expect(seat.bookingId.toString()).toBe(confirmRes.body.booking._id);
    });

    it('should reject confirmation with invalid holdToken (409)', async () => {
      // Hold seat
      await request(app)
        .post(`/api/seats/${seatId}/hold`)
        .set('Authorization', user1.authHeader);

      // Confirm with wrong token
      const res = await request(app)
        .post(`/api/seats/${seatId}/confirm`)
        .set('Authorization', user1.authHeader)
        .send({ holdToken: 'wrong-token-xyz' });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject confirmation if hold has expired (410)', async () => {
      // Create seat with expired hold
      await Seat.findByIdAndUpdate(seatId, {
        status: 'HELD',
        holdToken: 'valid-token-but-expired',
        holdExpiresAt: new Date(Date.now() - 10000), // 10s ago
        userId: user1.user._id
      });

      const res = await request(app)
        .post(`/api/seats/${seatId}/confirm`)
        .set('Authorization', user1.authHeader)
        .send({ holdToken: 'valid-token-but-expired' });

      expect(res.status).toBe(410);
      expect(res.body.error).toMatch(/expired/i);
    });

    it('should prevent confirmation by a user other than the hold owner (403)', async () => {
      // User 1 holds seat
      const holdRes = await request(app)
        .post(`/api/seats/${seatId}/hold`)
        .set('Authorization', user1.authHeader);
      const { holdToken } = holdRes.body;

      // User 2 attempts to confirm with User 1's token
      const res = await request(app)
        .post(`/api/seats/${seatId}/confirm`)
        .set('Authorization', user2.authHeader)
        .send({ holdToken });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/bookings/:bookingId/cancel and Rebooking', () => {
    let bookingId;

    beforeEach(async () => {
      const holdRes = await request(app)
        .post(`/api/seats/${seatId}/hold`)
        .set('Authorization', user1.authHeader);

      const confirmRes = await request(app)
        .post(`/api/seats/${seatId}/confirm`)
        .set('Authorization', user1.authHeader)
        .send({ holdToken: holdRes.body.holdToken });

      bookingId = confirmRes.body.booking._id;
    });

    it('should cancel booking and release seat back to AVAILABLE', async () => {
      const cancelRes = await request(app)
        .post(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', user1.authHeader);

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.booking.status).toBe('CANCELLED');
      expect(cancelRes.body.booking).toHaveProperty('cancelledAt');

      // Verify seat is AVAILABLE in DB
      const seat = await Seat.findById(seatId);
      expect(seat.status).toBe('AVAILABLE');
      expect(seat.bookingId).toBeNull();
      expect(seat.holdToken).toBeNull();
    });

    it('should reject cancellation by a different user (403)', async () => {
      const res = await request(app)
        .post(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', user2.authHeader);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
    });

    it('should allow rebooking a cancelled seat by another user', async () => {
      // Cancel booking
      await request(app)
        .post(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', user1.authHeader);

      // User 2 holds released seat
      const holdRes = await request(app)
        .post(`/api/seats/${seatId}/hold`)
        .set('Authorization', user2.authHeader);

      expect(holdRes.status).toBe(200);
      expect(holdRes.body).toHaveProperty('holdToken');

      // User 2 confirms booking
      const confirmRes = await request(app)
        .post(`/api/seats/${seatId}/confirm`)
        .set('Authorization', user2.authHeader)
        .send({ holdToken: holdRes.body.holdToken });

      expect(confirmRes.status).toBe(201);
      expect(confirmRes.body.booking.status).toBe('CONFIRMED');

      // Verify total bookings count is 2 (1 CANCELLED, 1 CONFIRMED)
      const allBookings = await Booking.find({ seatId });
      expect(allBookings.length).toBe(2);
    });

    it('should reject cancelling an already cancelled booking (400)', async () => {
      await request(app)
        .post(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', user1.authHeader);

      const secondCancel = await request(app)
        .post(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', user1.authHeader);

      expect(secondCancel.status).toBe(400);
      expect(secondCancel.body.error).toMatch(/already cancelled/i);
    });
  });

  describe('GET /api/bookings/:bookingId', () => {
    let bookingId;

    beforeEach(async () => {
      const holdRes = await request(app)
        .post(`/api/seats/${seatId}/hold`)
        .set('Authorization', user1.authHeader);

      const confirmRes = await request(app)
        .post(`/api/seats/${seatId}/confirm`)
        .set('Authorization', user1.authHeader)
        .send({ holdToken: holdRes.body.holdToken });

      bookingId = confirmRes.body.booking._id;
    });

    it('should allow owner to retrieve booking details', async () => {
      const res = await request(app)
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', user1.authHeader);

      expect(res.status).toBe(200);
      expect(res.body._id).toBe(bookingId);
      expect(res.body).toHaveProperty('ticketId');
      expect(res.body.showId).toHaveProperty('movieName');
      expect(res.body.seatId).toHaveProperty('row');
    });

    it('should reject retrieval by unauthorized non-owner (403)', async () => {
      const res = await request(app)
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', user2.authHeader);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('CONCURRENCY TEST: Simultaneous Holds on Same Seat', () => {
    it('should allow exactly one hold to succeed and reject the other with 409', async () => {
      // Fire two simultaneous hold requests concurrently for the exact same seat
      const [res1, res2] = await Promise.all([
        request(app).post(`/api/seats/${seatId}/hold`).set('Authorization', user1.authHeader),
        request(app).post(`/api/seats/${seatId}/hold`).set('Authorization', user2.authHeader)
      ]);

      const statuses = [res1.status, res2.status].sort();

      // Expected result: Exactly one HTTP 200, exactly one HTTP 409
      expect(statuses).toEqual([200, 409]);

      // Exactly one valid hold token returned
      const successfulRes = res1.status === 200 ? res1 : res2;
      const failedRes = res1.status === 409 ? res1 : res2;

      expect(successfulRes.body).toHaveProperty('holdToken');
      expect(failedRes.body).toHaveProperty('error');

      // Verify DB state: seat is HELD by the successful requester
      const seat = await Seat.findById(seatId);
      expect(seat.status).toBe('HELD');
      expect(seat.holdToken).toBe(successfulRes.body.holdToken);
    });
  });
});

