const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const reversiCounts=board=>[board.filter(v=>v===1).length,board.filter(v=>v===2).length];
export const flipDistance=(from,to)=>Math.max(Math.abs(Math.floor(from/8)-Math.floor(to/8)),Math.abs(from%8-to%8));
export function reversiFlipPlan(previous,next){
 if(!previous||previous.id!==next.id||previous.game!=='reversi'||next.game!=='reversi')return null;
 const e=next.events.findLast(e=>e.type==='stone'),old=previous.events.findLast(e=>e.type==='stone');
 if(!e||e.id<=(old?.id||0)||!Number.isInteger(e.square))return null;
 const color=e.color||next.state.board[e.square],flipped=(e.flipped||next.state.board.flatMap((v,i)=>v&&previous.state.board[i]&&v!==previous.state.board[i]?[i]:[])).map(square=>({square,distance:flipDistance(e.square,square),from:previous.state.board[square],to:color})).sort((a,b)=>a.distance-b.distance||a.square-b.square);
 return {event:e,square:e.square,color,flipped,duration:220+Math.max(0,...flipped.map(v=>v.distance-1))*95+360};
}
export function reversiCountBoard(board){const [black,white]=reversiCounts(board),out=Array(64).fill(0);for(let i=0;i<black;i++)out[i]=1;for(let i=0;i<white;i++)out[63-i]=2;return out;}
export function reversiLayout(width,height){const wide=width>=690&&width/height>1.25,panel=Math.min(185,Math.max(125,width*.16));return {wide,panel:Math.floor(panel),size:Math.max(100,Math.floor(Math.min(620,wide?width-2*panel-50:width-12,height-(wide?110:186))))};}
export function reversiStone(color,back=color){return `<span class="rv-disc" data-color="${color}" aria-hidden="true"><i class="rv-face rv-front ${color===1?'black':'white'}"></i><i class="rv-face rv-back ${back===1?'black':'white'}"></i></span>`;}
const label=(i,color)=>`${Math.floor(i/8)+1}行${i%8+1}列${color?' '+(color===1?'黒':'白'):''}`;
export class ReversiTable{
 constructor({getMatch,isBusy,onMove,onGesture,onPlace,onFinish,avatar}){
  Object.assign(this,{getMatch,isBusy,onMove,onGesture,onPlace,onFinish,avatar});this.model=null;this.timers=new Set();this.flights=new Set();this.animating=false;this.tallying=false;this.talliedId=null;
  document.addEventListener('click',e=>{const cell=e.target.closest('[data-rv-square]');if(!cell||cell.disabled||!this.ready())return;const m=this.getMatch(),square=Number(cell.dataset.rvSquare);if(!m.state.legal.includes(square))return;this.onGesture();this.onMove({square});});
 }
 ready(){const m=this.getMatch();return m?.game==='reversi'&&m.phase==='playing'&&m.currentId===m.selfId&&!this.isBusy()&&!this.animating&&Date.now()>=(m.animationUntil||0);}
 reset(){this.clearAnimations();this.observer?.disconnect();this.model=null;this.root=null;this.plan=null;this.counts=null;this.animating=false;this.tallying=false;this.talliedId=null;}
 clearAnimations(){for(const t of this.timers)clearTimeout(t);this.timers.clear();for(const e of this.flights)e.remove();this.flights.clear();}
 beforeRender(m){
  if(this.model&&m.id!==this.model.id)this.reset();
  const plan=reversiFlipPlan(this.model,m);
  if(this.tallying){this.clearAnimations();this.tallying=false;this.talliedId=m.id;}
  if(this.animating){this.clearAnimations();this.animating=false;}
  this.plan=plan&&Date.now()-plan.event.at<4000?plan:null;
  if(this.plan){this.animating=true;this.counts=reversiCounts(this.model.state.board);this.counts[this.plan.color-1]++;}
  else this.counts=reversiCounts(m.state.board);
  if(!this.model&&m.phase==='finished')this.talliedId=m.id;
 }
 markup(m){
  const seat=m.players.find(p=>p.id===m.selfId)?.seat||0,ownColor=seat+1,sorted=m.phase==='finished'&&this.talliedId===m.id,board=sorted?reversiCountBoard(m.state.board):m.state.board,plan=this.plan,flips=new Map(plan?.flipped.map(v=>[v.square,v])||[]);
  const player=side=>{const p=m.players[side],own=p.id===m.selfId,color=side+1;return `<div data-rv-player-color="${color}" class="rv-player ${own?'rv-you':'rv-rival'} ${m.turn===side&&m.phase==='playing'?'rv-current':''}"><div class="rv-player-top">${this.avatar(p)}<div><b>${esc(p.name)}</b><small>${own?'自分':p.bot?'CPU':'対戦相手'}</small></div></div><div class="rv-player-color"><span class="rv-chip ${color===1?'black':'white'}"></span><strong>${own?'あなたは':'相手は'}${color===1?'黒':'白'}</strong><small>${color===1?'先手':'後手'}</small></div><div class="rv-player-score"><b data-rv-count="${color}">${this.counts?.[side]??reversiCounts(board)[side]}</b><small>枚</small></div></div>`;};
  const first=!m.events.some(e=>e.type==='stone'),yourTurn=m.currentId===m.selfId&&m.phase==='playing',host=m.players.filter(p=>!p.bot)[0]?.id===m.selfId;
  return `<div class="rv-table ${sorted?'rv-count-complete':''}" data-rv-layout="stack"><div class="rv-players">${player(seat)}${player(1-seat)}</div><div class="rv-center"><div class="rv-status"><span class="rv-turn ${yourTurn?'rv-your-turn':''}" role="status"><i class="rv-chip ${sorted?(this.counts[0]>this.counts[1]?'black':'white'):m.turn===0?'black':'white'}" ${sorted&&this.counts[0]===this.counts[1]?'hidden':''}></i><b>${m.phase==='finished'?(sorted?this.resultLabel(m):'石を数えます'):this.animating?'石を返しています':yourTurn?'あなたの番':'相手の番'}</b></span><time id="turn-clock" aria-label="この手の残り時間"></time></div><div class="rv-board-frame"><div class="rv-board" role="grid" aria-label="オセロ盤" aria-rowcount="8" aria-colcount="8">${board.map((v,i)=>{const f=flips.get(i);return `<button class="rv-cell ${m.state.legal.includes(i)?'rv-legal':''} ${m.state.last===i&&!sorted?'rv-last':''}" role="gridcell" data-rv-square="${i}" aria-label="${label(i,v)}" ${!this.ready()||!m.state.legal.includes(i)?'disabled':''}>${v?reversiStone(f?.from||v,v):'<i class="rv-move-dot" aria-hidden="true"></i>'}</button>`;}).join('')}</div><div class="rv-board-stars" aria-hidden="true"><i></i><i></i><i></i><i></i></div></div><p class="rv-hint" aria-live="polite">${sorted?`黒 ${reversiCounts(board)[0]}枚 ・ 白 ${reversiCounts(board)[1]}枚`:first?`あなたは${ownColor===1?'黒・先手':'白・後手'}です。${ownColor===1?'印のマスに石を置こう。':'黒が置いたら、印のマスを選ぼう。'}`:m.phase==='finished'?'黒は左上から、白は右下から並べます。':'印のマスに置いて、相手の石を挟もう。'}</p></div><div class="rv-footer"><span class="rv-count-direction"><i class="rv-chip black"></i>黒は左上から<i class="rv-chip white"></i>白は右下から</span><div class="rv-result-buttons" ${!sorted?'hidden':''}>${host?'<button class="btn primary" data-action="match-next">次の対局</button>':''}<button class="btn" data-action="match-leave">ホームに戻る</button></div></div></div>`;
 }
 afterRender(m){
  this.root=document.querySelector('.rv-table');this.fit();this.observer?.disconnect();if(this.root){this.observer=new ResizeObserver(()=>this.fit());this.observer.observe(this.root.parentElement);}
  const plan=this.plan;this.plan=null;this.model=structuredClone(m);this.updateCounts();
  if(plan)requestAnimationFrame(()=>this.animateMove(plan,m));else if(m.phase==='finished'&&this.talliedId!==m.id)this.later(()=>this.countUp(m),100);
  this.refreshStatus();
 }
 fit(){if(!this.root?.isConnected)return;const r=this.root.parentElement.getBoundingClientRect(),box=r.width+'x'+r.height,p=reversiLayout(r.width,r.height);if(this.tallying&&this.box&&this.box!==box)this.finishCount(this.getMatch());this.box=box;this.root.dataset.rvLayout=p.wide?'wide':'stack';this.root.style.setProperty('--rv-size',p.size+'px');this.root.style.setProperty('--rv-panel',p.panel+'px');}
 later(fn,delay){const t=setTimeout(()=>{this.timers.delete(t);fn();},Math.max(0,delay));this.timers.add(t);return t;}
 updateCounts(){if(!this.root)return;for(let i=0;i<2;i++){const e=this.root.querySelector(`[data-rv-count="${i+1}"]`);if(e)e.textContent=this.counts?.[i]??0;}}
 refreshStatus(){
  const m=this.getMatch();if(m?.game!=='reversi'||!this.root?.isConnected)return;
  const turning=this.animating||Date.now()<(m.animationUntil||0),own=m.currentId===m.selfId&&m.phase==='playing',turn=this.root.querySelector('.rv-turn');
  if(m.phase==='playing'){turn.querySelector('b').textContent=turning?'石を返しています':own?'あなたの番':'相手の番';turn.classList.toggle('rv-your-turn',own&&!turning);this.root.classList.toggle('rv-is-turning',turning);}
  const ready=this.ready();for(const e of this.root.querySelectorAll('[data-rv-square]')){const legal=m.state.legal.includes(Number(e.dataset.rvSquare));e.disabled=!ready||!legal;e.classList.toggle('rv-can-place',ready&&legal);}
  this.root.closest('.match-screen')?.classList.toggle('own-turn',ready);for(const p of this.root.querySelectorAll('[data-rv-player-color]'))p.classList.toggle('rv-current',m.phase==='playing'&&!turning&&Number(p.dataset.rvPlayerColor)===m.turn+1);
 }
 animateMove(plan,m){
  if(!this.root?.isConnected||this.getMatch()?.id!==m.id)return;const placed=this.root.querySelector(`[data-rv-square="${plan.square}"] .rv-disc`),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(placed){placed.animate([{transform:'translateY(-34px) scale(1.18)',opacity:0},{transform:'translateY(0) scale(1)',opacity:1}],{duration:reduced?70:220,easing:'cubic-bezier(.2,.65,.35,1)',fill:'both'});this.later(()=>this.onPlace?.(),reduced?50:200);}
  for(const f of plan.flipped){const piece=this.root.querySelector(`[data-rv-square="${f.square}"] .rv-disc`);if(!piece)continue;
   const dr=Math.floor(f.square/8)-Math.floor(plan.square/8),dc=f.square%8-plan.square%8,axis=Math.abs(dr)>Math.abs(dc)?'1,0,0':Math.abs(dr)===Math.abs(dc)?'1,1,0':'0,1,0',delay=reduced?60:220+(f.distance-1)*95;
   piece.animate([{transform:`rotate3d(${axis},0deg) translateY(0)`},{transform:`rotate3d(${axis},90deg) translateY(-2px)`,offset:.5},{transform:`rotate3d(${axis},180deg) translateY(0)`}],{duration:reduced?80:360,delay,easing:'cubic-bezier(.3,.1,.3,1)',fill:'forwards'});
   this.later(()=>{if(!this.root?.isConnected)return;this.counts[plan.color-1]++;this.counts[2-plan.color]--;this.updateCounts();},delay+(reduced?75:350));
  }
  const end=Math.max(reduced?150:plan.duration,Math.max(0,(m.animationUntil||0)-Date.now()));
  this.later(()=>{this.animating=false;this.counts=reversiCounts(m.state.board);this.updateCounts();this.refreshStatus();if(m.phase==='finished')this.countUp(m);},end+30);
 }
 resultLabel(m){const [b,w]=reversiCounts(m.state.board);return b===w?'引き分け':b>w?'黒の勝ち':'白の勝ち';}
 setBoard(board){for(const cell of this.root.querySelectorAll('[data-rv-square]')){const i=Number(cell.dataset.rvSquare),v=board[i];cell.innerHTML=v?reversiStone(v):'';cell.setAttribute('aria-label',label(i,v));cell.classList.remove('rv-last','rv-can-place','rv-legal');cell.disabled=true;}}
 finishCount(m){
  if(!this.root?.isConnected)return;this.clearAnimations();this.tallying=false;this.talliedId=m.id;this.setBoard(reversiCountBoard(m.state.board));this.counts=reversiCounts(m.state.board);this.updateCounts();this.root.querySelector('.rv-turn b').textContent=this.resultLabel(m);const chip=this.root.querySelector('.rv-turn>i');chip.hidden=this.counts[0]===this.counts[1];chip.className='rv-chip '+(this.counts[0]>this.counts[1]?'black':'white');this.root.querySelector('.rv-hint').textContent=`黒 ${this.counts[0]}枚 ・ 白 ${this.counts[1]}枚`;this.root.querySelector('.rv-result-buttons').hidden=false;this.root.classList.add('rv-count-complete');this.onFinish?.();
 }
 countUp(m){
  if(!this.root?.isConnected||this.tallying||this.talliedId===m.id)return;
  this.tallying=true;this.animating=false;this.root.querySelector('.rv-turn b').textContent='石を並べて比べています';this.root.classList.add('rv-counting');this.counts=[0,0];this.updateCounts();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced){this.later(()=>this.finishCount(m),150);return;}
  const cells=[...this.root.querySelectorAll('[data-rv-square]')],rects=cells.map(c=>c.getBoundingClientRect()),sources=[[],[]];
  for(let i=0;i<64;i++){const color=m.state.board[i];if(color)sources[color-1].push(i);}sources[1].reverse();
  let last=0;
  for(let side=0;side<2;side++)for(let n=0;n<sources[side].length;n++){
   const source=sources[side][n],target=side===0?n:63-n,stone=cells[source].querySelector('.rv-disc'),sr=stone?.getBoundingClientRect();if(!sr)continue;
   const tr=rects[target],destX=tr.left+(tr.width-sr.width)/2,destY=tr.top+(tr.height-sr.height)/2,dx=destX-sr.left,dy=destY-sr.top,wait=450+n*48,total=wait+340;
   const flight=document.createElement('div');flight.className='rv-count-flight';flight.innerHTML=reversiStone(side+1);Object.assign(flight.style,{left:sr.left+'px',top:sr.top+'px',width:sr.width+'px',height:sr.height+'px'});document.body.append(flight);this.flights.add(flight);stone.style.visibility='hidden';
   flight.animate([{transform:'translate(0,0) scale(1)',easing:'ease-out'},{transform:'translate(0,-24px) scale(1.06)',offset:350/total,easing:'linear'},{transform:'translate(0,-24px) scale(1.06)',offset:wait/total,easing:'cubic-bezier(.25,.5,.3,1)'},{transform:`translate(${dx}px,${dy}px) scale(1)`}],{duration:total,easing:'linear',fill:'forwards'});
   this.later(()=>{if(!this.root?.isConnected)return;flight.remove();this.flights.delete(flight);cells[target].innerHTML=reversiStone(side+1);cells[target].setAttribute('aria-label',label(target,side+1));this.counts[side]++;this.updateCounts();},total);
   last=Math.max(last,total);
  }
  this.later(()=>this.setBoard(Array(64).fill(0)),360);
  this.later(()=>this.finishCount(m),last+220);
 }
}
