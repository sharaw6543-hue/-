'use strict';
// Хөзөр — найзуудтайгаа онлайнаар тоглох сервер. Гаднын сан шаардахгүй (зөвхөн Node.js 18+).
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const GAMES = { durak: require('./games/durak') };
const PUBLIC = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const rooms = new Map();

function newCode() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += a[crypto.randomInt(a.length)];
    if (!rooms.has(c)) return c;
  }
}

const cleanName = (n) => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 16);

function roomView(room, pid) {
  const G = GAMES[room.gameType];
  return {
    code: room.code,
    gameType: room.gameType,
    gameName: G.meta.name,
    min: G.meta.min,
    max: G.meta.max,
    isHost: room.hostId === pid,
    players: room.players.map((p) => ({ name: p.name, online: p.streams.size > 0, host: p.id === room.hostId })),
    game: room.game ? G.view(room.game, pid) : null,
  };
}

function broadcast(room) {
  room.touched = Date.now();
  for (const p of room.players) {
    if (!p.streams.size) continue;
    const data = `data: ${JSON.stringify(roomView(room, p.id))}\n\n`;
    for (const res of p.streams) res.write(data);
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => { b += c; if (b.length > 20000) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } });
  });
}

const json = (res, code, obj) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
};

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/events') {
    const room = rooms.get((url.searchParams.get('room') || '').toUpperCase());
    const p = room && room.players.find((x) => x.id === url.searchParams.get('pid'));
    if (!p) return json(res, 404, { error: 'Өрөө олдсонгүй' });
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    res.write('retry: 2000\n\n');
    p.streams.add(res);
    const ka = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => { clearInterval(ka); p.streams.delete(res); broadcast(room); });
    res.write(`data: ${JSON.stringify(roomView(room, p.id))}\n\n`);
    broadcast(room);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/check') {
    const room = rooms.get((url.searchParams.get('room') || '').toUpperCase());
    const ok = room && room.players.some((x) => x.id === url.searchParams.get('pid'));
    return json(res, ok ? 200 : 404, { ok: !!ok });
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'Буруу хүсэлт' });
  const body = await readBody(req);

  if (url.pathname === '/api/create') {
    const name = cleanName(body.name);
    if (!name) return json(res, 400, { error: 'Нэрээ оруулна уу' });
    const gameType = GAMES[body.gameType] ? body.gameType : 'durak';
    const room = { code: newCode(), gameType, players: [], hostId: null, game: null, touched: Date.now() };
    const p = { id: crypto.randomUUID(), name, streams: new Set() };
    room.players.push(p);
    room.hostId = p.id;
    rooms.set(room.code, room);
    return json(res, 200, { room: room.code, pid: p.id });
  }

  const room = rooms.get(String(body.room || '').toUpperCase());
  if (!room) return json(res, 404, { error: 'Ийм кодтой өрөө олдсонгүй' });
  const G = GAMES[room.gameType];

  if (url.pathname === '/api/join') {
    const name = cleanName(body.name);
    if (!name) return json(res, 400, { error: 'Нэрээ оруулна уу' });
    if (room.game && room.game.phase === 'play') return json(res, 400, { error: 'Тоглоом аль хэдийн эхэлсэн байна' });
    if (room.players.length >= G.meta.max) return json(res, 400, { error: 'Өрөө дүүрсэн байна' });
    let n = name, k = 2;
    while (room.players.some((p) => p.name === n)) n = `${name} ${k++}`;
    const p = { id: crypto.randomUUID(), name: n, streams: new Set() };
    room.players.push(p);
    broadcast(room);
    return json(res, 200, { room: room.code, pid: p.id });
  }

  const me = room.players.find((p) => p.id === body.pid);
  if (!me) return json(res, 403, { error: 'Та энэ өрөөнд байхгүй' });

  if (url.pathname === '/api/start') {
    if (room.hostId !== me.id) return json(res, 403, { error: 'Зөвхөн өрөөний эзэн эхлүүлнэ' });
    if (room.game && room.game.phase === 'play') return json(res, 400, { error: 'Тоглоом явагдаж байна' });
    if (room.players.length < G.meta.min) return json(res, 400, { error: `Хамгийн багадаа ${G.meta.min} тоглогч хэрэгтэй` });
    room.game = G.create(room.players.map((p) => ({ id: p.id, name: p.name })));
    broadcast(room);
    return json(res, 200, {});
  }

  if (url.pathname === '/api/action') {
    if (!room.game) return json(res, 400, { error: 'Тоглоом эхлээгүй байна' });
    const err = G.act(room.game, me.id, body.action || {});
    if (err) return json(res, 400, { error: err });
    broadcast(room);
    return json(res, 200, {});
  }

  if (url.pathname === '/api/leave') {
    if (room.game && room.game.phase === 'play') return json(res, 400, { error: 'Тоглоом дундаа гарах боломжгүй' });
    room.players = room.players.filter((p) => p !== me);
    for (const r of me.streams) r.end();
    if (!room.players.length) rooms.delete(room.code);
    else {
      if (room.hostId === me.id) room.hostId = room.players[0].id;
      broadcast(room);
    }
    return json(res, 200, {});
  }

  json(res, 404, { error: 'Олдсонгүй' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    let f = url.pathname === '/' ? '/index.html' : url.pathname;
    const full = path.normalize(path.join(PUBLIC, f));
    if (!full.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(full, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'content-type': MIME[path.extname(full)] || 'application/octet-stream' });
      res.end(data);
    });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: 'Серверийн алдаа' });
  }
});

// 6 цаг идэвхгүй өрөөг цэвэрлэнэ
setInterval(() => {
  const now = Date.now();
  for (const [c, r] of rooms) {
    if (now - r.touched > 6 * 3600 * 1000 && r.players.every((p) => !p.streams.size)) rooms.delete(c);
  }
}, 10 * 60 * 1000).unref();

if (require.main === module) server.listen(PORT, () => console.log(`Хөзөр: http://localhost:${PORT}`));
module.exports = server;
