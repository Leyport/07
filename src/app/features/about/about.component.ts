import { Component } from '@angular/core';
import { DatePipe } from '@angular/common';
import { buildInfo } from '../../build-info';

@Component({
  selector: 'app-about',
  standalone: true,
  template: `
    <div class="about-page">
      <div class="about-header">
        <div class="about-icon">🇫🇷</div>
        <h1 class="about-title">App Info</h1>
      </div>

      <div class="info-card">
        <div class="info-row">
          <span class="info-label">Version</span>
          <span class="info-value version-badge">v{{ info.version }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Last commit</span>
          <span class="info-value commit-message">{{ info.commitMessage }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Commit hash</span>
          <code class="info-value hash">{{ info.commitHash }}</code>
        </div>
        <div class="info-row">
          <span class="info-label">Committed</span>
          <span class="info-value">{{ info.commitDate | date:'d MMM yyyy, HH:mm' }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Built</span>
          <span class="info-value">{{ info.buildDate | date:'d MMM yyyy, HH:mm' }}</span>
        </div>
      </div>
    </div>
  `,
  imports: [DatePipe],
  styles: [`
    .about-page {
      max-width: 560px;
      margin: 3rem auto;
    }

    .about-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .about-icon { font-size: 3rem; }

    .about-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 2rem;
      font-weight: 700;
      margin: 0;
      color: var(--text-primary);
    }

    .info-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
    }

    .info-row {
      display: flex;
      align-items: baseline;
      gap: 1rem;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--border);
    }

    .info-row:last-child { border-bottom: none; }

    .info-label {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted);
      flex: 0 0 110px;
    }

    .info-value {
      font-size: 0.95rem;
      color: var(--text-primary);
      flex: 1;
      word-break: break-word;
    }

    .version-badge {
      display: inline-block;
      padding: 0.2rem 0.6rem;
      background: var(--accent-subtle);
      color: var(--accent);
      border: 1px solid var(--accent-border);
      border-radius: 99px;
      font-weight: 600;
      font-size: 0.85rem;
    }

    .commit-message {
      font-style: italic;
    }

    .hash {
      font-family: 'Courier New', monospace;
      font-size: 0.875rem;
      background: var(--hover);
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      color: var(--text-secondary);
    }
  `]
})
export class AboutComponent {
  info = {
    ...buildInfo,
    commitDate: new Date(buildInfo.commitDate),
    buildDate: new Date(buildInfo.buildDate),
  };
}
