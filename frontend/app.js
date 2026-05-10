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
  reportData:     null,
  isPaused:       false,
  pausedMs:       0,      // total milliseconds accumulated while paused
  pauseStart:     null,   // timestamp when current pause began
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

async function loadSession(id) {
  if (S.isStreaming) return;
  try {
    const d = await (await fetch(`/api/sessions/${id}/messages`)).json();
    S.messages  = d.messages; S.sessionId = id;
    S.turnCount = d.messages.filter(m => m.role==='user').length;
    S.sessionStart = Date.now(); S.interviewEnded = false;

    $('messages').innerHTML = '';
    for (const m of d.messages) appendMsg(m.role, m.content, true);

    $('welcome-screen').style.display = 'none';
    $('messages-wrap').classList.add('visible');
    $('input-area').classList.add('visible');
    $('ended-bar').classList.remove('visible');
    $('turn-count').textContent = S.turnCount;

    clearInterval(S.timerInterval);
    S.timerInterval = setInterval(tickTimer, 1000);

    document.querySelectorAll('.session-item').forEach(el => el.classList.toggle('active', el.dataset.id===id));
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
  const elapsed = S.sessionStart ? Math.floor((Date.now()-S.sessionStart)/1000) : 0;
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
  S.messages = []; S.turnCount = 0; S.sessionStart = Date.now(); S.interviewEnded = false;
  clearInterval(S.timerInterval);
  S.timerInterval = setInterval(tickTimer, 1000);
  $('timer').textContent = '00:00'; $('turn-count').textContent = '0';
  await loadSessions();
  sendMessage('你好，请开始面试', { hidden: true });
}

function newSession() {
  clearInterval(S.timerInterval);
  Object.assign(S, { messages:[], sessionId:null, turnCount:0, sessionStart:null, isStreaming:false, interviewEnded:false, reportData:null, isPaused:false, pausedMs:0, pauseStart:null });
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

function endInterview() {
  S.interviewEnded = true;
  sendCommand('end');
}

function tickTimer() {
  if (!S.sessionStart || S.isPaused) return;
  const s = Math.floor((Date.now() - S.sessionStart - S.pausedMs) / 1000);
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
    // detect 'end' typed manually
    if (text.trim().toLowerCase() === 'end') S.interviewEnded = true;
  }

  S.messages.push({ role:'user', content:text });
  const aiEl = appendMsg('assistant', '');
  const textEl = aiEl.querySelector('.msg-text');
  textEl.classList.add('streaming');
  setStreaming(true);

  let full = '';
  try {
    const res = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: S.messages, llm: loadCfg() }),
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
          S.messages.push({ role:'assistant', content:full });
          if (S.ttsEnabled) speak(full);
          if (!hidden && full) saveTurn(text, full);
          // Show ended bar after interview ends
          if (S.interviewEnded) {
            $('ended-bar').classList.add('visible');
            $('input-area').classList.remove('visible');
          }
        }
        else if (data.type==='error') { renderMsg(textEl, `⚠️ 错误：${data.content}`, false); }
      }
    }
  } catch (err) { renderMsg(textEl, `⚠️ 连接失败：${err.message}`, false); }
  finally {
    textEl.classList.remove('streaming');
    if (full) renderMsg(textEl, full, false);
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
  if (v.includes('strong hire'))   return '#27ae60';
  if (v.includes('lean no hire'))  return '#e67e22';
  if (v.includes('no hire'))       return '#e74c3c';
  if (v.includes('lean hire'))     return '#f39c12';
  if (v.includes('hire'))          return '#2980b9';
  return '#7f8c8d';
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

    <div class="rpt-section-title">📝 题目详解</div>`;

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
            <div class="q-section-label">✅ 标准答案</div>
            <div class="q-section-content">${marked.parse(q.standard_answer || '')}</div>
          </div>
          ${q.feedback ? `
          <div class="q-feedback">
            <div class="q-section-label">💬 评价</div>
            <div class="q-section-content">${esc(q.feedback)}</div>
          </div>` : ''}
        </div>
      </div>`;
  }

  html += `<div class="rpt-section-title">📊 综合评价</div>
    <div class="rpt-summary-grid">`;

  const sections = [
    { key:'strengths',          icon:'✅', label:'主要优势' },
    { key:'improvements',       icon:'⚠️', label:'改进方向' },
    { key:'recommended_topics', icon:'📚', label:'建议学习' },
  ];
  for (const s of sections) {
    const items = r[s.key] || [];
    if (!items.length) continue;
    html += `<div class="rpt-summary-card">
      <h4>${s.icon} ${s.label}</h4>
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
  $('tts-icon').textContent = S.ttsEnabled ? '🔊' : '🔇';
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
  $('theme-icon').textContent = S.darkMode ? '☀️' : '🌙';
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
document.addEventListener('DOMContentLoaded', () => {
  setupSpeech();
  loadSessions();
  // Close overlays on backdrop click
  $('report-overlay').addEventListener('click', e => { if(e.target===$('report-overlay')) closeReport(); });
  $('settings-overlay').addEventListener('click', e => { if(e.target===$('settings-overlay')) closeSettings(); });
});
