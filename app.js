// Flock survey: one question per screen, answers kept in localStorage and sent
// to Supabase after every step, so drop-off is measurable and a reload resumes.

import { QUESTIONS, PARTS, CONCEPT, UI, LOOK, endsSurvey } from './questions.js';
import { ICONS, BIRD_LEVEL, FORMATION } from './icons.js';
import { SUPABASE_URL, SUPABASE_KEY, SURVEY_ID } from './config.js';

const STORE = `flock-survey:${SURVEY_ID}`;
const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
const SOURCE = (params.get('s') || params.get('utm_source') || '').slice(0, 40) || null;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(pointer: fine)').matches;

let state = load() || fresh();
let busy = false;
let inflight = Promise.resolve();
let swapToken = 0;
let autoTimer = 0;
let prevPct = 0;
// Motion bookkeeping, so a redraw only animates what just changed.
let lastPicked = null;
let lastPeople = 0;
let footWasValid = null;

// ---------------------------------------------------------------------------
// State

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function fresh(lang) {
  return {
    id: uuid(),
    lang: lang || (/^it\b/i.test(navigator.language || '') ? 'it' : 'en'),
    answers: {},
    at: -1, // -1 is the welcome screen, otherwise an index into QUESTIONS
    reached: 0, // furthest question shown, 1-based
    done: false, // the five core answers are in
    out: false, // finished early: doesn't live with flatmates
    bonus: false, // answering the optional bonus round
    bonusDone: false,
  };
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    return s && s.id ? s : null;
  } catch {
    return null;
  }
}

function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify(state));
  } catch {
    // private mode: the survey still works, it just won't resume
  }
}

const t = (m) => m[state.lang] ?? m.en;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const shown = (q) => !q.when || q.when(state.answers);
const current = () => QUESTIONS[state.at];
// On the thank-you screen: the core is sent and no bonus round is open.
const onDone = () => state.done && (!state.bonus || state.bonusDone);

// The core or bonus questions this respondent will see, given their answers so far.
function path(bonus = state.bonus) {
  const out = [];
  for (const q of QUESTIONS) {
    if (Boolean(q.bonus) !== bonus || !shown(q)) continue;
    out.push(q);
    if (endsSurvey(q, state.answers)) break;
  }
  return out;
}

function answered(q) {
  const a = state.answers;
  switch (q.type) {
    case 'single':
    case 'scale':
      return a[q.id] != null;
    case 'multi':
      return (a[q.id] || []).length > 0;
    case 'combo':
      return q.parts.every((p) => a[p.id] != null);
    case 'prices':
      return q.fields.every((f) => a[f.id] != null);
    default:
      return Boolean((a[q.id] || '').trim());
  }
}

// Core questions need an answer; optional and bonus ones can be skipped.
// Prices go all or nothing.
function valid(q) {
  if (q.type === 'prices') {
    const n = q.fields.filter((f) => state.answers[f.id] != null).length;
    return n === q.fields.length || (n === 0 && Boolean(q.optional || q.bonus));
  }
  return answered(q) || Boolean(q.optional || q.bonus);
}

// ---------------------------------------------------------------------------
// Navigation

function go(i, dir, fromHistory = false) {
  clearTimeout(autoTimer);
  state.at = i;
  if (i >= 0) state.reached = Math.max(state.reached, i + 1);
  save();
  if (dir > 0 && !fromHistory) history.pushState({ at: i }, '');
  render(dir);
}

function start() {
  const p = path(false);
  const furthest = p.filter((q) => QUESTIONS.indexOf(q) < state.reached);
  go(QUESTIONS.indexOf(furthest[furthest.length - 1] || p[0]), 1);
}

function startBonus() {
  state.bonus = true;
  go(QUESTIONS.indexOf(path(true)[0]), 1);
}

function next() {
  const q = current();
  if (!q || busy || !valid(q)) return;
  const p = path();
  const k = p.indexOf(q);
  if (k === p.length - 1) return finish();
  go(QUESTIONS.indexOf(p[k + 1]), 1);
  push();
}

