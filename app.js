'use strict';

/* ===========================================================
   Ritmo — checklist diário
   Tudo fica salvo no próprio aparelho (localStorage).
   =========================================================== */

const APP_VERSION = '1.1.0';
const STORAGE_KEY = 'ritmo:data';
const MAX_TITLE = 60;
const MAX_SHARED_TASKS = 50;

const PERIODS = [
  { id: 'manha', label: 'Manhã', icon: '🌅' },
  { id: 'tarde', label: 'Tarde', icon: '☀️' },
  { id: 'noite', label: 'Noite', icon: '🌙' },
  { id: 'livre', label: 'Qualquer hora', icon: '✨' },
];
const WEEKDAYS_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const WEEKDAYS_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const EMOJIS = [
  '✅', '💧', '🏃', '📚', '🧘', '🛏️', '🍎', '💊',
  '🪥', '📝', '💼', '🧹', '🐶', '🎯', '📵', '☕',
  '🌱', '💰', '😴', '🗓️', '📥', '🧠', '🎵', '🙏',
];
const WEEKDAYS_ONLY = [1, 2, 3, 4, 5];

const TEMPLATES = [
  {
    id: 'manha', name: 'Manhã produtiva', icon: '🌅',
    tasks: [
      ['🛏️', 'Arrumar a cama', 'manha'],
      ['💧', 'Beber um copo de água', 'manha'],
      ['🧘', '5 minutos de meditação', 'manha'],
      ['📝', 'Definir as 3 prioridades do dia', 'manha'],
    ],
  },
  {
    id: 'saude', name: 'Saúde em dia', icon: '💪',
    tasks: [
      ['💧', 'Beber 2 litros de água', 'livre'],
      ['🏃', '30 minutos de exercício', 'tarde'],
      ['🍎', 'Comer uma fruta', 'livre'],
      ['😴', 'Dormir antes das 23h', 'noite'],
    ],
  },
  {
    id: 'noite', name: 'Noite tranquila', icon: '🌙',
    tasks: [
      ['📵', 'Largar o celular 1h antes de dormir', 'noite'],
      ['📚', 'Ler 10 páginas', 'noite'],
      ['🪥', 'Higiene e skincare', 'noite'],
      ['🗓️', 'Planejar o dia seguinte', 'noite'],
    ],
  },
  {
    id: 'estudos', name: 'Estudos e trabalho', icon: '🎓',
    tasks: [
      ['📥', 'Zerar a caixa de entrada', 'manha', WEEKDAYS_ONLY],
      ['🎯', '1 bloco de foco de 50 min', 'tarde', WEEKDAYS_ONLY],
      ['🧠', 'Revisar o que aprendi', 'noite', WEEKDAYS_ONLY],
    ],
  },
];

/* ---------- Datas ---------- */

function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function isDateKey(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/* ---------- Utilidades ---------- */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function firstGrapheme(s) {
  s = String(s || '').trim();
  if (!s) return '';
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    for (const { segment } of new Intl.Segmenter('pt', { granularity: 'grapheme' }).segment(s)) return segment;
  }
  return Array.from(s)[0];
}
function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}
function b64urlEncode(str) {
  let bin = '';
  new TextEncoder().encode(str).forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0)));
}

/* ---------- Estado ---------- */

function defaultState() {
  return { version: 1, tasks: [], history: {}, settings: { name: '', theme: 'auto' }, createdAt: dateKey() };
}

function sanitizeTask(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.title ?? '').trim().slice(0, MAX_TITLE);
  if (!title) return null;
  const days = Array.isArray(raw.days)
    ? [...new Set(raw.days.filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : [];
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 40) : uid(),
    title,
    emoji: firstGrapheme(raw.emoji) || '✅',
    period: PERIODS.some(p => p.id === raw.period) ? raw.period : 'livre',
    days: days.length === 7 ? [] : days,
    createdAt: isDateKey(raw.createdAt) ? raw.createdAt : dateKey(),
  };
}

