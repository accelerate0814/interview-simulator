/* ── State ─────────────────────────────────────── */
const S = {
  messages:       [],
  sessionId:      null,
  isStreaming:    false,
  isRecording:    false,
  ttsEnabled:     false,
  darkMode:       false,
  sessionStart:   null,
  timerInterval:  null,
  turnCount:      0,
  interviewEnded: false,
  endedAt:        null,   // timestamp the interview was ended — freezes the clock
  reportData:     null,
  isPaused:       false,
  pausedMs:       0,      // total milliseconds accumulated while paused
  pauseStart:     null,   // timestamp when current pause began
  useResume:      false,  // this interview references the stored résumé
  jdId:           null,   // this interview references this saved JD (id)
};

const $ = id => document.getElementById(id);
marked.setOptions({ breaks: true, gfm: true });

/* ── Model Presets ─────────────────────────────── */
const PRESETS = {
  deepseek:   { name: 'DeepSeek',              base_url: 'https://api.deepseek.com',                                    model: 'deepseek-chat',                   note: 'DeepSeek V3 / R1，性价比高，推荐用于技术面试。' },
  qianwen:    { name: '千问 (Tongyi)',          base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',           model: 'qwen-max',                        note: '阿里云百炼，支持 qwen-max / qwen-plus / qwen-turbo。' },
  zhipu:      { name: '智谱 (ChatGLM)',         base_url: 'https://open.bigmodel.cn/api/paas/v4/',                       model: 'glm-4',                           note: '智谱 AI，支持 glm-4 / glm-4-flash（免费额度）。' },
  openai:     { name: 'OpenAI',                 base_url: 'https://api.openai.com/v1',                                   model: 'gpt-4o',                          note: '需要国际网络。支持 gpt-4o / gpt-4o-mini。' },
  moonshot:   { name: 'Moonshot (Kimi)',         base_url: 'https://api.moonshot.cn/v1',                                  model: 'moonshot-v1-8k',                  note: '国内访问，支持 moonshot-v1-8k / 32k / 128k。' },
  openrouter: { name: 'OpenRouter (Claude 等)', base_url: 'https://openrouter.ai/api/v1',                                model: 'anthropic/claude-sonnet-4-5',     note: '聚合平台，可访问 Claude、GPT-4o、Gemini 等，需注册 openrouter.ai。' },
};

/* ── LLM Config (localStorage) ────────────────── */
function loadCfg() {
  try { return JSON.parse(localStorage.getItem('isim_llm_cfg') || 'null'); } catch { return null; }
}
function saveCfg(cfg) {
  localStorage.setItem('isim_llm_cfg', JSON.stringify(cfg));
}

/* ── Client identity (no login) ────────────────── */
// A stable per-browser id so the backend can de-dup interview questions across
// every session this user ever runs. Generated once, kept in localStorage.
function clientId() {
  let id = null;
  try { id = localStorage.getItem('isim_client_id'); } catch (_) {}
  if (!id) {
    id = (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'c-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    try { localStorage.setItem('isim_client_id', id); } catch (_) {}
  }
  return id;
}

/* ── Active session persistence (survives reload / tab-discard) ── */
const ACTIVE_KEY = 'isim_active_session';

function persistSession() {
  if (!S.sessionId || !S.sessionStart) { clearPersistedSession(); return; }
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify({
      v: 1,
      sessionId:      S.sessionId,
      turnCount:      S.turnCount,
      sessionStart:   S.sessionStart,
      pausedMs:       S.pausedMs,
      isPaused:       S.isPaused,
      pauseStart:     S.pauseStart,
      interviewEnded: S.interviewEnded,
      endedAt:        S.endedAt,
      useResume:      S.useResume,
      jdId:           S.jdId,
    }));
  } catch (_) {}
}

function clearPersistedSession() {
  try { localStorage.removeItem(ACTIVE_KEY); } catch (_) {}
}

