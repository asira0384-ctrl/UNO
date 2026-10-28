export function insideDropZone(x,y,rect,padding=22){return !!rect&&x>=rect.left-padding&&x<=rect.right+padding&&y>=rect.top-padding&&y<=rect.bottom+padding;}
export class CardInput {
  constructor(){this.selected=null;this.lastTap=null;this.pointer=null;}
  down(cardId,x,y,time){this.selected=cardId;this.pointer={cardId,x,y,time,dragging:false};return {select:cardId};}
  move(x,y,time){const p=this.pointer;if(!p)return null;const distance=Math.hypot(x-p.x,y-p.y);if(distance>10||(time-p.time>=180&&distance>3))p.dragging=true;return {dragging:p.dragging,cardId:p.cardId};}
  up(x,y,time,dropRect){const p=this.pointer;this.pointer=null;if(!p)return null;
    if(p.dragging){this.lastTap=null;return {cardId:p.cardId,commit:insideDropZone(x,y,dropRect),dragging:true};}
    const double=this.lastTap?.cardId===p.cardId&&time-this.lastTap.time<=360;
    this.lastTap=double?null:{cardId:p.cardId,time};return {cardId:p.cardId,commit:!!double,dragging:false};}
  cancel(){this.pointer=null;this.lastTap=null;}
  reset(){this.cancel();this.selected=null;}
}
