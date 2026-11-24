// Installing the app. Chrome, Edge and Samsung Internet fire beforeinstallprompt,
// which we keep so Settings can offer an Install button (the browser's own
// mini-infobar shows rarely, and not again for months once dismissed). Safari
// has no prompt, so Settings explains the menu steps instead.

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallPlatform = 'prompt' | 'ios-safari' | 'ios-other' | 'mac-safari' | 'manual';

function isStandalone() {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    matchMedia('(display-mode: window-controls-overlay)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectPlatform(): Exclude<InstallPlatform, 'prompt'> {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch points give it away.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) {
    // In-app web views (Gmail, Slack, …) drop the Safari/ token and have no Add to Home Screen.
    const safari = /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
    return safari ? 'ios-safari' : 'ios-other';
  }
  // File → Add to Dock arrived in Safari 17.
  const macSafari = /Macintosh/.test(ua) && !/Chrome|Chromium|Edg\//.test(ua) && /Version\/(\d+).*Safari/.exec(ua);
  if (macSafari && Number(macSafari[1]) >= 17) return 'mac-safari';
  return 'manual';
}

const DISMISS_KEY = 'pm.installBanner.dismissed';
const INSTALLED_KEY = 'pm.installed';
function readFlag(key: string) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
function writeFlag(key: string, on: boolean) {
  try {
    if (on) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch {}
}

class Install {
  /** Running as the installed app. */
  standalone = $state(isStandalone());
  /** Installed from this browser (remembered until the browser offers installing again). */
  installed = $state(readFlag(INSTALLED_KEY));
  platform = $state<InstallPlatform>(detectPlatform());
  /** The overview's install banner was closed with "don't show again". */
  bannerDismissed = $state(readFlag(DISMISS_KEY));
  private deferred: BeforeInstallPromptEvent | null = null;

  /** Show the banner only where installing is one tap or a known recipe. */
  get showBanner() {
    return (
      !this.bannerDismissed &&
      !this.standalone &&
      !this.installed &&
      (this.platform === 'prompt' || this.platform === 'ios-safari')
    );
  }

  dismissBanner() {
    this.bannerDismissed = true;
    writeFlag(DISMISS_KEY, true);
  }

  private markInstalled() {
    this.installed = true;
    writeFlag(INSTALLED_KEY, true);
  }

  constructor() {
    // Must be listening before the app mounts: the event can fire very early.
    addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferred = e as BeforeInstallPromptEvent;
      this.platform = 'prompt';
      // The browser offers installing only when the app is not installed (any more).
      this.installed = false;
      writeFlag(INSTALLED_KEY, false);
    });
    addEventListener('appinstalled', () => {
      this.deferred = null;
      this.markInstalled();
      this.platform = detectPlatform();
    });
    for (const q of ['(display-mode: standalone)', '(display-mode: window-controls-overlay)'])
      matchMedia(q).addEventListener?.('change', () => (this.standalone = isStandalone()));
  }

  /** Shows the browser's install dialog. */
  async prompt() {
    const e = this.deferred;
    if (!e) return;
    this.deferred = null;
    try {
      await e.prompt();
      const { outcome } = await e.userChoice;
      if (outcome === 'accepted') this.markInstalled();
    } catch {
      // The event can be used only once; fall back to the menu steps.
    }
    this.platform = detectPlatform();
  }
}

export const install = new Install();
