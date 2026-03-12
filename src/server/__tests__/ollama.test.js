import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

// We need to mock fetch before importing ollama module
const originalFetch = globalThis.fetch;

describe('ollama module', () => {
  let checkHealth, generateSQL, summarizeResults;

  beforeEach(async () => {
    // Re-import for each test to get fresh module
    const mod = await import('../ollama.js');
    checkHealth = mod.checkHealth;
    generateSQL = mod.generateSQL;
    summarizeResults = mod.summarizeResults;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('checkHealth', () => {
    it('should return available true when model is present', async () => {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          models: [{ name: 'qwen2.5:1.5b' }],
        }),
      });

      const result = await checkHealth();
      expect(result.available).toBe(true);
      expect(result.model).toBe('qwen2.5:1.5b');
    });

    it('should return available false when model is not present', async () => {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          models: [{ name: 'llama3:8b' }],
        }),
      });

      const result = await checkHealth();
      expect(result.available).toBe(false);
    });

    it('should return available false when Ollama is not running', async () => {
      globalThis.fetch = async () => {
        throw new Error('Connection refused');
      };

      const result = await checkHealth();
      expect(result.available).toBe(false);
      expect(result.error).toBe('Connection refused');
    });

    it('should return available false on non-ok response', async () => {
      globalThis.fetch = async () => ({
        ok: false,
        status: 500,
      });

      const result = await checkHealth();
      expect(result.available).toBe(false);
      expect(result.error).toContain('500');
    });
  });

  describe('generateSQL', () => {
    it('should return clean SQL from model response', async () => {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          response: 'SELECT SUM(amount) FROM transactions WHERE is_credit = 0',
        }),
      });

      const sql = await generateSQL('How much did I spend?');
      expect(sql).toBe('SELECT SUM(amount) FROM transactions WHERE is_credit = 0');
    });

    it('should strip markdown code fences', async () => {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          response: '```sql\nSELECT * FROM transactions\n```',
        }),
      });

      const sql = await generateSQL('Show all transactions');
      expect(sql).toBe('SELECT * FROM transactions');
    });

    it('should strip trailing semicolons', async () => {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          response: 'SELECT * FROM transactions;',
        }),
      });

      const sql = await generateSQL('Show all');
      expect(sql).toBe('SELECT * FROM transactions');
    });

    it('should throw on non-SELECT output', async () => {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          response: 'DROP TABLE transactions',
        }),
      });

      await expect(generateSQL('Drop everything')).rejects.toThrow('did not generate a SELECT');
    });

    it('should throw on non-ok response', async () => {
      globalThis.fetch = async () => ({
        ok: false,
        status: 503,
      });

      await expect(generateSQL('test')).rejects.toThrow('503');
    });
  });

  describe('summarizeResults', () => {
    it('should return summary from model response', async () => {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          response: 'You spent ₹5,000 last month.',
        }),
      });

      const summary = await summarizeResults(
        'How much did I spend?',
        'SELECT SUM(amount) FROM transactions',
        [{ 'SUM(amount)': 5000 }]
      );
      expect(summary).toBe('You spent ₹5,000 last month.');
    });

    it('should throw on non-ok response', async () => {
      globalThis.fetch = async () => ({
        ok: false,
        status: 500,
      });

      await expect(
        summarizeResults('test', 'SELECT 1', [])
      ).rejects.toThrow('500');
    });
  });
});
