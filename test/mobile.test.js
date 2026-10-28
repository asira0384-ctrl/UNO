import test from 'node:test';
import assert from 'node:assert/strict';
import { fitHand,dealSequence } from '../public/layout.js';
import { cardMarkup } from '../public/cards.js';
import { profileImage } from '../src/profile.js';

test('every card stays inside the fitted hand at phone sizes, even with 108 cards',()=>{
  for(const [width,height] of [[320,568],[375,667],[393,852],[430,932],[852,393]])for(let n=1;n<=108;n++){
    const l=fitHand(n,width,height);assert.equal(l.placements.length,n);
    assert.ok(l.width<=width-20);
    for(const p of l.placements){assert.ok(p.x>=-.001);assert.ok(p.x+l.cardWidth<=l.width+.001);assert.ok(p.y+l.cardHeight<=l.height+.001);}
    assert.ok(l.height<=Math.min(height*.42,260));
    assert.equal(new Set(l.placements.map(p=>`${p.x},${p.y}`)).size,n);
  }
});
test('large hands use multiple rows and smaller cards',()=>{
  assert.equal(fitHand(7,393,852).rows,1);assert.equal(fitHand(20,393,852).rows,2);
  assert.ok(fitHand(20,393,852).cardWidth<fitHand(7,393,852).cardWidth);
});
test('the opening deal has seven one-card rounds with all seats receiving a card',()=>{
  for(const count of [2,3,4]){
    const players=Array.from({length:count},(_,i)=>({id:String(i)}));const seq=dealSequence(players,'0');
    assert.equal(seq.length,count*7);
    for(let round=0;round<7;round++)assert.deepEqual(seq.slice(round*count,(round+1)*count).map(s=>s.playerId),players.map(p=>p.id));
    assert.ok(seq.at(-1).at+350<3350);assert.equal(seq.filter(s=>s.self).length,7);
  }
});
test('played wild and +4 faces turn into the selected color without recoloring the hand',()=>{
  for(const value of ['wild','wild4'])for(const color of ['red','yellow','green','blue']){
    const card={color:'wild',value};assert.match(cardMarkup(card,'',color),new RegExp(`data-selected-color="${color}"`));
    assert.doesNotMatch(cardMarkup(card),/data-selected-color/);
  }
});
test('reverse is drawn with arrow geometry rather than a text glyph',()=>{
  const html=cardMarkup({color:'red',value:'reverse'});assert.match(html,/reverse-symbol/);assert.match(html,/<path/);assert.doesNotMatch(html,/⇄/);
});
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGxkAAAAASUVORK5CYII=';
test('profile pictures accept bounded raster images and reject SVG, URLs and oversized data',()=>{
  assert.equal(profileImage(png),png);assert.equal(profileImage(null),null);
  for(const value of ['https://example.com/picture.png','data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,'+'A'.repeat(100000),'data:image/png;base64,PHN2Zz4='])assert.throws(()=>profileImage(value));
});
