import { Component, computed, inject, input, output, signal, HostListener } from '@angular/core';
import { DvdsService } from '../../core/services/dvds.service';
import { AuthService } from '../../core/services/auth.service';
import { DvdItem, DvdViewing } from '../../core/models/dvd-item.model';

/** 'YYYY-MM-DD' in the viewer's own timezone (toISOString would shift it to UTC). */
function localIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Dialog listing who watched a disc and what they thought, with an add/edit form for editors. */
@Component({
  selector: 'app-dvd-viewings',
  standalone: true,
  template: `
    <div class="backdrop" (click)="closed.emit()">
      <div class="dialog" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">

        <div class="head">
          @if (item().photoUrl) { <img [src]="item().photoUrl" alt="" /> }
          <div class="head-text">
            <h3>{{ item().title }}{{ item().year ? ' (' + item().year + ')' : '' }}</h3>
            <p class="stats">
              @if (viewings().length) {
                {{ viewings().length }} viewing{{ viewings().length !== 1 ? 's' : '' }}
                · ★ {{ averageRating() }} average
                · {{ watchAgainCount() }} of {{ viewings().length }} would watch again
              } @else {
                Nobody has logged a viewing yet.
              }
            </p>
          </div>
          <button type="button" class="close" (click)="closed.emit()" title="Close">✕</button>
        </div>

        @if (viewings().length) {
          <ul class="list">
            @for (v of viewings(); track v.id) {
              <li [class.editing]="editingId() === v.id">
                <div class="row-top">
                  <strong>{{ v.watchedBy }}</strong>
                  <span class="stars" [title]="v.rating + ' out of 5'">{{ stars(v.rating) }}</span>
                  <span class="date">{{ formatDate(v.date) }}</span>
                </div>
                <div class="again" [class.no]="!v.watchAgain">
                  @if (v.watchAgain) { 🔁 Would watch again } @else { ✋ Wouldn't watch again }
                </div>
                @if (v.notes) { <p class="notes">“{{ v.notes }}”</p> }
                @if (auth.canWrite()) {
                  <div class="row-actions">
                    @if (confirmDeleteId() === v.id) {
                      <span>Delete this viewing?</span>
                      <button type="button" class="link danger" (click)="remove(v)" [disabled]="saving()">Delete</button>
                      <button type="button" class="link" (click)="confirmDeleteId.set(null)">Cancel</button>
                    } @else {
                      <button type="button" class="link" (click)="startEdit(v)">Edit</button>
                      <button type="button" class="link" (click)="confirmDeleteId.set(v.id)">Delete</button>
                    }
                  </div>
                }
              </li>
            }
          </ul>
        }

        @if (auth.canWrite()) {
          <form class="form" (submit)="$event.preventDefault(); save()">
            <h4>{{ editingId() ? 'Edit viewing' : 'Log a viewing' }}</h4>
            <div class="grid">
              <label>Who watched it
                <input type="text" list="dvd-viewer-names" [value]="watchedBy()" (input)="watchedBy.set(val($event))" placeholder="e.g. Mark" />
              </label>
              <label>Date watched
                <input type="date" [value]="date()" (input)="date.set(val($event))" [max]="today" />
              </label>
            </div>
            <datalist id="dvd-viewer-names">
              @for (n of knownNames(); track n) { <option [value]="n"></option> }
            </datalist>

            <div class="field">
              <span class="label">Rating</span>
              <div class="star-picker">
                @for (s of [1, 2, 3, 4, 5]; track s) {
                  <button type="button" [class.on]="s <= rating()" (click)="rating.set(s)" [title]="s + ' out of 5'">★</button>
                }
              </div>
            </div>

            <div class="field">
              <span class="label">Would they watch it again?</span>
              <div class="toggle">
                <button type="button" [class.active]="watchAgain() === true" (click)="watchAgain.set(true)">Yes</button>
                <button type="button" [class.active]="watchAgain() === false" (click)="watchAgain.set(false)">No</button>
              </div>
            </div>

            <label><span>What did they think? <span class="hint">(optional)</span></span>
              <textarea rows="2" [value]="notes()" (input)="notes.set(val($event))" placeholder="Loved the ending, a bit long in the middle..."></textarea>
            </label>

            @if (error()) { <p class="error">{{ error() }}</p> }
            <div class="actions">
              @if (editingId()) {
                <button type="button" class="btn-secondary" (click)="resetForm()">Cancel edit</button>
              }
              <button type="submit" class="btn-primary" [disabled]="saving()">
                {{ saving() ? 'Saving…' : editingId() ? 'Save changes' : 'Add viewing' }}
              </button>
            </div>
          </form>
        }
      </div>
    </div>
  `,
  styles: [`
    .backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1000;
      display: flex; align-items: center; justify-content: center; padding: 1rem;
    }
    .dialog {
      background: var(--surface); color: var(--text-primary); border-radius: 16px;
      width: 100%; max-width: 540px; max-height: 90vh; overflow-y: auto; padding: 1.25rem 1.4rem;
      box-sizing: border-box;
    }
    .head { display: flex; gap: 0.85rem; align-items: flex-start; margin-bottom: 1rem; }
    .head img { width: 52px; aspect-ratio: 2 / 3; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
    .head-text { flex: 1; min-width: 0; }
    .head h3 { margin: 0 0 0.25rem; font-size: 1.1rem; }
    .stats { margin: 0; font-size: 0.82rem; color: var(--text-secondary); }
    .close {
      background: var(--hover); border: none; width: 30px; height: 30px; border-radius: 50%;
      cursor: pointer; color: var(--text-secondary); flex-shrink: 0;
    }

    .list { list-style: none; margin: 0 0 1rem; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
    .list li { background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 0.7rem 0.85rem; }
    .list li.editing { border-color: #dc2626; }
    .row-top { display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; }
    .stars { color: #f59e0b; letter-spacing: 0.05em; }
    .date { margin-left: auto; font-size: 0.78rem; color: var(--text-muted); }
    .again { font-size: 0.8rem; color: #16a34a; margin-top: 0.2rem; }
    .again.no { color: var(--text-muted); }
    .notes { margin: 0.35rem 0 0; font-size: 0.85rem; color: var(--text-secondary); font-style: italic; white-space: pre-line; }
    .row-actions { display: flex; gap: 0.6rem; align-items: center; margin-top: 0.4rem; font-size: 0.78rem; color: var(--text-muted); }
    .link { background: none; border: none; padding: 0; cursor: pointer; color: var(--text-muted); text-decoration: underline; font-size: 0.78rem; }
    .link:hover { color: var(--text-primary); }
    .link.danger { color: #ef4444; }

    .form { border-top: 1px solid var(--border); padding-top: 1rem; display: flex; flex-direction: column; gap: 0.8rem; }
    .form h4 { margin: 0; font-size: 0.95rem; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    label, .label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.82rem; font-weight: 600; color: var(--text-secondary); }
    .hint { font-weight: 400; color: var(--text-muted); }
    input, textarea {
      padding: 0.55rem 0.7rem; border: 1px solid var(--border); border-radius: 8px; background: var(--bg);
      color: var(--text-primary); font-size: 0.92rem; font-family: inherit; box-sizing: border-box; width: 100%;
    }
    textarea { resize: vertical; }
    input:focus, textarea:focus { outline: none; border-color: #dc2626; }
    .field { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; }

    .star-picker { display: flex; gap: 0.1rem; }
    .star-picker button {
      background: none; border: none; cursor: pointer; font-size: 1.6rem; line-height: 1;
      color: var(--border); padding: 0 0.1rem; transition: color 0.1s, transform 0.1s;
    }
    .star-picker button.on { color: #f59e0b; }
    .star-picker button:hover { transform: scale(1.15); }

    .toggle { display: flex; gap: 0.4rem; }
    .toggle button {
      padding: 0.4rem 1rem; border: 1px solid var(--border); border-radius: 8px; background: var(--bg);
      color: var(--text-secondary); font-weight: 600; cursor: pointer;
    }
    .toggle button.active { border-color: #dc2626; background: color-mix(in srgb, #dc2626 10%, var(--bg)); color: var(--text-primary); }

    .error { color: #ef4444; font-size: 0.85rem; margin: 0; }
    .actions { display: flex; justify-content: flex-end; gap: 0.6rem; }
    .btn-primary {
      padding: 0.55rem 1.3rem; background: #dc2626; color: white; border: none; border-radius: 8px;
      font-size: 0.9rem; font-weight: 600; cursor: pointer;
    }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary {
      padding: 0.55rem 1.1rem; background: transparent; color: var(--text-secondary);
      border: 1px solid var(--border); border-radius: 8px; font-size: 0.9rem; cursor: pointer;
    }

    @media (max-width: 480px) {
      .grid { grid-template-columns: 1fr; }
    }
  `]
})
export class DvdViewingsComponent {
  private dvdsService = inject(DvdsService);
  auth = inject(AuthService);

