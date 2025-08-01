const request = require('supertest');
const express = require('express');

// Mock the server setup for testing
const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: 'test'
  });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'QR Check-in System API',
    version: '1.0.0'
  });
});

describe('Server Setup', () => {
  test('Health check endpoint should return OK', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body.status).toBe('OK');
    expect(response.body.environment).toBe('test');
  });

  test('Root endpoint should return API info', async () => {
    const response = await request(app)
      .get('/')
      .expect(200);
    
    expect(response.body.message).toBe('QR Check-in System API');
    expect(response.body.version).toBe('1.0.0');
  });
});