import { esc, icon } from './ui.js';

export function phraseForm(source = null) {
  return `<form class="personal-phrase-form"><div class="form-grid">
    <label>German phrase<input type="text" name="de" lang="de" required maxlength="500" placeholder="Ich rufe wegen … an."></label>
    <label>English meaning<input type="text" name="en" lang="en" required maxlength="1000" placeholder="I am calling about …"></label>
    <label class="full">Your own example sentence<textarea name="example" lang="de" maxlength="1500" placeholder="Use the phrase in a situation that matters to you."></textarea></label>
    <label class="full">Source link (optional)<input type="text" name="sourceUrl" inputmode="url" value="${esc(source?.url ?? '')}" placeholder="https://…"></label>
    <input type="hidden" name="sourceId" value="${esc(source?.id ?? '')}"><input type="hidden" name="sourceTitle" value="${esc(source?.title ?? '')}">
    </div><div class="btn-row form-actions"><button class="btn" type="submit">${icon('book')}Save phrase to my collection</button><a class="inline-link" href="#phrases">Open my phrases ${icon('arrow')}</a></div>
    <p class="fine">Saved phrases can be recalled aloud and travel with your progress export. Their wording is your own; check it against the source.</p></form>`;
}

export function bindPhraseForm(root, ctx, onSaved = () => {}) {
  root.querySelectorAll('.personal-phrase-form').forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    if (button.disabled) return;
    button.disabled = true;
    try {
      const data = Object.fromEntries(new FormData(form));
      const id = await ctx.store.addPersonalPhrase(data);
      form.reset();
      ctx.notify('Phrase saved. Matching phrases are kept once, including across devices.');
      await onSaved(id);
    } catch (error) { ctx.error(error.message); }
    finally { if (button.isConnected) button.disabled = false; }
  }));
}
