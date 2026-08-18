import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CostsService } from '../../core/services/costs.service';
import { AuthService } from '../../core/services/auth.service';
import { COST_CATEGORIES, CostCategory, CostItem, CostStatus } from '../../core/models/cost-item.model';

@Component({
  selector: 'app-costs',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="costs-page">

      <div class="page-header">
        <div class="page-icon">💶</div>
        <div>
          <h1 class="page-title">Costs &amp; Projects</h1>
          <p class="page-count">
            Bills, renovation invoices, and jobs that still need doing
          </p>
        </div>
      </div>

      <!-- Summary -->
      <div class="summary-card">
        <div class="summary-total">
          <span class="summary-total-label">Total paid</span>
          <span class="summary-total-value">{{ formatAmount(totalPaid()) }}</span>
        </div>
        @if (categoryTotals().length > 0) {
          <div class="summary-breakdown">
            @for (row of categoryTotals(); track row.category) {
              <div class="breakdown-row">
                <span class="breakdown-icon">{{ categoryMeta(row.category).icon }}</span>
                <span class="breakdown-label">{{ categoryMeta(row.category).label }}</span>
                <span class="breakdown-amount">{{ formatAmount(row.amount) }}</span>
              </div>
            }
          </div>
        }
        @if (plannedItems().length > 0) {
          <div class="summary-planned">
            📋 {{ plannedItems().length }} job{{ plannedItems().length !== 1 ? 's' : '' }} still to do
            @if (plannedEstimateTotal() > 0) {
              — roughly {{ formatAmount(plannedEstimateTotal()) }} estimated
            }
          </div>
        }
      </div>

      <!-- Add form -->
      @if (auth.user()) {
        <div class="upload-area" [class.dragover]="isDragging()"
             (dragover)="onDragOver($event)" (dragleave)="isDragging.set(false)" (drop)="onDrop($event)">
          @if (!showForm()) {
            <div class="upload-prompt" (click)="showForm.set(true)">
              <div class="upload-icon">🧾</div>
              <p class="upload-text">Add a bill, invoice, or job</p>
              <p class="upload-hint">or drag a bill/invoice file here</p>
            </div>
          } @else {
            <div class="upload-form">
              <h3 class="form-title">{{ editingId() ? 'Edit item' : 'Add a bill or project' }}</h3>

              <div class="form-row">
                <div class="form-group">
                  <label>Status</label>
                  <div class="status-toggle">
                    <button type="button" class="status-btn" [class.active]="status() === 'paid'" (click)="status.set('paid')">✅ Already paid</button>
                    <button type="button" class="status-btn" [class.active]="status() === 'planned'" (click)="status.set('planned')">📋 Planned / to do</button>
                  </div>
                </div>
              </div>

              <div class="form-group">
                <label>Title</label>
                <input [value]="title()" (input)="title.set($any($event.target).value)" type="text"
                  [placeholder]="status() === 'paid' ? 'e.g. Electricity bill — March 2024' : 'e.g. Reroof the barn'" class="form-input" />
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Category</label>
                  <select [value]="category()" (change)="category.set($any($event.target).value)" class="form-input">
                    @for (c of categories; track c.value) {
                      <option [value]="c.value">{{ c.icon }} {{ c.label }}</option>
                    }
                  </select>
                </div>
                <div class="form-group">
                  <label>{{ status() === 'paid' ? 'Amount paid (€)' : 'Estimated cost (€, optional)' }}</label>
                  <input [value]="amount()" (input)="amount.set($any($event.target).value)" type="number" min="0" step="0.01" placeholder="0.00" class="form-input" />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>{{ status() === 'paid' ? 'Bill date' : 'Target date (optional)' }}</label>
                  <input [value]="date()" (input)="date.set($any($event.target).value)" type="date" class="form-input" />
                </div>
              </div>

              <div class="form-group">
                <label>Notes <span class="label-hint">(optional)</span></label>
                <textarea [value]="notes()" (input)="notes.set($any($event.target).value)" placeholder="Any extra details..." class="form-input" rows="2"></textarea>
              </div>

              @if (!editingId()) {
                <div class="form-group">
                  <label>Bill / invoice <span class="label-hint">(optional — photo or PDF)</span></label>
                  <div class="file-drop" [class.has-file]="selectedFile()" (click)="fileInput.click()">
                    @if (selectedFile()) {
                      <span>✅ {{ selectedFile()!.name }}</span>
                    } @else {
                      <span>📁 Choose a file...</span>
                    }
                    <input #fileInput type="file" accept="image/*,application/pdf" (change)="onFileSelected($event)" hidden />
                  </div>
                </div>
              }

              @if (costsService.uploading()) {
                <div class="progress-bar">
                  <div class="progress-fill" [style.width.%]="costsService.uploadProgress()"></div>
                </div>
                <p class="progress-text">Uploading... {{ costsService.uploadProgress() }}%</p>
              }
              @if (formError()) {
                <p class="error-text">{{ formError() }}</p>
              }
              @if (!canSubmit() && !costsService.uploading() && !title().trim()) {
                <p class="hint-text">Add a title to continue.</p>
              }

              <div class="form-actions">
                <button class="btn-secondary" (click)="cancelForm()">Cancel</button>
                <button class="btn-primary" (click)="submit()" [disabled]="!canSubmit()">
                  {{ editingId() ? 'Save' : 'Add' }}
                </button>
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="signin-prompt">
          <span class="signin-icon">🔒</span>
          <p>Sign in with Google to add bills and projects.</p>
          <button class="btn-signin" (click)="auth.signInWithGoogle()">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
        </div>
      }

      <!-- Planned work -->
      @if (plannedItems().length > 0) {
        <h2 class="section-heading">📋 Planned work</h2>
        <div class="items-list">
          @for (item of plannedItems(); track item.id) {
            <div class="cost-card planned">
              <div class="cost-main">
                <div class="cost-category-badge">{{ categoryMeta(item.category).icon }} {{ categoryMeta(item.category).label }}</div>
                <h3 class="cost-title">{{ item.title }}</h3>
                @if (item.notes) { <p class="cost-notes">{{ item.notes }}</p> }
                <div class="cost-meta">
                  @if (item.date) { <span>🎯 {{ item.date | date:'d MMM yyyy' }}</span> }
                  @if (item.amount) { <span>~{{ formatAmount(item.amount) }} estimated</span> }
                </div>
              </div>
              @if (auth.user()) {
                <div class="cost-actions">
                  <button class="action-btn done" (click)="markDone(item)" title="Mark as done">✅ Done</button>
                  <button class="action-btn" (click)="startEdit(item)" title="Edit">✏️</button>
                  <button class="action-btn danger" (click)="confirmDelete(item)" title="Delete">🗑️</button>
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- Paid bills / invoices -->
      @if (paidItems().length > 0) {
        <h2 class="section-heading">🧾 Paid bills &amp; invoices</h2>
        <div class="items-list">
          @for (item of paidItems(); track item.id) {
            <div class="cost-card">
              @if (item.attachmentUrl && item.attachmentType === 'image') {
                <div class="cost-thumb" (click)="lightboxItem.set(item)">
                  <img [src]="item.attachmentUrl" [alt]="item.title" loading="lazy" />
                </div>
              } @else if (item.attachmentUrl) {
                <a class="cost-thumb pdf" [href]="item.attachmentUrl" target="_blank" rel="noopener">
                  <span class="pdf-icon">📄</span>
                  <span class="pdf-label">PDF</span>
                </a>
              }
              <div class="cost-main">
                <div class="cost-category-badge">{{ categoryMeta(item.category).icon }} {{ categoryMeta(item.category).label }}</div>
                <h3 class="cost-title">{{ item.title }}</h3>
                @if (item.notes) { <p class="cost-notes">{{ item.notes }}</p> }
                <div class="cost-meta">
                  @if (item.date) { <span>{{ item.date | date:'d MMM yyyy' }}</span> }
                  @if (item.uploadedBy) { <span>by {{ item.uploadedBy }}</span> }
                </div>
              </div>
              <div class="cost-amount">{{ formatAmount(item.amount) }}</div>
              @if (auth.user()) {
                <div class="cost-actions">
                  <button class="action-btn" (click)="startEdit(item)" title="Edit">✏️</button>
                  <button class="action-btn danger" (click)="confirmDelete(item)" title="Delete">🗑️</button>
                </div>
              }
            </div>
          }
        </div>
      }

      @if (items().length === 0) {
        <p class="empty-state">No costs recorded yet.</p>
      }

      <!-- Attachment lightbox -->
      @if (lightboxItem()) {
        <div class="lightbox" (click)="lightboxItem.set(null)">
          <div class="lightbox-content" (click)="$event.stopPropagation()">
            <button class="lightbox-close" (click)="lightboxItem.set(null)">✕</button>
            <img [src]="lightboxItem()!.attachmentUrl" [alt]="lightboxItem()!.title" />
            <div class="lightbox-caption">
              <h3>{{ lightboxItem()!.title }}</h3>
              <p>{{ formatAmount(lightboxItem()!.amount) }}</p>
            </div>
          </div>
        </div>
      }

      <!-- Delete confirm -->
      @if (deletingItem()) {
        <div class="lightbox" (click)="deletingItem.set(null)">
          <div class="confirm-dialog" (click)="$event.stopPropagation()">
            <h3>Delete this item?</h3>
            <p>This cannot be undone.</p>
            <div class="confirm-actions">
              <button class="btn-secondary" (click)="deletingItem.set(null)">Cancel</button>
              <button class="btn-danger" (click)="deleteItem()">Delete</button>
            </div>
          </div>
        </div>
      }

    </div>
  `,
  styles: [`
    .costs-page { max-width: 900px; margin: 0 auto; }

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

    /* Summary */
    .summary-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .summary-total { display: flex; align-items: baseline; gap: 0.75rem; margin-bottom: 0.5rem; }
    .summary-total-label { font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
    .summary-total-value { font-family: 'Playfair Display', Georgia, serif; font-size: 2rem; font-weight: 700; color: var(--text-primary); }

    .summary-breakdown {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1.25rem;
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--border);
    }

    .breakdown-row { display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--text-secondary); }
    .breakdown-icon { font-size: 0.95rem; }
    .breakdown-label { color: var(--text-muted); }
    .breakdown-amount { font-weight: 600; color: var(--text-primary); }

    .summary-planned {
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--border);
      font-size: 0.85rem;
      color: var(--text-secondary);
    }

    /* Upload area (shared visual language with Photos/Section) */
    .upload-area {
      background: var(--surface);
      border: 2px dashed var(--border);
      border-radius: 16px;
      margin-bottom: 2rem;
      transition: border-color 0.2s;
    }
    .upload-area.dragover { border-color: #16a34a; background: color-mix(in srgb, #16a34a 5%, var(--surface)); }
    .upload-prompt { padding: 2.5rem; text-align: center; cursor: pointer; }
    .upload-prompt:hover .upload-icon { transform: scale(1.1); }
    .upload-icon { font-size: 2.5rem; transition: transform 0.2s; }
    .upload-text { font-size: 1rem; font-weight: 600; color: var(--text-primary); margin: 0.5rem 0 0.25rem; }
    .upload-hint { font-size: 0.85rem; color: var(--text-muted); margin: 0; }

    .upload-form { padding: 1.5rem; }
    .form-title { font-size: 1.1rem; font-weight: 600; margin: 0 0 1rem; color: var(--text-primary); }

    .form-row { display: flex; gap: 1rem; }
    .form-row .form-group { flex: 1; }

    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.4rem; }
    .label-hint { font-weight: 400; color: var(--text-muted); font-size: 0.8rem; }

    .form-input {
      width: 100%;
      padding: 0.6rem 0.8rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg);
      color: var(--text-primary);
      font-size: 0.95rem;
      font-family: inherit;
      box-sizing: border-box;
      transition: border-color 0.2s;
      resize: vertical;
    }
    .form-input:focus { outline: none; border-color: #16a34a; }

    .status-toggle { display: flex; gap: 0.5rem; }
    .status-btn {
      flex: 1;
      padding: 0.6rem 0.8rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg);
      color: var(--text-secondary);
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .status-btn.active { border-color: #16a34a; background: color-mix(in srgb, #16a34a 10%, var(--bg)); color: var(--text-primary); }

    .file-drop {
      padding: 0.75rem 1rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      cursor: pointer;
      background: var(--bg);
      color: var(--text-secondary);
      font-size: 0.9rem;
      transition: border-color 0.2s;
    }
    .file-drop:hover { border-color: #16a34a; }
    .file-drop.has-file { color: var(--text-primary); border-color: #16a34a; }

    .progress-bar { height: 6px; background: var(--border); border-radius: 3px; margin: 1rem 0 0.25rem; overflow: hidden; }
    .progress-fill { height: 100%; background: #16a34a; border-radius: 3px; transition: width 0.3s; }
    .progress-text { font-size: 0.85rem; color: var(--text-secondary); margin: 0 0 1rem; }
    .error-text { color: #ef4444; font-size: 0.85rem; margin: 0 0 1rem; }
    .hint-text { color: var(--text-muted); font-size: 0.85rem; margin: 0 0 1rem; }

    .form-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }

    .btn-primary {
      padding: 0.6rem 1.4rem; background: #16a34a; color: white; border: none; border-radius: 8px;
      font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s;
    }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary:not(:disabled):hover { opacity: 0.9; }

    .btn-secondary {
      padding: 0.6rem 1.2rem; background: transparent; color: var(--text-secondary);
      border: 1px solid var(--border); border-radius: 8px; font-size: 0.9rem; cursor: pointer; transition: background 0.2s;
    }
    .btn-secondary:hover { background: var(--hover); }

    /* Sign-in prompt */
    .signin-prompt {
      display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
      padding: 2rem; margin-bottom: 2rem; background: var(--surface); border: 1px solid var(--border);
      border-radius: 16px; text-align: center;
    }
    .signin-icon { font-size: 2rem; }
    .signin-prompt p { margin: 0; color: var(--text-secondary); font-size: 0.95rem; }
    .btn-signin {
      display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1.2rem; border: 1px solid var(--border);
      border-radius: 8px; background: var(--surface); color: var(--text-primary); font-size: 0.875rem;
      font-weight: 500; cursor: pointer; transition: background 0.2s;
    }
    .btn-signin:hover { background: var(--hover); }

    /* Section heading */
    .section-heading {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 1.3rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 2rem 0 1rem;
    }

    .empty-state { color: var(--text-muted); text-align: center; padding: 2rem; }

    /* Item list */
    .items-list { display: flex; flex-direction: column; gap: 0.75rem; }

    .cost-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1rem;
    }

    .cost-card.planned { border-style: dashed; }

    .cost-thumb {
      flex-shrink: 0;
      width: 64px;
      height: 64px;
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      background: var(--hover);
    }
    .cost-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .cost-thumb.pdf {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-decoration: none; color: var(--text-secondary); gap: 0.15rem;
    }
    .pdf-icon { font-size: 1.5rem; }
    .pdf-label { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.05em; }

    .cost-main { flex: 1; min-width: 0; }

    .cost-category-badge {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 0.25rem;
    }

    .cost-title { font-size: 0.98rem; font-weight: 600; margin: 0 0 0.2rem; color: var(--text-primary); }
    .cost-notes { font-size: 0.85rem; color: var(--text-secondary); margin: 0 0 0.3rem; line-height: 1.4; }
    .cost-meta { display: flex; gap: 0.75rem; font-size: 0.78rem; color: var(--text-muted); }

    .cost-amount {
      flex-shrink: 0;
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
    }

    .cost-actions { display: flex; gap: 0.15rem; flex-shrink: 0; }

    .action-btn {
      background: none; border: none; font-size: 0.95rem; cursor: pointer;
      padding: 0.35rem 0.45rem; border-radius: 6px; transition: background 0.15s;
    }
    .action-btn:hover { background: var(--hover); }
    .action-btn.danger:hover { background: #fee2e2; }
    .action-btn.done { font-size: 0.8rem; font-weight: 600; padding: 0.35rem 0.6rem; }

    @media (max-width: 560px) {
      .cost-card { flex-wrap: wrap; }
      .cost-amount { order: 3; }
      .cost-actions { order: 4; margin-left: auto; }
      .form-row { flex-direction: column; gap: 0; }
    }

    /* Lightbox */
    .lightbox {
      position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex;
      align-items: center; justify-content: center; z-index: 1000; padding: 1rem;
    }
    .lightbox-content {
      position: relative; max-width: 90vw; max-height: 90vh; background: var(--surface);
      border-radius: 16px; overflow: hidden;
    }
    .lightbox-content img { max-width: 90vw; max-height: 75vh; display: block; }
    .lightbox-close {
      position: absolute; top: 0.75rem; right: 0.75rem; background: rgba(0,0,0,0.5); color: white;
      border: none; width: 32px; height: 32px; border-radius: 50%; font-size: 1rem; cursor: pointer;
      z-index: 10; display: flex; align-items: center; justify-content: center;
    }
    .lightbox-caption { padding: 1rem 1.25rem; }
    .lightbox-caption h3 { margin: 0 0 0.25rem; font-size: 1rem; color: var(--text-primary); }
    .lightbox-caption p { margin: 0; font-size: 0.875rem; color: var(--text-secondary); }

    .confirm-dialog { background: var(--surface); border-radius: 16px; padding: 2rem; max-width: 360px; width: 100%; text-align: center; }
    .confirm-dialog h3 { margin: 0 0 0.5rem; font-size: 1.1rem; color: var(--text-primary); }
    .confirm-dialog p { margin: 0 0 1.5rem; color: var(--text-secondary); font-size: 0.9rem; }
    .confirm-actions { display: flex; gap: 0.75rem; justify-content: center; }
    .btn-danger { padding: 0.6rem 1.4rem; background: #ef4444; color: white; border: none; border-radius: 8px; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
    .btn-danger:hover { background: #dc2626; }
  `]
})
export class CostsComponent implements OnInit {
  costsService = inject(CostsService);
  auth = inject(AuthService);

  categories = COST_CATEGORIES;

  items = signal<CostItem[]>([]);
  showForm = signal(false);
  isDragging = signal(false);
  selectedFile = signal<File | null>(null);
  formError = signal('');
  editingId = signal<string | null>(null);
  deletingItem = signal<CostItem | null>(null);
  lightboxItem = signal<CostItem | null>(null);

  status = signal<CostStatus>('paid');
  title = signal('');
  category = signal<CostCategory>('electricity');
  amount = signal('');
  date = signal('');
  notes = signal('');

  paidItems = computed(() => this.items().filter(i => i.status === 'paid'));
  plannedItems = computed(() => this.items().filter(i => i.status === 'planned'));

  totalPaid = computed(() =>
    this.paidItems().reduce((sum, i) => sum + (i.amount ?? 0), 0)
  );

  plannedEstimateTotal = computed(() =>
    this.plannedItems().reduce((sum, i) => sum + (i.amount ?? 0), 0)
  );

  categoryTotals = computed(() => {
    const totals = new Map<CostCategory, number>();
    for (const item of this.paidItems()) {
      if (!item.amount) continue;
      totals.set(item.category, (totals.get(item.category) ?? 0) + item.amount);
    }
    return Array.from(totals.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  });

  canSubmit = computed(() =>
    this.title().trim().length > 0 && !this.costsService.uploading()
  );

  ngOnInit() {
    this.costsService.getCosts().subscribe(items => this.items.set(items));
  }

  categoryMeta(value: CostCategory) {
    return this.categories.find(c => c.value === value) ?? this.categories[this.categories.length - 1];
  }

  formatAmount(amount?: number): string {
    if (amount === undefined || amount === null) return '—';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) {
      this.selectedFile.set(file);
      this.fillTitleFromFile(file);
      this.showForm.set(true);
    }
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.selectedFile.set(file);
      this.fillTitleFromFile(file);
    }
  }

  private fillTitleFromFile(file: File) {
    if (this.title().trim()) return;
    this.title.set(file.name.replace(/\.[^.]+$/, ''));
  }

  startEdit(item: CostItem) {
    this.editingId.set(item.id);
    this.status.set(item.status);
    this.title.set(item.title);
    this.category.set(item.category);
    this.amount.set(item.amount !== undefined ? String(item.amount) : '');
    this.date.set(item.date ? this.toDateInputValue(item.date) : '');
    this.notes.set(item.notes || '');
    this.showForm.set(true);
  }

  markDone(item: CostItem) {
    this.editingId.set(item.id);
    this.status.set('paid');
    this.title.set(item.title);
    this.category.set(item.category);
    this.amount.set(item.amount !== undefined ? String(item.amount) : '');
    this.date.set(item.date ? this.toDateInputValue(item.date) : this.toDateInputValue(new Date()));
    this.notes.set(item.notes || '');
    this.showForm.set(true);
  }

  private toDateInputValue(date: Date): string {
    const d = new Date(date);
    return d.toISOString().slice(0, 10);
  }

  cancelForm() {
    this.showForm.set(false);
    this.editingId.set(null);
    this.selectedFile.set(null);
    this.status.set('paid');
    this.title.set('');
    this.category.set('electricity');
    this.amount.set('');
    this.date.set('');
    this.notes.set('');
    this.formError.set('');
  }

  async submit() {
    if (!this.title().trim()) return;
    this.formError.set('');

    const parsedAmount = this.amount().trim() ? Number(this.amount()) : undefined;
    const parsedDate = this.date() ? new Date(this.date()) : undefined;

    if (this.editingId()) {
      try {
        await this.costsService.updateCost(this.editingId()!, {
          title: this.title().trim(),
          category: this.category(),
          status: this.status(),
          notes: this.notes().trim(),
          ...(parsedAmount !== undefined ? { amount: parsedAmount } : {}),
          ...(parsedDate ? { date: parsedDate } : {}),
        });
        this.cancelForm();
      } catch (err: any) {
        this.formError.set(err.message);
      }
      return;
    }

    const uploadedBy = this.auth.user()?.displayName || this.auth.user()?.email || undefined;

    this.costsService.addCost({
      title: this.title().trim(),
      category: this.category(),
      status: this.status(),
      currency: 'EUR',
      notes: this.notes().trim(),
      amount: parsedAmount,
      date: parsedDate,
      uploadedBy,
    }, this.selectedFile()).subscribe({
      next: result => {
        if (result.error) this.formError.set(result.error);
        else if (result.progress === 100) this.cancelForm();
      },
      error: err => this.formError.set(err.message)
    });
  }

  confirmDelete(item: CostItem) {
    this.deletingItem.set(item);
  }

  async deleteItem() {
    const item = this.deletingItem();
    if (item) {
      await this.costsService.deleteCost(item);
      this.deletingItem.set(null);
    }
  }
}
