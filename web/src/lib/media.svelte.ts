// Whether the window is wide enough for the desktop layout (sidebar, dense
// lists, two-column issue page). Narrower windows keep the mobile layout.
// Keep the width in step with the `--desktop` media queries in app.css.
const query = matchMedia('(min-width: 960px)');

class Media {
  desktop = $state(query.matches);
  constructor() {
    query.addEventListener('change', (e) => (this.desktop = e.matches));
  }
}

export const media = new Media();
