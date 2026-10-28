import { PartyAudio } from './audio.js?v=1.1';

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
let state=null,busy=false,connected=false,dialogType=null,wildCardId=null;
let sortCards=read('uno-sort',true),reactionOpen=false,toastTimer,serverOffset=0,lastTurnSound=null;
let joinValue=invitedCode,resuming=false;
let menu=invitedCode?'friends':'home',swapCardId=null;
let draft={roundMinutes:5,mode:'solo',maxPlayers:2,turnSeconds:30,stackDraw:true,sevenSwap:false,zeroSeven:false,forcePlay:false};
let stats=read('uno-stats',{wins:0,played:0,points:0,seen:[]});
profile.name ||= 'ゲスト'+Math.floor(1000+Math.random()*9000);
write('uno-profile',profile);

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
  return `<span aria-hidden="true" class="card ${back?'card-back':`${esc(card.color)} ${esc(card.value)}`} ${cls}"><span class="card-face"><span class="card-oval"></span><span class="card-corner top">${esc(corner)}</span><span class="card-value ${SYMBOLS[card.value]?'symbol':''}">${esc(value)}</span><span class="card-corner bottom">${esc(corner)}</span></span></span>`;
}
function toast(message,error=false) {
  const el=$('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('visible'),3500);
  if(error)sound.effect('error');
}
function updateConnection() {
  const el=$('#connection');if(el){el.className=`connection ${connected?'online':'offline'}`;$('span',el).textContent=connected?'オンライン':'接続中…';}
  const button=$('#sound-button'),name=sound.settings.music||sound.settings.effects?'sound':'mute';
  if(button&&button.dataset.audioIcon!==name){button.innerHTML=icon(name);button.dataset.audioIcon=name;}
}
function houseArt(kind='create') {
  const c=kind==='join'?['#d5ff67','#87d62c','#42a22d','#d9ffc8']:['#ffe890','#ffba30','#e69a23','#fff1b6'];
  return `<svg class="house-art" viewBox="0 0 240 205" aria-hidden="true"><defs><linearGradient id="roof-${kind}" x2=".8" y2="1"><stop stop-color="${c[0]}"/><stop offset="1" stop-color="${c[2]}"/></linearGradient><linearGradient id="wall-${kind}"><stop stop-color="${c[3]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient><filter id="shadow-${kind}"><feDropShadow dx="0" dy="10" stdDeviation="7" flood-opacity=".22"/></filter></defs><g filter="url(#shadow-${kind})"><path d="M19 154 119 109 224 145 124 194Z" fill="${c[3]}" stroke="white" stroke-width="5"/><path d="m34 151 86-35 88 30-84 35Z" fill="${c[2]}"/><path d="M55 80 120 45l65 29v80l-65 25-65-26Z" fill="url(#wall-${kind})"/><path d="m120 45 65 29v80l-65 25Z" fill="${c[2]}"/><path d="m39 83 77-65 85 47-14 23-66-36-65 52Z" fill="url(#roof-${kind})" stroke="${c[0]}" stroke-width="5" stroke-linejoin="round"/><path d="M69 49V20l22-7 5 29" fill="${c[1]}" stroke="${c[0]}" stroke-width="4"/><path d="M83 112v40l30 9v-43Z" fill="#fff7dd"/><path d="m140 96 21-8v23l-21 7Z" fill="${c[0]}" stroke="${c[3]}" stroke-width="4"/>${kind==='join'?`<circle cx="166" cy="129" r="17" fill="${c[0]}"/><path d="M147 175v-23c0-20 37-20 37 0v23Z" fill="${c[1]}" stroke="${c[0]}" stroke-width="3"/>`:`<g transform="translate(172 144) rotate(-24)"><rect x="-5" y="-24" width="12" height="57" rx="6" fill="#f5fcff" stroke="#b6d7e2" stroke-width="3"/><path d="m-8-33 3 15h13l6-13c18 13 8 34-8 35-24 1-35-23-14-37Z" fill="#d9f1fa" stroke="#a0c5d5" stroke-width="3"/></g>`}</g></svg>`;
}

function renderHeader() {
  const p={avatar:profile.avatar};
  $('.site-header').innerHTML=`<button class="header-profile" data-action="profile" aria-label="プレイヤー設定">${avatar(p)}<span><strong>${esc(profile.name)}</strong><small>カードパーティーへようこそ</small></span><span class="profile-edit">✎</span></button><button class="brand" data-action="home" aria-label="UNO PARTY ホーム"><span class="brand-mark">UNO!</span><span class="brand-sub">PARTY</span></button><div class="header-right"><span class="score-chip" title="この端末の勝利数">🏆 <b>${stats.wins||0}</b><small>WIN</small></span><span class="connection" id="connection"><i></i><span>接続中…</span></span><button class="icon-button" id="sound-button" data-action="audio" aria-label="サウンド設定">${icon('sound')}</button></div>`;
}

function homeHTML() {
  return `<section class="home-screen"><div class="home-intro"><span class="lobby-eyebrow">PLAY TOGETHER, ANYWHERE.</span><h1>さあ、もう一勝負。</h1><p>いつもの友達と。ちょっと空いた時間に。</p></div><div class="mode-cards"><button class="mode-card classic-mode" data-action="classic" aria-label="クラシック CPUと練習"><span class="mode-pill">CPUと練習</span><span class="mode-illustration card-illustration">${cardHTML({color:'blue',value:'reverse'})}${cardHTML({color:'red',value:'7'})}${cardHTML({color:'wild',value:'wild4'})}</span><strong>クラシック</strong><small>ひとりで気軽にプレイ</small><span class="mode-go">PLAY ${icon('arrow')}</span></button><button class="mode-card friends-mode" data-action="friends" aria-label="友達と遊ぶ"><span class="mode-pill">ONLINE · 2〜4人</span><span class="mode-illustration">${houseArt('create')}</span><strong>友達と遊ぶ</strong><small>ルームをつくって、みんなで集合</small><span class="mode-go">LET'S PARTY ${icon('arrow')}</span></button></div><div class="home-bottom"><button class="lobby-utility" data-action="help"><span>📖</span>遊び方</button><button class="start-audio-button" data-action="enable-audio">${icon('sound')}<span data-audio-home>音ありで遊ぶ</span></button><button class="lobby-utility" data-action="audio"><span>⚙</span>設定</button></div><span class="fan-note">UNO風オンラインカードゲーム · ダウンロード不要</span></section>`;
}

function friendsHTML() {
  return `<section class="friends-screen"><div class="screen-heading"><button class="back-button" data-action="home">${icon('back')}戻る</button><h1>友達と遊ぶ</h1><span>PRIVATE ROOM</span></div><div class="friends-options"><div class="friend-option join-option">${houseArt('join')}<h2>ルームに参加</h2><form data-form="join"><label class="field-label" for="join-code">6文字のルームコード</label><input class="join-code-input" id="join-code" inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="6" placeholder="ABC123" value="${esc(joinValue)}" aria-label="ルームコード"><button class="game-button green" type="submit" ${!connected?'disabled':''}>部屋に入る ${icon('arrow')}</button></form></div><div class="friend-option create-option">${houseArt('create')}<h2>ルームをつくる</h2><p>時間・人数・ルールを選んで<br>友達だけのパーティーを始めよう。</p><button class="game-button gold" data-action="room-create-settings" ${!connected?'disabled':''}>部屋を作成 ${icon('arrow')}</button></div></div><p class="screen-footnote">同じコードを入力すれば、スマホとPCでも一緒に遊べるよ。</p></section>`;
}

function ruleGrid(settings,disabled=false) {
  const rules=[['sevenSwap','7枚交換','7を出して相手と手札を交換','7 ⇄'],['zeroSeven','0–7ルール','0で全員移動・7で手札交換','0 ⇄ 7'],['stackDraw','スタッキング','同じ+2同士・+4同士を重ねる','+2 +4'],['forcePlay','強制プレイ','引いたカードが出せたら必ず出す','▶']];
  return `<div class="rule-tiles">${rules.map(([key,label,description,symbol])=>`<button class="rule-tile ${settings[key]?'selected':''}" data-action="toggle-rule" data-rule="${key}" role="switch" aria-checked="${!!settings[key]}" aria-label="${label}" title="${description}" ${disabled?'disabled':''}><span class="rule-art rule-${key}">${symbol}</span><strong>${label}</strong><small>${description}</small><span class="rule-check">${settings[key]?'✓':'+'}</span></button>`).join('')}</div>`;
}

function setupForm(settings,disabled=false) {
  return `<div class="setup-fields"><div class="setup-row"><span>合計時間</span><div class="choice-group">${[[3,'3分'],[5,'5分'],[0,'無制限']].map(([value,label])=>`<button class="choice ${settings.roundMinutes===value?'selected':''}" data-action="draft-choice" data-key="roundMinutes" data-value="${value}" aria-pressed="${settings.roundMinutes===value}" ${disabled?'disabled':''}><i></i>${label}</button>`).join('')}</div></div><div class="setup-row"><span>対戦モード</span><div class="choice-group">${[['solo','個人戦'],['teams','2 vs 2']].map(([value,label])=>`<button class="choice ${settings.mode===value?'selected':''}" data-action="draft-choice" data-key="mode" data-value="${value}" aria-pressed="${settings.mode===value}" ${disabled?'disabled':''}><i></i>${label}</button>`).join('')}</div></div><div class="setup-row"><label for="max-players">プレイヤー</label><select id="max-players" data-setting="maxPlayers" ${disabled||settings.mode==='teams'?'disabled':''}>${[2,3,4].map(n=>`<option value="${n}" ${n===settings.maxPlayers?'selected':''}>${n}人</option>`).join('')}</select><label for="turn-seconds">1ターン</label><select id="turn-seconds" data-setting="turnSeconds" ${disabled?'disabled':''}>${[15,30,60].map(n=>`<option value="${n}" ${n===settings.turnSeconds?'selected':''}>${n}秒</option>`).join('')}</select></div></div><div class="rule-heading"><span></span><strong>ルール</strong><button class="tiny-help" data-action="help" aria-label="ルールの説明">?</button><span></span></div>${ruleGrid(settings,disabled)}`;
}

function classicHTML() {
  return `<section class="classic-screen"><div class="screen-heading"><button class="back-button" data-action="home">${icon('back')}戻る</button><h1>クラシック</h1><span>VS COMPUTER</span></div><div class="classic-content"><div class="classic-preview"><div class="classic-deck">${cardHTML({back:true})}${cardHTML({color:'green',value:'skip'})}${cardHTML({color:'wild',value:'wild4'})}</div><h2>クラシック</h2><p>まずはCPUと、ひと勝負。</p><span class="ready-badge">${draft.maxPlayers-1}人のCPUが参加</span></div><div class="classic-setup"><h2>お好みのルールで</h2>${setupForm(draft)}<button class="game-button gold" data-action="quick" ${!connected?'disabled':''}>スタート ${icon('arrow')}</button></div></div></section>`;
}

function waitingHTML() {
  const host=state.hostId===state.selfId,teams=state.settings.mode==='teams';
  const canStart=state.players.length>=2&&(!teams||state.players.length===4);
  const seats=Array.from({length:state.settings.maxPlayers},(_,i)=>{
    const p=state.players[i];
    return p?`<div class="lobby-seat ${p.id===state.selfId?'is-self':''}"><span class="seat-number">${teams?`TEAM ${i%2+1}`:`PLAYER ${i+1}`}</span><div class="lobby-avatar">${avatar(p)}${p.id===state.hostId?'<span class="crown">♛</span>':''}</div><strong>${esc(p.name)}</strong><span class="player-ready">${p.bot?'CPU':p.connected?'準備OK':'再接続中'}</span>${host&&p.id!==state.selfId?`<button class="remove-seat" data-action="remove" data-player="${p.id}" aria-label="${esc(p.name)}をルームから外す">×</button>`:''}</div>`:`<div class="lobby-seat empty"><span class="seat-number">${teams?`TEAM ${i%2+1}`:`PLAYER ${i+1}`}</span><span class="empty-avatar">?</span><strong>参加を待っています</strong>${host?'<button class="small-game-button green" data-action="add-bot">CPUを追加</button>':'<span class="player-ready">WAITING…</span>'}</div>`;
  }).join('');
  return `<section class="waiting-screen"><div class="screen-heading"><button class="back-button" data-action="leave">${icon('back')}退出</button><h1>待機ルーム</h1><button class="small-game-button" data-action="room-settings">${icon('cpu')}ルール設定</button></div><div class="room-invitation"><span>ROOM CODE</span><button data-action="copy-code" class="room-code" aria-label="ルームコードをコピー">${state.code}${icon('copy')}</button><button class="game-button blue compact" data-action="invite">${icon('share')}友達を招待</button></div><div class="lobby-seats">${seats}</div><div class="lobby-rule-summary"><span>${teams?'2 vs 2':'個人戦'}</span><span>${state.settings.roundMinutes?`${state.settings.roundMinutes}分`:'時間無制限'}</span><span>ターン ${state.settings.turnSeconds}秒</span><span>${state.settings.stackDraw?'重ねがけ ON':'クラシックルール'}</span></div><div class="waiting-actions">${host?`${state.players.length<state.settings.maxPlayers?'<button class="small-game-button" data-action="fill-bots">CPUで空席を埋める</button>':''}<button class="game-button gold start-game" data-action="start" ${!canStart?'disabled':''}>ゲームスタート ${icon('arrow')}</button>`:'<p class="waiting-host">ホストが開始するまで、もう少し待ってね。</p>'}</div><p class="screen-footnote">${canStart?'みんな揃ったらスタート！':teams?'2vs2は4人で開始。空席にはCPUを追加できるよ。':'友達を呼ぶか、CPUを追加してね。'}</p></section>`;
}

function miniHand(p) {
  const n=Math.min(p.count,7);
  return `<div class="mini-hand" aria-label="${esc(p.name)}の手札${p.count}枚">${Array.from({length:n},(_,i)=>`<span class="mini-wrapper" style="--angle:${(i-(n-1)/2)*3}deg">${cardHTML({back:true},'mini-card')}</span>`).join('')}<span class="opponent-count">${p.count}</span></div>`;
}

function opponentHTML(p,position) {
  const active=p.id===state.currentId&&state.phase==='playing';
  return `<div class="opponent-seat ${position} ${active?'active':''}" data-player-id="${p.id}"><div class="player-token"><div class="avatar-wrap">${avatar(p)}${active?'<span class="turn-counter" data-turn-counter></span>':''}</div><strong class="player-name">${esc(p.name)}</strong><span class="player-status">${p.team!==null?`TEAM ${p.team+1}${p.bot?' · CPU':!p.connected?' · 再接続中':''}`:p.bot?'CPU':!p.connected?'再接続中':'ONLINE'}</span></div>${miniHand(p)}${p.uno?'<span class="uno-bubble">UNO!</span>':''}${active?'<span class="active-arrow">▼</span>':''}</div>`;
}

function gameHTML() {
  const me=state.players.find(p=>p.id===state.selfId),current=state.players.find(p=>p.id===state.currentId);
  const mine=state.currentId===state.selfId&&state.phase==='playing'&&!state.paused;
  const dealing=state.dealUntil>Date.now()+serverOffset;
  const playable=new Set(state.playableIds),hand=[...state.hand];
  if(sortCards)hand.sort((a,b)=>(COLORS.indexOf(a.color)<0?4:COLORS.indexOf(a.color))-(COLORS.indexOf(b.color)<0?4:COLORS.indexOf(b.color))||String(a.value).localeCompare(String(b.value),undefined,{numeric:true}));
  const myIndex=state.players.findIndex(p=>p.id===state.selfId);
  const others=state.players.map((p,i)=>({p,relative:(i-myIndex+state.players.length)%state.players.length})).filter(x=>x.p.id!==state.selfId).sort((a,b)=>a.relative-b.relative);
  const positions=others.length===1?['top']:others.length===2?['top-left','top-right']:['left','top','right'];
  const hint=dealing?'カードを配っています…':state.phase==='finished'?'ナイスゲーム！':!connected?'再接続しています…':state.paused?'対戦相手を待っています…':mine?(state.drawStack?`+${state.drawStack}！ 引くか、同じドローを重ねよう`:state.drawnCardId?(state.settings.forcePlay?'引いたカードを出してね':'引いたカードを出す？ パスもできるよ'):playable.size?'光るカードをタップして出そう':'山札をタップして1枚引こう'):`${current?.name||''} の番`;
  return `<section class="game-screen players-${state.players.length} ${dealing?'dealing':''} ${mine?'my-turn':''}"><div class="table-scene"></div><div class="game-topbar"><button class="table-back" data-action="leave" aria-label="ルームを退出">${icon('back')}</button><span class="match-clock">${icon('clock')}<b data-match-clock>--:--</b></span><span class="round-chip">ROUND ${state.round}${state.settings.mode==='teams'?' · 2 vs 2':''}</span><div class="game-tools"><button class="table-icon" data-action="log" aria-label="ゲームの履歴">${icon('log')}</button><button class="table-icon" data-action="audio" aria-label="サウンド設定">${icon('sound')}</button><button class="table-icon" data-action="table-settings" aria-label="ゲーム設定">⚙</button></div></div>
  ${others.map((x,i)=>opponentHTML(x.p,positions[i])).join('')}
  <button class="draw-deck" data-action="draw" ${!mine||!!state.drawnCardId||!connected||dealing?'disabled':''} aria-label="${state.drawStack?`${state.drawStack}枚引く`:'山札から1枚引く'}">${cardHTML({back:true})}${mine&&!state.drawnCardId&&!dealing?'<span class="deck-arrow">⬇</span>':''}<span class="deck-caption">${state.drawStack?`+${state.drawStack}`:'DRAW'}</span></button>
  <div class="center-play-area" style="--table-color:${SWATCHES[state.color]}"><div class="direction-orbit ${state.direction===-1?'reverse':''}" aria-label="${state.direction===1?'時計回り':'反時計回り'}"><svg viewBox="0 0 280 280" fill="none"><g stroke="currentColor" stroke-width="9" stroke-linecap="round"><path d="M47 112a98 98 0 0 1 169-37"/><path d="m196 43 24 34-38 5" stroke-linejoin="round"/><path d="M233 168A98 98 0 0 1 64 205"/><path d="m84 237-24-34 38-5" stroke-linejoin="round"/></g></svg></div><div class="discard-slot" aria-label="場のカード ${COLOR_NAMES[state.color]} ${esc(CARD_NAMES[state.top?.value]||state.top?.value)}">${cardHTML(state.top)}</div><span class="current-color" style="--swatch:${SWATCHES[state.color]}">${SHAPES[state.color]} ${COLOR_NAMES[state.color]}</span>${state.drawStack?`<span class="stack-warning">+${state.drawStack} STACK!</span>`:''}</div>
  <div class="self-player ${mine?'active':''}" data-self-player><div class="avatar-wrap">${avatar(me)}${mine?'<span class="turn-counter" data-turn-counter></span>':''}</div><strong class="player-name">${esc(me?.name)}</strong><span class="player-status">${me?.team!==null?`TEAM ${me.team+1}`:'YOU'} · ${hand.length}枚</span><button class="reaction-button" data-action="emojis" aria-label="リアクション">☺</button>${me?.uno?'<span class="uno-bubble">UNO!</span>':''}</div>
  <div class="my-zone"><div class="hand-message ${mine?'mine':''}">${mine&&!dealing?'<span class="your-turn-dot"></span>':''}${esc(hint)}</div><div class="hand-scroll"><div class="hand-rack" style="--overlap:${hand.length>10?'48px':'38px'}">${hand.map((c,i)=>`<button class="hand-card ${playable.has(c.id)&&mine?'playable':'unplayable'} ${state.drawnCardId===c.id?'drawn':''}" style="--i:${i+1};--fan:${Math.max(-7,Math.min(7,(i-(hand.length-1)/2)*1.4))}deg" data-action="play" data-card="${c.id}" aria-label="${COLOR_NAMES[c.color]||''}${CARD_NAMES[c.value]||c.value} ${playable.has(c.id)&&mine?'出せます':'今は出せません'}" aria-disabled="${!playable.has(c.id)||!mine}">${cardHTML(c)}</button>`).join('')}</div></div><div class="hand-footer"><button class="sort-button" data-action="sort" aria-label="手札の色順並び替え" aria-pressed="${sortCards}">${icon('sort')}</button><span>${hand.length>7?'手札は左右にスワイプできるよ':state.settings.zeroSeven?'0で全員移動・7で手札交換':state.settings.sevenSwap?'7で手札交換':'同じ色・数字・記号を合わせよう'}</span>${mine&&state.drawnCardId&&!state.settings.forcePlay?'<button class="pass-button" data-action="pass">パスする</button>':''}</div></div>
  <div class="uno-controls"><button class="uno-button ${state.unoArmed||me?.uno?'armed':''} ${hand.length===2&&mine&&!state.unoArmed?'ready':''}" data-action="uno" ${!connected||state.phase!=='playing'||dealing||hand.length>2||hand.length===0||(hand.length===2&&!mine)?'disabled':''} aria-label="UNOを宣言" aria-pressed="${state.unoArmed||me?.uno||false}"><small>コール</small><strong>UNO!</strong></button><span>${state.unoArmed||me?.uno?'宣言済み！':'残り1枚の前に！'}</span></div>
  ${state.pendingUnoId&&state.pendingUnoId!==state.selfId?'<button class="catch-button" data-action="catch">UNO忘れ！<br><strong>指摘する +2</strong></button>':''}
  ${reactionOpen?`<div class="reaction-tray">${['👋','😎','😂','😱','🔥','👏'].map(e=>`<button data-action="reaction" data-emoji="${e}" aria-label="${e}を送る">${e}</button>`).join('')}</div>`:''}
  <span class="latest-event">${esc(state.events.at(-1)?.text||'')}</span><button class="rotate-screen-button" data-action="fullscreen" aria-label="全画面表示">${icon('fullscreen')}<span>横向きでも遊べるよ</span></button>
  ${dealing?'<div class="deal-overlay"><span>READY?</span><strong data-countdown>3</strong><small>カードを配っています</small></div>':''}
  ${state.paused?'<div class="paused-cover"><strong>ちょっと、ひと休み。</strong><span>プレイヤーが戻ったら再開します</span></div>':''}</section>`;
}

function render() {
  const game=!!state&&state.phase!=='lobby';
  document.body.classList.toggle('in-game',game);
  document.body.classList.toggle('in-friends',!!state||menu==='friends');
  renderHeader();
  app.innerHTML=state?(state.phase==='lobby'?waitingHTML():gameHTML()):menu==='friends'?friendsHTML():menu==='classic'?classicHTML():homeHTML();
  updateConnection();updateClock();updateAudioStatus();
}

function updateAudioStatus() {
  const status=sound.status();
  const label=$('[data-audio-home]');if(label)label.textContent=status.musicPlaying?'サウンド ON':'音ありで遊ぶ';
  const detail=$('[data-audio-status]');
  if(detail)detail.textContent=status.musicPlaying?(status.context==='running'?'BGM・効果音を再生できます':'BGM再生中 · 効果音はタップで再開'):status.error||(!status.activated?'「音を開始」をタップしてね':'音楽はOFFです。設定を確認してね');
  const badge=$('[data-audio-engine]');if(badge)badge.textContent=`BGM: ${status.musicPlaying?'再生中':'停止中'} ／ 効果音: ${status.context==='running'?'準備OK':'タップで再開'}`;
  const button=$('#sound-button');if(button)button.classList.toggle('needs-tap',status.needsTap);
}

function dialogHead(title,close=true) {
  return `<div class="dialog-head"><h2>${title}</h2>${close?'<button class="dialog-close" data-action="close" aria-label="閉じる">×</button>':''}</div>`;
}
function dialogHTML(type) {
  if(type==='profile')return `${dialogHead('プレイヤー設定')}<label class="field-label" for="player-name">プレイヤー名</label><input class="text-input" id="player-name" autocomplete="nickname" maxlength="16" placeholder="名前を入力" value="${esc(profile.name)}"><div class="avatar-picker" role="group" aria-label="アバターを選択">${AVATARS.map((a,i)=>`<button class="avatar-option ${profile.avatar===i?'selected':''}" data-action="avatar" data-avatar="${i}" aria-label="アバター ${i+1}" aria-pressed="${profile.avatar===i}">${a}</button>`).join('')}</div><button class="game-button gold" data-action="save-profile">これで遊ぶ ${icon('check')}</button><p class="dialog-description">名前とアバターは、次に入るルームから反映されるよ。</p>`;
  if(type==='audio')return `${dialogHead('サウンド設定')}<div class="audio-status"><span class="audio-status-dot"></span><span data-audio-status>音を開始してね</span></div><div class="audio-start-buttons"><button class="game-button gold compact" data-action="enable-audio">${icon('sound')}音を開始</button><button class="small-game-button" data-action="test-audio">♪ 音をテスト</button></div><div class="sound-row"><span>BGM<small>パーティーを盛り上げる音楽</small></span><button class="switch ${sound.settings.music?'on':''}" role="switch" aria-checked="${sound.settings.music}" data-action="music" aria-label="BGMを切り替え"></button></div><div class="volume-row"><input type="range" min="0" max="100" value="${sound.settings.musicVolume}" data-volume="musicVolume" aria-label="BGM音量"><span data-volume-label="musicVolume">${sound.settings.musicVolume}%</span></div><div class="sound-row"><span>効果音<small>カード・ドロー・UNO・勝利</small></span><button class="switch ${sound.settings.effects?'on':''}" role="switch" aria-checked="${sound.settings.effects}" data-action="effects" aria-label="効果音を切り替え"></button></div><div class="volume-row"><input type="range" min="0" max="100" value="${sound.settings.effectsVolume}" data-volume="effectsVolume" aria-label="効果音の音量"><span data-volume-label="effectsVolume">${sound.settings.effectsVolume}%</span></div><p class="audio-engine-status" data-audio-engine></p><p class="audio-footnote">スマホで聞こえない時は「音を開始」をタップ。<br>iPhoneのBGM音量は、端末側の音量ボタンでも調節してね。</p>`;
  if(type==='create-room'||type==='room-settings') {
    const editing=type==='room-settings',host=!editing||state.hostId===state.selfId;
    return `${dialogHead(editing?'ルーム設定':'部屋を作成')}<p class="setup-description">${editing?'このルームで遊ぶルール':'自分たちだけのルールで、カードパーティー。'}</p>${setupForm(draft,!host)}<button class="game-button ${host?'green':'blue'}" data-action="${host?editing?'save-room-settings':'create-configured':'close'}">${host?editing?'設定を保存':'作成する':'閉じる'} ${icon('check')}</button>`;
  }
  if(type==='wild')return `${dialogHead('次は、何色？')}<div class="color-wheel">${COLORS.map(c=>`<button class="color-choice ${c}" style="--swatch:${SWATCHES[c]}" data-action="color" data-color="${c}" aria-label="${COLOR_NAMES[c]}を選ぶ"><span>${SHAPES[c]}</span><strong>${COLOR_NAMES[c]}</strong></button>`).join('')}<span class="wheel-center">COLOR</span></div><p class="color-prompt">好きな色をタップ</p>`;
  if(type==='swap')return `${dialogHead('誰と交換する？')}<p class="dialog-description">7のカードで、相手の手札とまるごと交換！</p><div class="swap-players">${state.players.filter(p=>p.id!==state.selfId).map(p=>`<button data-action="swap-target" data-player="${p.id}">${avatar(p)}<strong>${esc(p.name)}</strong><span>手札 ${p.count}枚</span></button>`).join('')}</div>`;
  if(type==='help')return `${dialogHead('遊び方')}<div class="rule-list">${[['色か数字を合わせて出す','場と同じ色・数字・記号のカードをタップ。先に手札をすべて出したら勝ち！'],['出せなければ山札をタップ','1枚引いて、出せる場合はそのカードを出せるよ。「強制プレイ」がOFFならパスもOK。'],['手札2枚になったらUNO!','自分の番にUNOボタンを押してから出そう。忘れたところを指摘されると2枚追加！'],['アクションで大逆転','スキップ・リバース・+2・ワイルド・+4で流れを変えよう。+4は今の色を持っていない時だけ。']].map((r,i)=>`<div class="rule-item"><span class="rule-num">${i+1}</span><div><strong>${r[0]}</strong><p>${r[1]}</p></div></div>`).join('')}</div><div class="special-rules"><strong>追加ルール</strong><p>7枚交換：7で選んだ相手と手札交換。<br>0–7：0で全員の手札が次の人へ、7で相手と交換。<br>スタッキング：同じ+2同士・+4同士を重ねられる。<br>2vs2：向かいの席が味方。どちらかが上がるとチームの勝ち。<br>時間切れ：残りカードの合計点が少ない人・チームが勝ち。数字はその数字、記号は20点、ワイルドは50点。</p></div><p class="dialog-description">UNO忘れの指摘は、次の人が出すか引くまで。<br>通信が30秒切れるとCPUが代行。戻ったら自分で操作できるよ。</p><button class="game-button green" data-action="close">わかった！ ${icon('check')}</button>`;
  if(type==='leave')return `${dialogHead('ルームを退出する？')}<p class="dialog-description">${state?.phase==='playing'?'対戦が続く場合は、あなたの代わりにCPUがプレイします。':'また遊ぶ時は、新しいルームを作るか参加してね。'}</p><div class="dialog-buttons"><button class="game-button gold" data-action="confirm-leave">退出する</button><button class="small-game-button" data-action="close">もう少し遊ぶ</button></div>`;
  if(type==='log')return `${dialogHead('ゲームの履歴')}<div class="event-log">${[...(state?.events||[])].reverse().map(e=>`<div class="log-entry"><span class="log-time">${new Date(e.at).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}</span><span>${esc(e.text)}</span></div>`).join('')}</div>`;
  if(type==='game-settings')return `${dialogHead('ゲーム設定')}<div class="game-setting-summary"><span>ROOM <b>${state.code}</b></span><span>${state.settings.mode==='teams'?'2 vs 2':'個人戦'} · ${state.settings.roundMinutes?`${state.settings.roundMinutes}分`:'時間無制限'}</span><span>スタッキング ${state.settings.stackDraw?'ON':'OFF'}</span></div><div class="dialog-buttons"><button class="game-button blue" data-action="audio">${icon('sound')}サウンド設定</button><button class="small-game-button" data-action="help">遊び方・ルール</button><button class="small-game-button" data-action="fullscreen">${icon('fullscreen')}全画面表示</button><button class="quiet-button" data-action="leave">ルームを退出する</button></div>`;
  if(type==='result') {
    const winner=state.players.find(p=>p.id===state.winnerId),me=state.players.find(p=>p.id===state.selfId);
    const won=state.rankings.find(p=>p.id===state.selfId)?.won,host=state.hostId===state.selfId;
    const points=state.events.findLast(e=>e.type==='win')?.points||0;
    const title=state.draw?'引き分け！':won?'お見事！ 勝利！':'もう一度トライ！';
    return `<div class="result-ribbon ${won?'victory':''}">${title}</div><div class="result-body"><div class="winner-card"><span class="winner-caption">${state.draw?'DRAW':'WINNER'}</span><div class="winner-trophy">${state.draw?'🤝':'🏆'}</div>${avatar(winner||me)}<strong>${state.draw?'ナイスゲーム！':state.winnerTeam!==null?`TEAM ${state.winnerTeam+1}`:esc(winner?.name)}</strong><b>${state.draw?'±0':`+${points}`}<small>POINTS</small></b></div><div class="result-board"><div class="rank-head"><span>順位</span><span>プレイヤー</span><span>残り点数</span></div>${state.rankings.map((p,i)=>`<div class="rank-row ${p.won?'winner':''}"><span class="rank-position">${state.draw?'—':i+1}<small>${i===0&&!state.draw?'st':''}</small></span>${avatar(p)}<span class="rank-name">${esc(p.name)}${p.id===state.selfId?'<small>YOU</small>':''}</span><span class="rank-score">${p.points}</span></div>`).join('')}<p class="result-explanation">${state.events.findLast(e=>e.type==='win')?.timed?'時間切れ！ 残りポイントで判定しました。':'相手の残りカード分のポイントを獲得。'}</p><p class="result-total">あなたの累計スコア <strong>${me?.score||0} pt</strong></p></div></div><div class="result-actions">${host?'<button class="game-button gold" data-action="rematch">もう一度あそぶ '+icon('rotate')+'</button><button class="small-game-button" data-action="back-lobby">待機ルームへ</button>':'<p class="waiting-host">ホストが次のゲームを準備しています…</p>'}<button class="quiet-button" data-action="leave">退出する</button></div>`;
  }
  return '';
}

function openDialog(type) {
  closeDialog(false);dialogType=type;
  const d=document.createElement('dialog');d.className=`dialog-${type}`;d.innerHTML=dialogHTML(type);d.setAttribute('aria-label',({audio:'サウンド設定',profile:'プレイヤー設定',help:'遊び方',wild:'色を選ぶ',swap:'手札を交換する相手',leave:'退出の確認',log:'ゲームの履歴',result:'対戦結果','create-room':'部屋を作成','room-settings':'ルーム設定','game-settings':'ゲーム設定'})[type]);
  modalRoot.append(d);d.addEventListener('cancel',()=>{dialogType=null;wildCardId=null;});
  d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
  d.showModal();updateAudioStatus();
}
function closeDialog(resetWild=true) { $('dialog',modalRoot)?.close();modalRoot.innerHTML='';dialogType=null;if(resetWild){wildCardId=null;swapCardId=null;} }
function updateClock() {
  if(!state)return;
  const now=Math.max(Date.now()+serverOffset,state.dealUntil||0);
  const seconds=Math.max(0,Math.ceil(((state.turnEndsAt||now)-now)/1000));
  for(const el of document.querySelectorAll('[data-turn-counter]'))el.textContent=seconds;
  const match=$('[data-match-clock]');
  if(match){const left=Math.max(0,Math.ceil(((state.roundEndsAt||now)-now)/1000));match.textContent=state.phase==='finished'?'FINISH':state.roundEndsAt?`${Math.floor(left/60).toString().padStart(2,'0')}:${(left%60).toString().padStart(2,'0')}`:'∞';}
  const counter=$('[data-countdown]');
  if(counter){const n=Math.ceil((state.dealUntil-Date.now()-serverOffset)/1000);counter.textContent=n>0?n:'GO!';}
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
  if(next.phase==='finished') {
    const key=`${next.code}:${next.round}`;
    if(!Array.isArray(stats.seen))stats.seen=[];
    if(!stats.seen.includes(key)) {
      stats.seen.push(key);stats.seen=stats.seen.slice(-50);stats.played=(Number(stats.played)||0)+1;
      if(next.rankings.find(p=>p.id===next.selfId)?.won){stats.wins=(Number(stats.wins)||0)+1;stats.points=(Number(stats.points)||0)+(next.events.findLast(e=>e.type==='win')?.points||0);}
      write('uno-stats',stats);
    }
  }
  updateRoomURL(next.code);
  if(before?.phase!==next.phase) { closeDialog();reactionOpen=false; }
  if(dialogType==='wild'&&(next.currentId!==next.selfId||!next.playableIds.includes(wildCardId)))closeDialog();
  render();
  if(play&&from)animateCard(play.card,from);
  for(const e of events)if(e.type==='draw')animateDraw(e.actorId,e.amount);
  if(play?.amount&&!next.drawStack)animateDraw(play.targetId,play.amount,180);
  if(before?.dealUntil&&!next.dealUntil&&next.phase==='playing')for(const p of next.players)animateDraw(p.id,2);
  const latest=events.at(-1);
  if(latest) {
    if(latest.type==='win') { sound.effect('win');if(!reducedMotion)confetti(); }
    else if(events.some(e=>e.type==='start'))sound.effect('start');
    else if(latest.type==='uno'||play?.uno) { sound.effect('uno');burst('UNO!'); }
    else if(play) { const value=play.card.value;sound.effect(value==='reverse'?'reverse':value==='skip'?'skip':value==='wild'||value==='wild4'?'wild':'play');if(['reverse','skip','draw2','wild4'].includes(value))burst(({reverse:'REVERSE!',skip:'SKIP!',draw2:'+2',wild4:'+4'})[value]); }
    else if(latest.type==='draw'||latest.type==='catch')sound.effect('draw');
    if(play?.exchange)burst(play.exchange.kind==='swap'?'HAND SWAP!':'ROTATE!');
  }
  if(before&&next.phase==='playing'&&next.currentId===next.selfId&&before.currentId!==next.selfId) {
    const key=`${next.revision}:${next.currentId}`;if(lastTurnSound!==key){lastTurnSound=key;setTimeout(()=>sound.effect('turn'),280);}
  }
  if(dialogType==='swap'&&(next.currentId!==next.selfId||!next.playableIds.includes(swapCardId)))closeDialog();
  if(next.phase==='finished'&&dialogType!=='result')openDialog('result');
});
socket.on('reaction',data=>{
  const el=data.playerId===state?.selfId?$('.self-player'):$(`[data-player-id="${data.playerId}"]`);
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
function animateDraw(playerId,amount,delay=0) {
  if(reducedMotion||!amount)return;
  const deck=$('.draw-deck')?.getBoundingClientRect();
  const target=playerId===state?.selfId?$('.hand-scroll'):$(`[data-player-id="${playerId}"] .avatar-wrap`);
  const end=target?.getBoundingClientRect();if(!deck||!end)return;
  for(let i=0;i<Math.min(3,amount);i++)setTimeout(()=>{
    const n=document.createElement('div');n.className='flying-card';n.innerHTML=cardHTML({back:true});
    n.style.setProperty('--card-w','48px');n.style.setProperty('--card-h','72px');
    n.style.transform=`translate(${deck.left}px,${deck.top}px) rotate(-13deg) scale(.7)`;fxRoot.append(n);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{n.style.transform=`translate(${end.left+end.width/2-24+i*7}px,${end.top+end.height/2-36}px) rotate(${i*7-7}deg) scale(.8)`;}));
    setTimeout(()=>n.remove(),450);
  },delay+i*65);
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
  const result=await send('room:create',{name:profile.name,avatar:profile.avatar,quick,settings:draft});saveSession(result);sound.effect('start');
}
async function join() {
  if(joinValue.length!==6)throw new Error('6文字のルームコードを入力してね');
  saveSession(await send('room:join',{name:profile.name,avatar:profile.avatar,code:joinValue}));sound.effect('start');
}
async function play(cardId,color,targetId) {
  if(!state||state.phase!=='playing')return;
  if(state.currentId!==state.selfId)throw new Error('あなたの番を待ってね');
  if(!state.playableIds.includes(cardId)) {
    const card=state.hand.find(c=>c.id===cardId);
    if(card?.value==='wild4'&&!state.drawStack)throw new Error('+4は、今の色のカードがない時だけ使えるよ');
    throw new Error(state.drawnCardId?'今引いたカードを出すか、パスしてね':'同じ色・数字・記号のカードを選んでね');
  }
  const c=state.hand.find(c=>c.id===cardId);
  if(c?.value==='7'&&(state.settings.sevenSwap||state.settings.zeroSeven)&&state.hand.length>1&&!targetId){swapCardId=cardId;openDialog('swap');return;}
  if(c?.color==='wild'&&!color) { wildCardId=cardId;openDialog('wild');return; }
  await send('game:play',{cardId,color,uno:state.unoArmed,targetId});
}

