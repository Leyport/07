import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Section {
  route: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  gradient: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="home">
      <div class="hero">
        <div class="hero-flag">🇫🇷</div>
        <h1 class="hero-title">Our House in France</h1>
        <p class="hero-subtitle">
          Everything you need to know about looking after the house.
          Photos and videos for each step of the way.
        </p>
      </div>

      <div class="sections-grid">
        @for (section of sections; track section.route) {
          <a [routerLink]="section.route" class="section-card" [style.--card-color]="section.color" [style.--card-gradient]="section.gradient">
            <div class="card-icon">{{ section.icon }}</div>
            <div class="card-body">
              <h2 class="card-title">{{ section.title }}</h2>
              <p class="card-subtitle">{{ section.subtitle }}</p>
            </div>
            <div class="card-arrow">→</div>
          </a>
        }
      </div>

      <div class="help-banner">
        <span class="help-icon">💬</span>
        <p>If anything is unclear, just call us! We're always happy to help.</p>
      </div>
    </div>
  `,
  styles: [`
    .home { max-width: 800px; margin: 0 auto; }

    .hero {
      text-align: center;
      padding: 3rem 1rem 2.5rem;
    }

    .hero-flag {
      font-size: 4rem;
      display: block;
      margin-bottom: 1rem;
      animation: wave 2s ease-in-out infinite;
    }

    @keyframes wave {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-5deg); }
      75% { transform: rotate(5deg); }
    }

    .hero-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: clamp(2rem, 5vw, 3rem);
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 0.75rem;
      letter-spacing: -0.03em;
    }

    .hero-subtitle {
      font-size: 1.05rem;
      color: var(--text-secondary);
      line-height: 1.7;
      max-width: 500px;
      margin: 0 auto;
    }

    .sections-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.25rem;
      margin-top: 1rem;
    }

    .section-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.5rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      text-decoration: none;
      color: inherit;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }

    .section-card::before {
      content: '';
      position: absolute;
      inset: 0;
      background: var(--card-gradient);
      opacity: 0;
      transition: opacity 0.25s;
    }

    .section-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 40px rgba(0,0,0,0.12);
      border-color: var(--card-color);
    }

    .section-card:hover::before { opacity: 0.05; }

    .card-icon {
      font-size: 2.5rem;
      flex-shrink: 0;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
    }

    .card-body { flex: 1; }

    .card-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 0.25rem;
    }

    .card-subtitle {
      font-size: 0.85rem;
      color: var(--text-secondary);
      margin: 0;
      line-height: 1.4;
    }

    .card-arrow {
      font-size: 1.25rem;
      color: var(--card-color);
      flex-shrink: 0;
      transition: transform 0.2s;
    }

    .section-card:hover .card-arrow { transform: translateX(4px); }

    .help-banner {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-top: 2rem;
      padding: 1.25rem 1.5rem;
      background: var(--accent-subtle);
      border-radius: 12px;
      border: 1px solid var(--accent-border);
    }

    .help-icon { font-size: 1.5rem; }

    .help-banner p {
      margin: 0;
      color: var(--text-secondary);
      font-size: 0.95rem;
    }
  `]
})
export class HomeComponent {
  sections: Section[] = [
    {
      route: '/opening',
      title: 'Opening the House',
      subtitle: 'Arrive, unlock, and get everything running',
      icon: '🔓',
      color: '#4CAF50',
      gradient: 'linear-gradient(135deg, #4CAF50, #8BC34A)'
    },
    {
      route: '/closing',
      title: 'Closing the House',
      subtitle: 'Secure everything before you leave',
      icon: '🔒',
      color: '#2196F3',
      gradient: 'linear-gradient(135deg, #2196F3, #03A9F4)'
    },
    {
      route: '/tips',
      title: 'General Tips',
      subtitle: 'Useful things to know about the house',
      icon: '💡',
      color: '#FF9800',
      gradient: 'linear-gradient(135deg, #FF9800, #FFC107)'
    },
    {
      route: '/photos',
      title: 'Photos',
      subtitle: 'Shared photos and videos of the house',
      icon: '📸',
      color: '#9333ea',
      gradient: 'linear-gradient(135deg, #9333ea, #a855f7)'
    }
  ];
}
