import { expect } from '@playwright/test';
import { newState } from '../../app/js/model.js';
import { createSession, tasksFor } from '../../app/js/session.js';

export class PracticePage {
  constructor(page) { this.page = page; }

  async open() {
    await this.page.goto('/');
    await expect(this.page.getByRole('heading', { name: 'A little more confident, every day.' })).toBeVisible();
    // These fixtures exercise the existing A2–B1 course; new learners now start on the beginner path.
    await this.page.getByRole('combobox', { name: 'Learning path', exact: true }).selectOption('work');
    await expect(this.page.getByRole('button', { name: 'Start this mission', exact: true })).toBeVisible();
  }

  async seedTask(taskId = 'intro', missionId = 'first-interview') {
    await this.open();
    const state = newState();
    state.preferences.learningPath = 'work';
    const session = createSession(state, missionId, { id: 'browser-session' });
    session.cursor = tasksFor(session).findIndex(task => task.id === taskId);
    state.sessions.push(session);
    await this.page.evaluate(async data => {
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open('sprich-german-v2'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      await new Promise((resolve, reject) => { const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').put(data, 'state'); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
      db.close();
    }, state);
    await this.page.goto('/#session/browser-session');
    await expect(this.page.getByRole('heading', { name: 'One clear answer is enough.' })).toBeVisible();
  }

  async chooseShortGoal() {
    await this.page.getByRole('combobox', { name: 'Daily practice goal' }).selectOption('15');
    await expect.poll(async () => (await this.readState()).preferences.dailyMinutes).toBe(15);
  }

  async markSpokenAndReflect() {
    await this.page.getByRole('checkbox', { name: 'I practised aloud (recording is optional)' }).check();
    const criteria = this.page.getByRole('group', { name: 'Speaking self-assessment' }).getByRole('checkbox');
    for (const checkbox of await criteria.all()) await checkbox.check();
  }

  async readState() {
    return this.page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open('sprich-german-v2'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const result = await new Promise((resolve, reject) => { const request = db.transaction('meta').objectStore('meta').get('state'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      db.close();
      return result;
    });
  }
}
