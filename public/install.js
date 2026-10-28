// Optional browser install flow; a manual guide remains available on Safari.
export function installPlatform(nav = navigator) {
  if (/iPhone|iPad|iPod/.test(nav.userAgent) || nav.platform === 'MacIntel' && nav.maxTouchPoints > 1) return 'ios';
  return /Android/i.test(nav.userAgent) ? 'android' : 'desktop';
}
export class AppInstall {
  constructor(onChange = () => {}, env = window) {
    this.env = env; this.onChange = onChange; this.deferred = null; this.installing = false;
    this.standalone = env.matchMedia('(display-mode: standalone)');
    this.wasInstalled = false;
    env.addEventListener('beforeinstallprompt', e => { e.preventDefault(); this.deferred = e; this.onChange(); });
    env.addEventListener('appinstalled', () => { this.wasInstalled = true; this.deferred = null; this.onChange(); });
    this.standalone.addEventListener?.('change', () => this.onChange());
  }
  get installed() { return this.wasInstalled || this.standalone.matches || this.env.navigator.standalone === true; }
  get canPrompt() { return !!this.deferred && !this.installed && !this.installing; }
  async prompt() {
    if (!this.canPrompt) return false;
    const event = this.deferred; this.deferred = null; this.installing = true; this.onChange();
    try { await event.prompt(); return (await event.userChoice).outcome === 'accepted'; }
    finally { this.installing = false; this.onChange(); }
  }
  register() {
    if (!this.env.isSecureContext || !('serviceWorker' in this.env.navigator)) return;
    const register = () => this.env.navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
    if (this.env.document.readyState === 'complete') register();
    else this.env.addEventListener('load', register, { once: true });
  }
}
