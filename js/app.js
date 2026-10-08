// ---------------- helpers ----------------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2400);
}

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d)) return s;
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// "3:30" -> 210, "95" -> 95, "" -> null, garbage -> NaN
function parseTime(str) {
  str = (str || '').trim();
  if (!str) return null;
  const m = str.match(/^(\d{1,2}):([0-5]?\d)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  if (/^\d+$/.test(str)) return Number(str);
  return NaN;
}

const ratioText = (dose, water) => (dose > 0 && water > 0 ? `1:${(water / dose).toFixed(1)}` : '');
const starsHtml = n => `<span class="rating">${'★'.repeat(n)}<span class="off">${'★'.repeat(5 - n)}</span></span>`;
const beanLabel = b => (b.roaster ? `${b.name} — ${b.roaster}` : b.name);

// ---------------- method definitions ----------------
const METHODS = {
  pourover: {
    label: 'Pour-over', short: 'Pour-over', waterLabel: 'Water (g)', timeLabel: 'Total time (m:ss)',
    fields: [
      { key: 'dripper', label: 'Dripper', type: 'select', options: ['Hario V60', 'Kalita Wave', 'Chemex', 'Origami', 'April', 'Orea', 'Melitta', 'Other'] },
      { key: 'filter', label: 'Filter', placeholder: 'e.g. Hario tabbed' },
      { key: 'bloomWater', label: 'Bloom water (g)', type: 'number' },
      { key: 'bloomTime', label: 'Bloom time (s)', type: 'number' },
      { key: 'pours', label: 'Number of pours', type: 'number' },
      { key: 'technique', label: 'Technique', placeholder: 'e.g. swirl after bloom' },
    ],
  },
  aeropress: {
    label: 'AeroPress', short: 'AeroPress', waterLabel: 'Brew water (g)', timeLabel: 'Total time (m:ss)',
    fields: [
      { key: 'orientation', label: 'Orientation', type: 'select', options: ['Standard', 'Inverted', 'Flow control cap'] },
      { key: 'filter', label: 'Filter', type: 'select', options: ['Paper', '2× paper', 'Metal', 'Paper + metal'] },
      { key: 'bloomWater', label: 'Bloom water (g)', type: 'number' },
      { key: 'steepTime', label: 'Steep time (s)', type: 'number' },
      { key: 'agitation', label: 'Agitation', placeholder: 'e.g. stir 10×, swirl' },
      { key: 'pressTime', label: 'Press time (s)', type: 'number' },
      { key: 'bypass', label: 'Bypass / dilution (g)', type: 'number' },
    ],
  },
  rok: {
    label: 'ROK Presso GC Pro', short: 'ROK', waterLabel: 'Yield (g)', timeLabel: 'Shot time (m:ss)',
    fields: [
      { key: 'drink', label: 'Drink', type: 'select', options: ['Espresso', 'Ristretto', 'Lungo', 'Americano', 'Latte', 'Flat white', 'Cappuccino', 'Cortado'] },
      { key: 'preheat', label: 'Preheated', type: 'select', options: ['Yes', 'No'] },
      { key: 'preinfusion', label: 'Pre-infusion (s)', type: 'number' },
      { key: 'pressure', label: 'Peak pressure (bar)', type: 'number', step: '0.5' },
      { key: 'puckPrep', label: 'Puck prep', placeholder: 'e.g. WDT, tamp, paper' },
      { key: 'milk', label: 'Milk (g)', type: 'number' },
    ],
  },
};

// ---------------- navigation ----------------
let currentView = 'log';

function show(view) {
  currentView = view;
  $$('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
  render();
  window.scrollTo(0, 0);
}

function render() {
  const n = Store.brews.length;
  $('#brewCount').textContent = n ? `${n} brew${n === 1 ? '' : 's'}` : '';
  if (currentView === 'history') renderHistory();
  if (currentView === 'beans') renderBeans();
  if (currentView === 'favourites') renderFavourites();
  if (currentView === 'log') { refreshBeanSelect(); refreshGrinders(); }
}

$('#tabs').addEventListener('click', e => {
  const b = e.target.closest('button[data-view]');
  if (b) show(b.dataset.view);
});

// ---------------- brew form ----------------
const form = $('#brewForm');
const F = name => form.elements[name];
let editingId = null;
let rating = 0;

function refreshBeanSelect(selected) {
  const sel = $('#beanSelect');
  const cur = selected ?? sel.value;
  const beans = [...Store.beans].sort((a, b) => (!!b.favourite - !!a.favourite) || a.name.localeCompare(b.name));
  sel.innerHTML = '<option value="">— No bean —</option>' +
    beans.map(b => `<option value="${esc(b.id)}">${b.favourite ? '★ ' : ''}${esc(beanLabel(b))}</option>`).join('');
  sel.value = cur && Store.bean(cur) ? cur : '';
}

function refreshGrinders() {
  const names = [...new Set(Store.brews.map(b => b.grinder).filter(Boolean))];
  $('#grinderList').innerHTML = names.map(n => `<option value="${esc(n)}">`).join('');
}

function renderMethodFields(method, values = {}) {
  const m = METHODS[method];
  $('#methodLegend').textContent = `${m.label} details`;
  $('#waterLabel').textContent = m.waterLabel;
  $('#timeLabel').textContent = m.timeLabel;
  $('#methodFields').innerHTML = m.fields.map(f => {
    const v = values[f.key] ?? '';
    const name = `d_${f.key}`;
    if (f.type === 'select') {
      const opts = v && !f.options.includes(v) ? [...f.options, v] : f.options;
      return `<label>${esc(f.label)}<select name="${name}"><option value=""></option>${
        opts.map(o => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
    }
    const numAttrs = f.type === 'number' ? `type="number" step="${f.step || 'any'}" min="0" inputmode="decimal"` : '';
    return `<label>${esc(f.label)}<input name="${name}" ${numAttrs} placeholder="${esc(f.placeholder || '')}" value="${esc(v)}"></label>`;
  }).join('');
  updateRatio();
}

function updateRatio() {
  const dose = Number(F('dose').value), water = Number(F('water').value);
  const method = F('method').value;
  const bypass = method === 'aeropress' && F('d_bypass') ? Number(F('d_bypass').value) : 0;
  let txt = ratioText(dose, water);
  if (!txt) { $('#ratioOut').textContent = 'Ratio —'; return; }
  txt = `${method === 'rok' ? 'Brew ratio' : 'Ratio'} ${txt}`;
  if (bypass > 0) txt += ` · ${ratioText(dose, water + bypass)} incl. dilution`;
  $('#ratioOut').textContent = txt;
}

function renderStars() {
  $('#ratingInput').innerHTML = [1, 2, 3, 4, 5].map(i =>
    `<button type="button" data-v="${i}" class="${i <= rating ? 'on' : ''}" aria-label="${i} star${i > 1 ? 's' : ''}">★</button>`).join('');
}

$('#ratingInput').addEventListener('click', e => {
  const b = e.target.closest('button[data-v]');
  if (!b) return;
  const v = Number(b.dataset.v);
  rating = v === rating ? 0 : v;
  renderStars();
});

// mode: 'edit' keeps everything; 'new' starts a fresh brew from the given parameters.
function fillBrewForm(b = {}, mode = 'new') {
  form.reset();
  const method = METHODS[b.method] ? b.method : 'pourover';
  form.querySelector(`input[name=method][value=${method}]`).checked = true;
  refreshBeanSelect(b.beanId || '');
  refreshGrinders();
  const isEdit = mode === 'edit';
  F('date').value = isEdit && b.date ? b.date : nowLocal();
  F('recipeName').value = b.recipeName || '';
  F('dose').value = b.dose ?? '';
  F('water').value = b.water ?? '';
  F('temp').value = b.temp ?? '';
  F('grinder').value = b.grinder || '';
  F('grind').value = b.grind || '';
  F('time').value = fmtTime(b.time);
  F('notes').value = isEdit ? b.notes || '' : '';
  F('favourite').checked = isEdit && !!b.favourite;
  rating = isEdit ? b.rating || 0 : 0;
  renderStars();
  renderMethodFields(method, b.details || {});
  editingId = isEdit ? b.id : null;
  $('#brewFormTitle').textContent = editingId ? 'Edit brew' : 'Log a brew';
  $('#cancelEdit').hidden = !editingId;
  $('#saveBrewBtn').textContent = editingId ? 'Update brew' : 'Save brew';
}

function readBrewForm() {
  const method = F('method').value;
  const num = v => (v === '' ? null : Number(v));
  const details = {};
  METHODS[method].fields.forEach(f => {
    const v = F(`d_${f.key}`).value.trim();
    if (v !== '') details[f.key] = f.type === 'number' ? Number(v) : v;
  });
  return {
    method,
    beanId: F('beanId').value || null,
    date: F('date').value,
    recipeName: F('recipeName').value.trim(),
    dose: num(F('dose').value),
    water: num(F('water').value),
    temp: num(F('temp').value),
    grinder: F('grinder').value.trim(),
    grind: F('grind').value.trim(),
    time: parseTime(F('time').value),
    rating,
    notes: F('notes').value.trim(),
    favourite: F('favourite').checked,
    details,
  };
}

const lastBrewOf = method =>
  [...Store.brews].filter(b => b.method === method).sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];

$('#methodPicker').addEventListener('change', () => {
  const method = F('method').value;
  renderMethodFields(method);
  // carry the usual grinder for this method over to save typing
  const last = lastBrewOf(method);
  if (last && !F('grinder').value) F('grinder').value = last.grinder || '';
});

form.addEventListener('input', e => {
  if (['dose', 'water', 'd_bypass'].includes(e.target.name)) updateRatio();
});

$('#copyLastBtn').addEventListener('click', () => {
  const last = lastBrewOf(F('method').value);
  if (!last) return toast(`No previous ${METHODS[F('method').value].label} brews yet`);
  fillBrewForm(last, 'new');
  toast('Copied your last brew — tweak and save');
});

$('#cancelEdit').addEventListener('click', () => { fillBrewForm({ method: F('method').value }); show('history'); });
$('#clearForm').addEventListener('click', () => fillBrewForm({ method: F('method').value }));

form.addEventListener('submit', e => {
  e.preventDefault();
  const brew = readBrewForm();
  if (Number.isNaN(brew.time)) {
    F('time').focus();
    return toast('Time should look like 3:30 (or seconds)');
  }
  if (editingId) brew.id = editingId;
  Store.saveBrew(brew);
  if (!Store.persisted()) return toast('Could not save — browser storage is unavailable');
  toast(editingId ? 'Brew updated' : 'Brew saved ☕');
  fillBrewForm({ method: brew.method, grinder: brew.grinder });
  show('history');
});

// ---------------- brew cards ----------------
function brewCard(b) {
  const bean = b.beanId ? Store.bean(b.beanId) : null;
  const m = METHODS[b.method] || METHODS.pourover;
  const beanName = bean ? bean.name : b.beanId ? 'Deleted bean' : 'No bean';
  const unit = b.method === 'rok' ? 'out' : '';
  const stats = [
    b.dose != null && b.water != null ? `<span><b>${b.dose} g → ${b.water} g ${unit}</b> ${ratioText(b.dose, b.water)}</span>` : '',
    b.temp != null ? `<span>🌡 ${b.temp}°C</span>` : '',
    b.time != null ? `<span>⏱ ${fmtTime(b.time)}</span>` : '',
    b.grind || b.grinder ? `<span>⚙ ${esc([b.grind, b.grinder].filter(Boolean).join(' on '))}</span>` : '',
  ].filter(Boolean).join('');
  const kv = m.fields
    .filter(f => b.details && b.details[f.key] != null && b.details[f.key] !== '')
    .map(f => `<dt>${esc(f.label)}</dt><dd>${esc(b.details[f.key])}</dd>`).join('');
  return `<article class="brew" data-method="${esc(b.method)}" data-id="${esc(b.id)}">
    <div class="brew-top">
      <div>
        <span class="badge">${esc(m.short)}</span><span class="brew-title">${esc(beanName)}</span>
        <div class="brew-meta">${esc(fmtDate(b.date))}${bean && bean.roaster ? ' · ' + esc(bean.roaster) : ''}${b.recipeName ? ' · ' + esc(b.recipeName) : ''}</div>
      </div>
      <button class="fav-btn ${b.favourite ? 'on' : ''}" data-act="fav-brew" aria-label="Toggle favourite brew" title="Favourite brew">★</button>
    </div>
    ${stats ? `<div class="brew-stats">${stats}</div>` : ''}
    ${b.rating ? `<div>${starsHtml(b.rating)}</div>` : ''}
    ${b.notes ? `<div class="brew-notes">${esc(b.notes)}</div>` : ''}
    ${kv ? `<details><summary>${esc(m.label)} details</summary><dl class="kv">${kv}</dl></details>` : ''}
    <div class="actions">
      <button class="btn sm" data-act="again">↻ Brew again</button>
      <button class="btn ghost sm" data-act="edit">Edit</button>
      <button class="btn ghost sm danger" data-act="del-brew">Delete</button>
    </div>
  </article>`;
}

const empty = msg => `<div class="empty">${msg}</div>`;

// ---------------- history ----------------
const historyState = { method: '', q: '', sort: 'new', fav: false };

function renderHistory() {
  const q = historyState.q.toLowerCase();
  let list = Store.brews.filter(b => {
    if (historyState.method && b.method !== historyState.method) return false;
    if (historyState.fav && !b.favourite) return false;
    if (!q) return true;
    const bean = b.beanId ? Store.bean(b.beanId) : null;
    const hay = [b.notes, b.recipeName, b.grinder, bean && bean.name, bean && bean.roaster, bean && bean.origin,
      ...Object.values(b.details || {})].join(' ').toLowerCase();
    return hay.includes(q);
  });
  const byDate = (a, b) => (b.date || '').localeCompare(a.date || '');
  if (historyState.sort === 'new') list.sort(byDate);
  if (historyState.sort === 'old') list.sort((a, b) => byDate(b, a));
  if (historyState.sort === 'rating') list.sort((a, b) => (b.rating || 0) - (a.rating || 0) || byDate(a, b));
  $('#historyList').innerHTML = list.length ? list.map(brewCard).join('')
    : empty(Store.brews.length ? 'No brews match these filters.' : 'No brews yet — log your first one in “Log brew”.');
}

$('#historyMethodChips').addEventListener('click', e => {
  const c = e.target.closest('[data-m]');
  if (!c) return;
  historyState.method = c.dataset.m;
  $$('#historyMethodChips .chip').forEach(x => x.classList.toggle('active', x === c));
  renderHistory();
});
$('#historySearch').addEventListener('input', e => { historyState.q = e.target.value; renderHistory(); });
$('#historySort').addEventListener('change', e => { historyState.sort = e.target.value; renderHistory(); });
$('#historyFavOnly').addEventListener('change', e => { historyState.fav = e.target.checked; renderHistory(); });

// ---------------- beans ----------------
function beanCard(b) {
  const brews = Store.brews.filter(x => x.beanId === b.id);
  const rated = brews.filter(x => x.rating);
  const avg = rated.length ? (rated.reduce((s, x) => s + x.rating, 0) / rated.length).toFixed(1) : null;
  const days = b.roastDate ? Math.floor((Date.now() - new Date(b.roastDate)) / 86400000) : null;
  const sub = [b.origin, b.process, b.roastLevel, b.varietal].filter(Boolean).join(' · ');
  return `<article class="bean" data-bean-id="${esc(b.id)}">
    <div class="brew-top">
      <div>
        <div class="brew-title">${esc(b.name)}</div>
        ${b.roaster ? `<div class="bean-sub">${esc(b.roaster)}</div>` : ''}
      </div>
      <button class="fav-btn ${b.favourite ? 'on' : ''}" data-act="fav-bean" aria-label="Toggle favourite bean" title="Favourite bean">★</button>
    </div>
    ${sub ? `<div class="bean-sub">${esc(sub)}</div>` : ''}
    ${days != null && days >= 0 ? `<div class="bean-sub">Roasted ${esc(b.roastDate)} · ${days} day${days === 1 ? '' : 's'} ago</div>` : ''}
    ${b.notes ? `<div class="brew-notes small">${esc(b.notes)}</div>` : ''}
    <div class="bean-stats">${brews.length} brew${brews.length === 1 ? '' : 's'}${avg ? ` · avg <span class="rating">★</span> ${avg}` : ''}</div>
    <div class="actions">
      <button class="btn sm" data-act="brew-bean">☕ Brew this</button>
      <button class="btn ghost sm" data-act="edit-bean">Edit</button>
      <button class="btn ghost sm danger" data-act="del-bean">Delete</button>
    </div>
  </article>`;
}

const beanState = { q: '', fav: false };

function renderBeans() {
  const q = beanState.q.toLowerCase();
  const list = Store.beans
    .filter(b => (!beanState.fav || b.favourite) &&
      (!q || [b.name, b.roaster, b.origin, b.process, b.varietal, b.notes].join(' ').toLowerCase().includes(q)))
    .sort((a, b) => (!!b.favourite - !!a.favourite) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  $('#beanList').innerHTML = list.length ? list.map(beanCard).join('')
    : empty(Store.beans.length ? 'No beans match.' : 'No beans yet — add the bag you are brewing.');
}

$('#beanSearch').addEventListener('input', e => { beanState.q = e.target.value; renderBeans(); });
$('#beanFavOnly').addEventListener('change', e => { beanState.fav = e.target.checked; renderBeans(); });

const beanDialog = $('#beanDialog');
const beanForm = $('#beanForm');
let beanEditingId = null;
let beanSavedCb = null;

function openBeanDialog(bean, onSaved) {
  beanForm.reset();
  beanEditingId = bean ? bean.id : null;
  beanSavedCb = onSaved || null;
  $('#beanDialogTitle').textContent = bean ? 'Edit bean' : 'Add bean';
  if (bean) {
    ['name', 'roaster', 'origin', 'process', 'roastLevel', 'varietal', 'roastDate', 'notes']
      .forEach(k => { beanForm.elements[k].value = bean[k] || ''; });
    beanForm.elements.favourite.checked = !!bean.favourite;
  }
  beanDialog.showModal();
  beanForm.elements.name.focus();
}

beanForm.addEventListener('submit', e => {
  e.preventDefault();
  const E = beanForm.elements;
  const bean = { favourite: E.favourite.checked };
  ['name', 'roaster', 'origin', 'process', 'roastLevel', 'varietal', 'roastDate', 'notes'].forEach(k => { bean[k] = E[k].value.trim(); });
  if (beanEditingId) bean.id = beanEditingId;
  const saved = Store.saveBean(bean);
  beanDialog.close();
  toast(beanEditingId ? 'Bean updated' : 'Bean added');
  if (beanSavedCb) beanSavedCb(saved);
  render();
});
$('#beanCancel').addEventListener('click', () => beanDialog.close());
$('#addBeanBtn').addEventListener('click', () => openBeanDialog());
$('#quickAddBean').addEventListener('click', () => openBeanDialog(null, b => refreshBeanSelect(b.id)));

// ---------------- favourites ----------------
function renderFavourites() {
  const beans = Store.beans.filter(b => b.favourite);
  const brews = Store.brews.filter(b => b.favourite).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  $('#favBeans').innerHTML = beans.length ? beans.map(beanCard).join('') : empty('Tap ★ on a bean to keep it here.');
  $('#favBrews').innerHTML = brews.length ? brews.map(brewCard).join('') : empty('Tap ★ on a brew to keep it here.');
}

// ---------------- card actions (delegated) ----------------
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const brewId = btn.closest('[data-id]')?.dataset.id;
  const beanId = btn.closest('[data-bean-id]')?.dataset.beanId;
  switch (btn.dataset.act) {
    case 'fav-brew': {
      const on = Store.toggleFavourite('brew', brewId);
      toast(on ? 'Added to favourite brews ★' : 'Removed from favourites');
      render();
      break;
    }
    case 'again':
      fillBrewForm(Store.brew(brewId), 'new');
      show('log');
      toast('Same parameters loaded — brew and rate it');
      break;
    case 'edit':
      fillBrewForm(Store.brew(brewId), 'edit');
      show('log');
      break;
    case 'del-brew':
      if (confirm('Delete this brew?')) { Store.deleteBrew(brewId); toast('Brew deleted'); render(); }
      break;
    case 'fav-bean': {
      const on = Store.toggleFavourite('bean', beanId);
      toast(on ? 'Added to favourite beans ★' : 'Removed from favourites');
      render();
      break;
    }
    case 'brew-bean': {
      const method = F('method').value;
      const last = lastBrewOf(method);
      fillBrewForm({ method, beanId, grinder: last && last.grinder });
      show('log');
      break;
    }
    case 'edit-bean':
      openBeanDialog(Store.bean(beanId));
      break;
    case 'del-bean': {
      const n = Store.brews.filter(b => b.beanId === beanId).length;
      if (confirm(n ? `Delete this bean? Its ${n} brew(s) will be kept but show “Deleted bean”.` : 'Delete this bean?')) {
        Store.deleteBean(beanId);
        toast('Bean deleted');
        render();
      }
      break;
    }
  }
});

// ---------------- timer ----------------
const Timer = (() => {
  const el = $('#timer');
  let steps = [], startedAt = 0, acc = 0, running = false, raf = 0, lastIdx = -2, onLog = null, audio = null, wakeLock = null;
  const elapsed = () => acc + (running ? (performance.now() - startedAt) / 1000 : 0);

  function cue() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.2, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.35);
      o.connect(g).connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + 0.35);
    } catch (e) { /* no audio available */ }
    if (navigator.vibrate) navigator.vibrate(150);
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  const stepText = s => s.text + (s.target ? ` → ${s.target} g` : '');

  function draw() {
    const t = elapsed();
    $('#timerClock').textContent = fmtTime(Math.floor(t));
    let idx = -1;
    steps.forEach((s, i) => { if (s.at <= t) idx = i; });
    const cur = steps[idx], next = steps[idx + 1];
    $('#timerNow').textContent = running || acc ? (cur ? stepText(cur) : '') : 'Ready — press Start';
    $('#timerNext').textContent = next ? `Next in ${fmtTime(Math.ceil(next.at - t))}: ${stepText(next)}` : cur ? 'Last step' : '';
    if (running && idx !== lastIdx && idx >= 0) cue();
    lastIdx = idx;
    if (running) raf = requestAnimationFrame(draw);
  }

  async function keepAwake(on) {
    try {
      if (on && 'wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
      else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (e) { /* not supported or denied */ }
  }

  function pause() {
    if (!running) return;
    acc = elapsed();
    running = false;
    cancelAnimationFrame(raf);
    keepAwake(false);
    $('#timerToggle').textContent = 'Resume';
    draw();
  }

  function start() {
    startedAt = performance.now();
    running = true;
    keepAwake(true);
    $('#timerToggle').textContent = 'Pause';
    draw();
  }

  function reset() {
    pause();
    acc = 0;
    lastIdx = -2;
    $('#timerToggle').textContent = 'Start';
    draw();
  }

  $('#timerToggle').addEventListener('click', () => (running ? pause() : start()));
  $('#timerReset').addEventListener('click', reset);
  $('#timerClose').addEventListener('click', () => { pause(); el.hidden = true; });
  $('#timerLog').addEventListener('click', () => {
    const t = Math.round(elapsed());
    pause();
    el.hidden = true;
    if (onLog) onLog(t);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && running) keepAwake(true);
  });

  return {
    open(title, stepList, logCb) {
      steps = stepList.filter(s => s.at != null).sort((a, b) => a.at - b.at);
      onLog = logCb;
      $('#timerTitle').textContent = title;
      el.hidden = false;
      reset();
    },
  };
})();

// ---------------- recipe output (shared) ----------------
function logRecipe(rec, time) {
  const last = lastBrewOf(rec.log.method);
  fillBrewForm({ ...rec.log, time: time || rec.total, grinder: last && last.grinder });
  show('log');
  toast('Recipe loaded — pick your bean, rate it and save');
}

function renderRecipeOutput(container, rec) {
  let prev = 0;
  const rows = [
    ...rec.prep.map(s => `<tr><td class="t">Prep</td><td>${esc(s.text)}</td><td class="w"></td></tr>`),
    ...rec.steps.map(s => {
      let w = '';
      if (s.target) { w = `→ ${s.target} g<small>+${s.target - prev} g</small>`; prev = s.target; }
      return `<tr><td class="t">${fmtTime(s.at)}</td><td>${esc(s.text)}</td><td class="w">${w}</td></tr>`;
    }),
  ].join('');
  const total = rec.water + (rec.bypass || 0);
  container.innerHTML = `<div class="card recipe-out" style="margin-top:14px">
    <h3>${esc(rec.title)}</h3>
    <div class="muted small">${esc(rec.subtitle)}</div>
    <div class="recipe-summary">
      <div class="stat"><small>Coffee</small><b>${rec.dose} g</b></div>
      <div class="stat"><small>Water</small><b>${rec.water} g</b></div>
      ${rec.bypass ? `<div class="stat"><small>Dilute</small><b>+${rec.bypass} g</b></div>` : ''}
      <div class="stat"><small>Ratio</small><b>${ratioText(rec.dose, total)}</b></div>
      <div class="stat"><small>Temp</small><b>${rec.temp >= 100 ? 'Boiling' : rec.temp + '°C'}</b></div>
      <div class="stat"><small>Grind</small><b>${esc(rec.grind)}</b></div>
      <div class="stat"><small>Time</small><b>~${fmtTime(rec.total)}</b></div>
    </div>
    <table class="steps"><tbody>${rows}</tbody></table>
    ${rec.notes && rec.notes.length ? `<ul class="recipe-notes">${rec.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    <div class="actions">
      <button class="btn primary" data-rec="timer">▶ Start timer</button>
      <button class="btn ghost" data-rec="log">Log this brew</button>
    </div>
  </div>`;
  $('[data-rec=timer]', container).onclick = () => Timer.open(rec.title, rec.steps, t => logRecipe(rec, t));
  $('[data-rec=log]', container).onclick = () => logRecipe(rec);
}

$('#recipeTabs').addEventListener('click', e => {
  const c = e.target.closest('[data-r]');
  if (!c) return;
  $$('#recipeTabs .chip').forEach(x => x.classList.toggle('active', x === c));
  $('#recipe-pourover').hidden = c.dataset.r !== 'pourover';
  $('#recipe-aeropress').hidden = c.dataset.r !== 'aeropress';
});

// ---------------- pour-over generator ----------------
const pour = { id: POUROVER_RECIPES[0].id, dose: '', ratio: '', roast: 'light', opts: {} };
const pourRecipe = () => POUROVER_RECIPES.find(r => r.id === pour.id);

function selectPourRecipe(id) {
  pour.id = id;
  const r = pourRecipe();
  pour.dose = r.dose;
  pour.ratio = r.ratio;
  pour.opts = Object.fromEntries((r.options || []).map(o => [o.key, o.choices[0][0]]));
  $$('#pourRecipeList .recipe-opt').forEach(b => b.classList.toggle('active', b.dataset.id === id));
  renderPourControls();
  renderPourOutput();
}

function renderPourControls() {
  const r = pourRecipe();
  const roastOpts = ROAST_LEVELS.map(l => `<option value="${l}"${l === pour.roast ? ' selected' : ''}>${l[0].toUpperCase() + l.slice(1)}</option>`).join('');
  $('#pourControls').innerHTML = `
    <label>Coffee (g)<input type="number" min="5" max="80" step="0.5" inputmode="decimal" data-k="dose" value="${pour.dose}"></label>
    <label>Ratio 1:<input type="number" min="10" max="20" step="0.1" inputmode="decimal" data-k="ratio" value="${pour.ratio}"></label>
    <label>Roast<select data-k="roast">${roastOpts}</select></label>
    ${(r.options || []).map(o => `<label>${esc(o.label)}<select data-opt="${o.key}">${
      o.choices.map(([v, l]) => `<option value="${v}"${pour.opts[o.key] === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`).join('')}`;
}

function computePour() {
  const r = pourRecipe();
  const d = Number(pour.dose) > 0 ? Number(pour.dose) : r.dose;
  const ratio = Number(pour.ratio) > 0 ? Number(pour.ratio) : r.ratio;
  const W = r1(d * ratio);
  const { total, steps } = r.build(d, W, pour.opts);
  const temp = r.temp[pour.roast];
  const hasBloom = /^Bloom/.test(steps[0].text);
  return {
    title: r.name, subtitle: `${r.author} · ${r.dripper} · ${pour.roast} roast`,
    dose: d, water: W, bypass: 0, temp, grind: r.grind, total,
    prep: [
      { text: `Heat water to ${temp >= 100 ? 'just off the boil' : temp + '°C'}` },
      { text: `Grind ${d} g ${r.grind.toLowerCase()}` },
      { text: `Rinse the filter in your ${r.dripper}, discard the water, add coffee and tare` },
    ],
    steps,
    notes: r.notes,
    log: {
      method: 'pourover', dose: d, water: W, temp, recipeName: `${r.name} (${r.author})`,
      details: {
        dripper: r.dripper,
        bloomWater: hasBloom ? steps[0].target : '',
        bloomTime: hasBloom ? steps[1].at : '',
        pours: steps.filter(s => s.target).length,
      },
    },
  };
}

const renderPourOutput = () => renderRecipeOutput($('#pourOutput'), computePour());

$('#pourRecipeList').innerHTML = POUROVER_RECIPES.map(r =>
  `<button class="recipe-opt" data-id="${r.id}"><strong>${esc(r.name)}</strong><span>${esc(r.author)} · ${esc(r.dripper)} · 1:${r.ratio}</span></button>`).join('');
$('#pourRecipeList').addEventListener('click', e => {
  const b = e.target.closest('.recipe-opt');
  if (b) selectPourRecipe(b.dataset.id);
});
$('#pourControls').addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.k) pour[t.dataset.k] = t.value;
  if (t.dataset.opt) pour.opts[t.dataset.opt] = t.value;
  renderPourOutput();
});
$('#surpriseBtn').addEventListener('click', () => {
  const others = POUROVER_RECIPES.filter(r => r.id !== pour.id);
  const r = others[Math.floor(Math.random() * others.length)];
  selectPourRecipe(r.id);
  (r.options || []).forEach(o => { pour.opts[o.key] = o.choices[Math.floor(Math.random() * o.choices.length)][0]; });
  renderPourControls();
  renderPourOutput();
  toast(`How about ${r.name} by ${r.author}?`);
});

// ---------------- AeroPress dice ----------------
const PIPS = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const rand6 = () => Math.floor(Math.random() * 6);
const dice = { faces: DICE.map(rand6), locked: DICE.map(() => false), rolling: false };

function renderDice() {
  $('#diceGrid').innerHTML = DICE.map((die, i) => {
    const f = die.faces[dice.faces[i]];
    return `<button class="die${dice.locked[i] ? ' locked' : ''}${dice.rolling && !dice.locked[i] ? ' rolling' : ''}" data-i="${i}" aria-pressed="${dice.locked[i]}" title="Tap to ${dice.locked[i] ? 'unlock' : 'lock'}">
      <span class="pip">${PIPS[dice.faces[i]]}</span>
      <span class="die-name">${die.icon} ${esc(die.name)}</span>
      <span class="die-face">${esc(f.label)}</span>
    </button>`;
  }).join('');
}

function renderDiceRecipe() {
  const faces = Object.fromEntries(DICE.map((die, i) => [die.id, die.faces[dice.faces[i]]]));
  renderRecipeOutput($('#apOutput'), buildDiceRecipe(faces));
}

function rollDice() {
  if (dice.rolling) return;
  if (dice.locked.every(Boolean)) return toast('All dice are locked — tap one to unlock');
  $$('#apClassics .chip').forEach(c => c.classList.remove('active'));
  dice.rolling = true;
  let n = 0;
  const iv = setInterval(() => {
    dice.faces = dice.faces.map((f, i) => (dice.locked[i] ? f : rand6()));
    renderDice();
    if (++n >= 9) {
      clearInterval(iv);
      dice.rolling = false;
      renderDice();
      renderDiceRecipe();
    }
  }, 70);
}

$('#diceGrid').addEventListener('click', e => {
  const d = e.target.closest('.die');
  if (!d || dice.rolling) return;
  const i = Number(d.dataset.i);
  dice.locked[i] = !dice.locked[i];
  renderDice();
});
$('#rollBtn').addEventListener('click', rollDice);

$('#apClassics').innerHTML = AEROPRESS_CLASSICS.map(c => `<button class="chip" data-id="${c.id}">${esc(c.name)}</button>`).join('');
$('#apClassics').addEventListener('click', e => {
  const c = e.target.closest('[data-id]');
  if (!c) return;
  $$('#apClassics .chip').forEach(x => x.classList.toggle('active', x === c));
  renderRecipeOutput($('#apOutput'), AEROPRESS_CLASSICS.find(x => x.id === c.dataset.id).build());
});

// ---------------- import / export ----------------
$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `brew-log-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$('#importInput').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const res = Store.importJSON(JSON.parse(await file.text()));
    toast(`Imported ${res.brews} brews and ${res.beans} beans`);
    render();
  } catch (err) {
    toast(`Import failed: ${err.message}`);
  }
});

// ---------------- PWA ----------------
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
// Ask the browser not to evict our data under storage pressure.
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

// ---------------- init ----------------
fillBrewForm({ method: 'pourover', grinder: lastBrewOf('pourover')?.grinder });
selectPourRecipe(POUROVER_RECIPES[0].id);
renderDice();
renderDiceRecipe();
render();