function sanitizeState(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;

  const seen = new Set();
  const tasks = (Array.isArray(raw.tasks) ? raw.tasks : []).map(sanitizeTask).filter(Boolean);
  for (const t of tasks) {
    if (seen.has(t.id)) t.id = uid();
    seen.add(t.id);
  }

  const history = {};
  if (raw.history && typeof raw.history === 'object') {
    for (const [k, v] of Object.entries(raw.history)) {
      if (isDateKey(k) && Array.isArray(v)) history[k] = v.filter(id => typeof id === 'string');
    }
  }

  const s = raw.settings || {};
  const firstDay = [isDateKey(raw.createdAt) ? raw.createdAt : base.createdAt, ...tasks.map(t => t.createdAt), ...Object.keys(history)].sort()[0];

  return {
    version: 1,
    tasks,
    history,
    settings: {
      name: typeof s.name === 'string' ? s.name.slice(0, 30) : '',
      theme: ['auto', 'light', 'dark'].includes(s.theme) ? s.theme : 'auto',
    },
    createdAt: firstDay,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeState(JSON.parse(raw)) : defaultState();
  } catch {
    return defaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    toast('Não foi possível salvar neste navegador.');
  }
}

/* ---------- Regras da rotina ---------- */

function isScheduled(task, date) {
  return task.createdAt <= dateKey(date) && (!task.days.length || task.days.includes(date.getDay()));
}
function tasksForDate(date) {
  return state.tasks.filter(t => isScheduled(t, date));
}
function doneSet(key) {
  return new Set(state.history[key] || []);
}
function dayStats(date) {
  const tasks = tasksForDate(date);
  const done = doneSet(dateKey(date));
  const count = tasks.filter(t => done.has(t.id)).length;
  return { total: tasks.length, done: count, ratio: tasks.length ? count / tasks.length : 0 };
}

// Dias sem tarefas programadas não quebram a sequência; o dia de hoje
// incompleto também não (ainda dá tempo!).
function computeStreaks() {
  const todayKey = dateKey();
  let run = 0;
  let best = 0;
  let perfectDays = 0;
  for (let d = parseKey(state.createdAt); dateKey(d) <= todayKey; d = addDays(d, 1)) {
    const s = dayStats(d);
    if (!s.total) continue;
    if (s.done === s.total) {
      run++;
      perfectDays++;
      best = Math.max(best, run);
    } else if (dateKey(d) !== todayKey) {
      run = 0;
    }
  }
  return { current: run, best, perfectDays };
}

function completionRate(days) {
  let total = 0;
  let done = 0;
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = addDays(today, -i);
    if (dateKey(d) < state.createdAt) break;
    const s = dayStats(d);
    total += s.total;
    done += s.done;
  }
  return total ? Math.round((done / total) * 100) : 0;
}

function taskRate(task, days) {
  let total = 0;
  let done = 0;
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = addDays(today, -i);
    if (!isScheduled(task, d)) continue;
    total++;
    if (doneSet(dateKey(d)).has(task.id)) done++;
  }
  return total ? Math.round((done / total) * 100) : 0;
}

function daysLabel(days) {
  if (!days.length) return 'Todos os dias';
  if (days.length === 5 && WEEKDAYS_ONLY.every(d => days.includes(d))) return 'Dias úteis';
  if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Fins de semana';
  return days.map(d => WEEKDAYS_LONG[d].slice(0, 3)).join(', ');
}

/* ---------- Ações ---------- */

function toggleTask(id, key = dateKey()) {
  const before = dayStats(parseKey(key));
  const done = doneSet(key);
  const checking = !done.has(id);
  checking ? done.add(id) : done.delete(id);
  state.history[key] = [...done];
  if (!state.history[key].length) delete state.history[key];
  saveState();
  if (navigator.vibrate) navigator.vibrate(checking ? 12 : 6);

  const after = dayStats(parseKey(key));
  if (key === dateKey() && checking && after.total && after.done === after.total && before.done < before.total) {
    celebrate();
    toast('Dia completo! Mandou bem 🎉');
  }
}

function upsertTask(data) {
  const existing = state.tasks.find(t => t.id === data.id);
  if (existing) {
    Object.assign(existing, data);
  } else {
    state.tasks.push({ ...data, id: uid(), createdAt: dateKey() });
  }
  saveState();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  saveState();
}

function addTasks(list) {
  const today = dateKey();
  const existing = new Set(state.tasks.map(t => t.title.toLowerCase()));
  let added = 0;
  for (const raw of list) {
    const t = sanitizeTask(raw);
    if (!t || existing.has(t.title.toLowerCase())) continue;
    state.tasks.push({ ...t, id: uid(), createdAt: today });
    existing.add(t.title.toLowerCase());
    added++;
  }
  saveState();
  return added;
}

