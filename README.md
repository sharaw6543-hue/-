# Хөзөр — найзуудтайгаа онлайнаар тоглох хөзрийн app

Монгол хэлтэй. Android, iOS хоёулаа дээр ажиллана (утсан дээр app шиг суулгадаг веб app / PWA). Эхний тоглоом: **Дурак** (2–5 хүн).

## Компьютер дээр ажиллуулах
```
node server.js
```
Дараа нь http://localhost:3000 нээнэ. Гаднын сан суулгах шаардлагагүй (Node.js 18+).

Тест: `node test/simulate.js` (6000 санамсаргүй тоглоом), `node test/smoke.js` (сервер).

## Найзууд тоглохын тулд интернэтэд тавих
Серверийг Render, Railway, Fly.io зэрэгт тавина (Node app, `node server.js`, PORT-ыг өөрөө авна). HTTPS автоматаар гарна.

## Утсан дээр суулгах
- Android (Chrome): цэс → «Үндсэн дэлгэцэнд нэмэх» / «Суулгах»
- iPhone (Safari): Хуваалцах → «Нүүр дэлгэцэнд нэмэх»

## App Store / Google Play-д оруулах (дараагийн алхам)
Capacitor-оор энэ веб аппыг Android/iOS-ийн жинхэнэ app болгон боож болно. Тэр үед `public/index.html` доторх `fetch`/`EventSource`-ийн хаягийг сервер рүү заадаг болгоно. iOS-д Mac болон Apple Developer данс хэрэгтэй.

## Шинэ тоглоом нэмэх
`games/` хавтсанд `meta`, `create(players)`, `act(state, pid, action)`, `view(state, pid)` экспортлодог файл нэмээд `server.js` доторх `GAMES`-д бүртгэнэ.