async function restoreActiveSession() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null'); } catch { saved = null; }
  if (!saved || !saved.sessionId || !saved.sessionStart) return false;

  let d;
  try {
    const r = await fetch(`/api/sessions/${saved.sessionId}/messages`);
    if (!r.ok) { clearPersistedSession(); return false; }
    d = await r.json();
  } catch (_) { return false; } // network hiccup: keep the key, try again next load

  S.messages       = d.messages;
  S.sessionId      = saved.sessionId;
  S.turnCount      = saved.turnCount ?? d.messages.filter(m => m.role === 'user').length;
  S.sessionStart   = saved.sessionStart;
  S.pausedMs       = saved.pausedMs   || 0;
  S.isPaused       = !!saved.isPaused;
  S.pauseStart     = saved.pauseStart || null;
  S.interviewEnded = !!saved.interviewEnded;
  S.endedAt        = saved.endedAt || null;
  S.useResume      = !!saved.useResume;
  S.jdId           = saved.jdId ?? null;

  $('messages').innerHTML = '';
  for (const m of d.messages) appendMsg(m.role, m.content, true);

  $('welcome-screen').style.display = 'none';
  $('messages-wrap').classList.add('visible');
  $('turn-count').textContent = S.turnCount;

  if (S.interviewEnded) {
    $('ended-bar').classList.add('visible');
  } else {
    $('input-area').classList.add('visible');
  }

  if (S.isPaused) {
    document.querySelector('.timer-card')?.classList.add('paused');
    const hint = $('pause-hint'); if (hint) hint.textContent = '点击继续';
  }

  clearInterval(S.timerInterval);
  if (!S.interviewEnded) S.timerInterval = setInterval(tickTimer, 1000);
  tickTimer();

  document.querySelectorAll('.session-item').forEach(el =>
    el.classList.toggle('active', el.dataset.id === S.sessionId));
  scrollBottom();

  // Opening question was never persisted (sent hidden) — restart the intro on the same session
  if (!d.messages.length && !S.interviewEnded) {
    sendMessage('你好，请开始面试', { hidden: true });
  }
  return true;
}

/* ── Settings Panel ────────────────────────────── */
let _activePreset = null;

function openSettings() {
  const cfg = loadCfg();
  if (cfg) {
    $('cfg-key').value   = cfg.api_key   || '';
    $('cfg-url').value   = cfg.base_url  || '';
    $('cfg-model').value = cfg.model     || '';
    // detect active preset
    _activePreset = Object.keys(PRESETS).find(k =>
      PRESETS[k].base_url === cfg.base_url && PRESETS[k].model === cfg.model
    ) || null;
  } else {
    _activePreset = 'deepseek';
    applyPreset('deepseek', false);
  }
  syncPresetBtns();
  $('settings-status').textContent = '';
  $('settings-overlay').classList.add('open');
}

function closeSettings() { $('settings-overlay').classList.remove('open'); }

function applyPreset(key, fillKey = true) {
  const p = PRESETS[key];
  if (!p) return;
  _activePreset = key;
  if (fillKey) $('cfg-key').value = '';
  $('cfg-url').value   = p.base_url;
  $('cfg-model').value = p.model;
  $('settings-note').textContent = p.note;
  syncPresetBtns();
}

function syncPresetBtns() {
  document.querySelectorAll('.preset-btn').forEach(btn => {
    const k = btn.getAttribute('onclick').match(/'(\w+)'/)?.[1];
    btn.classList.toggle('active', k === _activePreset);
  });
}

function saveSettings() {
  const key   = $('cfg-key').value.trim();
  const url   = $('cfg-url').value.trim();
  const model = $('cfg-model').value.trim();
  if (!key || !url || !model) {
    $('settings-status').style.color = 'var(--danger)';
    $('settings-status').textContent = '请填写 API Key、Base URL 和模型名称';
    return;
  }
  saveCfg({ api_key: key, base_url: url, model });
  $('settings-status').style.color = 'var(--green)';
  $('settings-status').textContent = '✓ 配置已保存';
  setTimeout(closeSettings, 800);
}

function resetSettings() {
  localStorage.removeItem('isim_llm_cfg');
  $('cfg-key').value = $('cfg-url').value = $('cfg-model').value = '';
  _activePreset = null;
  syncPresetBtns();
  $('settings-note').textContent = '';
  $('settings-status').style.color = 'var(--text-muted)';
  $('settings-status').textContent = '已恢复为服务器默认配置';
}

/* ── My Profile (résumé + JD) ──────────────────── */
function openProfile() {
  $('profile-overlay').classList.add('open');
  $('resume-status').textContent = '';
  $('jd-status').textContent = '';
  loadResume();
  loadJDs();
}
function closeProfile() { $('profile-overlay').classList.remove('open'); }

async function loadResume() {
  let d = {};
  try { d = await (await fetch('/api/resume', { headers: { 'X-Client-Id': clientId() } })).json(); }
  catch (_) {}
  const el = $('resume-current');
  if (d && d.filename) {
    el.innerHTML = `
      <div>
        <div class="resume-name">${esc(d.filename)}</div>
        <div class="resume-meta">${d.chars} 字${d.updated_at ? ' · ' + relTime(d.updated_at) : ''}</div>
      </div>
      <button class="resume-del" onclick="deleteResume()">删除</button>`;
  } else {
    el.innerHTML = '<span class="resume-empty">还没上传简历</span>';
  }
}

