import { randomInt, randomUUID } from 'node:crypto';

export const COLORS = ['red', 'yellow', 'green', 'blue'];
export const COLOR_NAMES = { red: '赤', yellow: '黄', green: '緑', blue: '青' };
export const CARD_NAMES = { skip: 'スキップ', reverse: 'リバース', draw2: '+2', wild: 'ワイルド', wild4: '+4' };
export const DEFAULT_SETTINGS = { stackDraw: false, turnSeconds: 30, startingCards: 7 };

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

export function createPlayer(name, avatar = 0, bot = false) {
  return { id: randomUUID(), token: randomUUID() + randomUUID(), name, avatar, bot,
    connected: !bot, lastSeen: Date.now(), hand: [], uno: false, unoArmed: false, score: 0 };
}

export function createRoom(code, host, settings = {}) {
  return { code, hostId: host.id, phase: 'lobby', players: [host], settings: {
    stackDraw: settings.stackDraw === true,
    turnSeconds: [15,30,60].includes(settings.turnSeconds) ? settings.turnSeconds : 30,
    startingCards: 7,
  }, createdAt: Date.now(), updatedAt: Date.now(), round: 0, revision: 0,
    deck: [], discard: [], currentIndex: 0, direction: 1, color: 'red',
    drawnCardId: null, drawStack: 0, drawType: null, pendingUno: null, winnerId: null,
    turnEndsAt: null, paused: false, events: [], rankings: [] };
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

export function startGame(room) {
  if (room.phase === 'playing') throw new Error('すでに対戦中です');
  if (room.players.length < 2) throw new Error('2人以上でスタートできます。CPUも追加できます');
  if (room.players.length > 4) throw new Error('最大4人で遊べます');
  room.deck = deck(); room.discard = [];
  for (const player of room.players) {
    player.hand = take(room, room.settings.startingCards);
    player.uno = false; player.unoArmed = false;
  }
  // A number card opens each round, so there is no ambiguous opening action.
  const topIndex = room.deck.findIndex(c => /^\d$/.test(c.value));
  const [top] = room.deck.splice(topIndex, 1);
  room.discard = [top]; room.color = top.color;
  room.phase = 'playing'; room.direction = 1;
  room.currentIndex = room.round % room.players.length;
  room.round++; room.drawnCardId = null; room.drawStack = 0; room.drawType = null;
  room.pendingUno = null; room.winnerId = null; room.rankings = []; room.paused = false;
  room.turnEndsAt = Date.now() + room.settings.turnSeconds * 1000;
  event(room, 'start', `ラウンド ${room.round} スタート！`);
}

export function canPlay(room, player, card, ignoreDrawn = false) {
  if (room.phase !== 'playing' || currentPlayer(room)?.id !== player.id || !card) return false;
  if (!ignoreDrawn && room.drawnCardId && card.id !== room.drawnCardId) return false;
  if (room.drawStack) return room.settings.stackDraw && card.value === room.drawType;
  const top = room.discard.at(-1);
  if (card.value === 'wild4') return !player.hand.some(c => c.color === room.color);
  return card.color === 'wild' || card.color === room.color || card.value === top?.value;
}

function assertTurn(room, playerId) {
  if (room.phase !== 'playing') throw new Error('現在は対戦中ではありません');
  if (room.paused) throw new Error('対戦相手の再接続を待っています');
  const player = currentPlayer(room);
  if (player?.id !== playerId) throw new Error('あなたの番を待ってね');
  return player;
}

export function cardPoints(card) {
  return card.color === 'wild' ? 50 : /^\d$/.test(card.value) ? Number(card.value) : 20;
}

function finish(room, winner) {
  room.phase = 'finished'; room.winnerId = winner.id; room.turnEndsAt = null;
  room.pendingUno = null;
  const points = room.players.filter(p => p.id !== winner.id)
    .reduce((sum, p) => sum + p.hand.reduce((s, c) => s + cardPoints(c), 0), 0);
  winner.score += points;
  room.rankings = room.players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar,
    cards: p.hand.length, points: p.hand.reduce((s,c) => s + cardPoints(c), 0), score: p.score }))
    .sort((a,b) => (a.id === winner.id ? -1 : b.id === winner.id ? 1 : a.points - b.points));
  event(room, 'win', `${winner.name} の勝利！ +${points}pt`, { actorId: winner.id, points });
}

