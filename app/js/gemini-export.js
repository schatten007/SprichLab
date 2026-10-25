import { buildGeminiPack, GEMINI_FACTS, GEMINI_LEVELS } from './gemini-pack.js';
import { levelById } from '../data/starter-catalog.js';
import { esc, icon, safeAction, downloadFile } from './ui.js';

/** Shared by lesson overview, active lessons, workplace sessions, and the Gemini companion. */
export function mountGeminiExport(host, ctx, source, { beforeExport = async () => {}, level = source.level ?? 'starter', open = false } = {}) {
  const profile = ctx.store.state.profile;
  const support = source.support === 'light' ? 'light' : 'guided';
  const available = Object.entries(GEMINI_FACTS).filter(([key]) => profile[key]?.trim());
  host.innerHTML = `<details class="card gemini-export" ${open ? 'open' : ''}><summary>Export for Gemini ${icon('external')}</summary>
    <p class="small section-gap">Take <strong>${esc(source.title)}</strong> into a natural voice conversation on your phone. This pack includes the lesson’s words, meanings, models, and roleplay instructions.</p>
    <div class="gemini-pack-grid"><section class="gemini-pack-config" aria-label="Practice pack options"><p class="eyebrow">01 · PERSONALISE</p><h3>Make it yours.</h3>
    <div class="form-grid"><label>Level target<select data-pack-level aria-label="Level target">${GEMINI_LEVELS.map(id => { const entry = levelById(id); return `<option value="${id}" ${level === id ? 'selected' : ''}>${esc(entry ? `${entry.short} · ${entry.label}` : id)}</option>`; }).join('')}</select></label>
    <label>Help from Gemini<select data-pack-support aria-label="Help from Gemini"><option value="guided" ${support === 'guided' ? 'selected' : ''}>Guided · hints and English when needed</option><option value="light" ${support === 'light' ? 'selected' : ''}>Less help · only when I ask</option></select></label></div>
    ${available.length ? `<fieldset class="pack-facts"><legend>Optional facts to include</legend>${available.map(([key, label]) => `<label class="check-label"><input type="checkbox" data-pack-fact="${key}">${esc(label)}: ${esc(profile[key])}</label>`).join('')}<p class="fine">Only checked fields go into the pack. You can edit the text below.</p></fieldset>` : '<p class="fine section-gap">No profile facts are included. Add optional facts in <a href="#settings">Settings</a> if you want to personalise the pack.</p>'}
    </section><section class="gemini-pack-editor" aria-label="Editable practice pack"><p class="eyebrow">02 · PREVIEW &amp; EXPORT</p>
    <label>Practice pack preview<textarea data-pack-text aria-label="Practice pack preview" rows="16" maxlength="16000" spellcheck="false"></textarea></label>
    <p class="fine">Edit freely. Changing the level, help, or checked facts rebuilds this preview.</p>
    <div class="btn-row section-gap"><button class="btn" data-pack-copy>${icon('book')}Copy practice pack</button><button class="btn secondary" data-pack-download>${icon('download')}Download .txt</button><button class="btn secondary" data-pack-share ${typeof navigator.share === 'function' ? '' : 'hidden'}>${icon('external')}Share</button></div>
    <p class="fine section-gap" data-pack-status role="status"></p>
    <div class="gemini-export-boundary">${icon('eye')}<div><strong>Exporting does not complete or grade a lesson.</strong><p class="fine">Prepared on this device. You choose when to send it.</p></div></div>
    </section><section class="gemini-handoff" aria-label="Phone handoff"><p class="eyebrow">03 · CONTINUE ON YOUR PHONE</p><h3>Phone handoff</h3>
    <p class="fine">Gemini runs outside Sprich. The pack is prepared locally; the conversation needs your own Gemini app or chat.</p>
    <ol class="guided-steps"><li><strong>On your phone:</strong> copy this pack into a normal Gemini chat, then tap Live.</li><li><strong>On your computer:</strong> paste it into a normal <a href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer">Gemini text chat</a>. Open that same chat in the Gemini phone app and tap Live. The .txt file is another way to carry the lesson between devices.</li><li>Ask Gemini to start the warm-up. Come back afterward to save a takeaway. Copying or downloading does not complete this lesson.</li></ol>
    <a class="btn secondary" href="#assessments/lesson/${esc(source.id)}">Use a graded roleplay ${icon('arrow')}</a></section></div></details>`;
  const editor = host.querySelector('[data-pack-text]');
  const status = host.querySelector('[data-pack-status]');
  const rebuild = () => {
    const facts = Object.fromEntries([...host.querySelectorAll('[data-pack-fact]:checked')].map(input => [input.dataset.packFact, profile[input.dataset.packFact]]));
    editor.value = buildGeminiPack(source, { level: host.querySelector('[data-pack-level]').value, support: host.querySelector('[data-pack-support]').value, facts });
  };
  rebuild();
  host.querySelector('[data-pack-level]').addEventListener('change', rebuild);
  host.querySelector('[data-pack-support]').addEventListener('change', rebuild);
  host.querySelectorAll('[data-pack-fact]').forEach(input => input.addEventListener('change', rebuild));
  const prepare = async () => {
    await beforeExport();
    if (ctx.signal?.aborted) return false;
    ctx.speech.stop(); document.querySelectorAll('audio').forEach(audio => audio.pause());
    if (!editor.value.trim()) throw new Error('Keep some lesson text in the practice pack first.');
    return true;
  };
  const manualCopy = () => { editor.focus(); editor.select(); status.textContent = 'Copy the selected text manually, or choose Download .txt.'; };
  safeAction(host.querySelector('[data-pack-copy]'), async () => {
    if (!await prepare()) return;
    try { await navigator.clipboard.writeText(editor.value); status.textContent = 'Practice pack copied. Paste it into Gemini, then use Live on your phone.'; }
    catch { manualCopy(); }
  }, ctx.error);
  safeAction(host.querySelector('[data-pack-download]'), async () => {
    if (!await prepare()) return;
    downloadFile(editor.value, `sprich-${source.id}-gemini.txt`, 'text/plain;charset=utf-8');
    status.textContent = 'Practice pack downloaded. Open it on your phone and copy it into Gemini.';
  }, ctx.error);
  safeAction(host.querySelector('[data-pack-share]'), async () => {
    if (!await prepare()) return;
    try { await navigator.share({ title: `Sprich · ${source.title}`, text: editor.value }); }
    catch (error) { if (error.name !== 'AbortError') manualCopy(); }
  }, ctx.error);
}