function applyTemplate(id) {
  const tpl = TEMPLATES.find(t => t.id === id);
  if (!tpl) return;
  const added = addTasks(tpl.tasks.map(([emoji, title, period, days = []]) => ({ emoji, title, period, days })));
  closeModal();
  setTab('hoje');
  toast(added ? `${plural(added, 'tarefa adicionada', 'tarefas adicionadas')} ✨` : 'Essas tarefas já estão na sua rotina.');
}

/* ---------- Compartilhar ---------- */

function appUrl() {
  return location.origin + location.pathname;
}

async function shareOrCopy({ title, text, url }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copiado! É só colar e enviar 📋');
  } catch {
    window.prompt('Copie o link abaixo:', url);
  }
}

function shareApp() {
  shareOrCopy({
    title: 'Ritmo — Checklist diário',
    text: 'Tô usando o Ritmo pra organizar minha rotina. Testa aí!',
    url: appUrl(),
  });
}

function shareRoutine() {
  if (!state.tasks.length) {
    toast('Adicione tarefas antes de compartilhar sua rotina.');
    return;
  }
  const payload = { v: 1, n: state.settings.name || '', t: state.tasks.map(t => [t.emoji, t.title, t.period, t.days]) };
  shareOrCopy({
    title: 'Minha rotina no Ritmo',
    text: 'Montei essa rotina no Ritmo. Abre o link pra copiar pra você:',
    url: `${appUrl()}#rotina=${b64urlEncode(JSON.stringify(payload))}`,
  });
}

function readSharedRoutine() {
  const match = location.hash.match(/rotina=([A-Za-z0-9_-]+)/);
  if (!match) return null;
  try {
    const data = JSON.parse(b64urlDecode(match[1]));
    if (!data || !Array.isArray(data.t)) return null;
    const tasks = data.t.slice(0, MAX_SHARED_TASKS)
      .map(row => Array.isArray(row) ? sanitizeTask({ emoji: row[0], title: row[1], period: row[2], days: row[3] }) : null)
      .filter(Boolean);
    return tasks.length ? { from: typeof data.n === 'string' ? data.n.slice(0, 30) : '', tasks } : null;
  } catch {
    return null;
  }
}

function clearHash() {
  history.replaceState(null, '', location.pathname + location.search);
}

/* ---------- Backup ---------- */

function exportBackup() {
  const blob = new Blob([JSON.stringify({ app: 'ritmo', exportedAt: new Date().toISOString(), ...state }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ritmo-backup-${dateKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Backup baixado 💾');
}

async function importBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data.tasks)) throw new Error('formato');
    if (!confirm('Importar este backup vai substituir todos os dados atuais. Continuar?')) return;
    state = sanitizeState(data);
    saveState();
    applyTheme();
    setTab('hoje');
    toast('Backup restaurado ✅');
  } catch {
    toast('Arquivo inválido. Use um backup exportado pelo Ritmo.');
  }
}

function resetAll() {
  if (!confirm('Apagar todas as tarefas e o histórico? Isso não pode ser desfeito.')) return;
  state = defaultState();
  saveState();
  applyTheme();
  setTab('hoje');
  toast('Tudo apagado. Bora recomeçar!');
}

/* ---------- Visual ---------- */

const $view = document.getElementById('view');
const $modal = document.getElementById('modal');
const $fab = document.getElementById('fab');
const $toast = document.getElementById('toast');
const $confetti = document.getElementById('confetti');

let state = loadState();
let currentTab = 'hoje';
let renderedDay = dateKey();
let toastTimer;

function applyTheme() {
  const theme = state.settings.theme;
  if (theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

function toast(msg) {
  $toast.textContent = msg;
  $toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.remove('show'), 2800);
}

function celebrate() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#6d5dfc', '#ff7a59', '#22a06b', '#f5b400', '#3ba7ff', '#e85fa8'];
  $confetti.innerHTML = Array.from({ length: 40 }, () => {
    const left = Math.random() * 100;
    const delay = Math.random() * 0.3;
    const dur = 1.2 + Math.random() * 0.9;
    const rot = Math.floor(Math.random() * 360);
    const color = colors[Math.floor(Math.random() * colors.length)];
    return `<i style="left:${left}%;background:${color};animation-delay:${delay}s;animation-duration:${dur}s;transform:rotate(${rot}deg)"></i>`;
  }).join('');
  setTimeout(() => { $confetti.innerHTML = ''; }, 2500);
}

