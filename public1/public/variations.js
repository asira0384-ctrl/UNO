// Each set plays all five alternatives in random order before reshuffling.
export class VariationBag {
  constructor(random=Math.random){this.random=random;this.bags=new Map();this.last=new Map();}
  next(name,count=5){
    if(!Number.isInteger(count)||count<1)return 0;
    let bag=this.bags.get(name);
    if(!bag?.length||bag.some(n=>n>=count)){
      bag=Array.from({length:count},(_,i)=>i);
      for(let i=count-1;i>0;i--){const j=Math.min(i,Math.floor(this.random()*(i+1)));[bag[i],bag[j]]=[bag[j],bag[i]];}
      if(count>1&&bag.at(-1)===this.last.get(name))[bag[0],bag[count-1]]=[bag[count-1],bag[0]];
      this.bags.set(name,bag);
    }
    const value=bag.pop();this.last.set(name,value);return value;
  }
}
