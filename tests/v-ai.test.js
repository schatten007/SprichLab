import test from 'node:test';
import assert from 'node:assert/strict';
import { __testing } from '../app/js/v-ai.js';
import { newAIDraft } from '../app/js/ai-state.js';

const { draftAfterError, draftAfterReceipt, draftAfterRecovery } = __testing;

function draft(patch = {}) {
  return { ...newAIDraft(1700000000000), text: 'Ich studiere Informatik.', recordingMs: 12_500, audioKey: 'rec-1', ...patch };
}

test('a definite rejection clears the unknown request and keeps the learner words', () => {
  const source = draft({ status: 'sending' });
  const next = draftAfterError(source, Object.assign(new Error('Send a German answer first.'), { code: 'empty_input', status: 400 }));
  assert.equal(next.status, 'error');
  assert.notEqual(next.requestId, source.requestId);
  assert.equal(next.supersedes, '');
  assert.equal(next.text, source.text);
  assert.equal(next.recordingMs, source.recordingMs);
  assert.equal(next.audioKey, source.audioKey);
  assert.equal(next.error, 'Send a German answer first.');
});

test('an outcome that could already have been generated keeps its request for recovery', () => {
  const source = draft({ status: 'draft' });
  for (const error of [
    Object.assign(new Error('Timed out'), { code: 'timeout' }),
    Object.assign(new Error('Offline'), { code: 'network' }),
    Object.assign(new Error('Pending'), { code: 'pending' }),
    Object.assign(new Error('Slow'), { code: 'provider_timeout' }),
    Object.assign(new Error('Gateway busy'), { status: 504, code: 'provider_timeout' }),
  ]) {
    const next = draftAfterError(source, error);
    assert.equal(next.status, 'sending');
    assert.equal(next.requestId, source.requestId);
    assert.ok(next.error.length > 0);
  }
});

test('a superseded request is reported but not regenerated silently', () => {
  const source = draft({ status: 'sending', requestId: 'req-old', supersedes: 'req-parent' });
  const next = draftAfterError(source, Object.assign(new Error('This conversation moved on.'), { code: 'request_changed', status: 409 }));
  assert.equal(next.status, 'error');
  assert.notEqual(next.requestId, 'req-old');
  assert.equal(next.supersedes, 'req-parent');
  assert.equal(next.operation, 'reply');
});

test('an unreadable clip becomes a typed reply again', () => {
  const source = draft({ status: 'sending' });
  const next = draftAfterReceipt(source, { inputStatus: 'unclear' });
  assert.equal(next.status, 'draft');
  assert.equal(next.recordingMs, 0);
  assert.equal(next.audioKey, '');
  assert.equal(next.text, source.text);
  assert.notEqual(next.requestId, source.requestId);
  assert.match(next.error, /shorter sentence/);
});

test('a successful receipt is handed to the store untouched', () => {
  const source = draft({ status: 'sending' });
  const result = { inputStatus: 'accepted', requestId: source.requestId };
  assert.equal(draftAfterReceipt(source, result), source);
});

test('recovery tells the learner to send again when the request never existed', () => {
  const source = draft({ status: 'sending' });
  const next = draftAfterRecovery(source, Object.assign(new Error('Unknown request'), { code: 'request_missing', status: 404 }));
  assert.equal(next.status, 'draft');
  assert.notEqual(next.requestId, source.requestId);
  assert.equal(next.supersedes, '');
  assert.match(next.error, /Send it again/);
});

test('recovery stays pending while the connection itself is still down', () => {
  const source = draft({ status: 'sending' });
  const next = draftAfterRecovery(source, Object.assign(new Error('Offline'), { code: 'network' }));
  assert.equal(next.status, 'sending');
  assert.equal(next.requestId, source.requestId);
  assert.match(next.error, /Check for my reply/);
});

test('recovery that cannot prove the outcome returns a fresh attempt', () => {
  const source = draft({ status: 'sending' });
  const next = draftAfterRecovery(source, Object.assign(new Error('Provider failed'), { code: 'provider_timeout', status: 504 }));
  assert.equal(next.status, 'error');
  assert.notEqual(next.requestId, source.requestId);
  assert.match(next.error, /nothing new was generated/);
});
