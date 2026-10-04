import test from 'node:test';
import assert from 'node:assert/strict';
import { retryPayment } from './server.mjs';
for (const [name, outcomes, maxAttempts, status, attempts] of [
  ['temporary then success', ['temporary', 'success'], 3, 'success', 2],
  ['bounded temporary failures', ['temporary', 'temporary', 'success'], 2, 'failed', 2],
  ['permanent stops', ['permanent', 'success'], 3, 'failed', 1],
  ['success stops', ['success', 'temporary'], 3, 'success', 1],
  ['outcomes exhausted', ['temporary'], 3, 'failed', 1],
]) test(name, () => assert.deepEqual(retryPayment({ outcomes, maxAttempts }), { code: 200, body: { status, attempts } }));
for (const maxAttempts of [0, 11, 1.5, '3']) test('reject invalid max ' + maxAttempts, () => assert.equal(retryPayment({ outcomes: ['success'], maxAttempts }).body.error, 'INVALID_ATTEMPTS'));
for (const outcomes of [[], ['unknown'], null]) test('reject invalid outcomes ' + JSON.stringify(outcomes), () => assert.equal(retryPayment({ outcomes, maxAttempts: 3 }).body.error, 'INVALID_OUTCOMES'));
