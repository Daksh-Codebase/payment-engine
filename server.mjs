import http from 'node:http';
import { pathToFileURL } from 'node:url';

export function retryPayment({ outcomes, maxAttempts }) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10)
    return { code: 400, body: { error: 'INVALID_ATTEMPTS' } };
  if (!Array.isArray(outcomes) || !outcomes.length || outcomes.length > 10 ||
      outcomes.some(o => !['success', 'temporary', 'permanent'].includes(o)))
    return { code: 400, body: { error: 'INVALID_OUTCOMES' } };
  let attempts = 0;
  for (const outcome of outcomes) {
    attempts++;
    if (outcome === 'success')
      return { code: 200, body: { status: 'success', attempts } };
    if (outcome === 'permanent') break;
  }
  return { code: 200, body: { status: 'failed', attempts } };
}

export function createServer() {
  const payments = new Map();
  const references = new Map();
  const respond = (res, code, body) => {
    res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/health') return respond(res, 200, { ok: true });
    if (req.method === 'GET' && /^\/payments\/pay_[0-9]+$/.test(url.pathname)) {
      const payment = payments.get(url.pathname.split('/')[2]);
      return respond(res, payment ? 200 : 404, payment ?? { error: 'NOT_FOUND' });
    }
    if (req.method !== 'POST' || !['/payments', '/payments/retry'].includes(url.pathname))
      return respond(res, 404, { error: 'NOT_FOUND' });
    try {
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 16384) { respond(res, 413, { error: 'BODY_TOO_LARGE' }); return; }
        chunks.push(chunk);
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { return respond(res, 400, { error: 'INVALID_JSON' }); }
      if (!body || typeof body !== 'object' || Array.isArray(body))
        return respond(res, 400, { error: 'INVALID_BODY' });
      if (url.pathname === '/payments/retry') {
        const result = retryPayment(body); return respond(res, result.code, result.body);
      }
      const { clientReference, amountMinor, currency } = body;
      if (typeof clientReference !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(clientReference) ||
          !Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > 100000000 ||
          !['INR', 'USD', 'EUR'].includes(currency))
        return respond(res, 400, { error: 'INVALID_PAYMENT' });
      if (references.has(clientReference)) {
        const existing = payments.get(references.get(clientReference));
        if (existing.amountMinor !== amountMinor || existing.currency !== currency)
          return respond(res, 409, { error: 'REFERENCE_CONFLICT' });
        return respond(res, 200, existing);
      }
      if (payments.size >= 1000) return respond(res, 503, { error: 'CAPACITY_REACHED' });
      const payment = { id: 'pay_' + (payments.size + 1), clientReference, amountMinor, currency, status: 'pending' };
      payments.set(payment.id, payment); references.set(clientReference, payment.id);
      return respond(res, 201, payment);
    } catch { if (!res.headersSent) respond(res, 400, { error: 'REQUEST_FAILED' }); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  createServer().listen(Number(process.env.PORT ?? 9000), '0.0.0.0');
