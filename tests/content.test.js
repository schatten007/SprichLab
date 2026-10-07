import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, PHRASES } from '../app/data/missions.js';
import { RESOURCES, resourceById } from '../app/data/resources.js';
import { newState, validateState } from '../app/js/model.js';
import { createSession, tasksFor } from '../app/js/session.js';

test('the course contains 12 complete missions, 120 distinct phrases, and 36 bilingual dialogues', () => {
  assert.equal(MISSIONS.length, 12);
  assert.equal(PHRASES.length, 120);
  assert.equal(new Set(PHRASES.map(phrase => phrase.id)).size, 120);
  assert.equal(new Set(PHRASES.map(phrase => phrase.de)).size, 120);
  assert.equal(MISSIONS.reduce((sum, mission) => sum + mission.listening.length, 0), 36);
  for (const phrase of PHRASES) assert.ok(phrase.de && phrase.en && phrase.cueDe && phrase.cue && phrase.example && phrase.noteDe);
  const phraseIds = new Set(PHRASES.map(phrase => phrase.id));
  const used = new Set();
  for (const mission of MISSIONS) {
    assert.ok(mission.goalDe && mission.situationDe && mission.retryDe && mission.shadowEn);
    assert.ok(mission.turns.filter(turn => turn.essential).length >= 2);
    mission.phraseIds.forEach(id => used.add(id));
    mission.turns.forEach(turn => turn.phraseIds.forEach(id => used.add(id)));
    assert.ok(mission.resources.every(id => resourceById(id)));
    assert.equal(mission.listening.length, 3);
    for (const listening of mission.listening) {
      assert.ok(listening.transcriptEn && listening.dialogue.length >= 4);
      assert.equal(listening.questions.length, 3);
      for (const question of listening.questions) {
        assert.ok(question.questionEn);
        assert.equal(question.options.length, question.optionsEn.length);
        assert.ok(question.options[question.answer] && question.optionsEn[question.answer]);
      }
    }
    for (const turn of mission.turns) {
      assert.equal(turn.prompts.length, turn.promptsEn.length);
      assert.ok(turn.goalDe && turn.modelEn && turn.rephraseEn);
      assert.equal(turn.criteriaDe.length, 3);
      assert.ok(turn.phraseIds.every(id => phraseIds.has(id)));
    }
  }
  assert.equal([...phraseIds].filter(id => !used.has(id)).length, 0, 'Every phrase needs a course context.');
  for (const resource of RESOURCES) {
    assert.ok(resource.missionIds.every(id => MISSIONS.some(mission => mission.id === id)));
    assert.ok(resource.phraseIds.every(id => phraseIds.has(id)));
  }
});

test('every normal and short route validates for all three dialogue variants', () => {
  for (const mission of MISSIONS) {
    for (const short of [false, true]) {
      const state = newState();
      state.preferences.dailyMinutes = short ? 15 : 90;
      for (let variant = 0; variant < 3; variant++) {
        const session = createSession(state, mission.id);
        state.sessions.push(session);
        validateState(state);
        const tasks = tasksFor(session);
        assert.equal(session.variant, variant);
        assert.equal(tasks.find(task => task.kind === 'listen').listening.title, mission.listening[variant].title);
        assert.ok(tasks.filter(task => task.kind === 'speak' && !task.retry).length >= 2);
        assert.ok(tasks.filter(task => task.kind === 'speak').every(task => task.goalDe && task.modelEn));
        assert.equal(tasks.at(-1).kind, 'wrap');
        session.completedAt = Date.now();
      }
    }
  }
});

test('appointment confirmations and closings use the date actually selected', () => {
  const session = createSession(newState(), 'appointment-change');
  session.drafts.intro = { intent: 'accepted' };
  let tasks = tasksFor(session);
  assert.match(tasks.find(task => task.id === 'confirm').prompt, /Donnerstag/);
  assert.match(tasks.find(task => task.id === 'close').prompt, /Donnerstag/);
  assert.ok(tasks.find(task => task.id === 'confirm').criteria.includes('I said nine thirty.'));
  session.drafts.intro = { intent: 'check' };
  tasks = tasksFor(session);
  assert.match(tasks.find(task => task.id === 'confirm').prompt, /Bis wann/);
  assert.match(tasks.find(task => task.id === 'close').prompt, /Rückmeldung/);
});