function greeting() {
  const h = new Date().getHours();
  const base = h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  return state.settings.name ? `${base}, ${esc(state.settings.name)}` : base;
}

function ring(pct) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return `
    <svg class="ring" viewBox="0 0 100 100" aria-hidden="true">
      <circle class="ring-track" cx="50" cy="50" r="${r}"/>
      <circle class="ring-fill" cx="50" cy="50" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}"/>
    </svg>`;
}

const CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12.5 4 4L18 8"/></svg>';
const DOTS_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/></svg>';

function taskItem(t, done, day) {
  const dayAttr = day ? ` data-day="${day}"` : '';
  return `
    <li class="task${done ? ' done' : ''}">
      <button class="task-check" data-action="toggle" data-id="${esc(t.id)}"${dayAttr} aria-pressed="${done}">
        <span class="box">${CHECK_SVG}</span>
        <span class="emoji" aria-hidden="true">${esc(t.emoji)}</span>
        <span class="task-title">${esc(t.title)}</span>
      </button>
      ${day ? '' : `<button class="icon-btn" data-action="edit" data-id="${esc(t.id)}" aria-label="Editar ${esc(t.title)}">${DOTS_SVG}</button>`}
    </li>`;
}

function renderOnboarding() {
  return `
    <header class="page-head">
      <p class="eyebrow">Bem-vindo ao Ritmo</p>
      <h1>Monte sua rotina</h1>
      <p class="muted">Escolha um modelo pronto para começar rápido, ou crie suas tarefas do zero. Dá pra ajustar tudo depois.</p>
    </header>
    ${templateList()}
    <button class="btn primary block" data-action="add">Criar minha própria tarefa</button>`;
}

function templateList() {
  return `
    <div class="template-grid">
      ${TEMPLATES.map(tpl => `
        <button class="template" data-action="template" data-id="${tpl.id}">
          <span class="template-icon" aria-hidden="true">${tpl.icon}</span>
          <span class="template-body">
            <strong>${tpl.name}</strong>
            <span class="muted small">${tpl.tasks.map(t => t[1]).join(' · ')}</span>
          </span>
        </button>`).join('')}
    </div>`;
}

function renderToday() {
  if (!state.tasks.length) return renderOnboarding();

  const now = new Date();
  const key = dateKey(now);
  const tasks = tasksForDate(now);
  const done = doneSet(key);
  const doneCount = tasks.filter(t => done.has(t.id)).length;
  const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const { current } = computeStreaks();
  const dateLabel = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  let message = 'Bora começar o dia?';
  if (!tasks.length) message = 'Nada programado pra hoje. Aproveite! 🌴';
  else if (doneCount === tasks.length) message = 'Tudo feito! Dia completo 🎉';
  else if (pct >= 50) message = 'Mais da metade! Continue assim 💪';
  else if (doneCount > 0) message = 'Bom começo, segue o ritmo!';

  const groups = PERIODS.map(p => {
    const list = tasks.filter(t => t.period === p.id);
    if (!list.length) return '';
    return `
      <section class="group">
        <h2 class="group-title"><span aria-hidden="true">${p.icon}</span> ${p.label}
          <span class="count">${list.filter(t => done.has(t.id)).length}/${list.length}</span></h2>
        <ul class="task-list">${list.map(t => taskItem(t, done.has(t.id))).join('')}</ul>
      </section>`;
  }).join('');

  const others = state.tasks.filter(t => !isScheduled(t, now));
  const othersBlock = others.length ? `
    <details class="others">
      <summary>Fora da rotina de hoje (${others.length})</summary>
      <ul class="task-list compact">
        ${others.map(t => `
          <li class="task muted-task">
            <span class="emoji" aria-hidden="true">${esc(t.emoji)}</span>
            <span class="task-title">${esc(t.title)}<small>${esc(daysLabel(t.days))}</small></span>
            <button class="icon-btn" data-action="edit" data-id="${esc(t.id)}" aria-label="Editar ${esc(t.title)}">${DOTS_SVG}</button>
          </li>`).join('')}
      </ul>
    </details>` : '';

  return `
    <header class="page-head">
      <p class="eyebrow">${esc(dateLabel)}</p>
      <h1>${greeting()}</h1>
    </header>

    <section class="card progress-card${tasks.length && doneCount === tasks.length ? ' complete' : ''}">
      <div class="ring-wrap">
        ${ring(pct)}
        <span class="ring-label">${pct}<small>%</small></span>
      </div>
      <div class="progress-info">
        <p class="progress-msg">${message}</p>
        <p class="muted">${tasks.length ? `${doneCount} de ${plural(tasks.length, 'tarefa', 'tarefas')}` : 'Dia livre'}</p>
        <p class="streak-pill" title="Dias seguidos com tudo concluído">🔥 ${plural(current, 'dia seguido', 'dias seguidos')}</p>
      </div>
    </section>

    ${groups}
    ${othersBlock}`;
}

