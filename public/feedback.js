// Time and event feedback is independent of rendering and browser timers.
export function turnStatus(state, now, connected = true) {
  const playing = state?.phase === 'playing';
  const dealing = playing && state.dealUntil > now;
  const active = playing && connected && !state.paused && !dealing;
  const mine = active && state.currentId === state.selfId;
  const current = state?.players.find(p => p.id === state.currentId);
  const seconds = Math.max(0, Math.ceil(((state?.turnEndsAt || now) - Math.max(now, state?.dealUntil || 0)) / 1000));
  const roundSeconds = state?.roundEndsAt ? Math.max(0, Math.ceil((state.roundEndsAt - Math.max(now, state.dealUntil || 0)) / 1000)) : null;
  return { active, mine, dealing, seconds, roundSeconds, urgent: mine && seconds <= 5,
    progress: active ? Math.max(0, Math.min(1, (state.turnEndsAt - now) / (state.settings.turnSeconds * 1000))) : 1,
    title: !connected ? '再接続しています…' : state?.paused ? 'プレイヤーを待っています' : dealing ? 'まもなくスタート！' :
      !playing ? 'ナイスゲーム！' : mine ? 'あなたの番！' : `${current?.name || '相手'} の番`,
    key: state ? `${state.code}:${state.round}:${state.turnNumber || 0}:${state.currentId}` : null };
}

export function eventVoices(events) {
  const calls = [];
  for (const e of events) {
    if (e.type === 'uno') calls.push('uno');
    if (e.type === 'play') {
      const action = { reverse: 'reverse', skip: 'skip', draw2: 'draw-two', wild4: 'draw-four' }[e.card?.value];
      if (action) calls.push(action);
      if (e.card?.color === 'wild' && ['red','yellow','green','blue'].includes(e.color)) calls.push(e.color);
      if (e.announceUno ?? e.uno) calls.push('uno');
    }
    if (e.type === 'draw' && e.timedOut) calls.push('time-up');
  }
  return calls;
}

export class TurnFeedback {
  constructor() { this.reset(); }
  reset() { this.turnKey = null; this.deadline = null; this.roundKey = null; this.lastRoundSeconds = null; this.ticks = new Set(); this.roundCalls = new Set(); }
  update(state, now, { connected = true, visible = true } = {}) {
    const status = turnStatus(state, now, connected);
    const cues = [];
    if (!status.active || !visible) { this.turnKey = null; this.lastRoundSeconds = null; return { ...status, cues }; }
    const roundKey = `${state.code}:${state.round}`;
    if (this.roundKey !== roundKey) { this.roundKey = roundKey; this.roundCalls.clear(); this.lastRoundSeconds = null; }
    if (this.turnKey !== status.key) {
      this.turnKey = status.key;
      if (status.mine) cues.push({ effect: 'turn', voice: 'your-turn', intro: true });
    }
    if (this.deadline !== state.turnEndsAt) { this.deadline = state.turnEndsAt; this.ticks.clear(); }
    if (status.mine && status.seconds > 0) {
      if (status.seconds === 10 && !this.ticks.has(10)) { this.ticks.add(10); cues.push({ effect: 'warning' }); }
      if (status.seconds <= 5 && !this.ticks.has(status.seconds)) {
        this.ticks.add(status.seconds);
        cues.push({ effect: status.seconds <= 2 ? 'tick-fast' : 'tick', voice: status.seconds === 5 ? 'hurry' : null });
      }
    }
    if (status.roundSeconds !== null && this.lastRoundSeconds !== null) {
      for (const threshold of [30, 10]) {
        if (this.lastRoundSeconds > threshold && status.roundSeconds <= threshold && status.roundSeconds > 0 && !this.roundCalls.has(threshold)) {
          this.roundCalls.add(threshold);
          // After returning from a background tab, don't narrate an old milestone.
          if (threshold - status.roundSeconds <= 1) cues.push({ effect: 'round-warning', voice: threshold === 30 ? 'thirty-seconds' : 'ten-seconds' });
        }
      }
      const second = status.roundSeconds;
      if (second > 0 && second <= 5 && this.lastRoundSeconds !== second && !this.roundCalls.has(`tick-${second}`)) {
        this.roundCalls.add(`tick-${second}`);
        if (!cues.some(c => c.effect?.startsWith('tick'))) cues.push({ effect: 'tick-match' });
      }
    }
    this.lastRoundSeconds = status.roundSeconds;
    return { ...status, cues };
  }
}
