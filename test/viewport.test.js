import test from 'node:test';
import assert from 'node:assert/strict';
import {framePlan,viewMode} from '../public/viewport.js';
import {fitHand} from '../public/layout.js';

test('iPhone 16e and 16 can select a true landscape viewport without physical rotation',()=>{
  for(const [width,height] of [[390,844],[393,852]]){
    const safeHeight=height-(width===390?47:59)-34;
    assert.deepEqual(framePlan(width,safeHeight,'landscape'),{width:safeHeight,height:width,rotate:90});
    assert.deepEqual(framePlan(width,safeHeight,'portrait'),{width,height:safeHeight,rotate:0});
    assert.deepEqual(framePlan(width,safeHeight,'auto'),{width,height:safeHeight,rotate:0});
  }
});
test('manual portrait also works in a physically landscape viewport and auto follows the window',()=>{
  assert.deepEqual(framePlan(852,393,'portrait'),{width:393,height:852,rotate:-90});
  assert.deepEqual(framePlan(852,393,'auto'),{width:852,height:393,rotate:0});assert.equal(viewMode('bad'),'auto');
});
test('all cards fit in every selected iPhone viewport in both physical orientations',()=>{
  for(const [w,h] of [[390,763],[393,759],[750,369],[734,372]])for(const mode of ['auto','portrait','landscape']){
    const frame=framePlan(w,h,mode);
    for(const count of [1,2,7,12,20,40,108]){
      const fan=fitHand(count,frame.width,frame.height);assert.ok(fan.width<=frame.width);
      for(const p of fan.placements){assert.ok(p.x>=0&&p.x+fan.cardWidth<=fan.width+.001);assert.ok(p.y+fan.cardHeight<=fan.height+.001);}
    }
  }
});
