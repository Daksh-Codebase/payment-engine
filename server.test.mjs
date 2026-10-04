import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, retryPayment } from './server.mjs';

test('preserves immediate success and validates retry input', () => {
  assert.deepEqual(retryPayment({outcomes:['success'], maxAttempts:3}), {code:200,body:{status:'success',attempts:1}});
  assert.equal(retryPayment({outcomes:['success'], maxAttempts:0}).code, 400);
  assert.equal(retryPayment({outcomes:['unknown'], maxAttempts:1}).code, 400);
});
test('payment creation, idempotency, conflicts, lookup and invalid input', async t => {
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const post = body => fetch(origin+'/payments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const body={clientReference:'order-1',amountMinor:1000,currency:'INR'};
  const first=await post(body); assert.equal(first.status,201); const payment=await first.json();
  const duplicate=await post(body); assert.equal(duplicate.status,200);assert.deepEqual(await duplicate.json(),payment);
  assert.equal((await post({...body,amountMinor:2000})).status,409);
  assert.deepEqual(await (await fetch(origin+'/payments/'+payment.id)).json(),payment);
  assert.equal((await post({...body,amountMinor:-1})).status,400);
  assert.equal((await fetch(origin+'/payments/pay_999')).status,404);
  assert.equal((await fetch(origin+'/health')).status,200);
});
