import { check, ASSESSMENT_LIMITS } from '../../shared/assessment-contracts.js';

/** A complete evidence snapshot; unlike conversational history this never inserts learner text or truncates. */
export function buildRoleplaySubmission(session) {
  check(session?.assessmentRef, 'This conversation has no assessment identity.');
  check(session.draft.status !== 'sending' && !session.draft.text.trim() && !session.draft.audioKey && !session.draft.recordingMs, 'Send or discard your unfinished answer before grading.');
  const replaced = new Set(session.turns.map(turn => turn.supersedes).filter(Boolean));
  const active = session.turns.filter(turn => !replaced.has(turn.id));
  const turns = [{ id: `${session.id}:opening`, role: 'partner', phase: 'assessment', inputMode: 'generated', text: session.context.openingDe, audioKey: '', edited: false }];
  const events = structuredClone(session.assessmentEvents ?? []);
  for (const turn of active) {
    if (turn.operation === 'reply') {
      turns.push({ id: turn.id, role: 'learner', phase: 'assessment', inputMode: turn.inputMode ?? (turn.audioKey ? 'transcribed' : 'typed'),
        text: turn.transcript, audioKey: turn.audioKey, edited: Boolean(turn.supersedes) });
    } else {
      events.push({ id: `operation:${turn.id}`, kind: turn.operation === 'hint' ? 'answer_hint' : 'question_rephrase', phase: 'assessment', refId: turn.id, at: turn.createdAt });
      turns.push({ id: turn.id, role: 'control', phase: 'assessment', inputMode: 'control', text: '', audioKey: '', edited: false });
    }
    turns.push({ id: `${turn.id}:partner`, role: 'partner', phase: 'assessment', inputMode: 'generated', text: turn.replyDe, audioKey: '', edited: false });
  }
  check(turns.filter(turn => turn.role === 'learner' && turn.text.trim()).length >= ASSESSMENT_LIMITS.minReplies, 'Have at least three actual learner replies before grading. Help buttons do not count.');
  return { kind: 'roleplay', complete: true, turns, events };
}