function gestureAudio() { sound.unlock({gesture:true}); }
for(const name of ['pointerup','touchend','click'])document.addEventListener(name,gestureAudio,{capture:true,passive:true});
document.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')gestureAudio();});
document.addEventListener('visibilitychange',()=>sound.visibility(!document.hidden));
window.addEventListener('pageshow',()=>sound.visibility(!document.hidden));
window.addEventListener('focus',()=>{if(!document.hidden)sound.visibility(true);});
sound.subscribe(()=>{updateConnection();updateAudioStatus();});
document.addEventListener('input',e=>{
  if(e.target.id==='player-name'){profile.name=e.target.value;write('uno-profile',profile);}
  if(e.target.id==='join-code'){joinValue=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);e.target.value=joinValue;}
  if(e.target.dataset.volume){const key=e.target.dataset.volume;sound.set(key,Number(e.target.value));const label=$(`[data-volume-label="${key}"]`);if(label)label.textContent=e.target.value+'%';}
});
document.addEventListener('change',e=>{
  if(e.target.dataset.setting){draft[e.target.dataset.setting]=Number(e.target.value);if(draft.mode==='teams')draft.maxPlayers=4;const badge=$('.ready-badge');if(badge)badge.textContent=`${draft.maxPlayers-1}人のCPUが参加`;}
});
document.addEventListener('submit',e=>{if(e.target.dataset.form==='join'){e.preventDefault();perform(join);}});
document.addEventListener('click',e=>{
  const button=e.target.closest('[data-action]');if(!button||button.disabled)return;
  const action=button.dataset.action;
  if(!['play','color','draw','uno','reaction','test-audio'].includes(action))sound.effect('click');
  if(action==='home'){if(state)openDialog('leave');else{menu='home';render();}return;}
  if(action==='classic'||action==='friends'){menu=action;render();return;}
  if(['help','audio','log','profile'].includes(action)){openDialog(action);return;}
  if(action==='table-settings'){openDialog('game-settings');return;}
  if(action==='result'){if(state?.phase==='finished')openDialog('result');return;}
  if(action==='close'){closeDialog();return;}
  if(action==='save-profile'){profile.name=profile.name.trim()||'ゲスト';write('uno-profile',profile);closeDialog();render();return;}
  if(action==='avatar'){profile.avatar=Number(button.dataset.avatar);write('uno-profile',profile);if(dialogType==='profile')openDialog('profile');else render();return;}
  if(action==='room-create-settings'){openDialog('create-room');return;}
  if(action==='room-settings'){draft={...state.settings};openDialog('room-settings');return;}
  if(action==='draft-choice'){
    draft[button.dataset.key]=button.dataset.key==='roundMinutes'?Number(button.dataset.value):button.dataset.value;
    if(draft.mode==='teams')draft.maxPlayers=4;
    if(dialogType==='room-settings'||dialogType==='create-room')openDialog(dialogType);else render();return;
  }
  if(action==='toggle-rule'){
    draft[button.dataset.rule]=!draft[button.dataset.rule];
    if(dialogType==='room-settings'||dialogType==='create-room')openDialog(dialogType);else render();return;
  }
  if(action==='music'||action==='effects'){
    sound.set(action,!sound.settings[action]);button.classList.toggle('on',sound.settings[action]);button.setAttribute('aria-checked',String(sound.settings[action]));
    if(action==='effects')sound.effect('play');return;
  }
  if(action==='enable-audio'){
    sound.set('music',true);sound.set('effects',true);
    if(sound.settings.musicVolume===0)sound.set('musicVolume',34);
    if(sound.settings.effectsVolume===0)sound.set('effectsVolume',65);
    sound.unlock({gesture:true});sound.effect('start');updateAudioStatus();
    if(dialogType==='audio')openDialog('audio');toast('音声を開始します。端末の音量も上げてね');return;
  }
  if(action==='test-audio'){sound.test().then(ok=>toast(ok?'テスト音を再生しました':'再生できませんでした。Safariで開き直して試してね',!ok));return;}
  if(action==='leave'){openDialog('leave');return;}
  if(action==='copy-code'){copyText(state.code,'ルームコードをコピーしたよ');return;}
  if(action==='invite'){
    const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('room',state.code);
    if(navigator.share)navigator.share({title:'UNO PARTYで遊ぼう！',text:`ルームコード：${state.code}`,url:url.href}).catch(err=>{if(err.name!=='AbortError')copyText(url.href,'招待リンクをコピーしたよ');});
    else copyText(url.href,'招待リンクをコピーしたよ');return;
  }
  if(action==='sort'){sortCards=!sortCards;write('uno-sort',sortCards);render();return;}
  if(action==='emojis'){reactionOpen=!reactionOpen;render();return;}
  if(action==='fullscreen'){
    if(dialogType)closeDialog();
    if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});
    else if(document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(()=>toast('端末を横向きにすると、テーブルを広く使えるよ'));
    else toast('端末を横向きにすると広く使えるよ。ホーム画面への追加もおすすめ');return;
  }
  perform(async()=>{
    if(action==='create-configured'){await create();closeDialog();}
    else if(action==='quick')await create(true);
    else if(action==='add-bot')await send('room:add-bot');
    else if(action==='fill-bots'){const n=state.settings.maxPlayers-state.players.length;for(let i=0;i<n;i++)await send('room:add-bot');}
    else if(action==='remove')await send('room:remove',{playerId:button.dataset.player});
    else if(action==='save-room-settings'){await send('room:settings',draft);closeDialog();}
    else if(action==='start'||action==='rematch'){await send('game:start');closeDialog();}
    else if(action==='back-lobby'){await send('room:lobby');closeDialog();}
    else if(action==='draw')await send('game:draw');
    else if(action==='pass')await send('game:pass');
    else if(action==='uno')await send('game:uno');
    else if(action==='catch')await send('game:catch');
    else if(action==='play')await play(button.dataset.card);
    else if(action==='color'){const id=wildCardId,color=button.dataset.color;closeDialog();await play(id,color);}
    else if(action==='swap-target'){const id=swapCardId,target=button.dataset.player;closeDialog();await play(id,undefined,target);}
    else if(action==='reaction'){await send('reaction',{emoji:button.dataset.emoji});reactionOpen=false;render();}
    else if(action==='confirm-leave'){await send('room:leave');forgetSession();state=null;reactionOpen=false;closeDialog();menu='home';updateRoomURL(null);render();}
  });
});

render();socket.connect();
