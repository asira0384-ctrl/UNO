// Keep the complete hand inside the viewport, including large penalty hands.
export function fitHand(count, width, height) {
  const n=Math.max(0,Math.min(108,Math.floor(count)||0));
  const portrait=height>=width;
  const available=Math.max(240,Math.min(portrait?width-24:width*.58,820));
  const rows=n>90?6:n>68?5:n>45?4:n>28?3:n>12?2:1;
  const perRow=Math.max(1,Math.ceil(n/rows));
  const maxHeight=Math.min(portrait?230:145,height*(portrait?.285:.36));
  const maxWidth=n>45?44:n>28?54:n>12?68:portrait?84:76;
  const cardWidth=Math.max(12,Math.min(maxWidth,available/(perRow*.58+.42),(maxHeight-(rows-1)*4)/rows/1.5));
  const cardHeight=cardWidth*1.5;
  const rowHeight=cardHeight+4;
  const placements=[];
  for(let row=0,index=0;row<rows;row++){
    const rowCount=Math.min(perRow,n-index);
    const step=rowCount<2?0:Math.min(cardWidth+5,(available-cardWidth)/(rowCount-1));
    const start=(available-cardWidth-step*(rowCount-1))/2;
    for(let column=0;column<rowCount;column++,index++)placements.push({index,row,x:start+column*step,y:row*rowHeight});
  }
  return {width:available,height:n?rows*cardHeight+(rows-1)*4:0,cardWidth,cardHeight,rows,placements};
}

export function dealSequence(players, selfId, startingCards=7) {
  const result=[];
  // 7 rounds of one card per seat; all clients use the same server start time.
  const interval=Math.min(150,2400/(players.length*startingCards));
  for(let round=0;round<startingCards;round++)for(let seat=0;seat<players.length;seat++)
    result.push({playerId:players[seat].id,cardIndex:round,self:players[seat].id===selfId,at:450+(round*players.length+seat)*interval});
  return result;
}
