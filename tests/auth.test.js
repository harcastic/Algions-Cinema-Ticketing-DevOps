const request = require('supertest');
const app = require('../src/app');
const { startTestDB, stopTestDB, clearTestDB } = require('./setup');

describe('Authentication API Tests', () => {
  beforeAll(async () => {
    await startTestDB();
  });

  afterAll(async () => {
    await stopTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully and return JWT', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Alice Cooper',
          email: 'alice@example.com',
          password: 'secretPassword123'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.name).toBe('Alice Cooper');
      expect(res.body.user.email).toBe('alice@example.com');
      expect(res.body.user).not.toHaveProperty('password');
    });

    it('should reject registration with existing email (409 Conflict)', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Alice Cooper',
          email: 'alice@example.com',
          password: 'secretPassword123'
        });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Alice Duplicate',
          email: 'alice@example.com',
          password: 'anotherPassword'
        });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject registration with missing fields (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'alice@example.com'
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Bob Marley',
          email: 'bob@example.com',
          password: 'correctPassword'
        });
    });

    it('should log in successfully with valid credentials and return JWT', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'bob@example.com',
          password: 'correctPassword'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe('bob@example.com');
    });

    it('should reject login with wrong password (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'bob@example.com',
          password: 'wrongPassword'
        });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject login with non-existent email (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'ghost@example.com',
          password: 'correctPassword'
        });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });
  });
});

