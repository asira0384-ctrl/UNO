// Optional browser install flow; a manual guide remains available on Safari.
export function installPlatform(nav = navigator) {
  if (/iPhone|iPad|iPod/.test(nav.userAgent) || nav.platform === 'MacIntel' && nav.maxTouchPoints > 1) return 'ios';
  return /Android/i.test(nav.userAgent) ? 'android' : 'desktop';
}
export class AppInstall {
  constructor(onChange = () => {}, env = window) {
    this.env = env; this.onChange = onChange; this.deferred = null; this.installing = false;
    this.bridgeState = null; this.bridgePending = new Map(); this.bridgeId = 0;
    this.standalone = env.matchMedia('(display-mode: standalone)');
    this.wasInstalled = false;
    env.addEventListener('beforeinstallprompt', e => { e.preventDefault(); this.deferred = e; this.onChange(); });
    env.addEventListener('appinstalled', () => { this.wasInstalled = true; this.deferred = null; this.onChange(); });
    this.standalone.addEventListener?.('change', () => this.onChange());
    if(env.parent && env.parent!==env){
      env.addEventListener('message', event=>{
        if(event.source!==env.parent || event.origin!==env.location.origin)return;
        const data=event.data;if(!data||typeof data!=='object')return;
        if(data.type==='uno-install-state'){this.bridgeState={installed:data.installed===true,canPrompt:data.canPrompt===true};this.onChange();}
        else if(data.type==='uno-install-result')this.bridgePending.get(data.id)?.(data.accepted===true);
      });
      env.parent.postMessage({type:'uno-install-ready'},env.location.origin);
    }
  }
  get installed() { return this.bridgeState?.installed || this.wasInstalled || this.standalone.matches || this.env.navigator.standalone === true; }
  get canPrompt() { return (!!this.deferred || this.bridgeState?.canPrompt===true) && !this.installed && !this.installing; }
  async prompt() {
    if (!this.canPrompt) return false;
    if(this.env.parent && this.env.parent!==this.env){
      this.installing=true;this.onChange();const id=++this.bridgeId;
      try{return await new Promise(resolve=>{
        const timer=setTimeout(()=>{this.bridgePending.delete(id);resolve(false);},60000);
        this.bridgePending.set(id,result=>{clearTimeout(timer);this.bridgePending.delete(id);resolve(result);});
        this.env.parent.postMessage({type:'uno-install-request',id},this.env.location.origin);
      });}finally{this.installing=false;this.onChange();}
    }
    const event = this.deferred; this.deferred = null; this.installing = true; this.onChange();
    try { await event.prompt(); return (await event.userChoice).outcome === 'accepted'; }
    finally { this.installing = false; this.onChange(); }
  }
  register() {
    if(this.env.parent && this.env.parent!==this.env)return;
    if (!this.env.isSecureContext || !('serviceWorker' in this.env.navigator)) return;
    const register = () => this.env.navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
    if (this.env.document.readyState === 'complete') register();
    else this.env.addEventListener('load', register, { once: true });
  }
}