function back(fromHistory = false) {
  if (busy || onDone()) return;
  const p = path();
  const k = p.indexOf(current());
  if (k > 0) return go(QUESTIONS.indexOf(p[k - 1]), -1, fromHistory);
  if (!state.bonus) return go(-1, -1, fromHistory);
  // Leaving the bonus round goes back to the thank-you screen; answers stay.
  state.bonus = false;
  save();
  render(-1);
}

function autoNext() {
  clearTimeout(autoTimer);
  const at = state.at;
  autoTimer = setTimeout(() => state.at === at && next(), reduceMotion ? 120 : 320);
}

function choose(q, raw, id = q.id) {
  const a = state.answers;
  lastPicked = `${id}:${raw}`;
  navigator.vibrate?.(8);
  if (q.type === 'multi') {
    const opt = q.options.find((o) => o.v === raw);
    let cur = a[q.id] || [];
    if (cur.includes(raw)) cur = cur.filter((x) => x !== raw);
    else if (opt.exclusive) cur = [raw];
    else cur = [...cur.filter((x) => !q.options.find((o) => o.v === x)?.exclusive), raw];
    a[q.id] = cur;
    save();
    paint();
    if (opt.follow && cur.includes(raw)) revealFollow(opt.follow.id);
    return;
  }
  a[id] = q.type === 'scale' ? Number(raw) : raw;
  save();
  paint();
  if (q.type === 'combo') {
    if (answered(q)) autoNext();
    return;
  }
  const opt = q.options?.find((o) => o.v === raw);
  if (opt?.follow) {
    revealFollow(opt.follow.id);
    return;
  }
  autoNext();
}

// ---------------------------------------------------------------------------
// Sending

function device() {
  if (matchMedia('(pointer: coarse)').matches) return Math.min(screen.width, screen.height) >= 700 ? 'tablet' : 'mobile';
  return 'desktop';
}

// Only answers on this respondent's path, trimmed; follow-up text only when
// its option is still picked.
function cleanAnswers() {
  const a = state.answers;
  const out = {};
  for (const q of [...path(false), ...(state.bonus || state.bonusDone ? path(true) : [])]) {
    const ids = q.type === 'combo' ? q.parts.map((p) => p.id) : q.type === 'prices' ? q.fields.map((f) => f.id) : [q.id];
    for (const id of ids) {
      let v = a[id];
      if (typeof v === 'string') v = v.trim().slice(0, 2000);
      if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) out[id] = v;
    }
    for (const o of q.options || []) {
      if (!o.follow) continue;
      const picked = Array.isArray(a[q.id]) ? a[q.id].includes(o.v) : a[q.id] === o.v;
      const v = (a[o.follow.id] || '').trim().slice(0, 500);
      if (picked && v) out[o.follow.id] = v;
    }
  }
  return out;
}

async function send(completed) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/submit_survey`, {
    method: 'POST',
    keepalive: true,
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_id: state.id,
      p_survey: SURVEY_ID,
      p_lang: state.lang,
      p_answers: cleanAnswers(),
      p_step: state.reached,
      p_completed: completed,
      p_source: SOURCE,
      p_device: device(),
    }),
  });
  if (!res.ok) throw new Error(`submit_survey ${res.status}`);
}

// Progress is best effort; the final send is the one that has to land.
function push() {
  inflight = send(false).catch(() => {});
}

async function finish() {
  if (busy) return;
  busy = true;
  paintFoot();
  try {
    await inflight;
    await send(true);
    if (state.bonus) {
      state.bonusDone = true;
    } else {
      state.done = true;
      state.out = Boolean(state.answers.living && state.answers.living !== 'flatmates');
    }
    busy = false;
    save();
    render(1);
  } catch {
    busy = false;
    paintFoot();
    toast(t(UI.sendError), t(UI.retry), finish);
  }
}

// ---------------------------------------------------------------------------
// Views

function icon(name, size = 24, cls = '') {
  const d = ICONS[name];
  const stroke = d.stroke.map((p) => `<path d="${p}"/>`).join('');
  const fill = (d.fill || []).map((p) => `<path d="${p}" fill="currentColor" stroke="none"/>`).join('');
  return `<svg${cls ? ` class="${cls}"` : ''} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${stroke}${fill}</svg>`;
}

const bird = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${BIRD_LEVEL}"/></svg>`;

