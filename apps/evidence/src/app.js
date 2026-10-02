import { parseEvidence } from './validate.ts';
const $ = (id) => document.getElementById(id);
const clear = () => {
  $('evidence').value = '';
  $('details').hidden = true;
  for (const id of ['symbol', 'metadata', 'excerpt', 'related', 'limitations'])
    $(id).textContent = '';
  $('status').textContent = 'Evidence cleared. Nothing was stored.';
};
$('clear').addEventListener('click', clear);
$('import').addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const { context, capturedAt } = parseEvidence($('evidence').value);
    $('symbol').textContent = context.focusedSymbol?.name || context.path;
    $('metadata').textContent =
      `${context.path} · v${context.documentVersion} · captured ${capturedAt} · ${context.dirty ? 'unsaved' : 'saved'} · ${context.truncated ? 'truncated' : 'bounded'}`;
    $('excerpt').textContent = context.excerpt;
    $('related').replaceChildren();
    for (const item of context.related || []) {
      const title = document.createElement('p'),
        code = document.createElement('pre');
      title.textContent = `${item.path}:${item.range.start.line + 1} · ${item.reason} · ${item.resolution} · hash ${item.hash}`;
      code.textContent = item.excerpt;
      $('related').append(title, code);
    }
    $('limitations').replaceChildren();
    for (const value of [
      ...(context.limitations || []),
      'Imported evidence may be stale; this viewer does not recheck workspace files.',
      'This viewer does not verify provenance or historical causes.',
    ]) {
      const li = document.createElement('li');
      li.textContent = value;
      $('limitations').append(li);
    }
    $('details').hidden = false;
    $('status').textContent =
      'Validated ContextSlice loaded locally. No evidence was uploaded.';
  } catch {
    $('details').hidden = true;
    $('status').textContent =
      'Invalid evidence. Paste a bounded context.preview export in oax-evidence.v1 format.';
  }
});
let installPrompt;
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  $('install').hidden = false;
});
$('install').addEventListener('click', async () => {
  if (installPrompt) {
    await installPrompt.prompt();
    installPrompt = undefined;
    $('install').hidden = true;
  }
});
if ('serviceWorker' in navigator)
  navigator.serviceWorker.register('./sw.js').catch(() => {});
