const KEYS = ['nav_chatgpt', 'nav_gemini', 'nav_claude'];

chrome.storage.local.get(KEYS, (data) => {
  document.querySelectorAll('.row').forEach(row => {
    const inp = row.querySelector('input');
    const on = !!data[inp.dataset.key];
    inp.checked = on;
    row.classList.toggle('on', on);
  });
});

document.querySelectorAll('.row').forEach(row => {
  const inp = row.querySelector('input');
  const key = inp.dataset.key;

  function set(val) {
    inp.checked = val;
    row.classList.toggle('on', val);
    chrome.storage.local.set({ [key]: val });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_NAVIGATOR', key, enabled: val }).catch(() => {});
    });
  }

  inp.addEventListener('change', () => set(inp.checked));
  row.addEventListener('click', () => set(!inp.checked));
});
