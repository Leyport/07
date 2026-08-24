import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Once a newer version is deployed, an already-open tab can still hold a build
// whose lazy chunk files no longer exist on the server (Firebase Hosting falls
// back to serving index.html for the missing path, which the browser then
// rejects as a disallowed MIME type). Detect that specific failure and reload
// once to pick up the current build — guarded so a genuinely broken deploy
// can't loop forever.
const RELOAD_FLAG = 'chunk-reload-attempted';

function isStaleChunkError(message: string): boolean {
  return /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module|disallowed MIME type/i.test(message);
}

function reloadOnce() {
  if (sessionStorage.getItem(RELOAD_FLAG)) return;
  sessionStorage.setItem(RELOAD_FLAG, '1');
  // A plain reload() can be satisfied from the browser's own HTTP cache (index.html
  // is served with max-age=3600), which could just re-load the same stale build. A
  // cache-busting query param forces a real network fetch of the current deploy.
  const url = new URL(window.location.href);
  url.searchParams.set('_r', Date.now().toString());
  window.location.replace(url.toString());
}

window.addEventListener('error', e => {
  if (isStaleChunkError(e.message || '')) reloadOnce();
});

window.addEventListener('unhandledrejection', e => {
  const reason = (e as PromiseRejectionEvent).reason;
  const message = (reason && reason.message) || String(reason || '');
  if (isStaleChunkError(message)) reloadOnce();
});

bootstrapApplication(AppComponent, appConfig)
  .then(() => sessionStorage.removeItem(RELOAD_FLAG))
  .catch(err => console.error(err));
