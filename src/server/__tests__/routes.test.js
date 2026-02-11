import { describe, it, expect } from 'vitest';
import { handleApiRequest } from '../routes.js';

describe('API Routes', () => {
  describe('GET /api/transactions', () => {
    it('should return success response with transactions and stats', async () => {
      const req = new Request('http://localhost:3000/api/transactions');
      const url = new URL(req.url);

      const response = await handleApiRequest(req, url);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.transactions).toBeInstanceOf(Array);
      expect(data.stats).toBeDefined();
      expect(data.stats).toHaveProperty('totalTransactions');
      expect(data.stats).toHaveProperty('totalStatements');
      expect(data.stats).toHaveProperty('totalDebits');
      expect(data.stats).toHaveProperty('totalCredits');
    });
  });

  describe('GET /api/statements', () => {
    it('should return success response with statements', async () => {
      const req = new Request('http://localhost:3000/api/statements');
      const url = new URL(req.url);

      const response = await handleApiRequest(req, url);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.statements).toBeInstanceOf(Array);
    });
  });

  describe('POST /api/upload', () => {
    it('should reject request without file', async () => {
      const formData = new FormData();
      const req = new Request('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData
      });
      const url = new URL(req.url);

      const response = await handleApiRequest(req, url);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('No file provided');
    });

    it('should reject CSV with no valid transactions', async () => {
      const emptyCSV = '';
      const file = new File([emptyCSV], 'empty.csv', { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', file);

      const req = new Request('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData
      });
      const url = new URL(req.url);

      const response = await handleApiRequest(req, url);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it('should reject invalid CSV format', async () => {
      const invalidCSV = 'Invalid~|~Data\nNo~|~Valid~|~Columns';
      const file = new File([invalidCSV], 'invalid.csv', { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', file);

      const req = new Request('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData
      });
      const url = new URL(req.url);

      const response = await handleApiRequest(req, url);
      const data = await response.json();

      expect(data.success).toBe(false);
    });
  });

  describe('DELETE /api/statements/:id', () => {
    it('should return 404 for non-existent statement', async () => {
      const req = new Request('http://localhost:3000/api/statements/999999', {
        method: 'DELETE'
      });
      const url = new URL(req.url);

      const response = await handleApiRequest(req, url);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Statement not found');
    });

    it('should parse statement ID from URL correctly', async () => {
      const req = new Request('http://localhost:3000/api/statements/123', {
        method: 'DELETE'
      });
      const url = new URL(req.url);

      const response = await handleApiRequest(req, url);

      // Should attempt to delete (will return 404 since doesn't exist)
      expect(response.status).toBe(404);
    });
  });

  describe('404 handling', () => {
    it('should return 404 for unknown routes', async () => {
      const req = new Request('http://localhost:3000/api/unknown');
      const url = new URL(req.url);

      const response = await handleApiRequest(req, url);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Not Found');
    });

    it('should return 404 for wrong HTTP method', async () => {
      const req = new Request('http://localhost:3000/api/transactions', {
        method: 'POST'  // Wrong method for this endpoint
      });
      const url = new URL(req.url);

      const response = await handleApiRequest(req, url);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });

  describe('Response format validation', () => {
    it('should return JSON content-type for all responses', async () => {
      const req = new Request('http://localhost:3000/api/transactions');
      const url = new URL(req.url);

      const response = await handleApiRequest(req, url);

      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('application/json');
    });

    it('should include success field in all responses', async () => {
      const req1 = new Request('http://localhost:3000/api/transactions');
      const url1 = new URL(req1.url);
      const response1 = await handleApiRequest(req1, url1);
      const data1 = await response1.json();
      expect(data1).toHaveProperty('success');

      const req2 = new Request('http://localhost:3000/api/unknown');
      const url2 = new URL(req2.url);
      const response2 = await handleApiRequest(req2, url2);
      const data2 = await response2.json();
      expect(data2).toHaveProperty('success');
    });
  });
});
