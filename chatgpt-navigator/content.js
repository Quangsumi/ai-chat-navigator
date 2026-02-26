/* AI Chat Navigator v8 — ChatGPT · Gemini · Claude */
(function () {
  'use strict';

  // ─── Site detection ──────────────────────────────────────────────────────────
  const H = location.hostname;
  const SITE =
    (H.includes('chatgpt.com') || H.includes('chat.openai.com')) ? 'chatgpt' :
    H.includes('gemini.google.com') ? 'gemini' :
    H.includes('claude.ai')         ? 'claude'  : null;
  if (!SITE) return;

  const CFG = {
    chatgpt: { key: 'nav_chatgpt', label: 'ChatGPT', icon: '🤖', accent: '#74d7a0', dim: 'rgba(116,215,160,.08)' },
    gemini:  { key: 'nav_gemini',  label: 'Gemini',  icon: '✦',  accent: '#5ab4f5', dim: 'rgba(90,180,245,.08)'  },
    claude:  { key: 'nav_claude',  label: 'Claude',  icon: '✺',  accent: '#e8a87c', dim: 'rgba(232,168,124,.08)' },
  }[SITE];

  const WK = 'nw_' + SITE;
  const A  = CFG.accent;

  // ─── State ───────────────────────────────────────────────────────────────────
  let on = false, panelOpen = false, W = 300, curIdx = -1, query = '';
  let blocks = [], tmr = null, obs = null, resizing = false, rx = 0, rw = 0;
  let host, shadow, fab, panel, lst, cnt, searchEl;

  // ─── Boot ────────────────────────────────────────────────────────────────────
  chrome.storage.local.get([CFG.key, WK], d => {
    if (d[WK]) W = Math.max(200, Math.min(580, +d[WK]));
    if (d[CFG.key]) { on = true; mount(); }
  });

  chrome.runtime.onMessage.addListener(msg => {
    if (msg.type !== 'TOGGLE_NAVIGATOR' || msg.key !== CFG.key) return;
    if (msg.enabled && !on)  { on = true;  mount();   }
    if (!msg.enabled && on)  { on = false; unmount(); }
  });

  // ─── Mount / Unmount ─────────────────────────────────────────────────────────
  function mount() {
    host = document.createElement('div');
    Object.assign(host.style, {
      all: 'initial', position: 'fixed', top: 0, left: 0,
      width: 0, height: 0, overflow: 'visible',
      zIndex: 2147483647, pointerEvents: 'none',
    });
    document.documentElement.appendChild(host);
    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${styles()}</style>`;
    buildFAB();
    buildPanel();
    setTimeout(scan, 600);
    obs = new MutationObserver(() => { clearTimeout(tmr); tmr = setTimeout(scan, 700); });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    // FIX 1: Do NOT auto-open — panel starts hidden, FAB is always visible
    // showPanel() removed — user opens manually
  }

  function unmount() {
    obs?.disconnect(); obs = null;
    host?.remove();
    host = shadow = fab = panel = lst = cnt = searchEl = null;
    document.body.classList.remove('nav-open', 'nav-closed');
    document.documentElement.style.removeProperty('--nav-w');
    blocks = []; curIdx = -1; panelOpen = false; query = '';
  }

  // ─── FAB ─────────────────────────────────────────────────────────────────────
  function buildFAB() {
    fab = el('div', 'fab');
    fab.innerHTML = `<span class="fi">${CFG.icon}</span><span class="fl">NAV</span>`;
    fab.addEventListener('click', togglePanel);
    shadow.appendChild(fab);
  }

  // ─── Panel ───────────────────────────────────────────────────────────────────
  function buildPanel() {
    panel = el('div', 'panel off');
    panel.innerHTML = `
      <div class="rh" id="rh"></div>
      <div class="hd">
        <div class="logo"><span class="li">${CFG.icon}</span><span class="lt">${CFG.label} Navigator</span></div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="mc">Q: <b id="cnt">0</b></span>
          <button class="xb" id="xb">✕</button>
        </div>
      </div>
      <div class="sb-wrap"><input class="sb" id="sb" type="text" placeholder="Search questions…" autocomplete="off" spellcheck="false"></div>
      <div class="list" id="lst"></div>
      <div class="ft"><span class="k">↔ drag to resize</span><span class="k">click to jump</span></div>`;
    shadow.appendChild(panel);

    lst      = shadow.getElementById('lst');
    cnt      = shadow.getElementById('cnt');
    searchEl = shadow.getElementById('sb');

    shadow.getElementById('xb').addEventListener('click', hidePanel);
    shadow.getElementById('rh').addEventListener('mousedown', startResize);

    searchEl.addEventListener('input', () => { query = searchEl.value.trim().toLowerCase(); render(); });

    // FIX 3: Stop ALL keyboard events on the search box from reaching the page
    searchEl.addEventListener('keydown',  e => e.stopPropagation(), true);
    searchEl.addEventListener('keyup',    e => e.stopPropagation(), true);
    searchEl.addEventListener('keypress', e => e.stopPropagation(), true);

    panel.style.width = W + 'px';
  }

  // ─── Panel open / close ───────────────────────────────────────────────────────
  function showPanel() {
    panelOpen = true;
    panel.classList.remove('off');
    fab.classList.add('open');
    shiftBody(W);
  }
  function hidePanel() {
    panelOpen = false;
    panel.classList.add('off');
    fab.classList.remove('open');
    shiftBody(0);
  }
  function togglePanel() { panelOpen ? hidePanel() : showPanel(); }

  function shiftBody(w) {
    document.documentElement.style.setProperty('--nav-w', w + 'px');
    document.body.classList.toggle('nav-open',   w > 0);
    document.body.classList.toggle('nav-closed', w === 0);
    fab.style.right = (w > 0 ? w + 10 : 16) + 'px';
  }

  // ─── Resize ───────────────────────────────────────────────────────────────────
  function startResize(e) {
    e.preventDefault(); resizing = true; rx = e.clientX; rw = W;
    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', endResize);
  }
  function onResize(e) {
    if (!resizing) return;
    W = Math.max(200, Math.min(580, rw + rx - e.clientX));
    panel.style.width = W + 'px';
    if (panelOpen) shiftBody(W);
    updateClamp();
  }
  function endResize() {
    resizing = false;
    document.removeEventListener('mousemove', onResize);
    document.removeEventListener('mouseup', endResize);
    chrome.storage.local.set({ [WK]: W });
  }
  function updateClamp() {
    const n = W < 240 ? 2 : W < 300 ? 3 : W < 380 ? 4 : W < 460 ? 5 : 7;
    shadow.querySelectorAll('.tx').forEach(e => e.style.webkitLineClamp = n);
    panel._cl = n;
  }

  // ─── Scan ─────────────────────────────────────────────────────────────────────
  function scan() {
    const seen = new Set();
    blocks = getMessages()
      .filter(e => { if (seen.has(e)) return false; seen.add(e); return true; })
      .filter(e => getText(e).length > 1)
      .map((e, i) => ({ e, i, text: getText(e) }));
    render();
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  function render() {
    if (!lst) return;
    const filtered = query ? blocks.filter(b => b.text.toLowerCase().includes(query)) : blocks;
    cnt.textContent = filtered.length;
    lst.innerHTML = '';

    if (!filtered.length) {
      lst.innerHTML = `<div class="empty">${query ? 'No matches.' : 'No messages yet.<br>Start chatting!'}</div>`;
      return;
    }
    const cl = panel._cl || 3;
    filtered.forEach(({ e, i, text }) => {
      const it = el('div', 'it' + (i === curIdx ? ' on' : ''));
      it.dataset.i = i;
      it.innerHTML = `<span class="num">${String(i+1).padStart(2,'0')}</span><span class="tx" style="-webkit-line-clamp:${cl}">${query ? highlight(text, query) : esc(text)}</span>`;
      it.addEventListener('click', () => jump(i));
      lst.appendChild(it);
    });
  }

  function highlight(text, q) {
    return esc(text).replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'), '<mark>$1</mark>');
  }

  function jump(i) {
    if (i < 0 || i >= blocks.length) return;
    curIdx = i;
    blocks[i].e.scrollIntoView({ behavior: 'smooth', block: 'start' });
    shadow.querySelectorAll('.it').forEach(e => e.classList.remove('on'));
    const it = lst.querySelector(`[data-i="${i}"]`);
    if (it) { it.classList.add('on'); it.scrollIntoView({ block: 'nearest' }); }
  }

  // ─── Message finders ─────────────────────────────────────────────────────────
  function getMessages() {
    if (SITE === 'chatgpt') return qsa('[data-message-author-role="user"]');
    if (SITE === 'gemini')  return qsa('user-query');
    if (SITE === 'claude')  return getClaudeMessages();
    return [];
  }

  function getText(el) {
    if (SITE === 'gemini') return getGeminiText(el);
    return el.textContent.trim();
  }

  // ─── Gemini: strip "You said" prefix ─────────────────────────────────────────
  function getGeminiText(el) {
    const raw = el.textContent.trim();
    const stripped = raw.replace(/^you said[:\s]*/i, '').trim();
    if (stripped.length > 1) return stripped;
    for (const child of el.children) {
      const t = child.textContent.trim();
      if (t.length > 1 && !/^you said[:\s]*$/i.test(t)) return t;
    }
    return raw;
  }

  // ─── Claude finder ───────────────────────────────────────────────────────────
  // FIX 2: Only scan on conversation pages (URL has /chat/).
  // Use only specific, strict selectors — no broad fallback that matches
  // profile UI elements like username or plan name.
  function getClaudeMessages() {
    // Guard: Claude homepage / settings don't have conversations
    if (!location.pathname.includes('/chat')) return [];

    const sels = [
      '[data-testid="human-turn"]',
      '[data-testid="user-human-turn"]',
      '[data-testid="user-message"]',
      '.human-turn',
      '[class*="HumanTurn"]',
      '[class*="humanTurn"]',
    ];
    for (const s of sels) {
      const found = qsa(s).filter(e => e.textContent.trim().length > 1);
      if (found.length) return found;
    }
    return [];
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  function qsa(s) { try { return [...document.querySelectorAll(s)]; } catch { return []; } }
  function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // ─── Styles ──────────────────────────────────────────────────────────────────
  function styles() { return `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    .fab {
      position: fixed; right: 16px; top: 50%; transform: translateY(-50%);
      width: 36px; height: 60px;
      background: #0d0d10; border: 1.5px solid #252535; border-radius: 11px;
      cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;
      box-shadow: 0 2px 20px rgba(0,0,0,.8), 0 0 0 1px rgba(255,255,255,.04);
      pointer-events: all; font-family: monospace;
      transition: border-color .2s, right .3s ease;
    }
    .fab:hover { border-color: ${A}; }
    .fab.open  { border-color: ${A}; background: ${CFG.dim}; }
    .fi { font-size: 14px; color: #555568; transition: color .2s; }
    .fab:hover .fi, .fab.open .fi { color: ${A}; }
    .fl { font-size: 7px; color: #404050; writing-mode: vertical-rl; letter-spacing: 1px; }

    .panel {
      position: fixed; top: 0; right: 0;
      width: 300px; min-width: 200px; max-width: 580px; height: 100vh;
      background: #0d0d10; border-left: 1.5px solid #1e1e2c;
      display: flex; flex-direction: column;
      font-family: system-ui, -apple-system, sans-serif;
      box-shadow: -4px 0 32px rgba(0,0,0,.7);
      transform: translateX(0); transition: transform .3s ease;
      pointer-events: all; overflow: hidden;
    }
    .panel.off { transform: translateX(110%); }

    .rh {
      position: absolute; left: 0; top: 0; width: 5px; height: 100%;
      cursor: ew-resize; z-index: 1; background: transparent; transition: background .2s;
    }
    .rh:hover { background: linear-gradient(to right, rgba(255,255,255,.1), transparent); }

    .hd {
      padding: 13px 12px 11px 16px; border-bottom: 1px solid #1c1c28;
      display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-shrink: 0;
      background: linear-gradient(160deg, #0d0d10, #10101a);
    }
    .logo { display: flex; align-items: center; gap: 7px; min-width: 0; }
    .li { width: 22px; height: 22px; background: ${CFG.dim}; border: 1px solid ${A}44; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; }
    .lt { font-size: 12px; font-weight: 700; color: #ddddf0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mc { font-size: 9px; color: #505065; font-family: monospace; white-space: nowrap; }
    .mc b { color: ${A}; }
    .xb { background: none; border: none; color: #505065; cursor: pointer; font-size: 15px; padding: 1px 4px; border-radius: 4px; line-height: 1; transition: color .15s, background .15s; }
    .xb:hover { color: #ddddf0; background: #222232; }

    .sb-wrap { padding: 8px 12px; border-bottom: 1px solid #1c1c28; flex-shrink: 0; }
    .sb {
      width: 100%; padding: 7px 10px;
      background: #13131e; border: 1px solid #252535; border-radius: 7px;
      color: #d0d0e8; font-size: 12px; font-family: system-ui, sans-serif;
      outline: none; transition: border-color .15s;
    }
    .sb::placeholder { color: #404055; }
    .sb:focus { border-color: ${A}88; }

    .list { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 4px 0 10px; scrollbar-width: thin; scrollbar-color: #252535 transparent; }
    .list::-webkit-scrollbar { width: 3px; }
    .list::-webkit-scrollbar-thumb { background: #252535; border-radius: 2px; }

    .it { display: flex; align-items: flex-start; gap: 9px; padding: 8px 12px 8px 16px; cursor: pointer; border-right: 2px solid transparent; transition: background .1s, border-color .1s; min-width: 0; }
    .it + .it { border-top: 1px solid rgba(255,255,255,.03); }
    .it:hover { background: rgba(255,255,255,.04); border-right-color: rgba(255,255,255,.1); }
    .it.on { background: ${CFG.dim}; border-right-color: ${A}; }

    .num { font-size: 9px; color: ${A}; min-width: 20px; padding-top: 2px; flex-shrink: 0; font-family: monospace; }
    .tx { font-size: 12px; color: #636378; line-height: 1.6; flex: 1; min-width: 0; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; word-break: break-word; transition: color .1s; }
    .it:hover .tx, .it.on .tx { color: #ddddf0; }
    mark { background: ${A}33; color: ${A}; border-radius: 2px; padding: 0 1px; }

    .empty { padding: 20px 16px; text-align: center; font-size: 10px; color: #3d3d52; line-height: 1.7; font-family: monospace; }

    .ft { padding: 8px 12px; border-top: 1px solid #1c1c28; display: flex; gap: 6px; flex-shrink: 0; flex-wrap: wrap; }
    .k { font-size: 8px; color: #404052; font-family: monospace; background: #121220; border: 1px solid #1e1e2c; padding: 2px 6px; border-radius: 3px; white-space: nowrap; }
  `; }

})();
