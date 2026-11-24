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
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua) ? 'ios-other' : 'ios-safari';
  if (/Macintosh/.test(ua) && /Version\/\d+.*Safari/.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) return 'mac-safari';
  return 'manual';
}

const DISMISS_KEY = 'pm.installBanner.dismissed';
function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

class Install {
  /** Running as the installed app. */
  standalone = $state(isStandalone());
  /** Installed during this visit. */
  installed = $state(false);
  platform = $state<InstallPlatform>(detectPlatform());
  /** The overview's install banner was closed with "don't show again". */
  bannerDismissed = $state(readDismissed());
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
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {}
  }

  constructor() {
    // Must be listening before the app mounts: the event can fire very early.
    addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferred = e as BeforeInstallPromptEvent;
      this.platform = 'prompt';
    });
    addEventListener('appinstalled', () => {
      this.deferred = null;
      this.installed = true;
      this.platform = detectPlatform();
    });
    matchMedia('(display-mode: standalone)').addEventListener?.('change', () => (this.standalone = isStandalone()));
  }

  /** Shows the browser's install dialog. */
  async prompt() {
    const e = this.deferred;
    if (!e) return;
    this.deferred = null;
    await e.prompt();
    const { outcome } = await e.userChoice;
    if (outcome === 'accepted') this.installed = true;
    this.platform = detectPlatform();
  }
}

export const install = new Install();
