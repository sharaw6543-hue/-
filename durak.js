'use strict';
// Дурак (подкидной) — 36 хөзөр, 2–5 тоглогч.
const SUITS = ['s', 'h', 'd', 'c'];
const RANKS = [6, 7, 8, 9, 10, 11, 12, 13, 14];
const SYM = { s: '♠', h: '♥', d: '♦', c: '♣' };
const RL = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const txt = (c) => (RL[c.r] || c.r) + SYM[c.s];

const meta = { id: 'durak', name: 'Дурак', min: 2, max: 5 };

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function nextActive(g, i) {
  const n = g.seats.length;
  for (let k = 1; k <= n; k++) {
    const j = (i + k) % n;
    if (!g.seats[j].out) return j;
  }
  return i;
}

function create(players) {
  const deck = shuffle(SUITS.flatMap((s) => RANKS.map((r) => ({ r, s }))));
  const g = {
    phase: 'play',
    seats: players.map((p) => ({ id: p.id, name: p.name, hand: [], out: false })),
    deck,
    table: [],
    log: '',
    loser: null,
  };
  g.trumpCard = deck[deck.length - 1]; // доод талд үлдэнэ, хамгийн сүүлд авна
  g.trump = g.trumpCard.s;
  for (let i = 0; i < 6; i++) for (const s of g.seats) s.hand.push(g.deck.shift());
  let best = 0, bv = 99;
  g.seats.forEach((s, i) => s.hand.forEach((c) => {
    if (c.s === g.trump && c.r < bv) { bv = c.r; best = i; }
  }));
  g.att = best;
  g.def = nextActive(g, best);
  g.limit = Math.min(6, g.seats[g.def].hand.length);
  g.log = `${g.seats[g.att].name} эхэлнэ`;
  return g;
}

const beats = (g, a, d) => (d.s === a.s ? d.r > a.r : d.s === g.trump && a.s !== g.trump);
const allDefended = (g) => g.table.length > 0 && g.table.every((p) => p.d);

function endRound(g, took) {
  const n = g.seats.length;
  const d = g.seats[g.def];
  if (took) for (const p of g.table) { d.hand.push(p.a); if (p.d) d.hand.push(p.d); }
  g.table = [];
  const order = [];
  for (let k = 0; k < n; k++) {
    const j = (g.att + k) % n;
    if (!g.seats[j].out && j !== g.def) order.push(j);
  }
  order.push(g.def);
  for (const j of order) {
    const h = g.seats[j].hand;
    while (h.length < 6 && g.deck.length) h.push(g.deck.shift());
  }
  if (!g.deck.length) for (const s of g.seats) if (!s.out && !s.hand.length) s.out = true;
  const alive = g.seats.filter((s) => !s.out);
  if (alive.length <= 1) {
    g.phase = 'over';
    g.loser = alive[0] ? alive[0].name : null;
    g.log = g.loser ? `${g.loser} дурак боллоо` : 'Тэнцлээ';
    return;
  }
  const na = took ? nextActive(g, g.def) : (g.seats[g.def].out ? nextActive(g, g.def) : g.def);
  g.att = na;
  g.def = nextActive(g, na);
  g.limit = Math.min(6, g.seats[g.def].hand.length);
}

// Алдаа байвал мессеж (string) буцаана, амжилттай бол null.
function act(g, pid, a) {
  if (g.phase !== 'play') return 'Тоглоом дууссан';
  const i = g.seats.findIndex((s) => s.id === pid);
  if (i < 0) return 'Та энэ тоглоомд оролцоогүй';
  const s = g.seats[i];
  if (s.out) return 'Та тоглоомоос гарсан';
  const find = (c) => (c ? s.hand.findIndex((x) => x.r === c.r && x.s === c.s) : -1);

  if (a.type === 'attack') {
    if (i === g.def) return 'Хамгаалагч довтолж болохгүй';
    if (!g.table.length && i !== g.att) return 'Эхний хөзрийг довтлогч тавина';
    const k = find(a.card);
    if (k < 0) return 'Ийм хөзөр танд байхгүй';
    const c = s.hand[k];
    if (g.table.length && !g.table.some((p) => p.a.r === c.r || (p.d && p.d.r === c.r))) {
      return 'Ширээн дээрх хөзөртэй тоо нь таарах ёстой';
    }
    if (g.table.length >= g.limit) return 'Дахиж хөзөр тавих боломжгүй';
    if (g.table.filter((p) => !p.d).length >= g.seats[g.def].hand.length) return 'Хамгаалагчид хөзөр хүрэлцэхгүй';
    s.hand.splice(k, 1);
    g.table.push({ a: c, d: null });
    g.log = `${s.name}: ${txt(c)}`;
    return null;
  }

  if (a.type === 'defend') {
    if (i !== g.def) return 'Та хамгаалагч биш';
    const pair = g.table[a.index];
    if (!pair || pair.d) return 'Энэ хөзрийг хаах шаардлагагүй';
    const k = find(a.card);
    if (k < 0) return 'Ийм хөзөр танд байхгүй';
    if (!beats(g, pair.a, s.hand[k])) return 'Энэ хөзөр хүрэхгүй байна';
    pair.d = s.hand.splice(k, 1)[0];
    g.log = `${s.name}: ${txt(pair.d)}`;
    if (allDefended(g) && (s.hand.length === 0 || g.table.length >= g.limit)) endRound(g, false);
    return null;
  }

  if (a.type === 'take') {
    if (i !== g.def) return 'Та хамгаалагч биш';
    if (!g.table.length) return 'Ширээн дээр хөзөр алга';
    if (allDefended(g)) return 'Бүгдийг нь хаасан байна';
    g.log = `${s.name} хөзөр авлаа`;
    const msg = g.log;
    endRound(g, true);
    if (g.phase === 'play') g.log = msg;
    return null;
  }

  if (a.type === 'done') {
    if (i !== g.att) return 'Бито гэхийг довтлогч л хийнэ';
    if (!allDefended(g)) return 'Бүх хөзөр хаагдаагүй байна';
    g.log = `Бито`;
    endRound(g, false);
    if (g.phase === 'play') g.log = 'Бито';
    return null;
  }

  return 'Мэдэгдэхгүй үйлдэл';
}

const order = (g) => (c) => (c.s === g.trump ? 100 : 0) + SUITS.indexOf(c.s) * 20 + c.r;

function view(g, pid) {
  const i = g.seats.findIndex((s) => s.id === pid);
  const hand = i >= 0 ? g.seats[i].hand.slice().sort((x, y) => order(g)(x) - order(g)(y)) : [];
  return {
    type: 'durak',
    phase: g.phase,
    me: i,
    att: g.att,
    def: g.def,
    trump: g.trump,
    trumpCard: g.deck.length ? g.trumpCard : null,
    deckCount: g.deck.length,
    table: g.table,
    seats: g.seats.map((s) => ({ name: s.name, count: s.hand.length, out: s.out })),
    hand,
    loser: g.loser,
    log: g.log,
    limit: g.limit,
  };
}

module.exports = { meta, create, act, view };
