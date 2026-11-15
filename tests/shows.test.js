const request = require('supertest');
const app = require('../src/app');
const Show = require('../src/models/Show');
const { startTestDB, stopTestDB, clearTestDB } = require('./setup');

describe('Shows API Tests', () => {
  let createdShowId;

  beforeAll(async () => {
    await startTestDB();
  });

  afterAll(async () => {
    await stopTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    const show = await Show.create({
      movieName: 'Interstellar',
      screenName: '70mm IMAX',
      startsAt: new Date(Date.now() + 3600000),
      endsAt: new Date(Date.now() + 10800000),
      status: 'SCHEDULED'
    });
    createdShowId = show._id.toString();
  });

  describe('GET /api/shows and GET /api/shows/:showId', () => {
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

  describe('Removed Endpoints Verification', () => {
    it('should return 404 for POST /api/shows (endpoint deleted)', async () => {
      const res = await request(app)
        .post('/api/shows')
        .send({
          movieName: 'Dune',
          screenName: 'Screen 1',
          startsAt: new Date().toISOString(),
          endsAt: new Date(Date.now() + 3600000).toISOString()
        });

      expect(res.status).toBe(404);
    });

    it('should return 404 for POST /api/shows/:showId/seats (endpoint deleted)', async () => {
      const res = await request(app)
        .post(`/api/shows/${createdShowId}/seats`)
        .send({
          seats: [{ row: 'A', seatNumber: 1 }]
        });

      expect(res.status).toBe(404);
    });
  });
});