function renderHistory() {
  const { current, best, perfectDays } = computeStreaks();
  const rate30 = completionRate(30);
  const today = new Date();
  const todayKey = dateKey(today);
  const start = addDays(today, -today.getDay() - 28);

  const cells = Array.from({ length: 35 }, (_, i) => {
    const d = addDays(start, i);
    const key = dateKey(d);
    const label = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
    if (key > todayKey) return '<span class="cell future" aria-hidden="true"></span>';
    if (key < state.createdAt) return `<span class="cell before" title="${label}" aria-hidden="true"></span>`;
    const s = dayStats(d);
    const level = !s.total ? 'off' : s.ratio === 1 ? 4 : s.ratio >= 0.66 ? 3 : s.ratio >= 0.33 ? 2 : s.ratio > 0 ? 1 : 0;
    const desc = s.total ? `${label}: ${s.done} de ${s.total}` : `${label}: sem tarefas`;
    return `<button class="cell lvl-${level}${key === todayKey ? ' today' : ''}" data-action="day" data-day="${key}" title="${desc}" aria-label="${desc}">${d.getDate()}</button>`;
  }).join('');

  const perTask = state.tasks.map(t => {
    const rate = taskRate(t, 30);
    const dots = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, i - 6);
      const cls = !isScheduled(t, d) ? 'off' : doneSet(dateKey(d)).has(t.id) ? 'on' : '';
      return `<i class="${cls}" title="${WEEKDAYS_LONG[d.getDay()]}"></i>`;
    }).join('');
    return `
      <li class="habit">
        <span class="emoji" aria-hidden="true">${esc(t.emoji)}</span>
        <span class="habit-body">
          <span class="habit-title">${esc(t.title)}</span>
          <span class="bar"><span style="width:${rate}%"></span></span>
        </span>
        <span class="habit-side">
          <strong>${rate}%</strong>
          <span class="dots" aria-hidden="true">${dots}</span>
        </span>
      </li>`;
  }).join('');

  return `
    <header class="page-head">
      <p class="eyebrow">Seu progresso</p>
      <h1>Constância é tudo</h1>
    </header>

    <section class="stats">
      <div class="stat"><span class="stat-icon">🔥</span><strong>${current}</strong><span>sequência atual</span></div>
      <div class="stat"><span class="stat-icon">🏆</span><strong>${best}</strong><span>melhor sequência</span></div>
      <div class="stat"><span class="stat-icon">📈</span><strong>${rate30}%</strong><span>últimos 30 dias</span></div>
      <div class="stat"><span class="stat-icon">⭐</span><strong>${perfectDays}</strong><span>dias completos</span></div>
    </section>

    <section class="card">
      <h2 class="card-title">Últimas 5 semanas</h2>
      <p class="muted small">Toque em um dia para ver ou corrigir o que foi feito.</p>
      <div class="calendar">
        ${WEEKDAYS_SHORT.map(w => `<span class="cal-head">${w}</span>`).join('')}
        ${cells}
      </div>
      <div class="legend muted small">
        <span>Menos</span><i class="cell lvl-0"></i><i class="cell lvl-1"></i><i class="cell lvl-2"></i><i class="cell lvl-3"></i><i class="cell lvl-4"></i><span>Mais</span>
      </div>
    </section>

    ${state.tasks.length ? `
    <section class="card">
      <h2 class="card-title">Por tarefa <span class="muted small">(30 dias)</span></h2>
      <ul class="habits">${perTask}</ul>
    </section>` : '<p class="empty muted">Adicione tarefas para ver suas estatísticas.</p>'}`;
}

