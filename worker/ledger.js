import { problem, savedError, restoreError } from './errors.js';

export class RequestLedger {
  constructor(db, now = Date.now) { this.db = db; this.now = now; }
  async consume(key, limit, amount = 1, ttl = 86_400_000) {
    if (amount > limit) throw problem(429, 'app_quota', 'This request exceeds the configured free-use allowance.', 60);
    const expires = this.now() + ttl;
    const result = await this.db.prepare(`INSERT INTO ai_counters (counter_key, used, expires_at) VALUES (?, ?, ?)
      ON CONFLICT(counter_key) DO UPDATE SET used = ai_counters.used + excluded.used
      WHERE ai_counters.used + excluded.used <= ? RETURNING used`).bind(key, amount, expires, limit).first();
    if (!result || result.used > limit) throw problem(429, 'app_quota', 'This app’s practice allowance is used up for this period. Your draft is saved; try again later or use Gemini Companion.', 60);
    return result.used;
  }
  async count(key) { return (await this.db.prepare('SELECT used FROM ai_counters WHERE counter_key = ?').bind(key).first())?.used ?? 0; }
  async claim(id, hash, kind) {
    const now = this.now();
    const result = await this.db.prepare(`INSERT INTO ai_requests (id, payload_hash, kind, status, lease_until, created_at, updated_at, expires_at)
      VALUES (?, ?, ?, 'pending', ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`).bind(id, hash, kind, now + 120_000, now, now, now + 86_400_000).run();
    if (result.meta.changes > 0) return { claimed: true, transcript: null };
    const current = await this.get(id);
    if (current.payload_hash !== hash || current.kind !== kind) throw problem(409, 'request_changed', 'This request ID was already used for different input. Create a new turn to send an edited response.');
    if (current.status === 'complete') return { claimed: false, response: JSON.parse(current.response_json) };
    if (current.status === 'pending' && current.lease_until > now) return { claimed: false, pending: true };
    if (current.status === 'pending') {
      const error = problem(409, 'uncertain', 'The previous request may have reached the provider. Check for its reply before choosing an explicit new attempt.');
      await this.fail(id, error, 'uncertain'); throw error;
    }
    if (current.status === 'retryable' && current.attempts >= 2) {
      throw await this.fail(id, problem(409, 'retry_exhausted', 'This request reached its retry limit. Explicitly start a new request using the saved input.'), 'failed');
    }
    if (current.status === 'retryable' && current.attempts < 2) {
      if (current.retry_at > now) throw problem(429, 'cooldown', 'Please wait for the provider cooldown before retrying.', Math.ceil((current.retry_at - now) / 1000));
      const retry = await this.db.prepare(`UPDATE ai_requests SET status = 'pending', attempts = attempts + 1, lease_until = ?, updated_at = ?
        WHERE id = ? AND status = 'retryable' AND attempts = ?`).bind(now + 120_000, now, id, current.attempts).run();
      if (retry.meta.changes > 0) return { claimed: true, transcript: current.transcript };
      return { claimed: false, pending: true };
    }
    throw restoreError(JSON.parse(current.error_json || '{"status":409,"code":"uncertain","detail":"Check the previous reply or start a new attempt.","retryAfter":0}'));
  }
  async get(id) { return this.db.prepare('SELECT * FROM ai_requests WHERE id = ?').bind(id).first(); }
  async saveTranscript(id, transcript) { await this.db.prepare('UPDATE ai_requests SET transcript = ?, updated_at = ? WHERE id = ?').bind(transcript, this.now(), id).run(); }
  async finish(id, result) { await this.db.prepare("UPDATE ai_requests SET status = 'complete', response_json = ?, error_json = NULL, updated_at = ? WHERE id = ?").bind(JSON.stringify(result), this.now(), id).run(); }
  async fail(id, error, status = 'failed') {
    let failure = error;
    if (status === 'retryable' && (await this.get(id))?.attempts >= 2) {
      failure = problem(409, 'retry_exhausted', 'This request reached its retry limit. After the quota resets, explicitly request a new grade or turn using the saved input.');
      status = 'failed';
    }
    await this.db.prepare('UPDATE ai_requests SET status = ?, error_json = ?, retry_at = ?, updated_at = ? WHERE id = ?')
      .bind(status, JSON.stringify(savedError(failure)), this.now() + (failure.retryAfter || 0) * 1000, this.now(), id).run();
    return failure;
  }
  async cleanup() {
    await this.db.batch([
      this.db.prepare('DELETE FROM ai_requests WHERE id IN (SELECT id FROM ai_requests WHERE expires_at < ? LIMIT 100)').bind(this.now()),
      this.db.prepare('DELETE FROM ai_counters WHERE counter_key IN (SELECT counter_key FROM ai_counters WHERE expires_at < ? LIMIT 100)').bind(this.now()),
    ]);
  }
}
