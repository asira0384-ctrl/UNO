export const THEME_PERIOD=60000;
export const THEMES=[
  {id:'classic',name:'クラシック',music:'/assets/audio/scene-1.mp3',background:'/assets/table-room.webp'},
  {id:'garden',name:'グリーンラウンジ',music:'/assets/audio/scene-2.mp3',background:'/assets/backgrounds/garden.svg'},
  {id:'night',name:'ナイトクラブ',music:'/assets/audio/scene-3.mp3',background:'/assets/backgrounds/night.svg'},
  {id:'sunset',name:'サンセット',music:'/assets/audio/scene-4.mp3',background:'/assets/backgrounds/sunset.svg'},
  {id:'ocean',name:'オーシャン',music:'/assets/audio/scene-5.mp3',background:'/assets/backgrounds/ocean.svg'},
];
export function themeIndex(elapsed){return Math.floor(Math.max(0,Number(elapsed)||0)/THEME_PERIOD)%THEMES.length;}