function renderSettings() {
  const theme = state.settings.theme;
  const themeOpt = (value, label) => `
    <label class="seg-option">
      <input type="radio" name="theme" value="${value}"${theme === value ? ' checked' : ''}>
      <span>${label}</span>
    </label>`;

  return `
    <header class="page-head">
      <p class="eyebrow">Ajustes</p>
      <h1>Do seu jeito</h1>
    </header>

    <section class="card form-card">
      <label class="field">
        <span class="field-label">Como podemos te chamar?</span>
        <input id="name-input" type="text" maxlength="30" placeholder="Seu nome" value="${esc(state.settings.name)}" autocomplete="given-name">
      </label>
      <div class="field">
        <span class="field-label">Tema</span>
        <div class="segmented" role="radiogroup" aria-label="Tema">
          ${themeOpt('auto', 'Automático')}${themeOpt('light', 'Claro')}${themeOpt('dark', 'Escuro')}
        </div>
      </div>
    </section>

    <section class="card list-card">
      <h2 class="card-title">Compartilhar</h2>
      <button class="row" data-action="share-app"><span class="row-icon">📲</span><span><strong>Convidar amigos</strong><small>Envie o link do Ritmo</small></span></button>
      <button class="row" data-action="share-routine"><span class="row-icon">🔗</span><span><strong>Compartilhar minha rotina</strong><small>Seus amigos podem copiar suas tarefas</small></span></button>
    </section>

    <section class="card list-card">
      <h2 class="card-title">Rotina</h2>
      <button class="row" data-action="templates"><span class="row-icon">🧩</span><span><strong>Adicionar um modelo</strong><small>Rotinas prontas para começar rápido</small></span></button>
      <button class="row" data-action="install"><span class="row-icon">📱</span><span><strong>Instalar no celular</strong><small>Use como app, até sem internet</small></span></button>
    </section>

    <section class="card list-card">
      <h2 class="card-title">Seus dados</h2>
      <p class="muted small pad">Tudo fica salvo só neste aparelho. Faça backup para não perder nada ao trocar de celular.</p>
      <button class="row" data-action="export"><span class="row-icon">💾</span><span><strong>Exportar backup</strong><small>Baixa um arquivo com tudo</small></span></button>
      <button class="row" data-action="import"><span class="row-icon">📂</span><span><strong>Restaurar backup</strong><small>Carrega um arquivo exportado</small></span></button>
      <button class="row danger" data-action="reset"><span class="row-icon">🗑️</span><span><strong>Apagar tudo</strong><small>Remove tarefas e histórico</small></span></button>
    </section>

    <p class="about muted small">Ritmo v${APP_VERSION} · feito com carinho para criar bons hábitos</p>`;
}