// The brand formation; CSS hands the front bird to each flatmate colour in turn.
const formation = () =>
  `<svg class="formation" viewBox="0 0 120 120" fill="currentColor" aria-hidden="true">${['back', 'mid', 'front']
    .map((k) => `<path class="f-${k}" d="${FORMATION[k]}"/>`)
    .join('')}</svg>`;

const blobs = '<i class="blob b1"></i><i class="blob b2"></i><i class="blob b3"></i>';
const pill = (name, label, tone) => `<span class="pill caption c-${tone}">${icon(name, 16)}${esc(label)}</span>`;
const enterHint = () => (fine ? `<p class="foot-hint keys footnote">${t(UI.pressEnter)} <span class="kbd">↵</span></p>` : '');
const PEOPLE = ['Me', 'S', 'J', 'A', 'M', 'L'];

function topView() {
  const lang = `<div class="seg" role="group" aria-label="Language">${['en', 'it']
    .map((l) => `<button data-act="lang" data-v="${l}" aria-pressed="${state.lang === l}" lang="${l}">${l.toUpperCase()}</button>`)
    .join('')}</div>`;
  if (onDone() || state.at < 0) return `<span class="wordmark">flock</span>${lang}`;
  const p = path();
  const pos = Math.max(1, p.indexOf(current()) + 1);
  return `<button class="iconbtn" data-act="back" aria-label="${t(UI.back)}">${icon('chev')}</button>
    <div class="progress"><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${p.length}" aria-valuenow="${pos}"><i class="track"></i><i class="fill" style="width:${prevPct}%"></i><span class="rider" style="left:${prevPct}%">${bird(22)}</span></div><span class="count caption tabular">${pos} / ${p.length}</span></div>${lang}`;
}

function welcomeView() {
  return `<div class="welcome">
      <div class="hero st" style="--i:0">${blobs}${formation()}</div>
      <p class="eyebrow st" style="--i:1">${t(UI.eyebrow)}</p>
      <h1 class="display q-title st" style="--i:2" tabindex="-1">${esc(t(UI.welcomeTitle))}</h1>
      <p class="lede callout st" style="--i:3">${esc(t(UI.welcomeBody))}</p>
      <div class="quote callout st" style="--i:4">${icon('chat', 20)}<span>${esc(t(UI.welcomeHonest))}</span></div>
      <div class="pills st" style="--i:5">${pill('clock', t(UI.minutes), 'cleaning')}${pill('check', t(UI.anonymous), 'chat')}${pill('globe', 'EN · IT', 'laundry')}</div>
    </div>
    <div class="foot st" style="--i:6">
      <button class="btn primary" data-act="start">${t(state.reached > 0 ? UI.resume : UI.start)}${icon('arrow', 20, 'go')}</button>
      ${enterHint()}
      <p class="privacy footnote">${esc(t(UI.privacy))}</p>
    </div>`;
}

function isOn(id, v) {
  const cur = state.answers[id];
  return Array.isArray(cur) ? cur.includes(v) : cur === v;
}

function optButton(id, o, i, kind, extra = '', si = i + 3) {
  const on = isOn(id, kind === 'scale' ? Number(o.v) : o.v);
  const fk = `${id}:${o.v}`;
  const cls = `${o.tone ? ` tone-${o.tone}` : ''}${fk === lastPicked ? ' just' : ''}${extra}`;
  const key = i < 9 ? `<span class="key" aria-hidden="true">${i + 1}</span>` : '';
  const attrs = `data-act="pick" data-id="${id}" data-v="${o.v}" data-fk="${fk}" aria-pressed="${on}" style="--i:${si}"`;
  const tick = `<span class="tick">${icon('check')}</span>`;
  const oi = o.icon ? `<span class="oi">${icon(o.icon, kind === 'tile' ? 24 : 22)}</span>` : '';
  if (kind === 'cell' || kind === 'scale') {
    const word = /^[\d+]+$/.test(t(o)) ? '' : ' word';
    return `<button class="opt cell st${word}${cls}" ${attrs}>${key}${esc(t(o))}</button>`;
  }
  if (kind === 'tile') return `<button class="opt tile-opt st${cls}" ${attrs}>${oi}<span class="label">${esc(t(o))}</span>${key}${tick}</button>`;
  return `<button class="opt st${cls}" ${attrs}>${oi || key}<span class="label">${esc(t(o))}</span>${tick}</button>`;
}

