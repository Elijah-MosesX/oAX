const $ = (id) => document.getElementById(id);
let csrf,
  observation,
  displayed,
  eventIndex = 0;
const token = location.hash.slice(1);
history.replaceState(null, '', '/');
async function post(route, payload) {
  const response = await fetch(route, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(csrf ? { 'X-oax-csrf': csrf } : {}),
    },
    body: JSON.stringify(payload),
    credentials: 'same-origin',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Operation failed');
  return data;
}
function position(offset) {
  const lines = $('source').value.slice(0, offset).split('\n');
  return { line: lines.length - 1, column: lines.at(-1).length };
}
function capture() {
  if (!observation) throw new Error('Open a source file first');
  const start = position($('source').selectionStart),
    end = position($('source').selectionEnd);
  return { ...observation, cursor: start, selection: { start, end } };
}
$('source').addEventListener('select', () => {
  const current = capture();
  $('position').textContent =
    `Selection ${current.selection.start.line}:${current.selection.start.column} → ${current.selection.end.line}:${current.selection.end.column} · version ${current.documentVersion}`;
});
$('open').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const data = await post('/file', { resource: $('resource').value });
    observation = data.observation;
    $('source').value = observation.text;
    $('version').textContent = `v${observation.documentVersion} · saved`;
    $('feedback').textContent =
      'Select a symbol in the source, then inspect its evidence.';
    $('result').textContent = '';
    displayed = undefined;
    $('export').disabled = true;
  } catch (error) {
    $('feedback').textContent = error.message;
  }
});
for (const button of document.querySelectorAll('[data-method]'))
  button.addEventListener('click', async () => {
    const controls = [...document.querySelectorAll('button')];
    try {
      const payload = { observation: capture() };
      const method = button.dataset.method;
      if (method === 'graph.query') payload.relationship = 'callers';
      if (method === 'context.preview')
        payload.objective =
          'Explain the selected symbol and its direct callers';
      controls.forEach((control) => {
        control.disabled = true;
      });
      $('feedback').textContent = 'Gathering evidence from the local runtime…';
      const data = await post('/rpc', { method, payload });
      $('result').textContent = JSON.stringify(data.result, null, 2);
      displayed = {
        format: 'oax-evidence.v1',
        method,
        capturedAt: new Date().toISOString(),
        result: data.result,
      };
      $('feedback').textContent =
        'Evidence returned. Resolution, freshness and limitations are included where available.';
    } catch (error) {
      $('feedback').textContent = error.message;
    } finally {
      controls.forEach((control) => {
        control.disabled = false;
      });
      $('export').disabled = !displayed;
    }
  });
$('export').addEventListener('click', () => {
  if (!displayed) return;
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(displayed, null, 2)], {
      type: 'application/json',
    }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'oax-evidence.json';
  link.click();
  URL.revokeObjectURL(url);
});
if ('serviceWorker' in navigator)
  navigator.serviceWorker.register('/sw.js').catch(() => {});
post(token ? '/connect' : '/resume', token ? { token } : {})
  .then((data) => {
    csrf = data.csrf;
    $('workspace').textContent = data.workspace;
    $('connection').textContent = 'Connected · private local runtime';
    const poll = async () => {
      try {
        const data = await post('/events', { after: eventIndex });
        eventIndex = data.latest;
        if (data.events.length)
          $('events').textContent = JSON.stringify(data.events, null, 2);
        setTimeout(poll, 1500);
      } catch (error) {
        $('connection').textContent = `Disconnected · ${error.message}`;
      }
    };
    void poll();
  })
  .catch((error) => {
    $('connection').textContent =
      `Connection failed · ${error.message}. Relaunch for a fresh single-use link.`;
  });