function render() {
  renderedDay = dateKey();
  const views = { hoje: renderToday, historico: renderHistory, ajustes: renderSettings };
  $view.innerHTML = views[currentTab]();
  $fab.hidden = currentTab !== 'hoje' || !state.tasks.length;
  document.querySelectorAll('.tab').forEach(tab => {
    if (tab.dataset.tab === currentTab) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
}

function setTab(tab) {
  const changed = tab !== currentTab;
  currentTab = tab;
  render();
  if (changed) window.scrollTo({ top: 0 });
}

/* ---------- Modais ---------- */

function openModal(html, opts = {}) {
  $modal.innerHTML = `<div class="sheet">${html}</div>`;
  if (opts.day) $modal.dataset.day = opts.day;
  else delete $modal.dataset.day;
  if (!$modal.open) $modal.showModal();
}

function closeModal() {
  if ($modal.open) $modal.close();
}

function openTaskModal(task) {
  const t = task || { title: '', emoji: '✅', period: 'livre', days: [] };
  const allDays = !t.days.length;

  openModal(`
    <form id="task-form" class="task-form" novalidate>
      <div class="sheet-head">
        <h2>${task ? 'Editar tarefa' : 'Nova tarefa'}</h2>
        <button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar">✕</button>
      </div>

      <div class="title-row">
        <span class="emoji-preview" id="emoji-preview" aria-hidden="true">${esc(t.emoji)}</span>
        <input name="title" class="title-input" value="${esc(t.title)}" placeholder="Ex.: Beber água" maxlength="${MAX_TITLE}" required aria-label="Nome da tarefa" autocomplete="off">
      </div>
      <div class="emoji-grid" role="radiogroup" aria-label="Ícone da tarefa">
        ${(EMOJIS.includes(t.emoji) ? EMOJIS : [t.emoji, ...EMOJIS]).map(e => `
          <label class="emoji-pick">
            <input type="radio" name="emoji" value="${esc(e)}"${e === t.emoji ? ' checked' : ''}>
            <span>${esc(e)}</span>
          </label>`).join('')}
      </div>

      <div class="field">
        <span class="field-label">Quando?</span>
        <div class="segmented wrap">
          ${PERIODS.map(p => `
            <label class="seg-option">
              <input type="radio" name="period" value="${p.id}"${t.period === p.id ? ' checked' : ''}>
              <span>${p.icon} ${p.label}</span>
            </label>`).join('')}
        </div>
      </div>

      <div class="field">
        <span class="field-label">Repetir em</span>
        <div class="days">
          ${WEEKDAYS_SHORT.map((w, i) => `
            <label class="day-chip" title="${WEEKDAYS_LONG[i]}">
              <input type="checkbox" name="days" value="${i}"${allDays || t.days.includes(i) ? ' checked' : ''}>
              <span>${w}</span>
            </label>`).join('')}
        </div>
      </div>

      <p class="form-error" id="form-error" role="alert"></p>

      <div class="sheet-actions">
        ${task ? '<button type="button" class="btn ghost danger" id="delete-task">Excluir</button>' : ''}
        <button type="submit" class="btn primary">${task ? 'Salvar' : 'Adicionar'}</button>
      </div>
    </form>`);

  const form = document.getElementById('task-form');
  const titleInput = form.elements.title;
  if (!task) setTimeout(() => titleInput.focus(), 50);

  form.querySelectorAll('input[name="emoji"]').forEach(radio => {
    radio.addEventListener('change', () => { document.getElementById('emoji-preview').textContent = radio.value; });
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(form);
    const title = String(fd.get('title') || '').trim();
    const days = fd.getAll('days').map(Number);
    const error = document.getElementById('form-error');
    if (!title) {
      error.textContent = 'Dê um nome para a tarefa.';
      titleInput.focus();
      return;
    }
    if (!days.length) {
      error.textContent = 'Escolha pelo menos um dia da semana.';
      return;
    }
    upsertTask({
      ...(task ? { id: task.id } : {}),
      title: title.slice(0, MAX_TITLE),
      emoji: firstGrapheme(fd.get('emoji')) || '✅',
      period: fd.get('period') || 'livre',
      days: days.length === 7 ? [] : days.sort(),
    });
    closeModal();
    render();
    toast(task ? 'Tarefa atualizada' : 'Tarefa adicionada ✨');
  });

  const del = document.getElementById('delete-task');
  if (del) {
    del.addEventListener('click', () => {
      if (!confirm(`Excluir "${task.title}"? O histórico dela deixa de aparecer.`)) return;
      deleteTask(task.id);
      closeModal();
      render();
      toast('Tarefa excluída');
    });
  }
}

function openDayModal(key) {
  const date = parseKey(key);
  const tasks = tasksForDate(date);
  const done = doneSet(key);
  const label = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  openModal(`
    <div class="sheet-head">
      <h2 class="capitalize">${esc(label)}</h2>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar">✕</button>
    </div>
    ${tasks.length
      ? `<ul class="task-list">${tasks.map(t => taskItem(t, done.has(t.id), key)).join('')}</ul>`
      : '<p class="muted">Nenhuma tarefa programada neste dia.</p>'}
  `, { day: key });
}

function openTemplatesModal() {
  openModal(`
    <div class="sheet-head">
      <h2>Modelos de rotina</h2>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar">✕</button>
    </div>
    <p class="muted small">As tarefas do modelo são somadas às suas. Repetidas são ignoradas.</p>
    ${templateList()}`);
}

function openSharedRoutineModal(shared) {
  openModal(`
    <div class="sheet-head">
      <h2>${shared.from ? `Rotina de ${esc(shared.from)}` : 'Rotina compartilhada'}</h2>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar">✕</button>
    </div>
    <p class="muted small">Alguém compartilhou estas tarefas com você. Quer adicionar à sua rotina?</p>
    <ul class="task-list compact">
      ${shared.tasks.map(t => `
        <li class="task muted-task">
          <span class="emoji" aria-hidden="true">${esc(t.emoji)}</span>
          <span class="task-title">${esc(t.title)}<small>${PERIODS.find(p => p.id === t.period).label} · ${esc(daysLabel(t.days))}</small></span>
        </li>`).join('')}
    </ul>
    <div class="sheet-actions">
      <button type="button" class="btn ghost" data-action="close-modal">Agora não</button>
      <button type="button" class="btn primary" id="accept-routine">Adicionar à minha rotina</button>
    </div>`);

  document.getElementById('accept-routine').addEventListener('click', () => {
    const added = addTasks(shared.tasks);
    closeModal();
    setTab('hoje');
    toast(added ? `${plural(added, 'tarefa adicionada', 'tarefas adicionadas')} ✨` : 'Você já tem essas tarefas.');
  });
}

function openInstallModal() {
  if (deferredInstall) {
    deferredInstall.prompt();
    deferredInstall.userChoice.finally(() => { deferredInstall = null; });
    return;
  }
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  openModal(`
    <div class="sheet-head">
      <h2>Instalar o Ritmo</h2>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar">✕</button>
    </div>
    ${standalone ? '<p>O Ritmo já está instalado neste aparelho. 🎉</p>' : `
    <div class="install-steps">
      <p><strong>iPhone (Safari):</strong> toque em <em>Compartilhar</em> ⬆️ e depois em <em>Adicionar à Tela de Início</em>.</p>
      <p><strong>Android (Chrome):</strong> toque no menu ⋮ e depois em <em>Instalar app</em> ou <em>Adicionar à tela inicial</em>.</p>
      <p><strong>Computador:</strong> clique no ícone de instalar na barra de endereço do navegador.</p>
    </div>`}`);
}

/* ---------- Eventos ---------- */

document.addEventListener('click', e => {
  const tab = e.target.closest('[data-tab]');
  if (tab) {
    setTab(tab.dataset.tab);
    return;
  }

  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id, day } = el.dataset;

  switch (action) {
    case 'toggle':
      toggleTask(id, day);
      render();
      if (day && $modal.open) openDayModal(day);
      break;
    case 'edit': openTaskModal(state.tasks.find(t => t.id === id)); break;
    case 'add': openTaskModal(); break;
    case 'template': applyTemplate(id); break;
    case 'templates': openTemplatesModal(); break;
    case 'day': openDayModal(day); break;
    case 'share-app': shareApp(); break;
    case 'share-routine': shareRoutine(); break;
    case 'install': openInstallModal(); break;
    case 'export': exportBackup(); break;
    case 'import': document.getElementById('import-file').click(); break;
    case 'reset': resetAll(); break;
    case 'close-modal': closeModal(); break;
  }
});

// Fecha o modal ao tocar fora dele
$modal.addEventListener('click', e => {
  if (e.target === $modal) closeModal();
});
$modal.addEventListener('close', () => {
  $modal.innerHTML = '';
  delete $modal.dataset.day;
});

document.addEventListener('change', e => {
  if (e.target.name === 'theme') {
    state.settings.theme = e.target.value;
    saveState();
    applyTheme();
  } else if (e.target.id === 'name-input') {
    state.settings.name = e.target.value.trim().slice(0, 30);
    saveState();
    toast('Nome salvo');
  } else if (e.target.id === 'import-file' && e.target.files[0]) {
    importBackup(e.target.files[0]);
    e.target.value = '';
  }
});

// Virou o dia com o app aberto? Atualiza a tela.
function refreshIfNewDay() {
  if (dateKey() !== renderedDay && !$modal.open) render();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshIfNewDay();
});
setInterval(refreshIfNewDay, 60 * 1000);

// Sincroniza entre abas abertas
window.addEventListener('storage', e => {
  if (e.key !== STORAGE_KEY) return;
  state = loadState();
  applyTheme();
  if (!$modal.open) render();
});

/* ---------- Instalação (PWA) ---------- */

let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstall = e;
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

/* ---------- Início ---------- */

applyTheme();
render();

const shared = readSharedRoutine();
if (location.hash.includes('rotina=')) clearHash();
if (shared) openSharedRoutineModal(shared);