function followView(q) {
  return (q.options || [])
    .filter((o) => o.follow && isOn(q.id, o.v))
    .map((o) => `<div class="follow"><label class="footnote" for="f-${o.follow.id}">${esc(t(o.follow))}</label><input class="field" id="f-${o.follow.id}" data-input="${o.follow.id}" maxlength="500" autocomplete="off"></div>`)
    .join('');
}

// "How many of you?": one avatar per flatmate, the new ones pop in.
function peopleView() {
  const v = state.answers.flat_size;
  const n = v ? (v === '6plus' ? 6 : Number(v)) : 1;
  const prev = lastPeople;
  lastPeople = n;
  const avs = PEOPLE.slice(0, n)
    .map((p, k) => `<div class="av${k >= prev ? ' new' : ''}" style="--k:${Math.max(0, k - prev)}"><b class="c${(k % 5) + 1}">${p}</b><span class="caption">${k ? '&nbsp;' : t(UI.you)}</span></div>`)
    .join('');
  const tail = v === '6plus' ? `<div class="av ghost${prev < 7 ? ' new' : ''}" style="--k:1"><b>+</b><span class="caption">&nbsp;</span></div>` : '';
  const empty = v ? '' : `<div class="av ghost"><b>${icon('plus', 18)}</b><span class="caption">&nbsp;</span></div>`;
  if (v === '6plus') lastPeople = 7;
  return `<div class="people st" style="--i:2" aria-hidden="true">${avs}${tail}${empty}</div>`;
}

function answersView(q) {
  const scale = [1, 2, 3, 4, 5].map((n) => ({ v: String(n), en: String(n), it: String(n) }));
  switch (q.type) {
    case 'single':
      if (q.layout === 'row') {
        return `${q.id === 'flat_size' ? peopleView() : ''}<div class="answers row" role="group" aria-labelledby="qt" style="--n:${q.options.length}">${q.options.map((o, i) => optButton(q.id, o, i, 'cell')).join('')}</div>`;
      }
      return `<div class="answers" role="group" aria-labelledby="qt">${q.options.map((o, i) => optButton(q.id, o, i, 'row')).join('')}${followView(q)}</div>`;
    case 'multi':
      return `<div class="answers tiles multi" role="group" aria-labelledby="qt">${q.options.map((o, i) => optButton(q.id, o, i, 'tile')).join('')}</div>${followView(q)}`;
    case 'scale': {
      const sel = state.answers[q.id] || 0;
      return `<div class="answers row scale" role="group" aria-labelledby="qt" style="--n:5">${scale.map((o, i) => optButton(q.id, o, i, 'scale', i + 1 < sel ? ' lit' : '')).join('')}</div>
        <div class="ends footnote st" style="--i:8"><span>1 · ${esc(t(q.low))}</span><span>5 · ${esc(t(q.high))}</span></div>`;
    }
    case 'combo':
      return q.parts
        .map((p, n) => {
          const head = p.title ? `<h2 class="title2 sub-title st" style="--i:6" id="st-${p.id}">${esc(t(p.title))}</h2>` : '';
          const by = p.title ? `st-${p.id}` : 'qt';
          const gap = n ? ';margin-top:16px' : '';
          if (p.layout === 'list') {
            return `${head}<div class="answers" role="group" aria-labelledby="${by}" style="${gap}">${p.options.map((o, i) => optButton(p.id, o, i, 'row', '', i + 4 + n * 3)).join('')}</div>`;
          }
          return `${head}<div class="answers row" role="group" aria-labelledby="${by}" style="--n:${p.options.length}${gap}">${p.options.map((o, i) => optButton(p.id, o, i, 'cell', '', i + 3 + n * 4)).join('')}</div>`;
        })
        .join('');
    case 'text':
      return `<div class="answers st" style="--i:3"><label class="sr" for="f-${q.id}">${esc(t(q.title))}</label><textarea class="field" id="f-${q.id}" data-input="${q.id}" maxlength="2000" placeholder="${esc(t(q.placeholder))}"></textarea></div>`;
    case 'contact':
      return `<div class="answers st" style="--i:3"><label class="sr" for="f-${q.id}">${esc(t(q.title))}</label><input class="field" id="f-${q.id}" data-input="${q.id}" maxlength="200" autocomplete="off" placeholder="${esc(t(q.placeholder))}"></div>`;
    case 'prices':
      return `<div class="answers">${q.fields
        .map((f, i) => `<div class="price-row st" style="--i:${i + 3}"><i class="dot d-${f.tone}"></i><label for="p-${f.id}">${esc(t(f))}</label><div class="money"><span>€</span><input id="p-${f.id}" data-price="${f.id}" inputmode="decimal" autocomplete="off" placeholder="0" aria-describedby="per"></div></div>`)
        .join('')}</div>
        <p class="footnote faint st" style="--i:6;margin:8px 0 0 4px" id="per">${t(UI.perMonth)}</p>
        <div class="ladder st" style="--i:7" aria-hidden="true">${q.fields.map((f) => `<div class="mark" data-mark="${f.id}"><b></b><i class="d-${f.tone}"></i></div>`).join('')}<div class="rail"></div><div class="axis footnote"><span>€0</span><span data-axis></span></div></div>
        <p class="note footnote" data-order hidden>${esc(t(UI.priceOrder))}</p>`;
  }
  return '';
}

