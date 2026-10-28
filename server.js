import { profileImage } from './src/profile.js';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { randomInt, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoom, createPlayer, startGame, playCard, drawCard, passTurn, callUno,
  catchUno, publicState, currentPlayer, botMove, event, normalizeSettings, finishOnTime, BOT_LEVELS } from './src/game.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REACTIONS = ['👋','😎','😂','😱','🔥','👏'];
const BOT_NAMES = ['MOMO', 'KAI', 'LUNA', 'REO'];
const cleanName = value => [...String(value || '').replace(/[\p{Cc}\p{Cf}<>]/gu, '').trim()].slice(0,16).join('') || 'ゲスト';
const avatarId = value => Number.isInteger(value) && value >= 0 && value < 8 ? value : 0;

export async function createGameServer(options = {}) {
  const dataDir = options.dataDir ?? process.env.DATA_DIR ?? path.join(ROOT, 'data');
  const saveFile = path.join(dataDir, 'rooms.json');
  const rooms = new Map();
  const members = new Map();
  const botTimers = new Map();
  const createLimits = new Map();
  let saveTimer;
  let saving = Promise.resolve();
  let closing = false;

  try {
    const stored = JSON.parse(await fs.readFile(saveFile, 'utf8'));
    for (const room of stored.rooms || []) {
      if (!room.code || Date.now() - room.updatedAt > 24 * 60 * 60 * 1000) continue;
      room.settings = normalizeSettings(room.settings);
      room.paused = room.phase === 'playing';
      room.pauseStartedAt ||= Date.now();
      for (const p of room.players) { p.connected = false; p.lastSeen = Date.now(); }
      rooms.set(room.code, room);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`保存データを読み込めません: ${error.message}`);
  }

  async function flush() {
    clearTimeout(saveTimer); saveTimer = null;
    const contents = JSON.stringify({ schema: 1, savedAt: Date.now(), rooms: [...rooms.values()] });
    saving = saving.catch(() => {}).then(async () => {
      await fs.mkdir(dataDir, { recursive: true, mode: 0o700 });
      await fs.writeFile(saveFile + '.tmp', contents, { mode: 0o600 });
      await fs.rename(saveFile + '.tmp', saveFile);
    });
    return saving;
  }
  function persist() {
    if (saveTimer || closing) return;
    saveTimer = setTimeout(() => flush().catch(e => console.error('[save]', e.message)), 150);
    saveTimer.unref?.();
  }

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((req,res,next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self' ws: wss:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
    next();
  });
  app.get('/health', (req,res) => res.json({ ok: true }));
  app.use(express.static(path.join(ROOT, 'public'), { etag: true, maxAge: 0 }));
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    maxHttpBufferSize: 48 * 1024, pingInterval: 20000, pingTimeout: 25000,
    allowRequest(req, callback) {
      const origin = req.headers.origin;
      if (!origin) return callback(null, true);
      try {
        const originHost = new URL(origin).host;
        const allowed = [req.headers.host, req.headers['x-forwarded-host']?.split(',')[0]?.trim(), process.env.PUBLIC_HOST];
        callback(null, allowed.includes(originHost));
      } catch { callback(null, false); }
    }
  });

  function publish(room) {
    for (const p of room.players) {
      const socketId = members.get(p.id);
      if (socketId) io.to(socketId).emit('state', publicState(room, p.id));
    }
    persist(); scheduleBot(room);
  }
  function scheduleBot(room) {
    const p = currentPlayer(room);
    const key = `${p?.id}:${room.drawnCardId || ''}:${room.discard.at(-1)?.id || ''}`;
    const existing = botTimers.get(room.code);
    if (room.phase !== 'playing' || room.paused || room.dealUntil > Date.now() || !p?.bot) {
      clearTimeout(existing?.timer); botTimers.delete(room.code); return;
    }
    if (existing?.key === key) return;
    clearTimeout(existing?.timer);
    const timer = setTimeout(() => {
      botTimers.delete(room.code);
      if (rooms.get(room.code) !== room || room.phase !== 'playing' || room.paused || currentPlayer(room)?.id !== p.id || !p.bot) return;
      try {
        if (room.pendingUno && room.pendingUno.playerId !== p.id && Math.random() < (BOT_LEVELS[room.settings.botDifficulty] || BOT_LEVELS.normal).catchChance) catchUno(room, p.id);
        botMove(room); publish(room);
      } catch (e) { console.error('[cpu]', e.message); }
    }, options.botDelay ?? (()=>{const l=BOT_LEVELS[room.settings.botDifficulty]||BOT_LEVELS.normal;return l.delay+randomInt(l.jitter);})());
    timer.unref?.(); botTimers.set(room.code, { key, timer });
  }
  function setPaused(room) {
    const hasOnlineHuman = room.players.some(p => !p.bot && p.connected);
    if (room.phase === 'playing' && !hasOnlineHuman && !room.paused) {
      room.paused = true; room.pauseStartedAt = Date.now();
    }
  }
  function detach(socket, explicit = false) {
    const room = rooms.get(socket.data.code);
    const p = room?.players.find(p => p.id === socket.data.playerId);
    if (!room || !p || members.get(p.id) !== socket.id) { socket.data.code = null; socket.data.playerId = null; return; }
    members.delete(p.id); socket.leave(room.code);
    p.connected = false; p.lastSeen = Date.now();
    if (explicit && room.phase !== 'playing') room.players = room.players.filter(x => x.id !== p.id);
    else if (explicit) { p.bot = true; p.reserved = true; }
    socket.data.code = null; socket.data.playerId = null;
    if (!room.players.some(x => !x.bot || x.reserved) || (explicit && !room.players.some(x => !x.bot && x.connected))) {
      clearTimeout(botTimers.get(room.code)?.timer); botTimers.delete(room.code); rooms.delete(room.code); persist(); return;
    }
    if (room.hostId === p.id) room.hostId = room.players.find(x => !x.bot && x.connected)?.id || room.players.find(x => !x.bot)?.id || room.hostId;
    setPaused(room);
    event(room, explicit ? 'leave' : 'offline', explicit ? `${p.name} が退出した` : `${p.name} が再接続中`, { actorId: p.id });
    publish(room);
  }
  function bind(socket, room, p) {
    const previousId = members.get(p.id);
    if (previousId && previousId !== socket.id) {
      const old = io.sockets.sockets.get(previousId);
      if (old) { old.emit('session:replaced'); old.leave(room.code); old.data.code = null; old.data.playerId = null; }
    }
    socket.data.code = room.code; socket.data.playerId = p.id;
    socket.join(room.code); members.set(p.id, socket.id);
    p.connected = true; p.lastSeen = Date.now();
    if (p.reserved) { p.bot = false; p.reserved = false; }
    if (room.paused) {
      const pausedFor = Math.max(0,Date.now() - (room.pauseStartedAt || Date.now()));
      if (room.roundEndsAt) room.roundEndsAt += pausedFor;
      if (room.dealUntil) {room.dealUntil += pausedFor;if(room.dealStartedAt)room.dealStartedAt += pausedFor;}
      room.paused = false; room.pauseStartedAt = null;
      room.turnEndsAt = Math.max(Date.now(),room.dealUntil || 0) + room.settings.turnSeconds * 1000;
    }
    if (!room.players.some(x => x.id === room.hostId && !x.bot && x.connected)) room.hostId = p.id;
  }
  function auth(socket) {
    const room = rooms.get(socket.data.code);
    const player = room?.players.find(p => p.id === socket.data.playerId);
    if (!room || !player || members.get(player.id) !== socket.id) throw new Error('ルームに入り直してね');
    return { room, player };
  }
  function requireHost(room, player) {
    if (room.hostId !== player.id) throw new Error('ホストだけが操作できます');
  }
  function addBot(room) {
    if (room.players.length >= room.settings.maxPlayers) throw new Error('ルームは満員です');
    const index = room.players.filter(p => p.bot).length;
    let name = BOT_NAMES[index];
    if (room.players.some(p => p.name === name)) name = `CPU ${index + 1}`;
    room.players.push(createPlayer(name, (index + 1) % 8, true));
    event(room, 'join', `${name}（CPU）が参加した`);
  }

  io.on('connection', socket => {
    let rateStart = Date.now(), rateCount = 0, lastReaction = 0;
    function on(name, handler) {
      socket.on(name, (payload, callback) => {
        if (typeof payload === 'function') { callback = payload; payload = {}; }
        const ack = typeof callback === 'function' ? callback : () => {};
        try {
          if (Date.now() - rateStart > 1000) { rateStart = Date.now(); rateCount = 0; }
          if (++rateCount > 18) throw new Error('少し待ってから操作してね');
          if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('操作をやり直してね');
          const value = handler(payload);
          ack({ ok: true, ...value });
        } catch (e) { ack({ ok: false, error: e.message || '操作に失敗しました' }); }
      });
    }
    on('room:create', payload => {
      if (socket.data.code) throw new Error('現在のルームを退出してから作成してね');
      const ip = socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim() || socket.handshake.address;
      const limit = createLimits.get(ip) || { at: Date.now(), count: 0 };
      if (Date.now() - limit.at > 60000) { limit.at = Date.now(); limit.count = 0; }
      if (++limit.count > 10) throw new Error('ルームの作成が多すぎます。1分ほど待ってね');
      createLimits.set(ip, limit);
      if (rooms.size >= 500) throw new Error('ただいま混み合っています。少し待ってね');
      let code;
      do { code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(''); } while (rooms.has(code));
      const p = createPlayer(cleanName(payload.name), avatarId(payload.avatar), false, profileImage(payload.image));
      const room = createRoom(code, p, payload.settings);
      rooms.set(code, room); bind(socket, room, p);
      const cpu = Math.max(0, Math.min(room.settings.maxPlayers-1, Math.floor(Number(payload.cpu) || 0)));
      for (let i = 0; i < cpu; i++) addBot(room);
      event(room, 'join', `${p.name} のルームへようこそ`);
      if (payload.quick === true) {
        while (room.players.length < room.settings.maxPlayers) addBot(room);
        startGame(room,options.dealDelay ?? 3600);
      }
      publish(room);
      return { code, playerId: p.id, token: p.token };
    });
    on('room:join', payload => {
      if (socket.data.code) throw new Error('現在のルームを退出してから参加してね');
      const code = String(payload.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const room = rooms.get(code);
      if (!room) throw new Error('ルームが見つかりません。コードを確認してね');
      if (room.phase !== 'lobby') throw new Error('このルームは対戦中です。次のゲームまで待ってね');
      if (room.players.length >= room.settings.maxPlayers) throw new Error('ルームは満員です');
      const p = createPlayer(cleanName(payload.name), avatarId(payload.avatar), false, profileImage(payload.image));
      room.players.push(p); bind(socket, room, p);
      event(room, 'join', `${p.name} が参加した`, { actorId: p.id }); publish(room);
      return { code, playerId: p.id, token: p.token };
    });
    on('room:resume', payload => {
      if (socket.data.code) throw new Error('すでにルームに接続しています');
      const room = rooms.get(String(payload.code || ''));
      const token = typeof payload.token === 'string' && /^[0-9a-f-]{72}$/.test(payload.token) ? payload.token : '';
      const p = room?.players.find(p => p.token.length === token.length && timingSafeEqual(Buffer.from(p.token), Buffer.from(token)));
      if (!room || !p) throw new Error('前のルームは終了しました');
      bind(socket, room, p); event(room, 'online', `${p.name} が戻った`, { actorId: p.id }); publish(room);
      return { code: room.code, playerId: p.id, token: p.token };
    });
    on('player:profile', payload => {
      const {room,player} = auth(socket);
      const image=profileImage(payload.image);
      player.name=cleanName(payload.name);player.avatar=avatarId(payload.avatar);player.image=image;
      event(room,'profile','プレイヤーのアイコンが変更されました',{actorId:player.id});publish(room);
    });
    on('room:leave', () => { detach(socket, true); return {}; });
    on('room:add-bot', () => {
      const {room,player} = auth(socket); requireHost(room,player);
      if (room.phase !== 'lobby') throw new Error('待機ルームで追加してね');
      addBot(room); publish(room);
    });
    on('room:remove', payload => {
      const {room,player} = auth(socket); requireHost(room,player);
      if (room.phase !== 'lobby') throw new Error('対戦中は退出させられません');
      const target = room.players.find(p => p.id === payload.playerId && p.id !== player.id);
      if (!target) throw new Error('プレイヤーが見つかりません');
      const targetSocket = io.sockets.sockets.get(members.get(target.id));
      if (targetSocket) { targetSocket.emit('room:removed'); targetSocket.leave(room.code); targetSocket.data.code = null; targetSocket.data.playerId = null; }
      members.delete(target.id); room.players = room.players.filter(p => p.id !== target.id);
      event(room, 'leave', `${target.name} が退出した`); publish(room);
    });
    on('room:settings', payload => {
      const {room,player} = auth(socket); requireHost(room,player);
      if (room.phase !== 'lobby') throw new Error('待機ルームで設定してね');
      const nextSettings = normalizeSettings({...room.settings,...payload});
      if (nextSettings.maxPlayers < room.players.length) throw new Error('参加中の人数より少なくできません。先にCPUやプレイヤーを外してね');
      room.settings = nextSettings;
      event(room, 'settings', 'ルールが変更されました'); publish(room);
    });
    on('game:start', () => {
      const {room,player} = auth(socket); requireHost(room,player); startGame(room,options.dealDelay ?? 3600); publish(room);
    });
    on('room:lobby', () => {
      const {room,player} = auth(socket); requireHost(room,player);
      if (room.phase === 'playing') throw new Error('ゲームが終わったら戻れます');
      room.phase = 'lobby'; room.players.forEach(p => { p.hand = []; p.uno = false; p.unoArmed = false; });
      room.deck = []; room.discard = []; room.drawnCardId = null; room.pendingUno = null;
      event(room, 'lobby', '次のゲームの準備をしよう'); publish(room);
    });
    for (const [name,action] of Object.entries({
      'game:play': (r,p,d) => playCard(r,p.id,d.cardId,d.color,d.uno === true,d.targetId),
      'game:draw': (r,p) => drawCard(r,p.id),
      'game:pass': (r,p) => passTurn(r,p.id),
      'game:uno': (r,p) => callUno(r,p.id),
      'game:catch': (r,p) => catchUno(r,p.id),
    })) on(name, payload => { const {room,player} = auth(socket); action(room,player,payload); publish(room); });

    on('reaction', payload => {
      const {room,player} = auth(socket);
      if (!REACTIONS.includes(payload.emoji)) throw new Error('使えないリアクションです');
      if (Date.now() - lastReaction < 1800) throw new Error('少し待ってね');
      lastReaction = Date.now();
      io.to(room.code).emit('reaction', { playerId: player.id, name: player.name, emoji: payload.emoji });
    });
    socket.on('disconnect', () => detach(socket));
  });

  const tick = setInterval(() => {
    for (const [code,room] of rooms) {
      if (Date.now() - room.updatedAt > 24 * 60 * 60 * 1000) {
        clearTimeout(botTimers.get(code)?.timer); botTimers.delete(code); rooms.delete(code); persist(); continue;
      }
      if (room.phase !== 'playing' || room.paused) continue;
      if (room.dealUntil) {
        if (Date.now() < room.dealUntil) continue;
        room.dealUntil = 0; event(room,'ready','配札完了！ ゲームスタート'); publish(room);
      }
      if (room.roundEndsAt && Date.now() >= room.roundEndsAt) { finishOnTime(room); publish(room); continue; }
      let changed = false;
      for (const p of room.players) {
        if (!p.bot && !p.connected && Date.now() - p.lastSeen > 30000) {
          p.bot = true; p.reserved = true; changed = true;
          event(room, 'cpu', `${p.name} の操作をCPUが代行します`, { actorId: p.id });
          if (room.hostId === p.id) room.hostId = room.players.find(x => !x.bot && x.connected)?.id || room.hostId;
        }
      }
      if (room.turnEndsAt && Date.now() >= room.turnEndsAt && !currentPlayer(room).bot) {
        try { drawCard(room,currentPlayer(room).id,true); changed = true; } catch (e) { console.error('[turn]',e.message); }
      }
      if (changed) publish(room); else scheduleBot(room);
    }
    for (const [ip,limit] of createLimits) if (Date.now() - limit.at > 120000) createLimits.delete(ip);
  }, 250);
  tick.unref?.();

  return { app, httpServer, io, rooms,
    async listen(port = process.env.PORT || 3000, host = '0.0.0.0') {
      await new Promise((resolve,reject) => { httpServer.once('error',reject); httpServer.listen(port,host,resolve); });
      return httpServer.address();
    },
    async close() {
      closing = true; clearInterval(tick); clearTimeout(saveTimer);
      for (const value of botTimers.values()) clearTimeout(value.timer);
      await new Promise(resolve => io.close(resolve));
      await flush();
    }
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await createGameServer();
  const portFlag = process.argv.indexOf('--port');
  const devPort = portFlag >= 0 ? Number(process.argv[portFlag + 1]) : undefined;
  const address = await server.listen(process.env.PORT || devPort || 3000);
  console.log(`UNO PARTY is listening on port ${address.port}`);
  let stopping = false;
  for (const signal of ['SIGTERM','SIGINT']) process.on(signal, async () => {
    if (stopping) return; stopping = true;
    try { await server.close(); process.exit(0); } catch (e) { console.error(e.message); process.exit(1); }
  });
}