async function uploadResume() {
  const input = $('resume-file');
  const file = input.files && input.files[0];
  if (!file) return;
  $('resume-status').style.color = 'var(--text-muted)';
  $('resume-status').textContent = '正在解析…';
  const fd = new FormData();
  fd.append('file', file);
  try {
    const res = await fetch('/api/resume', {
      method: 'POST', headers: { 'X-Client-Id': clientId() }, body: fd,
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.detail || `HTTP ${res.status}`);
    $('resume-status').style.color = 'var(--green)';
    $('resume-status').textContent = `✓ 已保存（识别到 ${d.chars} 字）`;
    loadResume();
  } catch (e) {
    $('resume-status').style.color = 'var(--danger)';
    $('resume-status').textContent = `上传失败：${e.message}`;
  } finally {
    input.value = '';
  }
}

async function deleteResume() {
  try { await fetch('/api/resume', { method: 'DELETE', headers: { 'X-Client-Id': clientId() } }); }
  catch (_) {}
  $('resume-status').textContent = '';
  loadResume();
}

async function loadJDs() {
  let list = [];
  try { list = await (await fetch('/api/jds', { headers: { 'X-Client-Id': clientId() } })).json(); }
  catch (_) {}
  const el = $('jd-list');
  if (!Array.isArray(list) || !list.length) {
    el.innerHTML = '<div class="jd-empty">还没有保存的 JD</div>';
    return;
  }
  el.innerHTML = list.map(j => `
    <div class="jd-item">
      <div class="jd-item-head">
        <div>
          <div class="jd-item-title">${esc(j.title)}</div>
          <div class="jd-item-meta">${relTime(j.created_at)}</div>
        </div>
        <button class="jd-item-del" onclick="deleteJD(${j.id})" title="删除">×</button>
      </div>
      <div class="jd-item-preview">${esc(j.jd_text)}</div>
    </div>`).join('');
}

async function saveJD() {
  const title = $('jd-title').value.trim();
  const jd_text = $('jd-text').value.trim();
  if (!jd_text) {
    $('jd-status').style.color = 'var(--danger)';
    $('jd-status').textContent = 'JD 内容还没填哦';
    return;
  }
  try {
    const res = await fetch('/api/jds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': clientId() },
      body: JSON.stringify({ title, jd_text }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.detail || `HTTP ${res.status}`);
    $('jd-title').value = ''; $('jd-text').value = '';
    $('jd-status').style.color = 'var(--green)';
    $('jd-status').textContent = '✓ 已保存';
    loadJDs();
  } catch (e) {
    $('jd-status').style.color = 'var(--danger)';
    $('jd-status').textContent = `保存失败：${e.message}`;
  }
}

async function deleteJD(id) {
  try { await fetch(`/api/jds/${id}`, { method: 'DELETE', headers: { 'X-Client-Id': clientId() } }); }
  catch (_) {}
  loadJDs();
}

/* ── Start-interview confirmation card ─────────── */
async function openStartConfirm() {
  let resume = {}, jds = [];
  try { resume = await (await fetch('/api/resume', { headers: { 'X-Client-Id': clientId() } })).json(); } catch (_) {}
  try { jds    = await (await fetch('/api/jds',    { headers: { 'X-Client-Id': clientId() } })).json(); } catch (_) {}
  if (!Array.isArray(jds)) jds = [];

  const hasResume = !!(resume && resume.filename);
  const cb = $('start-use-resume');
  cb.checked = hasResume;
  cb.disabled = !hasResume;
  $('start-resume-name').textContent = hasResume
    ? resume.filename
    : '未上传简历（可在左下角「我的资料」里上传）';

  $('start-jd').innerHTML = '<option value="">不使用 JD</option>' +
    jds.map(j => `<option value="${j.id}">${esc(j.title)}</option>`).join('');

  $('start-overlay').classList.add('open');
}
function closeStartConfirm() { $('start-overlay').classList.remove('open'); }

function confirmStart(generic) {
  if (generic) {
    S.useResume = false;
    S.jdId = null;
  } else {
    S.useResume = $('start-use-resume').checked;
    const v = $('start-jd').value;
    S.jdId = v ? Number(v) : null;
  }
  closeStartConfirm();
  startSession();
}

/* ── Interview Knowledge Base ──────────────────── */
const _kb = { category: null, offset: 0, limit: 20 };
const _kbIcons = {
  trash: '<path d="M5 7h14"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/><path d="M6.7 7l.8 11a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l.8-11"/>',
  prev: '<polyline points="14 6 9 12 14 18"/>',
  next: '<polyline points="10 6 15 12 10 18"/>',
};
const _kbIc = (p) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

function openKB() {
  $('kb-overlay').classList.add('open');
  $('kb-status').textContent = '';
  _kb.category = null; _kb.offset = 0;
  loadKB();
}
function closeKB() { $('kb-overlay').classList.remove('open'); }

async function uploadKB() {
  const input = $('kb-file');
  const file = input.files && input.files[0];
  if (!file) return;
  $('kb-status').style.color = 'var(--text-muted)';
  $('kb-status').textContent = '正在解析并抽取题目…';
  const fd = new FormData();
  fd.append('file', file);
  const cfg = loadCfg();
  if (cfg) { fd.append('api_key', cfg.api_key || ''); fd.append('base_url', cfg.base_url || ''); fd.append('model', cfg.model || ''); }
  try {
    const res = await fetch('/api/knowledge-base/import', { method: 'POST', headers: { 'X-Client-Id': clientId() }, body: fd });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.detail || `HTTP ${res.status}`);
    if (d.fallback) {
      $('kb-status').style.color = 'var(--warning)';
      $('kb-status').textContent = 'AI 没能拆出单条题目，已把整篇存为 1 条（检查下模型配置？）';
    } else {
      $('kb-status').style.color = 'var(--green)';
      $('kb-status').textContent = `✓ 成功导入 ${d.imported} 道题目`;
    }
    _kb.category = null; _kb.offset = 0;
    loadKB();
  } catch (e) {
    $('kb-status').style.color = 'var(--danger)';
    $('kb-status').textContent = `导入失败：${e.message}`;
  } finally {
    input.value = '';
  }
}