  item = input.required<DvdItem>();
  /** Everyone who's logged a viewing on any disc, for the "who watched" suggestions. */
  knownNames = input<string[]>([]);
  closed = output<void>();

  readonly today = localIsoDate(new Date());

  viewings = computed(() => [...(this.item().viewings ?? [])].sort((a, b) => b.date.localeCompare(a.date)));
  averageRating = computed(() => {
    const v = this.viewings();
    return v.length ? (v.reduce((sum, x) => sum + x.rating, 0) / v.length).toFixed(1) : '';
  });
  watchAgainCount = computed(() => this.viewings().filter(v => v.watchAgain).length);

  editingId = signal<string | null>(null);
  watchedBy = signal('');
  date = signal(this.today);
  rating = signal(0);
  watchAgain = signal<boolean | null>(null);
  notes = signal('');
  saving = signal(false);
  error = signal('');
  confirmDeleteId = signal<string | null>(null);

  @HostListener('document:keydown.escape')
  onEscape() { this.closed.emit(); }

  val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  stars(rating: number): string {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  formatDate(date: string): string {
    return new Date(date + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  startEdit(v: DvdViewing) {
    this.editingId.set(v.id);
    this.watchedBy.set(v.watchedBy);
    this.date.set(v.date);
    this.rating.set(v.rating);
    this.watchAgain.set(v.watchAgain);
    this.notes.set(v.notes ?? '');
    this.error.set('');
    this.confirmDeleteId.set(null);
  }

  resetForm() {
    this.editingId.set(null);
    this.watchedBy.set('');
    this.date.set(this.today);
    this.rating.set(0);
    this.watchAgain.set(null);
    this.notes.set('');
    this.error.set('');
  }

  async save() {
    const watchedBy = this.watchedBy().trim();
    const date = this.date();
    const rating = this.rating();
    const watchAgain = this.watchAgain();
    const notes = this.notes().trim();
    if (!watchedBy) { this.error.set('Who watched it?'); return; }
    if (!date) { this.error.set('When did they watch it?'); return; }
    if (!rating) { this.error.set('Pick a rating from 1 to 5 stars.'); return; }
    if (watchAgain === null) { this.error.set('Would they watch it again?'); return; }

    const current = this.item().viewings ?? [];
    const editingId = this.editingId();
    const original = editingId ? current.find(v => v.id === editingId) : undefined;
    const addedBy = original ? original.addedBy : (this.auth.user()?.displayName || this.auth.user()?.email || undefined);
    // Firestore rejects undefined values, so optional fields are left out rather than set to undefined.
    const viewing: DvdViewing = {
      id: editingId ?? crypto.randomUUID(),
      date, watchedBy, rating, watchAgain,
      ...(notes ? { notes } : {}),
      ...(addedBy ? { addedBy } : {}),
    };
    const next = original ? current.map(v => v.id === editingId ? viewing : v) : [...current, viewing];

    this.saving.set(true);
    this.error.set('');
    try {
      await this.dvdsService.setViewings(this.item().id, next);
      this.resetForm();
    } catch (err: any) {
      this.error.set(err.message || 'Could not save that viewing.');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(v: DvdViewing) {
    this.saving.set(true);
    try {
      await this.dvdsService.setViewings(this.item().id, (this.item().viewings ?? []).filter(x => x.id !== v.id));
      this.confirmDeleteId.set(null);
      if (this.editingId() === v.id) this.resetForm();
    } catch (err: any) {
      this.error.set(err.message || 'Could not delete that viewing.');
    } finally {
      this.saving.set(false);
    }
  }
}
