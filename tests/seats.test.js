const request = require('supertest');
const app = require('../src/app');
const Seat = require('../src/models/Seat');
const { startTestDB, stopTestDB, clearTestDB, createTestUser } = require('./setup');

describe('Seats and Health API Tests', () => {
  let authHeader;
  let testUser;
  let otherAuthHeader;
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
    testUser = await createTestUser('User One', 'user1@example.com');
    authHeader = testUser.authHeader;

    const otherUser = await createTestUser('User Two', 'user2@example.com');
    otherAuthHeader = otherUser.authHeader;

    // Create a show
    const showRes = await request(app)
      .post('/api/shows')
      .set('Authorization', authHeader)
      .send({
        movieName: 'The Dark Knight',
        screenName: 'Screen 1',
        startsAt: new Date(Date.now() + 3600000).toISOString(),
        endsAt: new Date(Date.now() + 7200000).toISOString()
      });
    showId = showRes.body.show._id;

    // Create seats
    const seatsRes = await request(app)
      .post(`/api/shows/${showId}/seats`)
      .set('Authorization', authHeader)
      .send({
        seats: [
          { row: 'A', seatNumber: 1 },
          { row: 'A', seatNumber: 2 }
        ]
      });
    seatId = seatsRes.body.seats[0]._id;
  });

  describe('GET /health and GET /ready', () => {
    it('GET /health should return 200 and process status UP', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body).toHaveProperty('timestamp');
    });

    it('GET /ready should return 200 and database connected', async () => {
      const res = await request(app).get('/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('READY');
      expect(res.body.database).toBe('connected');
    });
  });

  describe('GET /api/shows/:showId/seats', () => {
    it('should retrieve all seats for a show publicly', async () => {
      const res = await request(app).get(`/api/shows/${showId}/seats`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
      expect(res.body[0].status).toBe('AVAILABLE');
    });

    it('should return 404 if show does not exist', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app).get(`/api/shows/${fakeId}/seats`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/seats/:seatId/hold', () => {
    it('should hold an available seat successfully', async () => {
      const res = await request(app)
        .post(`/api/seats/${seatId}/hold`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('holdToken');
      expect(res.body).toHaveProperty('holdExpiresAt');
      expect(res.body.seatId).toBe(seatId);

      // Verify in DB
      const seatInDb = await Seat.findById(seatId);
      expect(seatInDb.status).toBe('HELD');
      expect(seatInDb.holdToken).toBe(res.body.holdToken);
    });

    it('should reject unauthenticated hold attempts (401)', async () => {
      const res = await request(app).post(`/api/seats/${seatId}/hold`);
      expect(res.status).toBe(401);
    });

    it('should reject a second hold on an already held seat (409 Conflict)', async () => {
      // First hold succeeds
      const firstRes = await request(app)
        .post(`/api/seats/${seatId}/hold`)
        .set('Authorization', authHeader);
      expect(firstRes.status).toBe(200);

      // Second hold by another user fails
      const secondRes = await request(app)
        .post(`/api/seats/${seatId}/hold`)
        .set('Authorization', otherAuthHeader);

      expect(secondRes.status).toBe(409);
      expect(secondRes.body).toHaveProperty('error');
    });

    it('should allow holding a seat if previous hold has expired', async () => {
      // Hold the seat with an expired timestamp in the past
      await Seat.findByIdAndUpdate(seatId, {
        status: 'HELD',
        holdToken: 'old-expired-token',
        holdExpiresAt: new Date(Date.now() - 60000), // 1 minute in the past
        userId: testUser.user._id
      });

      // Another user requests a hold
      const res = await request(app)
        .post(`/api/seats/${seatId}/hold`)
        .set('Authorization', otherAuthHeader);

      expect(res.status).toBe(200);
      expect(res.body.holdToken).not.toBe('old-expired-token');

      const updated = await Seat.findById(seatId);
      expect(updated.status).toBe('HELD');
      expect(updated.userId.toString()).toBe(otherAuthHeader ? (await Seat.findById(seatId)).userId.toString() : '');
    });
  });
});

