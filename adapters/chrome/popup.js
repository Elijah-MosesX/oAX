import { workbenchLink } from './link.js';
document.getElementById('connect').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = document.getElementById('link');
  try {
    const url = workbenchLink(input.value.trim());
    input.value = '';
    await chrome.tabs.create({ url });
    window.close();
  } catch (error) {
    document.getElementById('status').textContent = error.message;
  }
});
