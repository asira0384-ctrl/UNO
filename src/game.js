import { randomInt, randomUUID } from 'node:crypto';

export const COLORS = ['red', 'yellow', 'green', 'blue'];
export const COLOR_NAMES = { red: '赤', yellow: '黄', green: '緑', blue: '青' };
export const CARD_NAMES = { skip: 'スキップ', reverse: 'リバース', draw2: '+2', wild: 'ワイルド', wild4: '+4' };
export const DEFAULT_SETTINGS = { stackDraw: false, turnSeconds: 30, startingCards: 7,
  maxPlayers: 4, roundMinutes: 5, mode: 'solo', sevenSwap: false, zeroSeven: false, forcePlay: false, botDifficulty: 'normal' };

export const BOT_LEVELS = { easy: { delay: 1600, jitter: 800, catchChance: .05 },
  normal: { delay: 1250, jitter: 700, catchChance: .16 }, hard: { delay: 850, jitter: 550, catchChance: .5 } };

export function normalizeSettings(input = {}) {
  const s = input && typeof input === 'object' ? input : {};
  const mode = s.mode === 'teams' ? 'teams' : 'solo';
  return { stackDraw: s.stackDraw === true, turnSeconds: [15,30,60].includes(s.turnSeconds) ? s.turnSeconds : 30,
    startingCards: 7, maxPlayers: mode === 'teams' ? 4 : [2,3,4].includes(s.maxPlayers) ? s.maxPlayers : 4,
    roundMinutes: [0,3,5].includes(s.roundMinutes) ? s.roundMinutes : 5, mode,
    sevenSwap: s.sevenSwap === true, zeroSeven: s.zeroSeven === true, forcePlay: s.forcePlay === true,
    botDifficulty: ['easy','normal','hard'].includes(s.botDifficulty) ? s.botDifficulty : 'normal' };
}

export function deck() {
  const cards = [];
  for (const color of COLORS) {
    cards.push({ id: randomUUID(), color, value: '0' });
    for (const value of ['1','2','3','4','5','6','7','8','9','skip','reverse','draw2']) {
      for (let i = 0; i < 2; i++) cards.push({ id: randomUUID(), color, value });
    }
  }
  for (const value of ['wild', 'wild4']) {
    for (let i = 0; i < 4; i++) cards.push({ id: randomUUID(), color: 'wild', value });
  }
  return shuffle(cards);
}

export function shuffle(cards) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export function createPlayer(name, avatar = 0, bot = false, image = null) {
  return { id: randomUUID(), token: randomUUID() + randomUUID(), name, avatar, image, bot,
    connected: !bot, lastSeen: Date.now(), hand: [], uno: false, unoArmed: false, score: 0 };
}

export function createRoom(code, host, settings = {}) {
  return { code, hostId: host.id, phase: 'lobby', players: [host], settings: normalizeSettings(settings),
    createdAt: Date.now(), updatedAt: Date.now(), round: 0, revision: 0,
    deck: [], discard: [], currentIndex: 0, direction: 1, color: 'red',
    drawnCardId: null, drawStack: 0, drawType: null, pendingUno: null, winnerId: null,
    turnEndsAt: null, roundEndsAt: null, dealUntil: 0, draw: false, winnerTeam: null,
    paused: false, pauseStartedAt: null, events: [], rankings: [] };
}

export function event(room, type, text, details = {}) {
  room.revision++;
  room.updatedAt = Date.now();
  room.events.push({ id: room.revision, type, text, at: Date.now(), ...details });
  if (room.events.length > 24) room.events.shift();
}

export function currentPlayer(room) { return room.players[room.currentIndex]; }
export function nextIndex(room, steps = 1) {
  return ((room.currentIndex + room.direction * steps) % room.players.length + room.players.length) % room.players.length;
}
function advance(room, steps = 1) {
  room.turnNumber = (room.turnNumber || 0) + 1;
  room.currentIndex = nextIndex(room, steps);
  room.drawnCardId = null;
  currentPlayer(room).unoArmed = false;
  room.turnEndsAt = Date.now() + room.settings.turnSeconds * 1000;
}

