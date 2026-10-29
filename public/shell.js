import {framePlan,viewMode} from './viewport.js?v=2.0';
import {AppInstall} from './install.js?v=2.0';
const frame=document.querySelector('#game-frame'),stage=document.querySelector('#game-stage');
let mode='auto';try{mode=viewMode(JSON.parse(localStorage.getItem('uno-view')));}catch{}
const installer=new AppInstall(sendInstallState);installer.register();
function send(message){frame.contentWindow?.postMessage(message,location.origin);}
function sendInstallState(){send({type:'uno-install-state',installed:installer.installed,canPrompt:installer.canPrompt});}
function layout(){
  const plan=framePlan(stage.clientWidth,stage.clientHeight,mode);
  frame.style.width=plan.width+'px';frame.style.height=plan.height+'px';
  frame.style.transform=`translate(-50%,-50%) rotate(${plan.rotate}deg)`;
  document.documentElement.dataset.view=mode;
  send({type:'uno-view-state',mode});
}
window.addEventListener('message',async event=>{
  if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
  const message=event.data;if(!message||typeof message!=='object')return;
  if(message.type==='uno-view'){
    mode=viewMode(message.mode);try{localStorage.setItem('uno-view',JSON.stringify(mode));}catch{}layout();
  }else if(message.type==='uno-room'){
    const code=typeof message.code==='string'&&/^[A-Z2-9]{6}$/.test(message.code)?message.code:null;
    const url=new URL(location.href);if(code)url.searchParams.set('room',code);else url.searchParams.delete('room');history.replaceState({},'',url.pathname+url.search+url.hash);
  }else if(message.type==='uno-install-ready')sendInstallState();
  else if(message.type==='uno-install-request'){
    let accepted=false;try{accepted=await installer.prompt();}catch{}
    send({type:'uno-install-result',id:message.id,accepted});sendInstallState();
  }
});
frame.addEventListener('load',()=>{layout();sendInstallState();frame.classList.add('ready');document.querySelector('#shell-loading').hidden=true;});
new ResizeObserver(layout).observe(stage);window.addEventListener('resize',layout);window.visualViewport?.addEventListener('resize',layout);
frame.src='/game.html'+location.search+location.hash;layout();
