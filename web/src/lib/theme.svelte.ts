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
  }
}

export const theme = new Theme();
