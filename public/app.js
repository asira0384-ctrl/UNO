import { PartyAudio } from './audio.js';

const $ = (query,root=document) => root.querySelector(query);
const app=$('#app'), modalRoot=$('#modal-root'), fxRoot=$('#fx-root');
const sound=new PartyAudio();
const AVATARS=['😼','👻','🤖','🦊','🐼','👽','🐲','🐸'];
const AVATAR_COLORS=['#f9d1b4','#dbd1f5','#c9dbe7','#ffdbb0','#e8dfd1','#cde3ba','#cce3dd','#d8e4a8'];
const COLORS=['red','yellow','green','blue'];
const COLOR_NAMES={red:'赤',yellow:'黄',green:'緑',blue:'青'};
const SWATCHES={red:'#e83250',yellow:'#f1bc35',green:'#2da47c',blue:'#328bd5'};
const SHAPES={red:'●',yellow:'◆',green:'▲',blue:'■'};
const SYMBOLS={skip:'⊘',reverse:'⇄',draw2:'+2',wild:'✦',wild4:'+4'};
const CARD_NAMES={skip:'スキップ',reverse:'リバース',draw2:'ドロー2',wild:'ワイルド',wild4:'ワイルド4'};
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function read(key,fallback) { try { return JSON.parse(localStorage.getItem(key))??fallback; } catch { return fallback; } }
function write(key,value) { try { localStorage.setItem(key,JSON.stringify(value)); } catch {} }
let profile=read('uno-profile',{name:'',avatar:0});
if(!Number.isInteger(profile.avatar)||profile.avatar<0||profile.avatar>7)profile.avatar=0;
let session=read('uno-session',null);
const invitedCode=new URLSearchParams(location.search).get('room')?.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6)||'';
let state=null,mode=invitedCode?'join':'create',busy=false,connected=false,dialogType=null,wildCardId=null;
let sortCards=read('uno-sort',false),reactionOpen=false,toastTimer,serverOffset=0,lastTurnSound=null;
let joinValue=invitedCode,resuming=false;

