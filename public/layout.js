// Large cards with tightly overlapping fans. Corners remain exposed.
export function fitHand(count,width,height){
  const n=Math.max(0,Math.min(108,Math.floor(count)||0)),portrait=height>=width;
  const available=Math.max(240,Math.min(portrait?width-20:width*.61,920));
  const rows=Math.max(1,Math.ceil(n/12)),perRow=Math.max(1,Math.ceil(n/rows));
  const maxHeight=Math.min(portrait?260:160,height*(portrait?.31:.41));
  const preferred=n>56?76:n>42?86:n>28?92:n>12?96:n>10?92:portrait?100:90;
  const cardWidth=Math.max(18,Math.min(preferred,(available-36)/(1+.24*(perRow-1)),maxHeight/(1.5+.24*(rows-1))));
  const cardHeight=cardWidth*1.5,rowStep=cardWidth*.24,placements=[];
  for(let row=0,index=0;row<rows;row++){
    const rowCount=Math.min(perRow,n-index),step=rowCount<2?0:Math.min(cardWidth*.62,(available-36-cardWidth)/(rowCount-1));
    const start=(available-cardWidth-step*(rowCount-1))/2;
    for(let column=0;column<rowCount;column++,index++)placements.push({index,row,x:start+column*step,y:row*rowStep,angle:Math.max(-3.5,Math.min(3.5,(column-(rowCount-1)/2)*.65))});
  }
  return {width:available,height:n?cardHeight+(rows-1)*rowStep:0,cardWidth,cardHeight,rows,placements};
}
export function dealSequence(players,selfId,startingCards=7){
  const result=[],interval=Math.min(145,2450/(players.length*startingCards));
  for(let round=0;round<startingCards;round++)for(let seat=0;seat<players.length;seat++)result.push({playerId:players[seat].id,cardIndex:round,self:players[seat].id===selfId,at:350+(round*players.length+seat)*interval});
  return result;
}