export function take(room, count) {
  const result = [];
  for (let i = 0; i < count; i++) {
    if (!room.deck.length && room.discard.length > 1) {
      const top = room.discard.pop();
      room.deck = shuffle(room.discard);
      room.discard = [top];
    }
    if (!room.deck.length) break;
    result.push(room.deck.pop());
  }
  return result;
}

function give(room, player, count) {
  const cards = take(room, count);
  player.hand.push(...cards);
  player.uno = false;
  player.unoArmed = false;
  return cards;
}

export function startGame(room, dealDelay = 0) {
  if (room.phase === 'playing') throw new Error('すでに対戦中です');
  if (room.players.length < 2) throw new Error('2人以上でスタートできます。CPUも追加できます');
  if (room.players.length > 4) throw new Error('最大4人で遊べます');
  if (room.settings.mode === 'teams' && room.players.length !== 4) throw new Error('2vs2は4人でスタートします。空席にCPUを追加してね');
  room.deck = deck(); room.discard = [];
  for (const player of room.players) {
    player.hand = []; player.uno = false; player.unoArmed = false;
  }
  // Deal one card per seat per round, from the same unbiased shuffled deck.
  for(let round=0;round<room.settings.startingCards;round++)
    for(const player of room.players)player.hand.push(...take(room,1));
  // A number card opens each round, so there is no ambiguous opening action.
  const topIndex = room.deck.findIndex(c => /^\d$/.test(c.value));
  const [top] = room.deck.splice(topIndex, 1);
  room.discard = [top]; room.color = top.color;
  room.phase = 'playing'; room.direction = 1;
  room.currentIndex = room.round % room.players.length;
  room.round++; room.turnNumber = 1; room.drawnCardId = null; room.drawStack = 0; room.drawType = null;
  room.pendingUno = null; room.winnerId = null; room.winnerTeam = null; room.draw = false; room.rankings = []; room.paused = false;
  room.pauseStartedAt = null; room.dealStartedAt = Date.now(); room.dealUntil = dealDelay ? Date.now() + dealDelay : 0;
  const startsAt = Date.now() + dealDelay;
  room.turnEndsAt = startsAt + room.settings.turnSeconds * 1000;
  room.roundEndsAt = room.settings.roundMinutes ? startsAt + room.settings.roundMinutes * 60000 : null;
  event(room, 'start', `ラウンド ${room.round} スタート！`);
}

export function canPlay(room, player, card, ignoreDrawn = false) {
  if (room.phase !== 'playing' || room.dealUntil > Date.now() || currentPlayer(room)?.id !== player.id || !card) return false;
  if (!ignoreDrawn && room.drawnCardId && card.id !== room.drawnCardId) return false;
  if (room.drawStack) return room.settings.stackDraw && card.value === room.drawType;
  const top = room.discard.at(-1);
  if (card.value === 'wild4') return !player.hand.some(c => c.color === room.color);
  return card.color === 'wild' || card.color === room.color || card.value === top?.value;
}

function assertTurn(room, playerId) {
  if (room.phase !== 'playing') throw new Error('現在は対戦中ではありません');
  if (room.paused) throw new Error('対戦相手の再接続を待っています');
  if (room.dealUntil > Date.now()) throw new Error('カードを配っています。もう少し待ってね');
  const player = currentPlayer(room);
  if (player?.id !== playerId) throw new Error('あなたの番を待ってね');
  return player;
}

export function cardPoints(card) {
  return card.color === 'wild' ? 50 : /^\d$/.test(card.value) ? Number(card.value) : 20;
}

function finish(room, winner, timed = false, tied = false) {
  room.phase = 'finished'; room.winnerId = tied ? null : winner.id; room.turnEndsAt = null;
  room.roundEndsAt = null; room.dealUntil = 0; room.draw = tied;
  room.winnerTeam = !tied && room.settings.mode === 'teams' ? room.players.indexOf(winner) % 2 : null;
  room.pendingUno = null;
  const winning = p => !tied && (room.winnerTeam === null ? p.id === winner.id : room.players.indexOf(p) % 2 === room.winnerTeam);
  const points = tied ? 0 : room.players.filter(p => !winning(p))
    .reduce((sum, p) => sum + p.hand.reduce((s, c) => s + cardPoints(c), 0), 0);
  for (const player of room.players) if (winning(player)) player.score += points;
  room.rankings = room.players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, image: p.image || null,
    cards: p.hand.length, points: p.hand.reduce((s,c) => s + cardPoints(c), 0), score: p.score,
    won: winning(p), team: room.settings.mode === 'teams' ? room.players.indexOf(p) % 2 : null }))
    .sort((a,b) => Number(b.won) - Number(a.won) || a.points - b.points);
  const name = room.winnerTeam === null ? winner.name : `チーム${room.winnerTeam + 1}`;
  event(room, 'win', tied ? '時間切れ。同点で引き分け！' : `${timed ? '時間切れ！ ' : ''}${name} の勝利！ +${points}pt`,
    { actorId: room.winnerId, points, timed, draw: tied, winnerTeam: room.winnerTeam });
}

