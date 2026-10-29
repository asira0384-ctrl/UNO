// Shogi presentation. The server's legal moves are the only drop targets.
export const SHOGI_NAMES={K:'玉将',R:'飛車',B:'角行',G:'金将',S:'銀将',N:'桂馬',L:'香車',P:'歩兵',r:'龍王',b:'龍馬',s:'成銀',n:'成桂',l:'成香',p:'と'};
const HAND_ORDER=['R','B','G','S','N','L','P'],RANKS=['一','二','三','四','五','六','七','八','九'];
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let pieceSerial=0;
export function shogiPiece(kind,opposing=false){
  const text=SHOGI_NAMES[kind]||'歩兵',promoted=kind===kind.toLowerCase(),id='sg-piece-'+(++pieceSerial);
  const glyphs=[...text],size=kind.toUpperCase()==='K'?1:['R','B'].includes(kind.toUpperCase())?.97:kind.toUpperCase()==='P'?.86:.92;
  return `<span class="sg-koma ${opposing?'opposing':''} ${promoted?'promoted':''}" style="--piece-size:${size}" data-kind="${kind}"><svg viewBox="0 0 80 94" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2=".7"><stop stop-color="#ffe8a8"/><stop offset=".5" stop-color="#efc578"/><stop offset="1" stop-color="#dba35d"/></linearGradient></defs><path d="M40 4 67 16 76 88 4 88 13 16Z" fill="#9f632f"/><path d="M40 2 66 14 74 83 6 83 14 14Z" fill="url(#${id})" stroke="#b77b3e" stroke-width="1.2"/><path d="M16 16 40 5 63 16M10 80 17 19" fill="none" stroke="#fff0bf" stroke-width="1.7" opacity=".85"/><path d="M22 20Q26 47 21 78M32 13Q34 45 30 79M50 15Q46 48 50 79M59 22Q55 44 59 77" fill="none" stroke="#b98046" stroke-width=".7" opacity=".16"/><g fill="${promoted?'#b82723':'#2f251d'}" font-family="Yu Mincho,Hiragino Mincho ProN,Noto Serif CJK JP,serif" font-weight="800" text-anchor="middle">${glyphs.length===1?`<text x="40" y="66" font-size="49">${text}</text>`:`<text x="40" y="42" font-size="30">${glyphs[0]}</text><text x="40" y="72" font-size="30">${glyphs[1]}</text>`}</g></svg></span>`;
}
export const shogiIndices=seat=>Array.from({length:81},(_,i)=>seat===1?80-i:i);
export function shogiTargets(legal,selection){
  if(!selection)return [];
  return [...new Set((legal||[]).filter(d=>selection.drop?d.drop===selection.drop:!d.drop&&d.from===selection.from).map(d=>d.to))];
}
export function shogiLayout(width,height){
  const wide=width>=690&&width/height>1.2,panel=Math.min(190,Math.max(116,width*.18));
  const size=Math.max(90,Math.floor(Math.min(640,wide?width-2*panel-48:width-30,(height-(wide?88:230))/1.08)));
  return {wide,size,panel:Math.floor(panel)};
}
export function shogiMovePlan(previous,next){
  if(!previous||previous.id!==next.id||previous.game!=='shogi'||next.game!=='shogi')return null;
  const event=next.events.findLast(e=>e.type==='piece'),prior=previous.events.findLast(e=>e.type==='piece');
  if(!event||event.id<=(prior?.id||0)||!event.move)return null;
  const move=event.move,after=next.state.board[move.to];if(!after)return null;
  const before=move.drop?{kind:move.drop,side:after.side}:previous.state.board[move.from];
  return {event,move,side:after.side,before:before||{kind:after.kind.toUpperCase(),side:after.side},after,captured:move.drop?null:event.captured||previous.state.board[move.to],promotion:!!move.promote&&before?.kind!==after.kind};
}
const rectOf=el=>el?.getBoundingClientRect();
const center=r=>({x:r.left+r.width/2,y:r.top+r.height/2});
export class ShogiTable{
  constructor({getMatch,isBusy,onMove,onGesture,onImpact,onCheck,avatar}){
    Object.assign(this,{getMatch,isBusy,onMove,onGesture,onImpact,onCheck,avatar});
    this.selection=null;this.model=null;this.flights=new Set();this.timers=new Set();this.suppressUntil=0;
    document.addEventListener('pointerdown',e=>this.pointerDown(e));
    document.addEventListener('pointermove',e=>this.pointerMove(e),{passive:false});
    document.addEventListener('pointerup',e=>this.pointerUp(e));
    document.addEventListener('pointercancel',()=>this.cancelDrag());
    document.addEventListener('click',e=>this.click(e));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&this.getMatch()?.game==='shogi'){this.promotionCancel?.();this.cancelDrag();this.selection=null;this.paintSelection();}});
    window.addEventListener('blur',()=>this.cancelDrag());
  }
  canMove(){const m=this.getMatch();return m?.game==='shogi'&&m.phase==='playing'&&m.currentId===m.selfId&&!this.isBusy();}
  seat(m=this.getMatch()){return m.players.find(p=>p.id===m.selfId)?.seat||0;}
  reset(){this.cancelDrag();this.finishFlights();this.observer?.disconnect();this.promotionCancel?.();this.pendingRelease=null;this.model=null;this.selection=null;this.plan=null;}
  markup(m){
    const seat=this.seat(m),s=m.state,indices=shogiIndices(seat),current=m.phase==='playing'?m.turn:null;
    if(m.currentId!==m.selfId||m.id!==this.model?.id)this.selection=null;
    const panel=side=>{const own=side===seat,p=m.players[side],entries=HAND_ORDER.filter(k=>s.hands[side][k]>0),total=entries.reduce((n,k)=>n+s.hands[side][k],0);
      return `<aside class="sg-side ${own?'sg-self':'sg-rival'} ${current===side?'sg-active':''}"><div class="sg-player">${this.avatar(p)}<div><b>${escapeHTML(p.name)}</b><small><i></i>${own?'自分':p.bot?'CPU':'対戦相手'} · ${side===0?'先手':'後手'}</small></div><span class="sg-player-mark">${current===side?'手番':''}</span></div><div class="sg-komadai" data-sg-tray="${side}"><div class="sg-tray-label"><span>${own?'自分の駒台':'相手の駒台'}</span><b>${total}枚</b></div><div class="sg-tray-pieces">${entries.length?entries.map(kind=>`<button class="sg-hand-piece" data-sg-hand="${kind}" data-sg-side="${side}" aria-label="${SHOGI_NAMES[kind]} ${s.hands[side][kind]}枚${own?'を打つ':''}" ${!own?'disabled':''}>${shogiPiece(kind)}<span class="sg-piece-count">${s.hands[side][kind]}</span></button>`).join(''):'<span class="sg-empty-tray">持ち駒なし</span>'}</div></div></aside>`;};
    const own=m.currentId===m.selfId&&m.phase==='playing',checked=s.check&&m.phase==='playing';
    return `<div class="shogi-table" data-sg-layout="stack">${panel(1-seat)}<div class="sg-center"><div class="sg-status"><span class="sg-turn ${own?'sg-your-turn':''}" role="status"><i></i>${m.phase==='finished'?'対局終了':own?'あなたの番':'相手の番'}${checked?'<em>王手</em>':''}</span><span class="sg-ply">${s.ply||0}手</span><time id="turn-clock" aria-label="この手の残り時間"></time></div><div class="sg-board-shell"><div class="sg-files" aria-hidden="true">${Array.from({length:9},(_,i)=>`<span>${seat===1?i+1:9-i}</span>`).join('')}</div><div class="sg-ranks" aria-hidden="true">${(seat===1?[...RANKS].reverse():RANKS).map(v=>`<span>${v}</span>`).join('')}</div><div class="sg-board" role="grid" aria-label="将棋盤" aria-rowcount="9" aria-colcount="9">${indices.map(i=>{const p=s.board[i],last=s.last,kingCheck=checked&&p?.kind==='K'&&p.side===m.turn;return `<button class="sg-cell ${last?.from===i?'sg-last-from':''} ${last?.to===i?'sg-last-to':''} ${kingCheck?'sg-king-check':''}" role="gridcell" data-sg-square="${i}" aria-label="${9-i%9}筋${RANKS[Math.floor(i/9)]}段${p?' '+(p.side===seat?'自分の':'相手の')+SHOGI_NAMES[p.kind]:''}" tabindex="${own&&p?.side===seat?'0':'-1'}">${p?shogiPiece(p.kind,p.side!==seat):''}<i class="sg-target" aria-hidden="true"></i></button>`;}).join('')}<div class="sg-stars" aria-hidden="true"><i></i><i></i><i></i><i></i></div></div></div><div class="sg-hint">${own?'駒をドラッグ、または駒 → マスをタップ':'相手が考えています'}</div></div>${panel(seat)}<div class="sg-actions"><button class="subtle" data-action="shogi-resign">投了</button><span>将棋</span><button class="subtle" data-action="shogi-draw">${s.drawOffer&&s.drawOffer!==m.selfId?'引き分けを承認':'引き分け提案'}</button></div></div>`;
  }
  beforeRender(m){
    const plan=shogiMovePlan(this.model,m);
    if(this.drag&&(plan||m.currentId!==m.selfId||m.phase!=='playing'))this.cancelDrag();
    if(!plan&&(m.currentId!==m.selfId||m.phase!=='playing')){this.promotionCancel?.();this.pendingRelease?.ghost?.remove();this.pendingRelease=null;}
    if(plan){
      plan.fromRect=this.pendingRelease?.move?.to===plan.move.to?rectOf(this.pendingRelease.ghost):rectOf(plan.move.drop?document.querySelector(`[data-sg-hand="${plan.move.drop}"][data-sg-side="${plan.side}"] .sg-koma`):document.querySelector(`[data-sg-square="${plan.move.from}"] .sg-koma`));
      plan.capturedRect=rectOf(document.querySelector(`[data-sg-square="${plan.move.to}"] .sg-koma`));
      this.pendingRelease?.ghost?.remove();this.pendingRelease=null;this.selection=null;this.finishFlights();this.promotionCancel?.();
    }
    if(this.model&&m.id!==this.model.id)this.reset();
    this.plan=plan;
  }
  afterRender(m){
    this.root=document.querySelector('.shogi-table');this.fit();this.observer?.disconnect();
    if(this.root){this.observer=new ResizeObserver(()=>this.fit());this.observer.observe(this.root.parentElement);}
    this.paintSelection();const plan=this.plan;this.plan=null;this.model=structuredClone(m);
    if(plan&&Date.now()-plan.event.at<4000)requestAnimationFrame(()=>this.animateMove(plan));
  }
  fit(){if(!this.root?.isConnected)return;const box=this.root.parentElement.getBoundingClientRect(),p=shogiLayout(box.width,box.height);this.root.dataset.sgLayout=p.wide?'wide':'stack';this.root.style.setProperty('--sg-size',p.size+'px');this.root.style.setProperty('--sg-panel',p.panel+'px');}
  paintSelection(){
    const m=this.getMatch();if(m?.game!=='shogi'||!this.root?.isConnected)return;
    const targets=shogiTargets(m.state.legal,this.selection),seat=this.seat(m);
    for(const el of this.root.querySelectorAll('[data-sg-square]')){const i=Number(el.dataset.sgSquare),legal=targets.includes(i),p=m.state.board[i];el.classList.toggle('sg-selected',this.selection?.from===i&&!this.selection?.drop);el.classList.toggle('sg-legal',legal);el.classList.toggle('sg-capture-target',legal&&!!p);el.tabIndex=this.canMove()&&(p?.side===seat||legal)?0:-1;}
    for(const el of this.root.querySelectorAll('[data-sg-hand]'))el.classList.toggle('sg-selected',el.dataset.sgHand===this.selection?.drop&&Number(el.dataset.sgSide)===seat);
  }
  choose(selection){this.selection=selection;this.paintSelection();}
  click(e){
    const square=e.target.closest('[data-sg-square]'),hand=e.target.closest('[data-sg-hand]');
    if((!square&&!hand)||Date.now()<this.suppressUntil||!this.canMove()||this.promotionCancel)return;
    this.onGesture();const m=this.getMatch(),seat=this.seat(m);
    if(hand){if(Number(hand.dataset.sgSide)===seat)this.choose({drop:hand.dataset.sgHand});return;}
    const to=Number(square.dataset.sgSquare);if(shogiTargets(m.state.legal,this.selection).includes(to)){this.commit(to);return;}
    if(m.state.board[to]?.side===seat)this.choose({from:to});else this.choose(null);
  }
  pointerDown(e){
    if(e.button!==0||!this.canMove()||this.drag||this.pendingRelease||this.promotionCancel)return;
    const square=e.target.closest('[data-sg-square]'),hand=e.target.closest('[data-sg-hand]'),m=this.getMatch(),seat=this.seat(m);let selection,el;
    if(hand&&Number(hand.dataset.sgSide)===seat){selection={drop:hand.dataset.sgHand};el=hand;}
    else if(square&&m.state.board[Number(square.dataset.sgSquare)]?.side===seat){selection={from:Number(square.dataset.sgSquare)};el=square;}
    else return;
    this.onGesture();this.choose(selection);this.drag={selection,el,piece:el.querySelector('.sg-koma'),x:e.clientX,y:e.clientY,id:e.pointerId,moving:false};
    el.setPointerCapture?.(e.pointerId);
  }
  pointerMove(e){
    const d=this.drag;if(!d||d.id!==e.pointerId)return;
    if(!d.moving&&Math.hypot(e.clientX-d.x,e.clientY-d.y)<5)return;
    if(!d.moving){d.moving=true;d.startRect=rectOf(d.piece);d.ghost=this.flight(d.piece.outerHTML,d.startRect,'sg-drag-ghost');d.piece.classList.add('sg-source-hidden');document.body.classList.add('sg-dragging');}
    e.preventDefault();d.ghost.style.left=(e.clientX-d.startRect.width/2)+'px';d.ghost.style.top=(e.clientY-d.startRect.height*.48)+'px';
    const cell=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-sg-square]'),to=cell?Number(cell.dataset.sgSquare):null,legal=shogiTargets(this.getMatch().state.legal,d.selection).includes(to);
    this.root?.querySelector('.sg-hover')?.classList.remove('sg-hover');if(legal)cell.classList.add('sg-hover');d.to=legal?to:null;
  }
  async pointerUp(e){
    const d=this.drag;if(!d||d.id!==e.pointerId)return;this.drag=null;d.el.releasePointerCapture?.(e.pointerId);document.body.classList.remove('sg-dragging');this.root?.querySelector('.sg-hover')?.classList.remove('sg-hover');
    if(!d.moving)return;
    this.suppressUntil=Date.now()+450;
    if(d.to!==null&&d.to!==undefined&&this.canMove()){this.pendingRelease={ghost:d.ghost,source:d.piece,startRect:d.startRect};await this.commit(d.to);}else this.returnGhost(d);
  }
  cancelDrag(){const d=this.drag;this.drag=null;if(d){try{d.el.releasePointerCapture?.(d.id);}catch{}d.ghost?.remove();d.piece?.classList.remove('sg-source-hidden');}document.body.classList.remove('sg-dragging');this.root?.querySelector('.sg-hover')?.classList.remove('sg-hover');}
  returnGhost(d){const ghost=d.ghost;if(!ghost)return;const r=rectOf(ghost),dest=d.startRect;
    if(!dest||!ghost.animate){ghost.remove();d.piece?.classList.remove('sg-source-hidden');return;}
    const a=ghost.animate([{transform:'translate(0,0)'},{transform:`translate(${dest.left-r.left}px,${dest.top-r.top}px)`}],{duration:180,easing:'ease-out',fill:'forwards'});
    a.finished.catch(()=>{}).then(()=>{ghost.remove();d.piece?.classList.remove('sg-source-hidden');this.flights.delete(ghost);});
  }
  async commit(to){
    if(!this.canMove())return;
    const m=this.getMatch(),selection=this.selection,moves=m.state.legal.filter(d=>d.to===to&&(selection?.drop?d.drop===selection.drop:!d.drop&&d.from===selection?.from));
    if(!moves.length)return;
    let move=moves[0];
    if(moves.length>1){const promote=await this.askPromotion(m.state.board[selection.from]?.kind||'P');if(promote===null){this.restorePending();return;}move=moves.find(d=>!!d.promote===promote);}
    if(!move||!this.canMove()||this.getMatch().id!==m.id){this.restorePending();return;}
    if(this.pendingRelease)this.pendingRelease.move=move;
    this.selection=null;this.paintSelection();let result;
    try{result=await this.onMove(move);}catch{result={ok:false};}
    if(result?.ok===false){this.selection=selection;this.restorePending();this.paintSelection();}
    else if(this.pendingRelease)this.later(()=>{if(this.pendingRelease?.move===move)this.restorePending();},1300);
  }
  restorePending(){const p=this.pendingRelease;this.pendingRelease=null;if(p)this.returnGhost({ghost:p.ghost,piece:p.source,startRect:p.startRect});}
  askPromotion(kind){
    return new Promise(resolve=>{const root=document.createElement('div');root.className='sg-promotion-shade';root.innerHTML=`<section class="sg-promotion-dialog" role="dialog" aria-modal="true" aria-label="成りますか"><h2>成りますか？</h2><p>駒を裏返すと、動きが変わります。</p><div><button data-sg-promote="yes">${shogiPiece(kind.toLowerCase())}<b>成る</b></button><button data-sg-promote="no">${shogiPiece(kind)}<b>成らない</b></button></div><button class="sg-promotion-cancel" data-sg-promote="cancel">戻る</button></section>`;
      const close=value=>{root.remove();this.promotionCancel=null;resolve(value);};this.promotionCancel=()=>close(null);root.addEventListener('click',e=>{const b=e.target.closest('[data-sg-promote]');if(b)close(b.dataset.sgPromote==='cancel'?null:b.dataset.sgPromote==='yes');});document.body.append(root);root.querySelector('button')?.focus();
    });
  }
  flight(html,rect,extra=''){
    const el=document.createElement('div');el.className='sg-flight '+extra;el.innerHTML=`<span class="sg-flip">${html}</span>`;Object.assign(el.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});document.body.append(el);this.flights.add(el);return el;
  }
  later(fn,ms){const t=setTimeout(()=>{this.timers.delete(t);fn();},ms);this.timers.add(t);return t;}
  finishFlights(){for(const t of this.timers)clearTimeout(t);this.timers.clear();for(const f of this.flights)f.remove();this.flights.clear();document.querySelectorAll('.sg-motion-hidden,.sg-source-hidden').forEach(e=>e.classList.remove('sg-motion-hidden','sg-source-hidden'));}
  animateMove(plan){
    if(!this.root?.isConnected)return;
    const {move,side,before,after,captured}=plan,seat=this.seat(),destPiece=this.root.querySelector(`[data-sg-square="${move.to}"] .sg-koma`),dest=rectOf(destPiece);
    if(!dest)return;const origin=plan.fromRect||dest,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,duration=reduced?80:330;
    destPiece.classList.add('sg-motion-hidden');const fly=this.flight(shogiPiece(before.kind,side!==seat),origin),dx=dest.left-origin.left,dy=dest.top-origin.top;
    const a=fly.animate([{transform:'translate(0,0) scale(1)'},{transform:`translate(${dx*.5}px,${dy*.5-14}px) scale(1.1)`,offset:.48},{transform:`translate(${dx}px,${dy}px) scale(${dest.width/origin.width},${dest.height/origin.height})`}],{duration,easing:'cubic-bezier(.2,.65,.35,1)',fill:'forwards'});
    a.finished.catch(()=>{}).then(()=>{if(!fly.isConnected)return;this.onImpact?.();if(plan.promotion){const flip=fly.querySelector('.sg-flip');flip.animate([{transform:'rotateY(0deg)'},{transform:'rotateY(90deg)'}],{duration:140,fill:'forwards'});this.later(()=>{flip.innerHTML=shogiPiece(after.kind,side!==seat);flip.animate([{transform:'rotateY(-90deg)'},{transform:'rotateY(0deg)'}],{duration:160,fill:'forwards'});},140);this.later(()=>{fly.remove();this.flights.delete(fly);destPiece.classList.remove('sg-motion-hidden');},305);}else{fly.remove();this.flights.delete(fly);destPiece.classList.remove('sg-motion-hidden');destPiece.animate([{transform:(side!==seat?'rotate(180deg) ':'')+'scale(1.06)'},{transform:(side!==seat?'rotate(180deg) ':'')+'scale(1)'}],{duration:150});}});
    if(captured){
      const kind=captured.kind.toUpperCase(),slot=this.root.querySelector(`[data-sg-hand="${kind}"][data-sg-side="${side}"] .sg-koma`),tray=rectOf(slot),start=plan.capturedRect||dest;
      if(tray){slot.classList.add('sg-motion-hidden');const hit=this.flight(shogiPiece(captured.kind,captured.side!==seat),start,'sg-captured-flight'),c=center(tray),r=center(start);
        hit.animate([{transform:'translate(0,0) scale(1)'},{transform:`translate(${(c.x-r.x)*.5}px,${(c.y-r.y)*.5-30}px) scale(.9)`,offset:.5},{transform:`translate(${c.x-r.x}px,${c.y-r.y}px) scale(${tray.width/start.width},${tray.height/start.height})`}],{duration:430,delay:duration,easing:'cubic-bezier(.22,.65,.35,1)',fill:'forwards'});
        this.later(()=>{const face=hit.querySelector('.sg-flip');face.animate([{transform:'rotateY(0deg)'},{transform:'rotateY(90deg)'}],{duration:90,fill:'forwards'});this.later(()=>{face.innerHTML=shogiPiece(kind);face.animate([{transform:'rotateY(-90deg)'},{transform:'rotateY(0deg)'}],{duration:100,fill:'forwards'});},90);},duration+110);
        this.later(()=>{hit.remove();this.flights.delete(hit);slot.classList.remove('sg-motion-hidden');slot.closest('button')?.animate([{transform:'scale(1.12)'},{transform:'scale(1)'}],{duration:220});},duration+440);
      }
    }
    if(plan.event.check)this.later(()=>{this.onCheck?.();this.root?.querySelector('.sg-turn em')?.animate([{opacity:0,transform:'scale(.85)'},{opacity:1,transform:'scale(1)'}],{duration:220});},duration+(plan.promotion?300:50));
  }
}
