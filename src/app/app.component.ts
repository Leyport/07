import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { buildInfo } from './build-info';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell">
      <header class="app-header">
        <a routerLink="/" class="brand">
          <span class="brand-flag">🇫🇷</span>
          <span class="brand-name">Maison de France</span>
        </a>
        <nav class="app-nav">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">Home</a>
          <a routerLink="/opening" routerLinkActive="active">Opening</a>
          <a routerLink="/closing" routerLinkActive="active">Closing</a>
          <a routerLink="/tips" routerLinkActive="active">Tips</a>
          <a routerLink="/photos" routerLinkActive="active">Photos</a>
        </nav>
        <div class="auth-area">
          @if (!auth.loading()) {
            @if (auth.user(); as user) {
              <div class="user-info">
                @if (user.photoURL) {
                  <img class="user-avatar" [src]="user.photoURL" [alt]="user.displayName || ''" referrerpolicy="no-referrer">
                }
                <span class="user-name">{{ user.displayName }}</span>
                <button class="btn-signout" (click)="auth.signOut()">Sign out</button>
              </div>
            } @else {
              <button class="btn-signin" (click)="auth.signInWithGoogle()">
                <svg class="google-icon" viewBox="0 0 24 24" width="18" height="18">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </button>
            }
          }
        </div>
      </header>
      <main class="app-main">
        <router-outlet />
      </main>
      <footer class="app-footer">
        <p>A guide to our home in France 🇫🇷</p>
        <a routerLink="/about" class="version-link">v{{ version }} · {{ commitHash }}</a>
      </footer>
    </div>
  `,
  styles: [`
    .app-shell {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background: var(--bg);
    }

    .app-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 2rem;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(12px);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      text-decoration: none;
      color: var(--text-primary);
    }

    .brand-flag { font-size: 1.6rem; }

    .brand-name {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--text-primary);
    }

    .app-nav {
      display: flex;
      gap: 0.25rem;
    }

    .app-nav a {
      padding: 0.5rem 1rem;
      border-radius: 8px;
      text-decoration: none;
      color: var(--text-secondary);
      font-size: 0.9rem;
      font-weight: 500;
      transition: all 0.2s;
    }

    .app-nav a:hover { background: var(--hover); color: var(--text-primary); }
    .app-nav a.active { background: var(--accent-subtle); color: var(--accent); }

    .app-main {
      flex: 1;
      padding: 2rem;
      max-width: 1100px;
      width: 100%;
      margin: 0 auto;
    }

    .app-footer {
      text-align: center;
      padding: 1.5rem;
      color: var(--text-muted);
      font-size: 0.85rem;
      border-top: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
    }

    .version-link {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-decoration: none;
      font-family: 'Courier New', monospace;
      opacity: 0.7;
      transition: opacity 0.2s;
    }

    .version-link:hover { opacity: 1; }

    .auth-area { display: flex; align-items: center; }

    .btn-signin {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.45rem 1rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      color: var(--text-primary);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s;
      white-space: nowrap;
    }
    .btn-signin:hover { background: var(--hover); border-color: var(--accent-border); }

    .user-info {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .user-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      object-fit: cover;
    }

    .user-name {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-primary);
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .btn-signout {
      padding: 0.35rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: transparent;
      color: var(--text-secondary);
      font-size: 0.8rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-signout:hover { background: var(--hover); color: var(--text-primary); }

    @media (max-width: 600px) {
      .app-header { padding: 0.75rem 1rem; flex-wrap: wrap; gap: 0.75rem; }
      .brand-name { font-size: 1rem; }
      .app-nav a { padding: 0.4rem 0.6rem; font-size: 0.8rem; }
      .app-main { padding: 1rem; }
      .user-name { display: none; }
    }
  `]
})
export class AppComponent {
  auth = inject(AuthService);
  version = buildInfo.version;
  commitHash = buildInfo.commitHash;
}