const paths={
  sound:'M11 5 6 9H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  mute:'M11 5 6 9H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6',
  arrow:'M5 12h14m-6-6 6 6-6 6',
  back:'m14 6-6 6 6 6',
  users:'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m14-13a4 4 0 0 1 0 8m6 5v-2a4 4 0 0 0-3-3M13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  cpu:'M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3M6 6h12v12H6V6Zm3 3h6v6H9V9Z',
  copy:'M9 9h11v11H9V9ZM5 15H3V3h12v2',
  share:'M12 16V3m-4 4 4-4 4 4M6 12H4v9h16v-9h-2',
  sparkle:'m12 2 2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5L12 2Zm7 16 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2',
  sort:'M4 6h16M4 12h11M4 18h6m7-2 3 3 3-3m-3-7v10',
  log:'M8 6h12M8 12h12M8 18h9M3 6h.01M3 12h.01M3 18h.01',
  clock:'M12 7v5l3 2M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0',
  rotate:'M20 11a8 8 0 1 0-2 6M20 4v7h-7',
  hand:'M8 12V6a2 2 0 0 1 4 0v6m0-6a2 2 0 0 1 4 0v6m0-4a2 2 0 0 1 4 0v6c0 5-2 8-7 8-3 0-5-2-7-5l-3-5a2 2 0 0 1 3-2l2 2',
  fullscreen:'M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6',
  link:'m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 2 1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',
  check:'m5 12 4 4L19 6',
};
function icon(name,cls='') { return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.sparkle}"/></svg>`; }
function avatar(player,cls='') { const a=player?.avatar??0;return `<span class="avatar ${cls}" style="--avatar-bg:${AVATAR_COLORS[a]||AVATAR_COLORS[0]}" aria-hidden="true">${AVATARS[a]||AVATARS[0]}</span>`; }
function cardHTML(card,cls='') {
  if(!card)return '';
  const back=card.back,value=back?'UNO!':(SYMBOLS[card.value]||card.value);
  const corner=card.value==='wild'?'✦':value;
  return `<span class="card ${back?'card-back':`${esc(card.color)} ${esc(card.value)}`} ${cls}"><span class="card-face"><span class="card-oval"></span><span class="card-corner top">${esc(corner)}</span><span class="card-value ${SYMBOLS[card.value]?'symbol':''}">${esc(value)}</span><span class="card-corner bottom">${esc(corner)}</span></span></span>`;
}
function heroArt() { return `<div class="hero-art" aria-hidden="true">${cardHTML({color:'red',value:'7'})}${cardHTML({color:'blue',value:'reverse'})}${cardHTML({color:'yellow',value:'2'})}${cardHTML({color:'wild',value:'wild4'})}<span class="art-spark one">✦</span><span class="art-spark two">✦</span></div>`; }
function toast(message,error=false) {
  const el=$('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('visible'),3500);
  if(error)sound.effect('error');
}
function updateConnection() {
  const el=$('#connection');el.className=`connection ${connected?'online':'offline'}`;
  $('span',el).textContent=connected?'オンライン':'接続中…';
  $('#sound-button').innerHTML=icon(sound.settings.music||sound.settings.effects?'sound':'mute');
}
function homeHTML() {
  return `<div class="home-grid"><section class="hero"><span class="eyebrow">${icon('sparkle')} GOOD CARDS. GREAT TIMES.</span><h1>その一枚で、<br><span>盛り上がれ。</span></h1><p class="hero-description">同じ色か、同じ数字。<br>あとは、友達と楽しむだけ。</p>${heroArt()}<div class="hero-features"><div class="hero-feature"><strong>2–4人</strong><small>友達と対戦</small></div><div class="hero-feature"><strong>どこでも</strong><small>スマホ・PC</small></div><div class="hero-feature"><strong>すぐ遊べる</strong><small>登録いらず</small></div></div></section>
  <section class="play-panel" aria-label="ゲームを始める"><div class="panel-heading"><h2>さあ、遊ぼう。</h2><span class="tiny-badge"><i></i> LET'S PLAY</span></div>
  ${resuming?'<div class="connect-notice">前のルームに戻っています…</div>':''}
  <label class="field-label" for="player-name">プレイヤー名</label><div class="profile-field"><span class="profile-current" style="background:${AVATAR_COLORS[profile.avatar]}">${AVATARS[profile.avatar]}</span><input class="text-input" id="player-name" autocomplete="nickname" maxlength="16" placeholder="名前を入力" value="${esc(profile.name)}" aria-label="プレイヤー名"></div><div class="avatar-picker" role="group" aria-label="アバターを選択">${AVATARS.map((a,i)=>`<button class="avatar-option ${profile.avatar===i?'selected':''}" data-action="avatar" data-avatar="${i}" aria-label="アバター ${i+1}" aria-pressed="${profile.avatar===i}">${a}</button>`).join('')}</div>
  <div class="segmented" role="tablist" aria-label="遊び方を選択"><button role="tab" aria-selected="${mode==='create'}" class="${mode==='create'?'active':''}" data-action="mode-create">ルームをつくる</button><button role="tab" aria-selected="${mode==='join'}" class="${mode==='join'?'active':''}" data-action="mode-join">参加する</button></div>
  ${mode==='create'?`<div class="mode-info"><span class="mode-icon">${icon('users')}</span><div><strong>いつもの友達と、もう一勝負。</strong><p>ルームコードを送るだけで集合。<br>足りない人数はCPUでも遊べるよ。</p></div></div><button class="primary-button" data-action="create" ${!connected||resuming?'disabled':''}>${icon('users')}<span class="button-label">ルームをつくる</span>${icon('arrow')}</button>`:`<form data-form="join"><label class="field-label" for="join-code">6文字のルームコード</label><input id="join-code" class="text-input join-code-input" inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="6" placeholder="ABC123" value="${esc(joinValue)}" aria-label="ルームコード"><button class="primary-button" type="submit" ${!connected||resuming?'disabled':''}>${icon('link')}<span class="button-label">ルームに参加する</span>${icon('arrow')}</button></form>`}
  <div class="divider">ひとりでも、楽しめる。</div><button class="secondary-button" data-action="quick" ${!connected||resuming?'disabled':''}>${icon('cpu')} CPUと練習する</button><p class="panel-note">ダウンロード不要 · お金はかかりません</p></section></div>
  <footer class="home-footer"><span>UNO風オンラインカードゲーム</span><span class="dot">●</span><button data-action="help">遊び方</button><span class="dot">●</span><button data-action="audio">BGM & サウンド</button></footer>`;
}
function waitingHTML() {
  const isHost=state.hostId===state.selfId;
  const seats=Array.from({length:4},(_,i)=>{
    const p=state.players[i];
    if(p)return `<div class="seat">${avatar(p)}<div class="seat-info"><strong>${esc(p.name)} ${p.id===state.selfId?'<span class="you-badge">YOU</span>':''}</strong><small>${p.bot?'コンピューター':p.connected?'準備OK':'再接続を待っています'}</small></div>${p.id===state.hostId?'<span class="host-badge">HOST</span>':p.bot?'<span class="cpu-badge">CPU</span>':''}${isHost&&p.id!==state.selfId?`<button class="remove-seat" data-action="remove" data-player="${p.id}" aria-label="${esc(p.name)}をルームから外す">×</button>`:''}</div>`;
    return `<div class="seat empty"><span class="avatar empty-avatar">+</span><span class="empty-name">友達を待っています…</span>${isHost?'<button class="add-cpu" data-action="add-bot">CPUを追加</button>':''}</div>`;
  }).join('');
  return `<div class="waiting-layout"><section class="waiting-intro"><span class="eyebrow">${icon('users')} YOUR PRIVATE TABLE</span><h1>みんな揃ったら、<br><span>パーティー開始。</span></h1><p class="hero-description">コードか招待リンクを友達に送ってね。</p><div class="room-ticket"><small>ROOM CODE</small><div class="room-code">${state.code}<button class="icon-button" data-action="copy-code" aria-label="ルームコードをコピー">${icon('copy')}</button></div><button class="secondary-button invite-button" data-action="invite">${icon('share')} 友達を招待する</button></div><p class="room-tip">${icon('sparkle')} スマホでもPCでも、同じルームで対戦。<br>2人から始められるよ。空いている席にはCPUも。</p><button class="waiting-quit" data-action="leave">${icon('back')} ホームに戻る</button></section><section class="waiting-panel"><div class="waiting-title"><h2>待機ルーム</h2><span class="player-total">${state.players.length} / 4</span></div><div class="seat-list">${seats}</div><div class="waiting-rules"><div class="rule-setting"><label>重ねがけ<small>同じ +2 同士・+4 同士を重ねられる</small></label><button class="switch ${state.settings.stackDraw?'on':''}" role="switch" aria-checked="${state.settings.stackDraw}" aria-label="重ねがけ" data-action="stack" ${!isHost?'disabled':''}></button></div><div class="rule-setting"><label for="turn-seconds">1ターンの時間</label><select id="turn-seconds" ${!isHost?'disabled':''}>${[15,30,60].map(n=>`<option value="${n}" ${n===state.settings.turnSeconds?'selected':''}>${n}秒</option>`).join('')}</select></div></div>${isHost?`<button class="primary-button" data-action="start" ${state.players.length<2?'disabled':''}>ゲームスタート ${icon('arrow')}</button>`:'<button class="primary-button" disabled>ホストの開始を待っています…</button>'}<p class="waiting-bottom-note">${state.players.length<2?'友達を呼ぶか、CPUを追加してね':'全員に7枚ずつ配ってスタート'}</p><button class="quiet-button" data-action="leave">ルームを退出する</button></section></div>`;
}
function opponentHTML(p) {
  const active=p.id===state.currentId&&state.phase==='playing';
  const visible=Math.min(p.count,7);
  return `<div class="opponent ${active?'active':''}" data-player-id="${p.id}"><div class="avatar-wrap">${avatar(p)}${active?'<span class="turn-counter" data-turn-counter></span>':''}</div><div class="opponent-name">${esc(p.name)}${p.bot?'<span class="cpu-badge">CPU</span>':''}</div>${!p.bot&&!p.connected?'<span class="offline-label">再接続中</span>':''}<div class="mini-hand" aria-label="手札${p.count}枚">${Array.from({length:visible},(_,i)=>`<span style="--angle:${(i-(visible-1)/2)*5}deg;--rise:${Math.abs(i-(visible-1)/2)*1.5}px">${cardHTML({back:true},'mini-card')}</span>`).join('')}<span class="opponent-count">${p.count}</span></div>${p.uno?'<span class="uno-bubble">UNO!</span>':''}</div>`;
}
function gameHTML() {
  const me=state.players.find(p=>p.id===state.selfId),current=state.players.find(p=>p.id===state.currentId);
  const mine=state.currentId===state.selfId&&state.phase==='playing'&&!state.paused;
  const playable=new Set(state.playableIds);
  const hand=[...state.hand];
  if(sortCards)hand.sort((a,b)=>(COLORS.indexOf(a.color)<0?4:COLORS.indexOf(a.color))-(COLORS.indexOf(b.color)<0?4:COLORS.indexOf(b.color))||String(a.value).localeCompare(String(b.value),undefined,{numeric:true}));
  const hint=state.phase==='finished'?'ナイスゲーム！':!connected?'再接続しています…':state.paused?'対戦相手を待っています…':mine?(state.drawStack?`${state.drawStack}枚引くか、同じドローカードを重ねてね`:state.drawnCardId?'引いたカードを出すか、パスしよう':state.playableIds.length?'光っているカードをタップして出そう':'出せるカードがないよ。山札をタップ'):`${current?.name||''} の番です`;
  return `<section class="game-screen"><div class="game-topbar"><div class="game-room-info"><button class="room-back" data-action="leave">${icon('back')} ルーム</button><span class="game-tag">ROUND ${state.round}</span><span class="game-tag">${state.settings.stackDraw?'重ねがけ ON':'クラシック'}</span></div><div class="game-info-actions"><button class="small-text-button code-button" data-action="copy-code">${icon('copy')}${state.code}</button><button class="small-text-button" data-action="log">${icon('log')}履歴</button><button class="small-text-button" data-action="fullscreen" aria-label="全画面">${icon('fullscreen')}</button></div></div>
  <div class="table"><span class="table-watermark" aria-hidden="true">UNO! PARTY</span><div class="opponents">${state.players.filter(p=>p.id!==state.selfId).map(opponentHTML).join('')}</div><div class="direction-orbit ${state.direction===-1?'reverse':''}" aria-hidden="true"><svg viewBox="0 0 345 255" fill="none"><path d="M295 82C268 14 76 14 47 82M47 173c29 68 221 68 248 0" stroke="currentColor" stroke-width="2" stroke-dasharray="4 8"/><path d="m280 74 16 9 2-19M63 181l-17-8-1 19" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
  <div class="turn-label ${mine?'mine':''}"><span class="turn-dot"></span>${state.phase==='finished'?'GAME FINISHED':mine?'あなたの番！':`${esc(current?.name)} の番`}${mine?' · <span data-turn-counter></span>秒':''}</div><div class="table-center"><button class="draw-deck" data-action="draw" ${!mine||!!state.drawnCardId||!connected?'disabled':''} aria-label="${state.drawStack?`${state.drawStack}枚引く`:'山札から1枚引く'}">${cardHTML({back:true})}${mine&&!state.drawnCardId?`<span class="deck-hint">${state.drawStack||'+'}</span>`:''}<span class="deck-label">${mine&&!state.drawnCardId?'タップして引く':'山札'}</span></button><div class="discard-slot" aria-label="場のカード ${COLOR_NAMES[state.color]} ${esc(CARD_NAMES[state.top?.value]||state.top?.value)}">${cardHTML(state.top)}</div></div>
  ${state.drawStack?`<span class="stack-warning">ドローが溜まってる！ +${state.drawStack}</span>`:''}${state.pendingUnoId&&state.pendingUnoId!==state.selfId?'<button class="catch-button" data-action="catch">UNO忘れ！<br>指摘する +2</button>':''}
  <div class="latest-event">${esc(state.events.at(-1)?.text||'')}</div><div class="table-bottom"><span class="color-indicator"><i class="color-dot" style="--swatch:${SWATCHES[state.color]}"></i>今の色：${COLOR_NAMES[state.color]} ${SHAPES[state.color]}</span><span class="direction-label">${icon('rotate')} ${state.direction===1?'時計回り':'反時計回り'}</span></div>${state.paused?'<div class="paused-cover"><strong>ちょっと、ひと休み。</strong><span>プレイヤーが戻ったら再開します</span></div>':''}</div>
  <div class="my-zone"><div class="hand-toolbar"><span class="my-identity">${avatar(me)}<span class="name">${esc(me?.name)}</span><span class="you-badge">YOU</span><span class="my-count">手札 ${hand.length}枚</span></span><span class="hand-hint ${mine?'active':''}">${icon('hand')}${esc(hint)}</span><div class="hand-right-actions"><button class="sort-button" data-action="sort" aria-label="手札の色順並び替え" aria-pressed="${sortCards}" title="色順に並び替え">${icon('sort')}</button><button class="emoji-button" data-action="emojis" aria-label="リアクション">☺</button></div></div><div class="hand-layout"><div class="hand-scroll"><div class="hand-rack">${hand.map((c,i)=>`<button class="hand-card ${playable.has(c.id)&&mine?'playable':'unplayable'} ${state.drawnCardId===c.id?'drawn':''}" style="--i:${i+1}" data-action="play" data-card="${c.id}" aria-label="${COLOR_NAMES[c.color]||''}${CARD_NAMES[c.value]||c.value} ${playable.has(c.id)&&mine?'出せます':'今は出せません'}" aria-disabled="${!playable.has(c.id)||!mine}">${cardHTML(c)}</button>`).join('')}</div></div><div class="uno-controls"><button class="uno-button ${state.unoArmed||me?.uno?'armed':''} ${hand.length===2&&mine&&!state.unoArmed?'ready':''}" data-action="uno" ${!connected||state.phase!=='playing'||hand.length>2||hand.length===0||(hand.length===2&&!mine)?'disabled':''} aria-label="UNOを宣言" aria-pressed="${state.unoArmed||me?.uno||false}">UNO!</button><small>${state.unoArmed||me?.uno?'宣言済み！':'残り1枚の前に！'}</small>${mine&&state.drawnCardId?'<button class="pass-button" data-action="pass">パスする</button>':''}</div></div>${reactionOpen?`<div class="reaction-tray">${['👋','😎','😂','😱','🔥','👏'].map(e=>`<button data-action="reaction" data-emoji="${e}" aria-label="${e}を送る">${e}</button>`).join('')}</div>`:''}<div class="game-footer-hint">${hand.length>7?'手札は左右にスワイプできます':'SAME COLOR. SAME NUMBER. ONE MORE ROUND.'}</div></div></section>`;
}
function render() {
  app.innerHTML=state?(state.phase==='lobby'?waitingHTML():gameHTML()):homeHTML();
  document.body.classList.toggle('in-game',!!state&&state.phase!=='lobby');
  updateConnection();updateClock();
}

function dialogHTML(type) {
  if(type==='audio')return `<div class="dialog-head"><h2>気分に合わせて、サウンド。</h2><button class="dialog-close" data-action="close" aria-label="閉じる">×</button></div><p class="dialog-description">音ありでも、音なしでも。自分のペースで。</p><div class="sound-row"><span>BGM<small>軽快なパーティービート</small></span><button class="switch ${sound.settings.music?'on':''}" role="switch" aria-checked="${sound.settings.music}" data-action="music" aria-label="BGMを切り替え"></button></div><div class="volume-row"><input type="range" min="0" max="100" value="${sound.settings.musicVolume}" data-volume="musicVolume" aria-label="BGM音量"><span data-volume-label="musicVolume">${sound.settings.musicVolume}%</span></div><div class="sound-row"><span>効果音<small>カード・UNO・勝利のサウンド</small></span><button class="switch ${sound.settings.effects?'on':''}" role="switch" aria-checked="${sound.settings.effects}" data-action="effects" aria-label="効果音を切り替え"></button></div><div class="volume-row"><input type="range" min="0" max="100" value="${sound.settings.effectsVolume}" data-volume="effectsVolume" aria-label="効果音の音量"><span data-volume-label="effectsVolume">${sound.settings.effectsVolume}%</span></div><div class="audio-footnote">音量設定はこの端末に保存されます。<br>音が聞こえない時は、端末の音量も確認してね。</div>`;
  if(type==='help')return `<div class="dialog-head"><h2>遊び方は、シンプル。</h2><button class="dialog-close" data-action="close" aria-label="閉じる">×</button></div><div class="rule-list">${[['色か数字を合わせて出そう','場のカードと同じ色・数字・記号のカードをタップ。手札を先に全部なくした人の勝ち！'],['出せない？ 山札をタップ','1枚引いて、出せるカードならそのまま出せるよ。出さない時は「パスする」。'],['残り1枚になる前に「UNO!」','手札が2枚になったら、自分の番にUNOボタンを押してから出そう。忘れたところを指摘されると2枚追加！'],['アクションカードで逆転','⊘ は次の人をスキップ。⇄ は順番を反転。+2 は次の人が2枚引いてお休み。ワイルドは色を選べるよ。']].map((r,i)=>`<div class="rule-item"><span class="rule-num">0${i+1}</span><div><strong>${r[0]}</strong><p>${r[1]}</p></div></div>`).join('')}</div><div class="special-rules"><strong>このゲームのルール</strong><br>・+4は、今の色のカードがない時に使えるよ。チャレンジはなし。<br>・2人対戦のリバースはスキップと同じ。<br>・重ねがけONでは、同じ+2同士・+4同士だけ重ねられるよ。<br>・UNO忘れの指摘は、次の人が出すか引くまで。<br>・時間切れは1枚引いてパス。ドローが溜まっていればその枚数を引くよ。<br>・通信切断が30秒続くとCPUが代行。戻ると自分で操作できるよ。</div><button class="primary-button" style="margin-top:21px" data-action="close">わかった！ ${icon('check')}</button>`;
  if(type==='wild')return `<div class="dialog-head"><h2>次は、何色？</h2><button class="dialog-close" data-action="close" aria-label="キャンセル">×</button></div><p class="dialog-description">自分に有利な色を選ぼう。</p><div class="color-choices">${COLORS.map(c=>`<button class="color-choice ${c}" style="--swatch:${SWATCHES[c]}" data-action="color" data-color="${c}"><span class="color-shape">${SHAPES[c]}</span>${COLOR_NAMES[c]}</button>`).join('')}</div>`;
  if(type==='leave')return `<div class="dialog-head"><h2>ルームを退出する？</h2><button class="dialog-close" data-action="close" aria-label="キャンセル">×</button></div><p class="dialog-description">${state?.phase==='playing'?'対戦が続く場合は、あなたの代わりにCPUがプレイします。':'また遊ぶ時は、新しいルームを作るか参加してね。'}</p><div class="dialog-buttons"><button class="primary-button" data-action="confirm-leave">退出する</button><button class="secondary-button" data-action="close">もう少し遊ぶ</button></div>`;
  if(type==='log')return `<div class="dialog-head"><h2>ゲームの履歴</h2><button class="dialog-close" data-action="close" aria-label="閉じる">×</button></div><div class="event-log">${[...(state?.events||[])].reverse().map(e=>`<div class="log-entry"><span class="log-time">${new Date(e.at).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}</span><span>${esc(e.text)}</span></div>`).join('')}</div>`;
  if(type==='result') {
    const winner=state.players.find(p=>p.id===state.winnerId),won=state.winnerId===state.selfId,isHost=state.hostId===state.selfId;
    const points=state.events.findLast(e=>e.type==='win')?.points||0;
    return `<span class="result-trophy" aria-hidden="true">🏆</span><div class="result-eyebrow">ROUND ${state.round} COMPLETE</div>${avatar(winner,'result-avatar')}<h2 class="result-title">${won?'YOU WIN!':'NICE GAME!'}</h2><p class="result-name">${esc(winner?.name)} の勝利！ おめでとう！</p><div class="result-ranking">${state.rankings.map((p,i)=>`<div class="rank-row"><span class="rank-position">${i+1}</span><span class="rank-avatar">${AVATARS[p.avatar]}</span><span class="rank-name">${esc(p.name)}</span><span class="rank-score">${i===0?`+${points} pt`:`残り ${p.points} pt`}</span></div>`).join('')}</div>${isHost?`<div class="dialog-buttons"><button class="primary-button" data-action="rematch">もう一度あそぶ ${icon('rotate')}</button><button class="secondary-button" data-action="back-lobby">待機ルームに戻る</button></div>`:'<p class="waiting-host">ホストが次のゲームを準備しています…</p>'}<button class="quiet-button" data-action="leave">ルームを退出する</button><p class="result-foot">${esc(winner?.name)} の累計スコア：${winner?.score||0} pt</p>`;
  }
  return '';
}
function openDialog(type) {
  closeDialog(false);dialogType=type;
  const d=document.createElement('dialog');d.className=type==='result'?'result-dialog':'';d.innerHTML=dialogHTML(type);d.setAttribute('aria-label',({audio:'サウンド設定',help:'遊び方',wild:'色を選ぶ',leave:'退出の確認',log:'ゲームの履歴',result:'対戦結果'})[type]);
  modalRoot.append(d);d.addEventListener('cancel',()=>{dialogType=null;wildCardId=null;});
  d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
  d.showModal();
}
function closeDialog(resetWild=true) { $('dialog',modalRoot)?.close();modalRoot.innerHTML='';dialogType=null;if(resetWild)wildCardId=null; }
function updateClock() {
  if(!state?.turnEndsAt)return;
  const seconds=Math.max(0,Math.ceil((state.turnEndsAt-(Date.now()+serverOffset))/1000));
  for(const el of document.querySelectorAll('[data-turn-counter]'))el.textContent=seconds;
}
setInterval(updateClock,250);

const socket=window.io({autoConnect:false,reconnection:true,reconnectionDelay:600,reconnectionDelayMax:3000,timeout:10000});
async function send(name,payload={}) {
  if(!socket.connected)throw new Error('接続を確認しています。少し待ってね');
  const result=await new Promise((resolve,reject)=>socket.timeout(8000).emit(name,payload,(err,result)=>err?reject(new Error('応答がありません。接続を確認してね')):resolve(result)));
  if(!result?.ok)throw new Error(result?.error||'操作に失敗しました');
  return result;
}
function saveSession(value) { session={code:value.code,token:value.token,playerId:value.playerId};write('uno-session',session); }
function forgetSession() { session=null;try{localStorage.removeItem('uno-session');}catch{} }
async function perform(fn) {
  if(busy)return;
  busy=true;document.body.style.cursor='progress';
  try{await fn();}catch(e){toast(e.message,true);}finally{busy=false;document.body.style.cursor='';}
}
function updateRoomURL(code) {
  const url=new URL(location.href);if(code)url.searchParams.set('room',code);else url.searchParams.delete('room');
  history.replaceState({},'',url.pathname+url.search+url.hash);
}
socket.on('connect',async()=>{
  connected=true;updateConnection();
  if(session&&(!invitedCode||invitedCode===session.code||state)) {
    resuming=true;render();
    try{saveSession(await send('room:resume',{code:session.code,token:session.token}));}
    catch(e){forgetSession();state=null;toast(e.message);}
    finally{resuming=false;render();}
  }else render();
});
socket.on('disconnect',()=>{connected=false;updateConnection();if(state)render();});
socket.on('connect_error',()=>{connected=false;updateConnection();});
socket.on('session:replaced',()=>{forgetSession();state=null;closeDialog();render();toast('別のタブでゲームを開きました');});
socket.on('room:removed',()=>{forgetSession();state=null;closeDialog();updateRoomURL(null);render();toast('ホストがルームから退出させました');});
socket.on('state',next=>{
  const before=state;
  const events=before?.code===next.code?next.events.filter(e=>e.id>before.revision):[];
  const play=events.findLast(e=>e.type==='play');
  let from;
  if(play) {
    const el=play.actorId===next.selfId?$(`[data-card="${play.card.id}"]`):$(`[data-player-id="${play.actorId}"] .avatar-wrap`);
    if(el)from=el.getBoundingClientRect();
  }
  state=next;serverOffset=next.serverNow-Date.now();
  updateRoomURL(next.code);
  if(before?.phase!==next.phase) { closeDialog();reactionOpen=false; }
  if(dialogType==='wild'&&(next.currentId!==next.selfId||!next.playableIds.includes(wildCardId)))closeDialog();
  render();
  if(play&&from)animateCard(play.card,from);
  const latest=events.at(-1);
  if(latest) {
    if(latest.type==='win') { sound.effect('win');if(!reducedMotion)confetti(); }
    else if(events.some(e=>e.type==='start'))sound.effect('start');
    else if(latest.type==='uno'||play?.uno) { sound.effect('uno');burst('UNO!'); }
    else if(play) { const value=play.card.value;sound.effect(value==='reverse'?'reverse':value==='skip'?'skip':value==='wild'||value==='wild4'?'wild':'play');if(['reverse','skip','draw2','wild4'].includes(value))burst(({reverse:'REVERSE!',skip:'SKIP!',draw2:'+2',wild4:'+4'})[value]); }
    else if(latest.type==='draw'||latest.type==='catch')sound.effect('draw');
  }
  if(before&&next.phase==='playing'&&next.currentId===next.selfId&&before.currentId!==next.selfId) {
    const key=`${next.revision}:${next.currentId}`;if(lastTurnSound!==key){lastTurnSound=key;setTimeout(()=>sound.effect('turn'),280);}
  }
  if(next.phase==='finished'&&dialogType!=='result')openDialog('result');
});
socket.on('reaction',data=>{
  const el=data.playerId===state?.selfId?$('.my-identity'):$(`[data-player-id="${data.playerId}"]`);
  const rect=el?.getBoundingClientRect();const node=document.createElement('span');node.className='reaction-float';node.textContent=data.emoji;
  node.style.left=`${rect?rect.left+rect.width/2-20:innerWidth/2}px`;node.style.top=`${rect?rect.top:innerHeight/2}px`;fxRoot.append(node);setTimeout(()=>node.remove(),2300);
});

function burst(text) {
  if(reducedMotion)return;
  const n=document.createElement('span');n.className='action-burst';n.textContent=text;fxRoot.append(n);setTimeout(()=>n.remove(),1250);
}
function animateCard(card,from) {
  if(reducedMotion)return;
  const to=$('.discard-slot')?.getBoundingClientRect();if(!to)return;
  const node=document.createElement('div');node.className='flying-card';node.innerHTML=cardHTML(card);
  node.style.transform=`translate(${from.left}px,${from.top}px) rotate(-14deg) scale(.8)`;fxRoot.append(node);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{node.style.transform=`translate(${to.left}px,${to.top}px) rotate(8deg) scale(1)`;}));setTimeout(()=>node.remove(),420);
}
function confetti() {
  for(let i=0;i<55;i++) {
    const n=document.createElement('i');n.className='confetti';
    n.style.cssText=`--confetti:${['#ffd873','#f47794','#73d4bb','#8dbff1','#fff6dd'][i%5]};--left:${Math.random()*100}%;--drift:${(Math.random()-.5)*250}px;--duration:${2+Math.random()*2}s;--delay:${Math.random()*.6}s`;
    fxRoot.append(n);setTimeout(()=>n.remove(),4700);
  }
}
async function copyText(value,message) {
  try {
    if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);
    else { const t=document.createElement('textarea');t.value=value;t.style.cssText='position:fixed;opacity:0;pointer-events:none';document.body.append(t);t.select();if(!document.execCommand('copy'))throw new Error('copy');t.remove(); }
    toast(message);
  }catch{toast(`コピーできませんでした：${value}`);}
}
async function create(quick=false) {
  const result=await send('room:create',{name:profile.name,avatar:profile.avatar,quick});saveSession(result);sound.effect('start');
}
async function join() {
  if(joinValue.length!==6)throw new Error('6文字のルームコードを入力してね');
  saveSession(await send('room:join',{name:profile.name,avatar:profile.avatar,code:joinValue}));sound.effect('start');
}
async function play(cardId,color) {
  if(!state||state.phase!=='playing')return;
  if(state.currentId!==state.selfId)throw new Error('あなたの番を待ってね');
  if(!state.playableIds.includes(cardId)) {
    const card=state.hand.find(c=>c.id===cardId);
    if(card?.value==='wild4'&&!state.drawStack)throw new Error('+4は、今の色のカードがない時だけ使えるよ');
    throw new Error(state.drawnCardId?'今引いたカードを出すか、パスしてね':'同じ色・数字・記号のカードを選んでね');
  }
  const c=state.hand.find(c=>c.id===cardId);
  if(c?.color==='wild'&&!color) { wildCardId=cardId;openDialog('wild');return; }
  await send('game:play',{cardId,color,uno:state.unoArmed});
}