function conceptView() {
  return `<div class="concept"><p class="callout st" style="--i:0">${esc(t(CONCEPT.lead))}</p><div class="grid">${CONCEPT.tiles
    .map((c, k) => `<div class="c tone-${c.tone}" style="--k:${k}">${icon(c.icon, 20)}<span>${esc(t(c))}</span></div>`)
    .join('')}</div></div>`;
}

function footInner(q) {
  if (busy) return `<button class="btn primary" disabled aria-busy="true"><span class="spin"></span>${t(UI.sending)}</button>`;
  const ok = valid(q);
  const has = answered(q);
  // The button springs and shines the moment an answer makes it count.
  const pop = has && footWasValid === false ? ' pop' : '';
  footWasValid = has;
  if (q.type === 'contact') return `<button class="btn primary${pop}" data-act="next">${t(UI.send)}${icon('arrow', 20, 'go')}</button>`;
  const p = path();
  let label = has || !ok ? t(UI.next) : t(UI.skip);
  if (state.bonus && p.indexOf(q) === p.length - 1) label = t(UI.finish);
  return `<button class="btn primary${pop}" data-act="next" ${ok ? '' : 'disabled'}>${label}${icon('arrow', 20, 'go')}</button>${q.type === 'text' ? '' : enterHint()}`;
}

function questionView(q) {
  const lead = q.concept ? conceptView() : `<div class="hero-ic">${icon(LOOK[q.id][0], 28)}</div>`;
  return `${lead}
    <div class="q-head">
      <p class="eyebrow st" style="--i:0">${t(PARTS[q.part])}</p>
      <h1 class="title1 q-title st" style="--i:1" id="qt" tabindex="-1">${esc(t(q.title))}</h1>
      ${q.hint ? `<p class="q-hint callout st" style="--i:2">${esc(t(q.hint))}</p>` : ''}
    </div>
    ${answersView(q)}
    <div class="foot" data-foot>${footInner(q)}</div>`;
}

