export type ThemePref = 'system' | 'light' | 'dark';

function read(): ThemePref {
  try {
    const v = localStorage.getItem('pm.theme');
    if (v === 'light' || v === 'dark') return v;
  } catch {}
  return 'system';
}

class Theme {
  pref = $state<ThemePref>(read());

  set(p: ThemePref) {
    this.pref = p;
    try {
      if (p === 'system') localStorage.removeItem('pm.theme');
      else localStorage.setItem('pm.theme', p);
    } catch {}
    if (p === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = p;
    syncThemeColor(p);
  }
}

export const theme = new Theme();

/** Keep the browser/system bar color in step with the app's theme choice. */
function syncThemeColor(p: ThemePref) {
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  metas.forEach((m, i) => {
    if (p === 'system') {
      m.media = i === 0 ? '(prefers-color-scheme: light)' : '(prefers-color-scheme: dark)';
      m.content = i === 0 ? '#F6F6F4' : '#111113';
    } else {
      m.removeAttribute('media');
      m.content = p === 'dark' ? '#111113' : '#F6F6F4';
    }
  });
}