async function loadKB() {
  const params = new URLSearchParams({ offset: _kb.offset, limit: _kb.limit });
  if (_kb.category) params.set('category', _kb.category);
  let d = { total: 0, items: [], categories: [] };
  try { d = await (await fetch('/api/knowledge-base?' + params)).json(); } catch (_) {}

  // filter chips
  const fEl = $('kb-filter');
  if (d.categories.length) {
    fEl.hidden = false;
    const grand = d.categories.reduce((s, c) => s + c.count, 0);
    fEl.innerHTML =
      `<button class="kb-chip ${!_kb.category ? 'active' : ''}" onclick="filterKB(null)">全部<span class="kb-chip-n">${grand}</span></button>` +
      d.categories.map(c =>
        `<button class="kb-chip ${_kb.category === c.category ? 'active' : ''}" onclick="filterKB('${encodeURIComponent(c.category)}')">${esc(c.category)}<span class="kb-chip-n">${c.count}</span></button>`
      ).join('');
  } else {
    fEl.hidden = true; fEl.innerHTML = '';
  }

  // list
  const lEl = $('kb-list');
  if (!d.items.length) {
    lEl.innerHTML = d.total === 0
      ? '<div class="kb-empty">还没有导入题目。<br/>上传一份你整理的面试笔记，AI 会把里面的题目拆出来存进知识库。</div>'
      : '<div class="kb-empty">这个类别下没有题目</div>';
  } else {
    lEl.innerHTML = d.items.map(it => {
      const raw = !it.category && it.question_text.length > 240;
      const meta = [];
      if (it.category) meta.push(`<span class="kb-item-tag">${esc(it.category)}</span>`);
      if (raw) meta.push(`<span class="kb-item-tag">整篇兜底</span>`);
      if (it.company_or_role) meta.push(esc(it.company_or_role));
      if (it.source_file) meta.push(esc(it.source_file));
      const metaHtml = meta.join('<span class="kb-dot"></span>');
      const q = raw ? esc(it.question_text.slice(0, 240)) + '…' : esc(it.question_text);
      return `<div class="kb-item ${raw ? 'kb-item-raw' : ''}">
        <div class="kb-item-q">${q}</div>
        ${metaHtml ? `<div class="kb-item-meta">${metaHtml}</div>` : ''}
        <button class="kb-item-del" onclick="deleteKBItem(${it.id})" title="删除">${_kbIc(_kbIcons.trash)}</button>
      </div>`;
    }).join('');
  }

  // pager
  const pEl = $('kb-pager');
  if (d.total > _kb.limit) {
    pEl.hidden = false;
    const page = Math.floor(_kb.offset / _kb.limit) + 1;
    const pages = Math.ceil(d.total / _kb.limit);
    pEl.innerHTML = `<span>共 ${d.total} 道 · 第 ${page} / ${pages} 页</span>
      <span class="kb-pager-btns">
        <button ${_kb.offset === 0 ? 'disabled' : ''} onclick="kbPage(-1)" title="上一页">${_kbIc(_kbIcons.prev)}</button>
        <button ${page >= pages ? 'disabled' : ''} onclick="kbPage(1)" title="下一页">${_kbIc(_kbIcons.next)}</button>
      </span>`;
  } else {
    pEl.hidden = true; pEl.innerHTML = '';
  }
}

function filterKB(cat) {
  _kb.category = cat ? decodeURIComponent(cat) : null;
  _kb.offset = 0;
  loadKB();
}
function kbPage(delta) {
  _kb.offset = Math.max(0, _kb.offset + delta * _kb.limit);
  loadKB();
}
async function deleteKBItem(id) {
  try { await fetch(`/api/knowledge-base/${id}`, { method: 'DELETE' }); } catch (_) {}
  loadKB();
}

