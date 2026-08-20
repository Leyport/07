import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { UsersService } from '../../core/services/users.service';
import { AppUser } from '../../core/models/app-user.model';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="admin-page">

      <div class="page-header">
        <div class="page-icon">🔑</div>
        <div>
          <h1 class="page-title">User Access</h1>
          <p class="page-count">Approve who can add photos, bills, and edits</p>
        </div>
      </div>

      @if (!auth.admin()) {
        <p class="empty-state">You don't have access to this page.</p>
      } @else {
        @if (pendingUsers().length > 0) {
          <h2 class="section-heading">⏳ Pending approval</h2>
          <div class="user-list">
            @for (u of pendingUsers(); track u.uid) {
              <div class="user-row pending">
                @if (u.photoURL) {
                  <img class="user-avatar" [src]="u.photoURL" [alt]="u.displayName" referrerpolicy="no-referrer" />
                } @else {
                  <div class="user-avatar placeholder">{{ u.displayName ? u.displayName[0] : '?' }}</div>
                }
                <div class="user-info">
                  <div class="user-name">{{ u.displayName || u.email }}</div>
                  <div class="user-email">{{ u.email }}</div>
                </div>
                <button class="btn-approve" (click)="approve(u)">✅ Approve</button>
              </div>
            }
          </div>
        }

        <h2 class="section-heading">👥 Approved users</h2>
        @if (approvedUsers().length > 0) {
          <div class="user-list">
            @for (u of approvedUsers(); track u.uid) {
              <div class="user-row">
                @if (u.photoURL) {
                  <img class="user-avatar" [src]="u.photoURL" [alt]="u.displayName" referrerpolicy="no-referrer" />
                } @else {
                  <div class="user-avatar placeholder">{{ u.displayName ? u.displayName[0] : '?' }}</div>
                }
                <div class="user-info">
                  <div class="user-name">
                    {{ u.displayName || u.email }}
                    @if (u.admin) { <span class="admin-badge">Admin</span> }
                  </div>
                  <div class="user-email">{{ u.email }}</div>
                </div>
                @if (!u.admin) {
                  <button class="btn-revoke" (click)="revoke(u)">Revoke access</button>
                }
              </div>
            }
          </div>
        } @else {
          <p class="empty-state">No approved users yet.</p>
        }
      }

    </div>
  `,
  styles: [`
    .admin-page { max-width: 700px; margin: 0 auto; }

    .page-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
    .page-icon { font-size: 3rem; }
    .page-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: clamp(1.6rem, 4vw, 2.2rem);
      font-weight: 700;
      margin: 0 0 0.25rem;
      color: var(--text-primary);
    }
    .page-count { margin: 0; color: var(--text-muted); font-size: 0.9rem; }

    .section-heading {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 1.75rem 0 1rem;
    }
    .section-heading:first-of-type { margin-top: 0; }

    .empty-state { color: var(--text-muted); padding: 1rem 0; }

    .user-list { display: flex; flex-direction: column; gap: 0.6rem; }

    .user-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 0.75rem 1rem;
    }
    .user-row.pending { border-style: dashed; border-color: #eda100; }

    .user-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
    .user-avatar.placeholder {
      display: flex; align-items: center; justify-content: center;
      background: var(--hover); color: var(--text-secondary); font-weight: 700;
    }

    .user-info { flex: 1; min-width: 0; }
    .user-name { font-size: 0.92rem; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 0.4rem; }
    .user-email {
      font-size: 0.8rem; color: var(--text-muted);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .admin-badge {
      font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
      color: #0d9488; background: color-mix(in srgb, #0d9488 15%, var(--surface));
      padding: 0.1rem 0.4rem; border-radius: 999px;
    }

    .btn-approve {
      flex-shrink: 0;
      padding: 0.5rem 1rem;
      background: #16a34a;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn-approve:hover { opacity: 0.9; }

    .btn-revoke {
      flex-shrink: 0;
      padding: 0.5rem 0.9rem;
      background: transparent;
      color: var(--text-secondary);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-revoke:hover { background: #fee2e2; color: #dc2626; }
  `]
})
export class AdminComponent implements OnInit {
  auth = inject(AuthService);
  usersService = inject(UsersService);

  users = signal<AppUser[]>([]);

  pendingUsers = computed(() =>
    this.users().filter(u => !u.approved)
      .sort((a, b) => (b.requestedAt?.getTime() ?? 0) - (a.requestedAt?.getTime() ?? 0))
  );

  approvedUsers = computed(() =>
    this.users().filter(u => u.approved)
      .sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email))
  );

  ngOnInit() {
    this.usersService.getUsers().subscribe(users => this.users.set(users));
  }

  approve(u: AppUser) {
    this.usersService.setApproved(u.uid, true);
  }

  revoke(u: AppUser) {
    this.usersService.setApproved(u.uid, false);
  }
}
