import {randomInt,randomUUID} from 'node:crypto';
export const uid=()=>randomUUID();
export const clone=v=>structuredClone(v);
export function shuffle(a){for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export const pick=a=>a.length?a[randomInt(a.length)]:null;
export function pack(jokers=0){const a=[];for(const suit of ['S','H','D','C'])for(let rank=1;rank<=13;rank++)a.push({id:uid(),suit,rank});for(let i=0;i<jokers;i++)a.push({id:uid(),suit:'J',rank:15});return shuffle(a);}
export function log(m,type,text,details={}){m.revision=(m.revision||0)+1;m.updatedAt=Date.now();m.events.push({id:m.revision,type,text,at:Date.now(),...details});if(m.events.length>40)m.events.shift();}
export function active(m){return m.players.filter(p=>!p.place);}
export function nextSeat(m,from=m.turn,steps=1,direction=1){let n=from;for(let i=0;i<steps;i++){let guard=0;do{n=(n+direction+m.players.length)%m.players.length;}while(m.players[n].place&&++guard<m.players.length);}return n;}
export function turn(m,index){m.turn=index;m.deadline=Date.now()+(m.settings.turnSeconds||30)*1000;m.drawn=null;}
export function assertTurn(m,id){if(m.phase!=='playing')throw Error('対戦中ではありません');if(m.players[m.turn]?.id!==id)throw Error('あなたの番を待ってね');return m.players[m.turn];}
export function ranked(m,rows){m.phase='finished';m.deadline=null;let last=null,place=0;m.rankings=rows.map((row,i)=>{const value=row.value??-i;if(last!==value)place=i+1;last=value;const p=m.players.find(p=>p.id===row.id);return {id:row.id,name:p?.name||'',image:p?.image||null,place,...row};});log(m,'win','全員の順位が決まりました',{winnerId:m.rankings[0]?.id});}
export function placeOut(m,p){if(!p.place){p.place=m.players.filter(x=>x.place).length+1;log(m,'place',`${p.name} が${p.place}位！`,{actorId:p.id,place:p.place});}const left=active(m);if(left.length<=1){if(left[0])left[0].place=m.players.length;ranked(m,[...m.players].sort((a,b)=>a.place-b.place).map(x=>({id:x.id,place:x.place,value:-x.place})));}}
export const rankValue=c=>c.rank===15?16:c.rank<3?c.rank+13:c.rank;
export const GAMES={
 uno:{name:'UNO',min:2,max:10,tag:'色と数字の駆け引き',theme:'uno'},
 shogi:{name:'将棋',min:2,max:2,tag:'一手で変わる、盤上の勝負',theme:'shogi'},
 reversi:{name:'オセロ',min:2,max:2,tag:'最後の一石まで、わからない',theme:'reversi'},
 oldmaid:{name:'ババ抜き',min:2,max:10,tag:'その1枚、引く？',theme:'oldmaid'},
 president:{name:'大富豪',min:2,max:10,tag:'手札を読んで、頂点へ',theme:'president'},
 poker:{name:'ポーカー',min:2,max:10,tag:'テキサスホールデム',theme:'poker'},
 speed:{name:'スピード',min:2,max:2,tag:'考えるより、先に出す',theme:'speed'},
 memory:{name:'神経衰弱',min:2,max:10,tag:'覚えた場所が、勝ちにつながる',theme:'memory'},
 blackjack:{name:'ブラックジャック',min:2,max:10,tag:'21への、もう一枚',theme:'blackjack'}
};