/* ── Speech Recognition ────────────────────────── */
let recognition = null, baseText = '';

function setupSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { $('mic-btn').style.display = 'none'; return; }
  recognition = new SR();
  recognition.lang = 'zh-CN'; recognition.continuous = true; recognition.interimResults = true;
  recognition.onresult = e => {
    let fin = '', tmp = '';
    for (let i = 0; i < e.results.length; i++) {
      if (e.results[i].isFinal) fin += e.results[i][0].transcript;
      else                      tmp += e.results[i][0].transcript;
    }
    $('input').value = baseText + fin + tmp;
    autoResize($('input'));
  };
  recognition.onerror = e => { if (e.error !== 'no-speech') stopRecording(); };
  recognition.onend   = () => { if (S.isRecording) { try { recognition.start(); } catch (_) {} } };
}

function toggleRecording() { S.isRecording ? stopRecording() : startRecording(); }
function startRecording() {
  if (!recognition) return;
  baseText = $('input').value;
  if (baseText && !baseText.endsWith(' ')) baseText += ' ';
  try { recognition.start(); S.isRecording = true; $('mic-btn').classList.add('recording'); $('voice-indicator').classList.add('active'); } catch (_) {}
}
function stopRecording() {
  if (!recognition) return;
  S.isRecording = false;
  try { recognition.stop(); } catch (_) {}
  $('mic-btn').classList.remove('recording');
  $('voice-indicator').classList.remove('active');
}

/* ── Session DB ────────────────────────────────── */
async function createSession() {
  try { const r = await fetch('/api/sessions', { method: 'POST' }); S.sessionId = (await r.json()).id; }
  catch (_) { S.sessionId = null; }
}

async function loadSessions() {
  try { renderSessionList(await (await fetch('/api/sessions')).json()); } catch (_) {}
}

function renderSessionList(sessions) {
  const el = $('session-list');
  if (!sessions.length) { el.innerHTML = '<div class="session-empty">暂无历史记录</div>'; return; }
  el.innerHTML = sessions.map(s => `
    <div class="session-item ${s.id===S.sessionId?'active':''}" data-id="${s.id}" onclick="loadSession('${s.id}')">
      <div class="session-title">${esc(s.title)}</div>
      <div class="session-meta">${relTime(s.created_at)} · ${s.turn_count} 轮</div>
      <button class="session-del" onclick="delSession('${s.id}',event)" title="删除">×</button>
    </div>`).join('');
}

let _loadSeq = 0;

async function loadSession(id) {
  if (S.isStreaming) return;
  const seq = ++_loadSeq;
  try {
    const d = await (await fetch(`/api/sessions/${id}/messages`)).json();
    if (seq !== _loadSeq) return; // 已有更晚的切换，丢弃这次过期结果
    S.messages  = d.messages; S.sessionId = id;
    S.turnCount = d.turn_count ?? d.messages.filter(m => m.role==='user').length;
    S.interviewEnded = false;

    // Timer = the session's accumulated duration, not "time since I clicked it".
    // If this is the still-active session, keep its live clock from localStorage;
    // otherwise resume from the duration stored on the server at the last turn.
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null'); } catch (_) {}
    if (saved && saved.sessionId === id && saved.sessionStart) {
      S.sessionStart = saved.sessionStart;
      S.pausedMs     = saved.pausedMs   || 0;
      S.isPaused     = !!saved.isPaused;
      S.pauseStart   = saved.pauseStart || null;
      S.useResume    = !!saved.useResume;
      S.jdId         = saved.jdId ?? null;
      S.interviewEnded = !!saved.interviewEnded;
      S.endedAt      = saved.endedAt || null;
    } else {
      S.sessionStart = Date.now() - (d.duration_s || 0) * 1000;
      S.pausedMs = 0; S.isPaused = false; S.pauseStart = null;
      S.useResume = false; S.jdId = null;
      S.endedAt = null;
    }
    document.querySelector('.timer-card')?.classList.toggle('paused', S.isPaused);
    { const h = $('pause-hint'); if (h) h.textContent = S.isPaused ? '点击继续' : '点击暂停'; }

    $('messages').innerHTML = '';
    for (const m of d.messages) appendMsg(m.role, m.content, true);

    $('welcome-screen').style.display = 'none';
    $('messages-wrap').classList.add('visible');
    $('input-area').classList.toggle('visible', !S.interviewEnded);
    $('ended-bar').classList.toggle('visible', S.interviewEnded);
    $('turn-count').textContent = S.turnCount;

    clearInterval(S.timerInterval);
    if (!S.interviewEnded) S.timerInterval = setInterval(tickTimer, 1000);
    tickTimer();

    document.querySelectorAll('.session-item').forEach(el => el.classList.toggle('active', el.dataset.id===id));
    persistSession();
    scrollBottom();
  } catch (e) { console.error(e); }
}

