const request = require('supertest');
const app = require('../src/app');
const { startTestDB, stopTestDB, clearTestDB, createTestUser } = require('./setup');

describe('Shows API Tests', () => {
  let authHeader;

  beforeAll(async () => {
    await startTestDB();
  });

  afterAll(async () => {
    await stopTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    const testUser = await createTestUser();
    authHeader = testUser.authHeader;
  });

  describe('POST /api/shows', () => {
    it('should create a show successfully when authenticated', async () => {
      const startsAt = new Date(Date.now() + 3600000).toISOString();
      const endsAt = new Date(Date.now() + 7200000).toISOString();

      const res = await request(app)
        .post('/api/shows')
        .set('Authorization', authHeader)
        .send({
          movieName: 'Dune: Part Two',
          screenName: 'IMAX Laser 1',
          startsAt,
          endsAt
        });

      expect(res.status).toBe(201);
      expect(res.body.show).toHaveProperty('_id');
      expect(res.body.show.movieName).toBe('Dune: Part Two');
      expect(res.body.show.status).toBe('SCHEDULED');
    });

    it('should reject show creation if unauthenticated (401)', async () => {
      const res = await request(app)
        .post('/api/shows')
        .send({
          movieName: 'Unauthenticated Movie',
          screenName: 'Screen 1',
          startsAt: new Date().toISOString(),
          endsAt: new Date(Date.now() + 3600000).toISOString()
        });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject show creation if endsAt is before or equal to startsAt (400)', async () => {
      const now = new Date();
      const res = await request(app)
        .post('/api/shows')
        .set('Authorization', authHeader)
        .send({
          movieName: 'Time Paradox',
          screenName: 'Screen 2',
          startsAt: new Date(now.getTime() + 7200000).toISOString(),
          endsAt: new Date(now.getTime() + 3600000).toISOString() // ends before starts
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/endsAt must be strictly after startsAt/i);
    });

    it('should reject show creation if required fields are missing (400)', async () => {
      const res = await request(app)
        .post('/api/shows')
        .set('Authorization', authHeader)
        .send({
          movieName: 'Missing Fields'
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/shows and GET /api/shows/:showId', () => {
    let createdShowId;

    beforeEach(async () => {
      const showRes = await request(app)
        .post('/api/shows')
        .set('Authorization', authHeader)
        .send({
          movieName: 'Interstellar',
          screenName: '70mm IMAX',
          startsAt: new Date(Date.now() + 3600000).toISOString(),
          endsAt: new Date(Date.now() + 10800000).toISOString()
        });
      createdShowId = showRes.body.show._id;
    });

    it('should retrieve all shows publicly without auth', async () => {
      const res = await request(app).get('/api/shows');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].movieName).toBe('Interstellar');
    });

    it('should retrieve single show by ID publicly', async () => {
      const res = await request(app).get(`/api/shows/${createdShowId}`);

      expect(res.status).toBe(200);
      expect(res.body._id).toBe(createdShowId);
      expect(res.body.movieName).toBe('Interstellar');
    });

    it('should return 404 for non-existent show ID', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app).get(`/api/shows/${fakeId}`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/shows/:showId/seats', () => {
    let showId;

    beforeEach(async () => {
      const showRes = await request(app)
        .post('/api/shows')
        .set('Authorization', authHeader)
        .send({
          movieName: 'Seat Layout Test',
          screenName: 'Screen A',
          startsAt: new Date(Date.now() + 3600000).toISOString(),
          endsAt: new Date(Date.now() + 7200000).toISOString()
        });
      showId = showRes.body.show._id;
    });

    it('should generate seat layout for a show', async () => {
      const res = await request(app)
        .post(`/api/shows/${showId}/seats`)
        .set('Authorization', authHeader)
        .send({
          rows: ['A', 'B'],
          seatsPerRow: 3
        });

      expect(res.status).toBe(201);
      expect(res.body.count).toBe(6);
      expect(res.body.seats[0].status).toBe('AVAILABLE');
      expect(res.body.seats[0].showId).toBe(showId);
    });

    it('should reject creating duplicate seats for the same show (409 Conflict)', async () => {
      await request(app)
        .post(`/api/shows/${showId}/seats`)
        .set('Authorization', authHeader)
        .send({
          seats: [{ row: 'A', seatNumber: 1 }]
        });

      const res = await request(app)
        .post(`/api/shows/${showId}/seats`)
        .set('Authorization', authHeader)
        .send({
          seats: [{ row: 'A', seatNumber: 1 }]
        });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('error');
    });
  });
});