export function finishOnTime(room) {
  if (room.phase !== 'playing') return;
  const ranked = room.players.map(p => ({ p, points: p.hand.reduce((n,c) => n + cardPoints(c),0) }))
    .sort((a,b) => a.points - b.points || a.p.hand.length - b.p.hand.length);
  if (room.settings.mode === 'teams') {
    const team = [0,0]; for (let i=0;i<room.players.length;i++) team[i%2] += room.players[i].hand.reduce((n,c) => n+cardPoints(c),0);
    finish(room,room.players[team[0] <= team[1] ? 0 : 1],true,team[0] === team[1]);
  } else finish(room,ranked[0].p,true,ranked[0].points === ranked[1].points && ranked[0].p.hand.length === ranked[1].p.hand.length);
}

export function playCard(room, playerId, cardId, chosenColor, declared = false, swapTargetId) {
  const player = assertTurn(room, playerId);
  const index = player.hand.findIndex(c => c.id === cardId);
  if (index === -1) throw new Error('そのカードは手札にありません');
  const card = player.hand[index];
  if (!canPlay(room, player, card)) {
    if (card.value === 'wild4' && player.hand.some(c => c.color === room.color) && !room.drawStack)
      throw new Error('+4は、今の色のカードを持っていない時だけ出せます');
    throw new Error(room.drawnCardId ? '今引いたカードだけ出せます' : '同じ色・数字・記号のカードを出してね');
  }
  if (card.color === 'wild' && !COLORS.includes(chosenColor)) throw new Error('次の色を選んでね');
  const swap = card.value === '7' && (room.settings.sevenSwap || room.settings.zeroSeven) && player.hand.length > 1;
  const swapTarget = swap ? room.players.find(p => p.id === swapTargetId && p.id !== playerId) : null;
  if (swap && !swapTarget) throw new Error('手札を交換する相手を選んでね');

  room.pendingUno = null;
  player.hand.splice(index, 1);
  room.discard.push(card); room.color = card.color === 'wild' ? chosenColor : card.color;
  const wasArmed = player.unoArmed;
  const didUno = declared || wasArmed;
  player.unoArmed = false;
  player.uno = player.hand.length === 1 && didUno;

  let steps = 1;
  let targetId;
  let amount = 0;
  if (card.value === 'reverse') {
    room.direction *= -1;
    if (room.players.length === 2) steps = 2;
  } else if (card.value === 'skip') steps = 2;
  else if (card.value === 'draw2' || card.value === 'wild4') {
    amount = (card.value === 'draw2' ? 2 : 4) + room.drawStack;
    targetId = room.players[nextIndex(room)].id;
    if (room.settings.stackDraw && player.hand.length) {
      room.drawStack = amount; room.drawType = card.value;
    } else {
      give(room, room.players[nextIndex(room)], amount);
      room.drawStack = 0; room.drawType = null;
      steps = 2;
    }
  }
  let exchange;
  if (player.hand.length && swapTarget) {
    [player.hand,swapTarget.hand] = [swapTarget.hand,player.hand];
    swapTarget.uno = swapTarget.hand.length === 1; swapTarget.unoArmed = false;
    exchange = { kind: 'swap', targetId: swapTarget.id, text: `${swapTarget.name} と手札を交換！` };
  } else if (player.hand.length && card.value === '0' && room.settings.zeroSeven) {
    const hands = room.players.map(p => p.hand);
    for (let i=0;i<room.players.length;i++) {
      const to = (i + room.direction + room.players.length) % room.players.length;
      room.players[to].hand = hands[i]; room.players[to].unoArmed = false;
      room.players[to].uno = hands[i].length === 1;
    }
    exchange = { kind: 'rotate', text: '全員の手札が次の人へ移動！' };
  }
  player.uno = player.hand.length === 1 && (exchange ? true : didUno);
  if (player.hand.length === 1 && !player.uno) room.pendingUno = { playerId: player.id };
  event(room, 'play', `${player.name} が ${COLOR_NAMES[room.color]}の${CARD_NAMES[card.value] || card.value} を出した${exchange ? ` · ${exchange.text}` : ''}`,
    { actorId: player.id, card, color: room.color, targetId, amount, uno: player.uno,
      announceUno: player.uno && !wasArmed && !exchange, exchange });
  if (!player.hand.length) { finish(room, player); return; }
  advance(room, steps);
}