async function delSession(id, event) {
  event.stopPropagation();
  await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
  if (S.sessionId === id) newSession();
  await loadSessions();
}

async function saveTurn(userContent, assistantContent) {
  if (!S.sessionId) return;
  const now = S.endedAt || (S.isPaused && S.pauseStart ? S.pauseStart : Date.now());
  const elapsed = S.sessionStart ? Math.max(0, Math.floor((now-S.sessionStart-S.pausedMs)/1000)) : 0;
  const isFirst = S.turnCount === 1;
  try {
    await fetch('/api/sessions/save-turn', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: S.sessionId, user_content: userContent,
        assistant_content: assistantContent, turn_count: S.turnCount,
        duration_s: elapsed, title: isFirst ? userContent.slice(0,50) : null,
      }),
    });
    persistSession();
    if (isFirst || S.turnCount % 3 === 0) await loadSessions();
  } catch (_) {}
}

/* ── Session UI ────────────────────────────────── */
async function startSession() {
  await createSession();
  $('welcome-screen').style.display = 'none';
  $('messages-wrap').classList.add('visible');
  $('input-area').classList.add('visible');
  $('ended-bar').classList.remove('visible');
  S.messages = []; S.turnCount = 0; S.sessionStart = Date.now(); S.interviewEnded = false; S.endedAt = null;
  clearInterval(S.timerInterval);
  S.timerInterval = setInterval(tickTimer, 1000);
  $('timer').textContent = '00:00'; $('turn-count').textContent = '0';
  persistSession();
  await loadSessions();
  sendMessage('你好，请开始面试', { hidden: true });
}

function newSession() {
  clearInterval(S.timerInterval);
  _loadSeq++; // 取消任何进行中的历史加载，避免旧请求覆盖新会话
  clearPersistedSession();
  Object.assign(S, { messages:[], sessionId:null, turnCount:0, sessionStart:null, isStreaming:false, interviewEnded:false, endedAt:null, reportData:null, isPaused:false, pausedMs:0, pauseStart:null, useResume:false, jdId:null });
  document.querySelector('.timer-card')?.classList.remove('paused');
  const hint = $('pause-hint'); if (hint) hint.textContent = '点击暂停';
  $('messages').innerHTML = ''; $('timer').textContent = '00:00'; $('turn-count').textContent = '0';
  $('input').value = ''; autoResize($('input'));
  $('messages-wrap').classList.remove('visible');
  $('input-area').classList.remove('visible');
  $('ended-bar').classList.remove('visible');
  $('welcome-screen').style.display = 'flex';
  document.querySelectorAll('.session-item').forEach(el => el.classList.remove('active'));
}

// Freeze the clock the instant the interview ends — don't keep counting while
// the closing scorecard is still generating.
function markEnded() {
  if (S.interviewEnded) return;
  S.interviewEnded = true;
  S.endedAt = S.isPaused && S.pauseStart ? S.pauseStart : Date.now();
  clearInterval(S.timerInterval); S.timerInterval = null;
  document.querySelector('.timer-card')?.classList.remove('paused');
  tickTimer();
  persistSession();
}

function endInterview() {
  markEnded();
  sendCommand('end');
}

function tickTimer() {
  if (!S.sessionStart) return;
  // Freeze the clock: at end time if the interview is over, else at the pause
  // moment if paused, else live.
  const now = S.endedAt ? S.endedAt
            : (S.isPaused && S.pauseStart ? S.pauseStart : Date.now());
  const s = Math.max(0, Math.floor((now - S.sessionStart - S.pausedMs) / 1000));
  $('timer').textContent = String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
}

function togglePause() {
  if (!S.sessionStart || S.interviewEnded) return;
  S.isPaused = !S.isPaused;
  const card = document.querySelector('.timer-card');
  const hint = $('pause-hint');
  if (S.isPaused) {
    S.pauseStart = Date.now();
    card.classList.add('paused');
    hint.textContent = '点击继续';
  } else {
    S.pausedMs += Date.now() - S.pauseStart;
    S.pauseStart = null;
    card.classList.remove('paused');
    hint.textContent = '点击暂停';
  }
  persistSession();
}

/* ── Input ─────────────────────────────────────── */
function handleKeydown(e) { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }
function handleSend() {
  const text = $('input').value.trim();
  if (!text) return;
  $('input').value = ''; autoResize($('input'));
  sendMessage(text);
}
function sendCommand(cmd) { sendMessage(cmd); }
function autoResize(el) { el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,160)+'px'; }