export function playCard(room, playerId, cardId, chosenColor, declared = false) {
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

  room.pendingUno = null;
  player.hand.splice(index, 1);
  room.discard.push(card); room.color = card.color === 'wild' ? chosenColor : card.color;
  const didUno = declared || player.unoArmed;
  player.unoArmed = false;
  player.uno = player.hand.length === 1 && didUno;
  if (player.hand.length === 1 && !player.uno) room.pendingUno = { playerId: player.id };

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
  event(room, 'play', `${player.name} が ${COLOR_NAMES[room.color]}の${CARD_NAMES[card.value] || card.value} を出した`,
    { actorId: player.id, card, color: room.color, targetId, amount, uno: player.uno });
  if (!player.hand.length) { finish(room, player); return; }
  advance(room, steps);
}

export function drawCard(room, playerId, timedOut = false) {
  const player = assertTurn(room, playerId);
  if (room.drawnCardId) {
    if (timedOut) return passTurn(room, playerId, true);
    throw new Error('引いたカードを出すか、パスしてね');
  }
  room.pendingUno = null;
  const penalty = room.drawStack;
  const cards = give(room, player, penalty || 1);
  room.drawStack = 0; room.drawType = null;
  const playable = !penalty && !timedOut && cards[0] && canPlay(room, player, cards[0], true);
  if (playable) room.drawnCardId = cards[0].id;
  event(room, 'draw', `${player.name} が${cards.length}枚引いた${timedOut ? '（時間切れ）' : ''}`,
    { actorId: player.id, amount: cards.length, timedOut, playable: Boolean(playable) });
  if (!playable) advance(room);
  else room.turnEndsAt = Date.now() + room.settings.turnSeconds * 1000;
}

export function passTurn(room, playerId, timedOut = false) {
  const player = assertTurn(room, playerId);
  if (!room.drawnCardId) throw new Error('出せるカードがなければ山札から引いてね');
  room.pendingUno = null;
  event(room, 'pass', `${player.name} がパスした${timedOut ? '（時間切れ）' : ''}`, { actorId: player.id });
  advance(room);
}

export function callUno(room, playerId) {
  if (room.phase !== 'playing') throw new Error('対戦中に使えます');
  const player = room.players.find(p => p.id === playerId);
  if (!player || player.hand.length > 2 || player.hand.length === 0) throw new Error('手札が2枚になったらUNOを押せます');
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

export function botMove(room) {
  const player = currentPlayer(room);
  if (room.phase !== 'playing' || room.paused || !player?.bot) return;
  const playable = player.hand.filter(c => canPlay(room, player, c));
  playable.sort((a,b) => {
    // Keep flexible wild cards unless they are the only way out.
    const weight = c => cardPoints(c) - (c.color === 'wild' ? 60 : 0)
      + player.hand.filter(h => h.color === c.color).length * 3;
    return weight(b) - weight(a);
  });
  if (playable.length) {
    const card = playable[0];
    playCard(room, player.id, card.id, bestColor(player.hand), true);
  } else if (room.drawnCardId) passTurn(room, player.id);
  else drawCard(room, player.id);
}

export function publicState(room, playerId) {
  const self = room.players.find(p => p.id === playerId);
  return { code: room.code, hostId: room.hostId, phase: room.phase, round: room.round,
    revision: room.revision, settings: room.settings, selfId: playerId,
    players: room.players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, bot: p.bot,
      connected: p.connected, count: p.hand.length, uno: p.uno, score: p.score })),
    hand: self?.hand || [], playableIds: self?.hand.filter(c => canPlay(room, self, c)).map(c => c.id) || [],
    top: room.discard.at(-1) || null, color: room.color, direction: room.direction,
    currentId: currentPlayer(room)?.id, drawnCardId: self?.id === currentPlayer(room)?.id ? room.drawnCardId : null,
    drawStack: room.drawStack, pendingUnoId: room.pendingUno?.playerId || null,
    unoArmed: self?.unoArmed || false, winnerId: room.winnerId, rankings: room.rankings,
    events: room.events, turnEndsAt: room.turnEndsAt, serverNow: Date.now(), paused: room.paused };
}
