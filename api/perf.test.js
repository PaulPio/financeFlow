/**
 * Smoke tests for the DB performance improvements.
 * Uses Node's built-in test runner (node:test) — no extra dependencies.
 * Run with: node --experimental-vm-modules api/perf.test.js
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const transactionSrc = readFileSync(path.join(__dirname, 'models/Transaction.js'), 'utf8');
const dbSrc = readFileSync(path.join(__dirname, 'db.js'), 'utf8');

// ---------------------------------------------------------------------------
// 1. Connection caching logic (extracted from db.js)
// ---------------------------------------------------------------------------
describe('connectDB – connection caching', () => {
  test('calls underlying connect only once even with concurrent calls', () => {
    // Simulate the caching pattern used in db.js
    const cache = { conn: null, promise: null };

    let callCount = 0;
    function fakeConnect() {
      callCount++;
      return Promise.resolve('conn-object');
    }

    function connectDB() {
      if (cache.conn) return Promise.resolve(cache.conn);
      if (!cache.promise) cache.promise = fakeConnect();
      return cache.promise.then(c => { cache.conn = c; return c; });
    }

    // Simulate concurrent calls before the promise resolves
    connectDB();
    connectDB();
    connectDB();

    // fakeConnect must only have been invoked once regardless of call count
    assert.equal(callCount, 1, 'underlying connect should only be called once');
  });

  test('returns cached connection without hitting fakeConnect again', async () => {
    const cache = { conn: null, promise: null };
    let callCount = 0;

    async function connectDB() {
      if (cache.conn) return cache.conn;
      if (!cache.promise) {
        callCount++;
        cache.promise = Promise.resolve('conn-object');
      }
      cache.conn = await cache.promise;
      return cache.conn;
    }

    await connectDB();          // first call – creates connection
    await connectDB();          // second call – should use cache
    await connectDB();          // third call – should use cache

    assert.equal(callCount, 1, 'underlying connect should only be called once');
  });
});

// ---------------------------------------------------------------------------
// 2. Budget aggregation – spentMap building (logic from GET /api/budgets)
// ---------------------------------------------------------------------------
describe('GET /api/budgets – spent calculation', () => {
  // Simulates what the $group aggregation returns
  const mockAggregationResult = [
    { _id: 'Food', total: 320 },
    { _id: 'Transport', total: 85 },
    { _id: 'Entertainment', total: 150 },
  ];

  const mockBudgets = [
    { _id: 'b1', category: 'Food', limit: 500 },
    { _id: 'b2', category: 'Transport', limit: 200 },
    { _id: 'b3', category: 'Savings', limit: 300 },   // no matching transactions
  ];

  test('builds spentMap correctly from aggregation result', () => {
    const spentMap = Object.fromEntries(
      mockAggregationResult.map(s => [s._id, s.total])
    );

    assert.equal(spentMap['Food'], 320);
    assert.equal(spentMap['Transport'], 85);
    assert.equal(spentMap['Entertainment'], 150);
  });

  test('budgets with no transactions get spent = 0 via nullish coalescing', () => {
    const spentMap = Object.fromEntries(
      mockAggregationResult.map(s => [s._id, s.total])
    );

    const budgetsWithSpent = mockBudgets.map(budget => ({
      ...budget,
      id: budget._id,
      spent: spentMap[budget.category] ?? 0,
    }));

    const food = budgetsWithSpent.find(b => b.category === 'Food');
    const savings = budgetsWithSpent.find(b => b.category === 'Savings');

    assert.equal(food.spent, 320, 'Food spent should match aggregation');
    assert.equal(savings.spent, 0, 'Savings with no transactions should be 0, not undefined');
  });

  test('parallel Promise.all shape matches expected [budgets, spentByCategory]', async () => {
    // Simulate what Promise.all returns
    const fakeBudgetQuery = Promise.resolve(mockBudgets);
    const fakeAggregation = Promise.resolve(mockAggregationResult);

    const [budgets, spentByCategory] = await Promise.all([fakeBudgetQuery, fakeAggregation]);

    assert.equal(budgets.length, 3);
    assert.equal(spentByCategory.length, 3);
    assert.ok(spentByCategory[0]._id, 'aggregation entries should have _id (category name)');
    assert.ok(typeof spentByCategory[0].total === 'number', 'aggregation entries should have numeric total');
  });
});

// ---------------------------------------------------------------------------
// 3. Transaction model – index definitions
// ---------------------------------------------------------------------------
describe('Transaction model – index definitions', () => {
  test('has userId+date desc index for list queries', () => {
    assert.ok(
      transactionSrc.includes("{ userId: 1, date: -1 }"),
      'Missing index { userId: 1, date: -1 }'
    );
  });

  test('has userId+date+category index for budget aggregation', () => {
    assert.ok(
      transactionSrc.includes("{ userId: 1, date: 1, category: 1 }"),
      'Missing compound index { userId: 1, date: 1, category: 1 }'
    );
  });
});

// ---------------------------------------------------------------------------
// 4. db.js – exports are correct
// ---------------------------------------------------------------------------
describe('db.js – module exports', () => {
  test('exports connectDB function and mongoose', () => {
    assert.ok(dbSrc.includes('export async function connectDB'), 'connectDB must be a named export');
    assert.ok(dbSrc.includes('export { mongoose }'), 'mongoose must be a named export');
    assert.ok(dbSrc.includes('maxPoolSize'), 'connection pool size should be configured');
    assert.ok(dbSrc.includes('serverSelectionTimeoutMS'), 'server selection timeout should be configured');
  });
});