// The one celebration: flatmate-coloured confetti behind the formation.
function doneView() {
  const contact = !state.out && (state.answers.contact || '').trim();
  const burst = Array.from({ length: 16 }, (_, k) => {
    const a = (k / 16) * Math.PI * 2 + 0.2;
    const d = 96 + (k % 3) * 24;
    return `<i class="burst${k % 2 ? ' sq' : ''}" style="--c:var(--p${(k % 5) + 1});--dx:${Math.round(Math.cos(a) * d)}px;--dy:${Math.round(Math.sin(a) * d * 0.8)}px;--r:${k * 45}deg"></i>`;
  }).join('');
  return `<div class="done">
      <div class="hero st" style="--i:0">${blobs}${burst}${formation()}</div>
      <h1 class="display q-title st" style="--i:1" tabindex="-1">${esc(t(state.out ? UI.outTitle : UI.doneTitle))}</h1>
      <p class="lede callout st" style="--i:2">${esc(t(state.out ? UI.outBody : UI.doneBody))}</p>
      ${contact ? `<p class="badge subhead st" style="--i:3">${icon('check')}${esc(t(UI.doneContact))}</p>` : ''}
      ${state.bonusDone ? `<p class="badge subhead st" style="--i:3">${icon('sparkle')}${esc(t(UI.bonusDone))}</p>` : ''}
      ${state.out || state.bonusDone ? '' : `<button class="bonus-card st" style="--i:4" data-act="bonus"><span class="oi">${icon('sparkle', 22)}</span><span class="bc"><b>${esc(t(UI.bonusTitle))}</b><span class="footnote">${esc(t(UI.bonusBody))}</span></span>${icon('arrow', 20, 'go')}</button>`}
    </div>
    <div class="foot st" style="--i:5">
      <button class="btn primary" data-act="wa">${icon('chat', 20)}${t(UI.whatsapp)}</button>
      <button class="btn secondary" data-act="${navigator.share ? 'share' : 'copy'}">${icon(navigator.share ? 'send' : 'note', 20)}${t(navigator.share ? UI.share : UI.copy)}</button>
      <button class="linkbtn footnote" data-act="again">${t(UI.again)}</button>
    </div>`;
}

// ---------------------------------------------------------------------------
// Drawing

function render(dir = 0) {
  const token = ++swapToken;
  const old = app.querySelector('.screen');
  if (dir && old && !reduceMotion) {
    old.classList.add('leave');
    setTimeout(() => token === swapToken && draw(dir, true), 140);
  } else {
    draw(dir, dir !== 0);
  }
}

function draw(dir, moved) {
  document.documentElement.lang = state.lang;
  const q = !onDone() && state.at >= 0 ? current() : null;
  app.className = `app acc-${q ? LOOK[q.id][1] : 'chat'}`;
  if (moved) {
    lastPicked = null;
    lastPeople = 0;
    footWasValid = null;
  }
  const body = onDone() ? doneView() : state.at < 0 ? welcomeView() : questionView(current());
  const cls = `screen${dir ? ' enter' : ''}${dir < 0 ? ' back' : ''}`;
  app.innerHTML = `<header class="top">${topView()}</header><main class="stage"><section class="${cls}">${body}</section></main>`;

  for (const el of app.querySelectorAll('[data-input]')) el.value = state.answers[el.dataset.input] || '';
  for (const el of app.querySelectorAll('[data-price]')) el.value = state.answers[el.dataset.price] ?? '';
  if (app.querySelector('.ladder')) ladder();

  const fill = app.querySelector('.bar .fill');
  if (fill) {
    const rider = app.querySelector('.rider');
    const p = path();
    const pct = (Math.max(1, p.indexOf(current()) + 1) / p.length) * 100;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        fill.style.width = `${pct}%`;
        rider.style.left = `${pct}%`;
      }),
    );
    prevPct = pct;
  } else {
    prevPct = 0;
  }

  if (moved) {
    window.scrollTo(0, 0);
    const field = fine && q && (q.type === 'text' || q.type === 'contact') ? app.querySelector('.field') : null;
    (field || app.querySelector('.q-title'))?.focus({ preventScroll: true });
  }
}

// Redraw the same screen after a change, keeping focus where it was.
function paint() {
  const fk = document.activeElement?.dataset?.fk;
  const shownFollow = [...app.querySelectorAll('.follow [data-input]')].map((x) => x.dataset.input);
  draw(0, false);
  for (const id of shownFollow) app.querySelector(`[data-input="${id}"]`)?.closest('.follow')?.classList.add('still');
  if (fk) app.querySelector(`[data-fk="${CSS.escape(fk)}"]`)?.focus({ preventScroll: true });
}

// A follow-up field can open below the fold, under the sticky button.
function revealFollow(id) {
  const el = app.querySelector(`[data-input="${id}"]`);
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
}

function paintFoot() {
  const foot = app.querySelector('[data-foot]');
  if (foot && current()) foot.innerHTML = footInner(current());
}