export function drawCard(room, playerId, timedOut = false) {
  const player = assertTurn(room, playerId);
  if (room.drawnCardId) {
    if (timedOut) {
      if (room.settings.forcePlay) {
        const c = player.hand.find(c => c.id === room.drawnCardId);
        return playCard(room,playerId,c.id,bestColor(player.hand),false,room.players[nextIndex(room)].id);
      }
      return passTurn(room, playerId, true);
    }
    throw new Error('引いたカードを出すか、パスしてね');
  }
  room.pendingUno = null;
  const penalty = room.drawStack;
  const cards = give(room, player, penalty || 1);
  room.drawStack = 0; room.drawType = null;
  const candidatePlayable = !penalty && cards[0] && canPlay(room, player, cards[0], true);
  const playable = !timedOut && candidatePlayable;
  if (playable) room.drawnCardId = cards[0].id;
  event(room, 'draw', `${player.name} が${cards.length}枚引いた${timedOut ? '（時間切れ）' : ''}`,
    { actorId: player.id, amount: cards.length, timedOut, playable: Boolean(playable) });
  if (timedOut && room.settings.forcePlay && candidatePlayable) {
    room.drawnCardId = cards[0].id;
    return playCard(room,playerId,cards[0].id,bestColor(player.hand),false,room.players[nextIndex(room)].id);
  }
  if (!playable) advance(room);
  else room.turnEndsAt = Date.now() + room.settings.turnSeconds * 1000;
}

export function passTurn(room, playerId, timedOut = false) {
  const player = assertTurn(room, playerId);
  if (!room.drawnCardId) throw new Error('出せるカードがなければ山札から引いてね');
  if (room.settings.forcePlay) throw new Error('強制プレイONです。引いたカードを出してね');
  room.pendingUno = null;
  event(room, 'pass', `${player.name} がパスした${timedOut ? '（時間切れ）' : ''}`, { actorId: player.id });
  advance(room);
}

export function callUno(room, playerId) {
  if (room.phase !== 'playing') throw new Error('対戦中に使えます');
  const player = room.players.find(p => p.id === playerId);
  if (!player || player.hand.length > 2 || player.hand.length === 0) throw new Error('手札が2枚になったらUNOを押せます');
  if (player.uno || player.unoArmed) throw new Error('すでにUNOを宣言しています');
  if (player.hand.length === 2 && currentPlayer(room).id !== player.id) throw new Error('自分の番になったらUNOを押してね');
  if (player.hand.length === 1) {
    player.uno = true;
    if (room.pendingUno?.playerId === player.id) room.pendingUno = null;
  } else player.unoArmed = true;
  event(room, 'uno', `${player.name}「UNO!」`, { actorId: player.id });
}

export function catchUno(room, playerId) {
  if (room.phase !== 'playing' || !room.pendingUno || room.pendingUno.playerId === playerId)
    throw new Error('今は指摘できる相手がいません');
  const target = room.players.find(p => p.id === room.pendingUno.playerId);
  if (!target || target.hand.length !== 1) throw new Error('すでに指摘のタイミングを過ぎています');
  give(room, target, 2); room.pendingUno = null;
  event(room, 'catch', `${target.name} がUNO忘れ！ 2枚ドロー`, { actorId: playerId, targetId: target.id, amount: 2 });
}

export function bestColor(hand) {
  return COLORS.map(color => ({ color, count: hand.filter(c => c.color === color).length }))
    .sort((a,b) => b.count - a.count)[0].color;
}

