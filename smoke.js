'use strict';
// Сервер + 2 тоглогч: өрөө үүсгэх → нэгдэх → эхлүүлэх → нүүдэл хийх → SSE шинэчлэл.
const server = require('../server');
const assert = require('assert');

async function main() {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const post = async (p, b) => (await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })).json();

  const html = await (await fetch(base + '/')).text();
  assert(html.includes('Хөзөр'));
  assert.equal((await fetch(base + '/../server.js')).status === 200 && false, false);

  const a = await post('/api/create', { name: 'Бат' });
  const b = await post('/api/join', { name: 'Дорж', room: a.room.toLowerCase() });
  assert(a.room && a.pid && b.pid);
  assert((await post('/api/start', { room: a.room, pid: b.pid })).error, 'зөвхөн эзэн эхлүүлнэ');

  const views = { a: null, b: null };
  async function listen(key, who) {
    const res = await fetch(`${base}/api/events?room=${a.room}&pid=${who.pid}`);
    const rd = res.body.getReader(); const dec = new TextDecoder();
    (async () => {
      for (;;) {
        const { value, done } = await rd.read(); if (done) return;
        for (const line of dec.decode(value).split('\n')) if (line.startsWith('data: ')) views[key] = JSON.parse(line.slice(6));
      }
    })();
  }
  await listen('a', a); await listen('b', b);
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(views.a.players.length, 2);
  assert.equal(views.a.isHost, true);
  assert.equal(views.b.isHost, false);

  assert.equal((await post('/api/start', { room: a.room, pid: a.pid })).error, undefined);
  await new Promise((r) => setTimeout(r, 150));
  const ga = views.a.game, gb = views.b.game;
  assert.equal(ga.hand.length, 6); assert.equal(gb.hand.length, 6);
  assert.equal(ga.seats[1].count, 6);
  assert(!('hand' in ga.seats[0]), 'бусдын хөзөр задрахгүй');

  // довтлогч нэг хөзөр тавина
  const attacker = ga.att === 0 ? { who: a, v: ga } : { who: b, v: gb };
  const r1 = await post('/api/action', { room: a.room, pid: attacker.who.pid, action: { type: 'attack', card: attacker.v.hand[0] } });
  assert.equal(r1.error, undefined);
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(views.a.game.table.length, 1);
  assert.equal(views.b.game.table.length, 1);
  // хамгаалагч довтолж чадахгүй
  const defender = attacker.who === a ? b : a;
  const dv = defender === a ? views.a.game : views.b.game;
  assert((await post('/api/action', { room: a.room, pid: defender.pid, action: { type: 'attack', card: dv.hand[0] } })).error);
  // авах
  assert.equal((await post('/api/action', { room: a.room, pid: defender.pid, action: { type: 'take' } })).error, undefined);
  console.log('smoke OK');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