document.addEventListener('pointerdown',()=>sound.unlock(),{passive:true});
document.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')sound.unlock();});
document.addEventListener('visibilitychange',()=>sound.visibility(!document.hidden));
document.addEventListener('input',e=>{
  if(e.target.id==='player-name') {profile.name=e.target.value;write('uno-profile',profile);}
  if(e.target.id==='join-code') {joinValue=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);e.target.value=joinValue;}
  if(e.target.dataset.volume) {const key=e.target.dataset.volume;sound.set(key,Number(e.target.value));$(`[data-volume-label="${key}"]`).textContent=e.target.value+'%';}
});
document.addEventListener('change',e=>{
  if(e.target.id==='turn-seconds')perform(()=>send('room:settings',{...state.settings,turnSeconds:Number(e.target.value)}));
});
document.addEventListener('submit',e=>{if(e.target.dataset.form==='join'){e.preventDefault();perform(join);}});
document.addEventListener('click',e=>{
  const button=e.target.closest('[data-action]');if(!button||button.disabled)return;
  const action=button.dataset.action;
  if(!['play','color','draw','uno','reaction'].includes(action))sound.effect('click');
  if(action==='home'){if(state)openDialog('leave');else{mode='create';render();}return;}
  if(action==='help'||action==='audio'||action==='log'){openDialog(action);return;}
  if(action==='close'){closeDialog();return;}
  if(action==='mode-create'||action==='mode-join'){mode=action==='mode-create'?'create':'join';render();return;}
  if(action==='avatar'){profile.avatar=Number(button.dataset.avatar);write('uno-profile',profile);render();return;}
  if(action==='music'||action==='effects'){sound.set(action,!sound.settings[action]);button.classList.toggle('on',sound.settings[action]);button.setAttribute('aria-checked',String(sound.settings[action]));updateConnection();if(action==='effects')sound.effect('play');return;}
  if(action==='leave'){openDialog('leave');return;}
  if(action==='copy-code'){copyText(state.code,'ルームコードをコピーしたよ');return;}
  if(action==='invite'){
    const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('room',state.code);
    if(navigator.share)navigator.share({title:'UNO PARTYで遊ぼう！',text:`ルームコード：${state.code}`,url:url.href}).catch(err=>{if(err.name!=='AbortError')copyText(url.href,'招待リンクをコピーしたよ');});else copyText(url.href,'招待リンクをコピーしたよ');return;
  }
  if(action==='sort'){sortCards=!sortCards;write('uno-sort',sortCards);render();return;}
  if(action==='emojis'){reactionOpen=!reactionOpen;render();return;}
  if(action==='fullscreen'){
    if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});
    else if(document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(()=>toast('この端末では全画面にできません'));
    else toast('iPhoneはSafariの共有から「ホーム画面に追加」で広く遊べるよ');return;
  }
  perform(async()=>{
    if(action==='create')await create();
    else if(action==='quick')await create(true);
    else if(action==='join')await join();
    else if(action==='add-bot')await send('room:add-bot');
    else if(action==='remove')await send('room:remove',{playerId:button.dataset.player});
    else if(action==='stack')await send('room:settings',{...state.settings,stackDraw:!state.settings.stackDraw});
    else if(action==='start'||action==='rematch'){await send('game:start');closeDialog();}
    else if(action==='back-lobby'){await send('room:lobby');closeDialog();}
    else if(action==='draw')await send('game:draw');
    else if(action==='pass')await send('game:pass');
    else if(action==='uno')await send('game:uno');
    else if(action==='catch')await send('game:catch');
    else if(action==='play')await play(button.dataset.card);
    else if(action==='color'){const id=wildCardId,color=button.dataset.color;closeDialog();await play(id,color);}
    else if(action==='reaction'){await send('reaction',{emoji:button.dataset.emoji});reactionOpen=false;render();}
    else if(action==='confirm-leave'){await send('room:leave');forgetSession();state=null;reactionOpen=false;closeDialog();updateRoomURL(null);render();}
  });
});

render();socket.connect();