export function chooseBotPlay(room, player = currentPlayer(room), random = Math.random) {
  const level = room.settings.botDifficulty || 'normal';
  const pick = list => list[Math.min(list.length - 1, Math.floor(random() * list.length))];
  const playable = player.hand.filter(c => canPlay(room, player, c));
  if (!playable.length) return null;
  // Easy sometimes draws voluntarily; it still follows exactly the same rules.
  if (level === 'easy' && !room.drawnCardId && !room.drawStack && random() < .12) return null;
  const selfIndex = room.players.indexOf(player);
  const rivals = room.players.filter((p,i) => p.id !== player.id && (room.settings.mode !== 'teams' || i % 2 !== selfIndex % 2));
  const next = room.players[nextIndex(room)];
  const nextIsRival = rivals.includes(next);
  const weight = c => {
    let value = cardPoints(c) - (c.color === 'wild' ? 60 : 0) + player.hand.filter(h => h.color === c.color).length * 3;
    if (level === 'hard') {
      if (['skip','draw2','wild4'].includes(c.value)) value += nextIsRival ? (next.hand.length <= 2 ? 50 : 12) : -45;
      if (c.value === '7' && (room.settings.zeroSeven || room.settings.sevenSwap)) value += Math.max(0,player.hand.length - 1 - Math.min(...rivals.map(p=>p.hand.length))) * 10;
    }
    return value;
  };
  playable.sort((a,b) => weight(b) - weight(a));
  // Normal deliberately mixes simple choices with its usual color preference.
  const card = level === 'hard' ? playable[0] : random() < (level === 'easy' ? .9 : .6) ? pick(playable) : playable[0];
  const ownColors = COLORS.filter(color => player.hand.some(c=>c.id!==card.id && c.color===color));
  const color = level === 'easy' ? pick(COLORS) : level === 'normal' && ownColors.length && random() < .25 ? pick(ownColors) : bestColor(player.hand.filter(c=>c.id!==card.id));
  const targets = rivals.length ? rivals : room.players.filter(p=>p.id!==player.id);
  const target = level === 'hard' ? [...targets].sort((a,b)=>a.hand.length-b.hand.length)[0] : pick(targets);
  const declared = level === 'hard' || random() >= (level === 'easy' ? .2 : .05);
  return { card, color, targetId: target?.id, declared };
}

export function botMove(room, random = Math.random) {
  const player = currentPlayer(room);
  if (room.phase !== 'playing' || room.paused || !player?.bot) return;
  const move = chooseBotPlay(room, player, random);
  if (move) {
    playCard(room, player.id, move.card.id, move.color, move.declared, move.targetId);
  } else if (room.drawnCardId) passTurn(room, player.id);
  else drawCard(room, player.id);
}

export function publicState(room, playerId) {
  const self = room.players.find(p => p.id === playerId);
  return { code: room.code, hostId: room.hostId, phase: room.phase, round: room.round,
    revision: room.revision, turnNumber: room.turnNumber || 0, settings: room.settings, selfId: playerId,
    players: room.players.map((p,i) => ({ id: p.id, name: p.name, avatar: p.avatar, image: p.image || null, bot: p.bot,
      connected: p.connected, count: p.hand.length, uno: p.uno, score: p.score, team: room.settings.mode === 'teams' ? i % 2 : null })),
    hand: self?.hand || [], playableIds: self?.hand.filter(c => canPlay(room, self, c)).map(c => c.id) || [],
    top: room.discard.at(-1) || null, color: room.color, direction: room.direction,
    currentId: currentPlayer(room)?.id, drawnCardId: self?.id === currentPlayer(room)?.id ? room.drawnCardId : null,
    drawStack: room.drawStack, pendingUnoId: room.pendingUno?.playerId || null,
    unoArmed: self?.unoArmed || false, winnerId: room.winnerId, winnerTeam: room.winnerTeam ?? null, draw: room.draw || false,
    rankings: room.rankings.map(p => ({ ...p, won: p.won ?? p.id === room.winnerId })),
    events: room.events, turnEndsAt: room.turnEndsAt, roundEndsAt: room.roundEndsAt,
    dealUntil: room.dealUntil, dealStartedAt: room.dealStartedAt || 0, serverNow: Date.now(), paused: room.paused };
}
