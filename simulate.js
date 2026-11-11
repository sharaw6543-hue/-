'use strict';
// Санамсаргүй хууль ёсны нүүдлээр олон тоглоом тоглуулж, гацалт/алдаа шалгана.
const D = require('../games/durak');
let stuck = 0, finished = 0, draws = 0;

function total(g) {
  return g.deck.length + g.table.reduce((n, p) => n + 1 + (p.d ? 1 : 0), 0) +
    g.seats.reduce((n, s) => n + s.hand.length, 0);
}

for (let n = 2; n <= 5; n++) {
  for (let t = 0; t < 1500; t++) {
    const g = D.create(Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i })));
    let steps = 0, discarded = 0;
    while (g.phase === 'play' && steps++ < 3000) {
      const before = g.table.length;
      const def = g.seats[g.def], att = g.seats[g.att];
      let moved = false;
      const und = g.table.map((p, i) => [p, i]).filter(([p]) => !p.d);
      if (und.length) {
        // хамгаалагч: боломжтой бол хаана, үгүй бол авна. Заримдаа нэмж тавина
        if (Math.random() < 0.3) {
          for (const s of g.seats) {
            for (const c of s.hand.slice()) {
              if (!D.act(g, s.id, { type: 'attack', card: c })) { moved = true; break; }
            }
            if (moved) break;
          }
        }
        if (!moved) {
          const [p, idx] = und[0];
          const opts = def.hand.filter((c) => !D.act.length || true);
          let ok = false;
          for (const c of def.hand.slice().sort(() => Math.random() - 0.5)) {
            if (!D.act(g, def.id, { type: 'defend', index: idx, card: c })) { ok = true; break; }
          }
          if (!ok) { const e = D.act(g, def.id, { type: 'take' }); if (e) throw new Error(e); }
        }
      } else if (g.table.length) {
        // бүгд хаагдсан: нэмж тавих эсвэл бито
        let added = false;
        if (Math.random() < 0.5) {
          for (const c of att.hand.slice()) {
            if (!D.act(g, att.id, { type: 'attack', card: c })) { added = true; break; }
          }
        }
        if (!added) { const e = D.act(g, att.id, { type: 'done' }); if (e) throw new Error(e); }
      } else {
        const c = att.hand[Math.floor(Math.random() * att.hand.length)];
        const e = D.act(g, att.id, { type: 'attack', card: c });
        if (e) throw new Error('first attack: ' + e);
      }
      if (g.phase === 'play' && total(g) + discarded !== 36) {
        // discarded картуудыг тоолохгүй тул зөвхөн дээд хязгаар шалгана
        if (total(g) > 36) throw new Error('card count > 36');
      }
      // давхар хөзөр байхгүй эсэх
      const all = [...g.deck, ...g.seats.flatMap((s) => s.hand), ...g.table.flatMap((p) => [p.a, p.d].filter(Boolean))];
      const keys = new Set(all.map((c) => c.r + c.s));
      if (keys.size !== all.length) throw new Error('duplicate card');
    }
    if (g.phase === 'play') stuck++;
    else { finished++; if (!g.loser) draws++; }
    // view нь бусдын хөзрийг задруулахгүй эсэх
    const v = D.view(g, 'p0');
    if (JSON.stringify(v).length > 0 && v.seats.some((s) => s.hand)) throw new Error('hand leaked');
  }
}
console.log({ finished, stuck, draws });
if (stuck) process.exit(1);