/* ── Core: Send & Stream ───────────────────────── */
async function sendMessage(text, opts = {}) {
  if (!text.trim() || S.isStreaming) return;
  const hidden = opts.hidden === true;

  if (!hidden) {
    appendMsg('user', text);
    S.turnCount++;
    $('turn-count').textContent = S.turnCount;
    // detect 'end' typed manually (also freezes the clock)
    if (text.trim().toLowerCase() === 'end') markEnded();
    persistSession();
  }

  S.messages.push({ role:'user', content:text });
  const aiEl = appendMsg('assistant', '');
  const textEl = aiEl.querySelector('.msg-text');
  textEl.classList.add('streaming');
  setStreaming(true);

  let full = '', gotDone = false;
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': clientId() },
      body: JSON.stringify({ messages: S.messages, llm: loadCfg(), session_id: S.sessionId, use_resume: !!S.useResume, jd_id: S.jdId }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader(), decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream:true });
      const parts = buf.split('\n\n'); buf = parts.pop();
      for (const part of parts) {
        if (!part.startsWith('data: ')) continue;
        let data; try { data = JSON.parse(part.slice(6)); } catch { continue; }
        if (data.type==='text') { full += data.content; renderMsg(textEl, full, true); scrollBottom(); }
        else if (data.type==='done') {
          gotDone = true;
          S.messages.push({ role:'assistant', content:full });
          if (S.ttsEnabled) speak(full);
          if (!hidden && full) await saveTurn(text, full);
          // Show ended bar after interview ends
          if (S.interviewEnded) {
            $('ended-bar').classList.add('visible');
            $('input-area').classList.remove('visible');
          }
          persistSession();
        }
        else if (data.type==='error') { renderMsg(textEl, `⚠️ 错误：${data.content}`, false); }
      }
    }
  } catch (err) { renderMsg(textEl, `⚠️ 连接失败：${err.message}`, false); }
  finally {
    textEl.classList.remove('streaming');
    if (full) renderMsg(textEl, full, false);
    // Stream ended without a 'done' event (proxy cut it, server hiccup) but the
    // answer did come through — treat it as complete so the turn still saves.
    if (!gotDone && full) {
      S.messages.push({ role:'assistant', content: full });
      if (!hidden) { try { await saveTurn(text, full); } catch (_) {} }
      persistSession();
    }
    setStreaming(false);
    scrollBottom();
  }
}

/* ── Report ────────────────────────────────────── */
async function openReport() {
  $('report-overlay').classList.add('open');
  $('report-body').innerHTML = '<div class="rpt-loading" id="rpt-loading"><div class="rpt-spinner"></div><p>AI 正在生成报告，请稍候...</p></div>';
  $('rpt-dl-btn').style.display = 'none';
  S.reportData = null;

  try {
    const res = await fetch(`/api/sessions/${S.sessionId}/report`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ llm: loadCfg() }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    S.reportData = await res.json();
    renderReport(S.reportData);
    $('rpt-dl-btn').style.display = '';
  } catch (e) {
    $('report-body').innerHTML = `<div class="rpt-loading"><p style="color:var(--danger)">⚠️ 报告生成失败：${e.message}</p></div>`;
  }
}

function closeReport() { $('report-overlay').classList.remove('open'); }

function downloadReport() {
  if (!S.sessionId) return;
  window.open(`/api/sessions/${S.sessionId}/report/download`, '_blank');
}

function verdictColor(v) {
  v = (v || '').toLowerCase();
  if (v.includes('strong hire'))   return '#7FB88A';
  if (v.includes('lean no hire'))  return '#E0A05A';
  if (v.includes('no hire'))       return '#E8998D';
  if (v.includes('lean hire'))     return '#F2B84B';
  if (v.includes('hire'))          return '#6FAE8B';
  return '#B3A398';
}