function ladder() {
  const q = current();
  const vals = q.fields.map((f) => state.answers[f.id]);
  const top = Math.max(10, Math.ceil((Math.max(0, ...vals.filter((v) => v != null)) * 1.25) / 5) * 5);
  const fmt = new Intl.NumberFormat(state.lang === 'it' ? 'it-IT' : 'en-IE', { maximumFractionDigits: 2 });
  q.fields.forEach((f, i) => {
    const mark = app.querySelector(`[data-mark="${f.id}"]`);
    const v = vals[i];
    mark.style.opacity = v == null ? '0' : '1';
    mark.style.left = `calc(6px + (100% - 12px) * ${v == null ? 0 : v / top})`;
    mark.querySelector('b').textContent = v == null ? '' : `€${fmt.format(v)}`;
  });
  app.querySelector('[data-axis]').textContent = `€${top}`;
  const all = vals.every((v) => v != null);
  app.querySelector('[data-order]').hidden = !all || (vals[0] <= vals[1] && vals[1] <= vals[2]);
}

function toast(msg, action, fn) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `${bird(20)}<span>${esc(msg)}</span>${action ? `<button>${esc(action)}</button>` : ''}`;
  if (action) {
    el.querySelector('button').onclick = () => {
      el.remove();
      fn();
    };
  }
  document.body.append(el);
  setTimeout(() => el.remove(), action ? 8000 : 2400);
}

function shareUrl() {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  u.searchParams.set('s', 'forward');
  return u.toString();
}

// ---------------------------------------------------------------------------
// Events

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  switch (el.dataset.act) {
    case 'lang':
      state.lang = el.dataset.v;
      save();
      paint();
      break;
    case 'start':
      start();
      break;
    case 'bonus':
      startBonus();
      break;
    case 'back':
      if (history.state && history.state.at != null) history.back();
      else back();
      break;
    case 'next':
      next();
      break;
    case 'pick':
      choose(current(), el.dataset.v, el.dataset.id);
      break;
    case 'wa':
      window.open(`https://wa.me/?text=${encodeURIComponent(`${t(UI.shareText)} ${shareUrl()}`)}`, '_blank', 'noopener');
      break;
    case 'share':
      navigator.share({ title: 'Flock', text: t(UI.shareText), url: shareUrl() }).catch(() => {});
      break;
    case 'copy':
      navigator.clipboard
        ?.writeText(shareUrl())
        .then(() => toast(t(UI.copied)))
        .catch(() => toast(shareUrl()));
      break;
    case 'again':
      state = fresh(state.lang);
      save();
      render(-1);
      break;
  }
});

app.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.input) {
    state.answers[el.dataset.input] = el.value;
  } else if (el.dataset.price) {
    const raw = el.value.replace(',', '.').replace(/[^\d.]/g, '');
    const v = parseFloat(raw);
    if (raw === '' || Number.isNaN(v)) delete state.answers[el.dataset.price];
    else state.answers[el.dataset.price] = Math.min(v, 9999);
    ladder();
  } else {
    return;
  }
  save();
  paintFoot();
});

function digitTarget(q, i) {
  if (q.type === 'scale') return i < 5 ? { v: String(i + 1), id: q.id } : null;
  if (q.type === 'combo') {
    const part = q.parts.find((p) => state.answers[p.id] == null) || q.parts[q.parts.length - 1];
    const o = part.options[i];
    return o ? { v: o.v, id: part.id } : null;
  }
  const o = q.options?.[i];
  return o ? { v: o.v, id: q.id } : null;
}

document.addEventListener('keydown', (e) => {
  if (e.altKey || onDone() || busy) return;
  const tag = e.target.tagName;
  if (state.at < 0) {
    if (e.key === 'Enter' && tag !== 'BUTTON') {
      e.preventDefault();
      start();
    }
    return;
  }
  const q = current();
  if (tag === 'TEXTAREA') {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      next();
    }
    return;
  }
  if (tag === 'INPUT') {
    if (e.key === 'Enter') {
      e.preventDefault();
      next();
    }
    return;
  }
  if (e.metaKey || e.ctrlKey) return;
  if (e.key === 'Enter' && tag !== 'BUTTON') {
    e.preventDefault();
    next();
    return;
  }
  const n = Number.parseInt(e.key, 10);
  if (n >= 1 && n <= 9) {
    const target = digitTarget(q, n - 1);
    if (target) {
      e.preventDefault();
      choose(q, target.v, target.id);
    }
  }
});

addEventListener('popstate', () => {
  if (!onDone() && state.at >= 0) back(true);
});

render(1);