function renderReport(r) {
  const score = r.overall_score ?? '—';
  const vc    = verdictColor(r.verdict);

  let html = `
    <div class="rpt-meta">
      <div class="rpt-meta-item">
        <span class="rpt-meta-label">面试岗位</span>
        <span class="rpt-meta-value">${esc(r.role || '—')}</span>
      </div>
      <div class="rpt-meta-item">
        <span class="rpt-meta-label">经验层级</span>
        <span class="rpt-meta-value">${esc(r.level || '—')}</span>
      </div>
      <div class="rpt-meta-item">
        <span class="rpt-meta-label">综合评分</span>
        <span class="rpt-meta-value">${score}/10</span>
      </div>
      <div class="rpt-meta-item">
        <span class="rpt-meta-label">面试结论</span>
        <span class="verdict-badge" style="background:${vc}22;color:${vc}">${esc(r.verdict || '—')}</span>
      </div>
    </div>

    <div class="rpt-section-title">题目详解</div>`;

  for (const [i, q] of (r.questions || []).entries()) {
    html += `
      <div class="q-card">
        <div class="q-card-header">
          <span class="q-num">Q${i+1}</span>
          <span class="q-text">${esc(q.question || '')}</span>
          <span class="q-score">${q.score ?? '—'}/10</span>
        </div>
        <div class="q-card-body">
          <div class="q-user-ans">
            <div class="q-section-label">候选人回答</div>
            <div class="q-section-content">${esc(q.user_answer || '未作答')}</div>
          </div>
          <div class="q-std-ans">
            <div class="q-section-label">标准答案</div>
            <div class="q-section-content">${marked.parse(q.standard_answer || '')}</div>
          </div>
          ${q.feedback ? `
          <div class="q-feedback">
            <div class="q-section-label">评价</div>
            <div class="q-section-content">${esc(q.feedback)}</div>
          </div>` : ''}
        </div>
      </div>`;
  }

  html += `<div class="rpt-section-title">综合评价</div>
    <div class="rpt-summary-grid">`;

  const sections = [
    { key:'strengths',          label:'主要优势' },
    { key:'improvements',       label:'改进方向' },
    { key:'recommended_topics', label:'建议学习' },
  ];
  for (const s of sections) {
    const items = r[s.key] || [];
    if (!items.length) continue;
    html += `<div class="rpt-summary-card">
      <h4>${s.label}</h4>
      <ul>${items.map(it => `<li>${esc(it)}</li>`).join('')}</ul>
    </div>`;
  }
  html += '</div>';

  $('report-body').innerHTML = html;
}

/* ── UI Helpers ────────────────────────────────── */
function appendMsg(role, text, noScroll=false) {
  const wrap = document.createElement('div'); wrap.className = `message ${role}`;
  const av   = document.createElement('div'); av.className = 'avatar'; av.textContent = role==='assistant'?'AI':'You';
  const body = document.createElement('div'); body.className = 'msg-body';
  const txt  = document.createElement('div'); txt.className = 'msg-text';
  if (role==='assistant') txt.innerHTML  = text ? marked.parse(text) : '';
  else                    txt.textContent = text;
  body.appendChild(txt); wrap.appendChild(av); wrap.appendChild(body);
  $('messages').appendChild(wrap);
  if (!noScroll) scrollBottom();
  return wrap;
}
function renderMsg(el, text, streaming) {
  el.innerHTML = text ? marked.parse(text) : '';
  streaming ? el.classList.add('streaming') : el.classList.remove('streaming');
}
function scrollBottom() { const w=$('messages-wrap'); w.scrollTop=w.scrollHeight; }
function setStreaming(val) { S.isStreaming=val; $('send-btn').disabled=val; $('input').disabled=val; }

/* ── TTS ───────────────────────────────────────── */
function toggleTTS() {
  S.ttsEnabled = !S.ttsEnabled;
  $('tts-btn').classList.toggle('active', S.ttsEnabled);
}
function speak(text) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[#*`_>~\-═─|]/g,' ').replace(/\s+/g,' ').trim());
  u.lang='zh-CN'; u.rate=1.1;
  speechSynthesis.speak(u);
}

/* ── Theme ─────────────────────────────────────── */
function toggleTheme() {
  S.darkMode = !S.darkMode;
  document.documentElement.setAttribute('data-theme', S.darkMode?'dark':'light');
  $('theme-btn').classList.toggle('active', S.darkMode);
}

/* ── Utils ─────────────────────────────────────── */
function relTime(iso) {
  const m=Math.floor((Date.now()-new Date(iso))/60000);
  if(m<1)return'刚刚'; if(m<60)return`${m}分钟前`;
  const h=Math.floor(m/60); if(h<24)return`${h}小时前`;
  const d=Math.floor(h/24); if(d<7)return`${d}天前`;
  return new Date(iso).toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'});
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Init ──────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  setupSpeech();
  await loadSessions();
  await restoreActiveSession();
  // Re-sync the timer immediately when the tab regains focus (background tabs
  // throttle setInterval, and some browsers discard/reload the tab entirely).
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tickTimer(); });
  window.addEventListener('focus', tickTimer);
  // Close overlays on backdrop click
  $('report-overlay').addEventListener('click', e => { if(e.target===$('report-overlay')) closeReport(); });
  $('settings-overlay').addEventListener('click', e => { if(e.target===$('settings-overlay')) closeSettings(); });
  $('profile-overlay').addEventListener('click', e => { if(e.target===$('profile-overlay')) closeProfile(); });
  $('start-overlay').addEventListener('click', e => { if(e.target===$('start-overlay')) closeStartConfirm(); });
  $('kb-overlay').addEventListener('click', e => { if(e.target===$('kb-overlay')) closeKB(); });
});
