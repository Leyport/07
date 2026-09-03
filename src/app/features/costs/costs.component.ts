import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CostsService } from '../../core/services/costs.service';
import { AuthService } from '../../core/services/auth.service';
import { COST_CATEGORIES, CostCategory, CostCategoryMeta, CostFolder, CostFrequency, CostItem, CostStatus, CustomCostCategory, CustomPayee } from '../../core/models/cost-item.model';

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
                <span class="breakdown-dot" [style.background]="categoryMeta(row.category).color"></span>
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

      <!-- Reports -->
      @if (categoryTotals().length > 0) {
        <div class="reports-card">
          <button type="button" class="reports-toggle" (click)="showReports.set(!showReports())">
            <span>📊 Spending reports</span>
            <span class="reports-toggle-chevron" [class.open]="showReports()">▾</span>
          </button>
          @if (showReports()) {
            <div class="reports-body">
              <div class="chart-section">
                <h3 class="chart-title">By category</h3>
                <div class="chart-bars">
                  @for (row of categoryTotals(); track row.category) {
                    <div class="chart-bar-row">
                      <div class="chart-bar-label" [title]="categoryMeta(row.category).label">{{ categoryMeta(row.category).icon }} {{ categoryMeta(row.category).label }}</div>
                      <div class="chart-bar-track">
                        <div class="chart-bar-fill"
                          [style.width.%]="barWidthPct(row.amount, categoryChartMax())"
                          [style.background]="categoryMeta(row.category).color"></div>
                      </div>
                      <div class="chart-bar-value">{{ formatAmount(row.amount) }}</div>
                    </div>
                  }
                </div>
              </div>

              @if (payeeChartData().length > 0) {
                <div class="chart-section">
                  <h3 class="chart-title">By payee</h3>
                  <div class="chart-bars">
                    @for (row of payeeChartData(); track row.key) {
                      <div class="chart-bar-row">
                        <div class="chart-bar-label" [title]="row.label">{{ row.label }}</div>
                        <div class="chart-bar-track">
                          <div class="chart-bar-fill"
                            [style.width.%]="barWidthPct(row.amount, payeeChartMax())"
                            [style.background]="row.colorSlot >= 0 ? 'var(--payee-slot-' + row.colorSlot + ')' : 'var(--payee-slot-none)'"></div>
                        </div>
                        <div class="chart-bar-value">{{ formatAmount(row.amount) }}</div>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- Folders -->
      @if (items().length > 0) {
        <div class="folders-card">
          <div class="folders-header">
            <h2 class="section-heading folders-heading">📁 Folders</h2>
            <div class="folders-header-actions">
              @if (auth.canWrite()) {
                <button type="button" class="manage-link" (click)="toggleSelectionMode()">
                  {{ selectionMode() ? 'Cancel select' : '☑️ Select bills' }}
                </button>
                <button type="button" class="manage-link" (click)="showFolderManager.set(!showFolderManager())">
                  {{ showFolderManager() ? 'Done' : '⚙️ Manage' }}
                </button>
              }
            </div>
          </div>

          <div class="folder-pills">
            <button type="button" class="folder-pill" [class.active]="selectedFolderId() === null" (click)="selectedFolderId.set(null)">
              All <span class="folder-pill-count">{{ items().length }}</span>
            </button>
            <button type="button" class="folder-pill" [class.active]="selectedFolderId() === 'unfiled'" (click)="selectedFolderId.set('unfiled')">
              📥 Unfiled
              @if (unfiledCount() > 0) { <span class="folder-pill-count">{{ unfiledCount() }}</span> }
              @if (unfiledTotal() > 0) { · {{ formatAmount(unfiledTotal()) }} }
            </button>
            @for (f of customFolders(); track f.id) {
              <button type="button" class="folder-pill" [class.active]="selectedFolderId() === f.id" (click)="selectedFolderId.set(f.id)">
                📁 {{ f.name }}
                @if (folderCount(f.id) > 0) { <span class="folder-pill-count">{{ folderCount(f.id) }}</span> }
                @if (folderTotal(f.id) > 0) { · {{ formatAmount(folderTotal(f.id)) }} }
              </button>
            }
          </div>

          @if (showFolderManager()) {
            <div class="category-manager">
              <ul class="category-list">
                @for (f of customFolders(); track f.id) {
                  <li>
                    <span>📁 {{ f.name }}</span>
                    @if (folderItemCount(f.id) === 0) {
                      <button type="button" class="category-remove" (click)="deleteFolder(f)" title="Delete folder">🗑️</button>
                    } @else {
                      <span class="category-in-use">{{ folderItemCount(f.id) }} item{{ folderItemCount(f.id) !== 1 ? 's' : '' }} — move out first</span>
                    }
                  </li>
                }
                @if (customFolders().length === 0) {
                  <li><span class="category-in-use">No folders yet.</span></li>
                }
              </ul>
              <div class="category-add">
                <input [value]="newFolderName()" (input)="newFolderName.set($any($event.target).value)"
                  type="text" placeholder="New folder name" class="form-input" (keydown.enter)="addFolder()" />
                <button type="button" class="btn-secondary" (click)="addFolder()">Add</button>
              </div>
              @if (folderError()) {
                <p class="error-text">{{ folderError() }}</p>
              }
            </div>
          }

          @if (selectionMode() && selectedItemIds().size > 0) {
            <div class="bulk-bar">
              <span>{{ selectedItemIds().size }} selected</span>
              <select [value]="bulkMoveTarget()" (change)="bulkMoveTarget.set($any($event.target).value)" class="form-input">
                <option value="">📥 Unfiled</option>
                @for (f of customFolders(); track f.id) {
                  <option [value]="f.id">📁 {{ f.name }}</option>
                }
              </select>
              <button type="button" class="btn-primary" (click)="bulkMove()">Move</button>
            </div>
          }
        </div>
      }

      <!-- Add form -->
      @if (auth.canWrite()) {
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

              <div class="form-row">
                <div class="form-group">
                  <label>Frequency</label>
                  <div class="status-toggle">
                    <button type="button" class="status-btn" [class.active]="frequency() === 'one-off'" (click)="frequency.set('one-off')">🔂 One-off</button>
                    <button type="button" class="status-btn" [class.active]="frequency() === 'periodic'" (click)="frequency.set('periodic')">🔁 Periodic</button>
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
                    @for (c of allCategories(); track c.value) {
                      <option [value]="c.value">{{ c.icon }} {{ c.label }}</option>
                    }
                  </select>
                  <button type="button" class="manage-link" (click)="showCategoryManager.set(!showCategoryManager())">
                    {{ showCategoryManager() ? 'Hide categories' : '⚙️ Manage categories' }}
                  </button>
                </div>
                <div class="form-group">
                  <label>{{ status() === 'paid' ? 'Amount paid (€)' : 'Estimated cost (€, optional)' }}</label>
                  <input [value]="amount()" (input)="amount.set($any($event.target).value)" type="number" min="0" step="0.01" placeholder="0.00" class="form-input" />
                </div>
              </div>

              @if (showCategoryManager()) {
                <div class="category-manager">
                  <ul class="category-list">
                    @for (c of allCategories(); track c.value) {
                      <li>
                        @if (editingCategoryValue() === c.value) {
                          <div class="category-edit-row">
                            <input [value]="editCategoryIcon()" (input)="editCategoryIcon.set($any($event.target).value)"
                              type="text" maxlength="4" class="category-icon-input" />
                            <input [value]="editCategoryColor()" (input)="editCategoryColor.set($any($event.target).value)"
                              type="color" class="category-color-input" />
                            <span class="category-edit-label">{{ c.label }}</span>
                            <button type="button" class="btn-small" (click)="saveCategoryEdit(c)">Save</button>
                            <button type="button" class="btn-small btn-cancel" (click)="editingCategoryValue.set(null)">Cancel</button>
                          </div>
                        } @else {
                          <span class="category-row-label">
                            <span class="category-swatch" [style.background]="c.color"></span>
                            {{ c.icon }} {{ c.label }}
                          </span>
                          <div class="category-row-actions">
                            <button type="button" class="category-edit-btn" (click)="startCategoryEdit(c)" title="Change icon/color">✏️</button>
                            @if (!c.builtIn) {
                              @if (categoryInUse(c.value)) {
                                <span class="category-in-use" title="Used by an existing item — remove or recategorize it first">in use</span>
                              } @else {
                                <button type="button" class="category-remove" (click)="removeCustomCategory(c)" title="Remove category">🗑️</button>
                              }
                            }
                          </div>
                        }
                      </li>
                    }
                  </ul>
                  <div class="category-add">
                    <input [value]="newCategoryIcon()" (input)="newCategoryIcon.set($any($event.target).value)"
                      type="text" maxlength="4" placeholder="🏷️" class="category-icon-input" />
                    <input [value]="newCategoryColor()" (input)="newCategoryColor.set($any($event.target).value)"
                      type="color" class="category-color-input" />
                    <input [value]="newCategoryLabel()" (input)="newCategoryLabel.set($any($event.target).value)"
                      type="text" placeholder="New category name" class="form-input" (keydown.enter)="addCustomCategory()" />
                    <button type="button" class="btn-secondary" (click)="addCustomCategory()">Add</button>
                  </div>
                  @if (categoryError()) {
                    <p class="error-text">{{ categoryError() }}</p>
                  }
                </div>
              }

              <div class="form-row">
                <div class="form-group">
                  <label>{{ status() === 'paid' ? 'Bill date' : 'Target date (optional)' }}</label>
                  <input [value]="date()" (input)="date.set($any($event.target).value)" type="text"
                    placeholder="e.g. 15/03/2024 — paste it straight from the bill" class="form-input" />
                  @if (date().trim()) {
                    @if (parsedDatePreview(); as preview) {
                      <p class="date-preview ok">✓ {{ preview }}</p>
                    } @else {
                      <p class="date-preview warn">Couldn't read that date — try dd/mm/yyyy</p>
                    }
                  }
                </div>
                <div class="form-group">
                  <label>Payee <span class="label-hint">(optional)</span></label>
                  <select [value]="payee()" (change)="payee.set($any($event.target).value)" class="form-input">
                    <option value="">—</option>
                    @for (p of customPayees(); track p.value) {
                      <option [value]="p.value">{{ p.name }}</option>
                    }
                  </select>
                  <button type="button" class="manage-link" (click)="showPayeeManager.set(!showPayeeManager())">
                    {{ showPayeeManager() ? 'Hide payees' : '⚙️ Manage payees' }}
                  </button>
                </div>
              </div>

              @if (showPayeeManager()) {
                <div class="category-manager">
                  <ul class="category-list">
                    @for (p of customPayees(); track p.value) {
                      <li>
                        <span>{{ p.name }}</span>
                        @if (payeeInUse(p.value)) {
                          <span class="category-in-use" title="Used by an existing item — remove or reassign it first">in use</span>
                        } @else {
                          <button type="button" class="category-remove" (click)="removePayee(p)" title="Remove payee">🗑️</button>
                        }
                      </li>
                    }
                    @if (customPayees().length === 0) {
                      <li><span class="category-in-use">No payees added yet.</span></li>
                    }
                  </ul>
                  <div class="category-add">
                    <input [value]="newPayeeName()" (input)="newPayeeName.set($any($event.target).value)"
                      type="text" placeholder="New payee name" class="form-input" (keydown.enter)="addPayee()" />
                    <button type="button" class="btn-secondary" (click)="addPayee()">Add</button>
                  </div>
                  @if (payeeError()) {
                    <p class="error-text">{{ payeeError() }}</p>
                  }
                </div>
              }

              <div class="form-group">
                <label>Contact name <span class="label-hint">(optional — who sent the bill)</span></label>
                <input [value]="contactName()" (input)="contactName.set($any($event.target).value)"
                  type="text" placeholder="e.g. EIRL Bottamedi" class="form-input" />
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Phone <span class="label-hint">(optional)</span></label>
                  <input [value]="contactPhone()" (input)="contactPhone.set($any($event.target).value)"
                    type="tel" placeholder="05 55 63 93 46" class="form-input" />
                </div>
                <div class="form-group">
                  <label>Email <span class="label-hint">(optional)</span></label>
                  <input [value]="contactEmail()" (input)="contactEmail.set($any($event.target).value)"
                    type="email" placeholder="contact@example.com" class="form-input" />
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
      } @else if (auth.user()) {
        <div class="signin-prompt">
          <span class="signin-icon">⏳</span>
          <p>Your account is waiting for approval. Once approved you'll be able to add bills and projects.</p>
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
      @if (visiblePlannedItems().length > 0) {
        <h2 class="section-heading">📋 Planned work</h2>
        <div class="items-list">
          @for (item of visiblePlannedItems(); track item.id) {
            <div class="cost-card planned">
              @if (selectionMode()) {
                <input type="checkbox" class="cost-select" [checked]="selectedItemIds().has(item.id)" (change)="toggleItemSelected(item.id)" />
              }
              <div class="cost-main">
                <div class="cost-category-badge" [style.background]="categoryBg(item.category)" [style.color]="categoryMeta(item.category).color">{{ categoryMeta(item.category).icon }} {{ categoryMeta(item.category).label }}</div>
                <span class="cost-frequency-badge" [class.periodic]="item.frequency === 'periodic'">{{ item.frequency === 'periodic' ? '🔁 Periodic' : '🔂 One-off' }}</span>
                <h3 class="cost-title">{{ item.title }}</h3>
                @if (item.notes) { <p class="cost-notes">{{ item.notes }}</p> }
                <div class="cost-meta">
                  @if (item.date) { <span>🎯 {{ item.date | date:'d MMM yyyy' }}</span> }
                  @if (item.amount) { <span>~{{ formatAmount(item.amount) }} estimated</span> }
                  @if (item.payee) { <span>👤 {{ payeeName(item.payee) }}</span> }
                  @if (item.folderId) { <span>📁 {{ folderName(item.folderId) }}</span> }
                </div>
                @if (item.contactName || item.contactPhone || item.contactEmail) {
                  <div class="cost-contact">
                    @if (item.contactName) { <span>{{ item.contactName }}</span> }
                    @if (item.contactPhone) { <a [href]="'tel:' + item.contactPhone" (click)="$event.stopPropagation()">📞 {{ item.contactPhone }}</a> }
                    @if (item.contactEmail) { <a [href]="'mailto:' + item.contactEmail" (click)="$event.stopPropagation()">✉️ {{ item.contactEmail }}</a> }
                  </div>
                }
              </div>
              @if (auth.canWrite()) {
                <div class="cost-actions">
                  <select class="folder-select" [value]="item.folderId || ''" (change)="moveItem(item, $any($event.target).value)" title="Move to folder">
                    <option value="">📥 Unfiled</option>
                    @for (f of customFolders(); track f.id) {
                      <option [value]="f.id">📁 {{ f.name }}</option>
                    }
                  </select>
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
      @if (visiblePaidItems().length > 0) {
        <h2 class="section-heading">🧾 Paid bills &amp; invoices</h2>
        <div class="items-list">
          @for (item of visiblePaidItems(); track item.id) {
            <div class="cost-card">
              @if (selectionMode()) {
                <input type="checkbox" class="cost-select" [checked]="selectedItemIds().has(item.id)" (change)="toggleItemSelected(item.id)" />
              }
              @if (item.attachmentUrl && item.attachmentType === 'image') {
                <div class="cost-thumb" (click)="lightboxItem.set(item)">
                  <img [src]="item.attachmentUrl" [alt]="item.title" loading="lazy" />
                </div>
              } @else if (item.attachmentUrl && item.thumbnailUrl) {
                <a class="cost-thumb pdf-preview" [href]="item.attachmentUrl" target="_blank" rel="noopener">
                  <img [src]="item.thumbnailUrl" [alt]="item.title" loading="lazy" />
                  <span class="pdf-badge">PDF</span>
                </a>
              } @else if (item.attachmentUrl) {
                <a class="cost-thumb pdf" [href]="item.attachmentUrl" target="_blank" rel="noopener">
                  <span class="pdf-icon">📄</span>
                  <span class="pdf-label">PDF</span>
                </a>
              }
              <div class="cost-main">
                <div class="cost-category-badge" [style.background]="categoryBg(item.category)" [style.color]="categoryMeta(item.category).color">{{ categoryMeta(item.category).icon }} {{ categoryMeta(item.category).label }}</div>
                <span class="cost-frequency-badge" [class.periodic]="item.frequency === 'periodic'">{{ item.frequency === 'periodic' ? '🔁 Periodic' : '🔂 One-off' }}</span>
                <h3 class="cost-title">{{ item.title }}</h3>
                @if (item.notes) { <p class="cost-notes">{{ item.notes }}</p> }
                <div class="cost-meta">
                  @if (item.date) { <span>{{ item.date | date:'d MMM yyyy' }}</span> }
                  @if (item.payee) { <span>👤 Paid by {{ payeeName(item.payee) }}</span> }
                  @if (item.uploadedBy) { <span>added by {{ item.uploadedBy }}</span> }
                  @if (item.folderId) { <span>📁 {{ folderName(item.folderId) }}</span> }
                </div>
                @if (item.contactName || item.contactPhone || item.contactEmail) {
                  <div class="cost-contact">
                    @if (item.contactName) { <span>{{ item.contactName }}</span> }
                    @if (item.contactPhone) { <a [href]="'tel:' + item.contactPhone" (click)="$event.stopPropagation()">📞 {{ item.contactPhone }}</a> }
                    @if (item.contactEmail) { <a [href]="'mailto:' + item.contactEmail" (click)="$event.stopPropagation()">✉️ {{ item.contactEmail }}</a> }
                  </div>
                }
              </div>
              <div class="cost-amount">{{ formatAmount(item.amount) }}</div>
              @if (auth.canWrite()) {
                <div class="cost-actions">
                  <select class="folder-select" [value]="item.folderId || ''" (change)="moveItem(item, $any($event.target).value)" title="Move to folder">
                    <option value="">📥 Unfiled</option>
                    @for (f of customFolders(); track f.id) {
                      <option [value]="f.id">📁 {{ f.name }}</option>
                    }
                  </select>
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
    .breakdown-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
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

    /* Reports — validated categorical palette for payees (no inherent color of their own);
       category bars reuse each category's own assigned color for consistency with its badge. */
    .reports-card {
      --payee-slot-0: #2a78d6; --payee-slot-1: #eb6834; --payee-slot-2: #1baf7a; --payee-slot-3: #eda100;
      --payee-slot-4: #e87ba4; --payee-slot-5: #008300; --payee-slot-6: #4a3aa7; --payee-slot-7: #e34948;
      --payee-slot-none: #9b9893;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      margin-bottom: 1.5rem;
      overflow: hidden;
    }
    @media (prefers-color-scheme: dark) {
      .reports-card {
        --payee-slot-0: #3987e5; --payee-slot-1: #d95926; --payee-slot-2: #199e70; --payee-slot-3: #c98500;
        --payee-slot-4: #d55181; --payee-slot-5: #008300; --payee-slot-6: #9085e9; --payee-slot-7: #e66767;
      }
    }

    .reports-toggle {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    .reports-toggle-chevron { color: var(--text-muted); transition: transform 0.2s; }
    .reports-toggle-chevron.open { transform: rotate(180deg); }

    .reports-body { padding: 0 1.5rem 1.5rem; }

    .chart-section + .chart-section { margin-top: 1.5rem; }
    .chart-title { font-size: 0.85rem; font-weight: 700; color: var(--text-secondary); margin: 0 0 0.75rem; }

    .chart-bars { display: flex; flex-direction: column; gap: 0.6rem; }
    .chart-bar-row { display: grid; grid-template-columns: 120px 1fr auto; align-items: center; gap: 0.6rem; }
    .chart-bar-label {
      font-size: 0.8rem;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .chart-bar-track { height: 20px; background: var(--hover); border-radius: 4px; overflow: hidden; }
    .chart-bar-fill { height: 100%; border-radius: 0 4px 4px 0; transition: width 0.4s ease; }
    .chart-bar-value {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      min-width: 64px;
      text-align: right;
    }

    @media (max-width: 560px) {
      .chart-bar-row { grid-template-columns: 84px 1fr auto; }
      .chart-bar-label { font-size: 0.72rem; }
    }

    /* Folders */
    .folders-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.5rem;
    }

    .folders-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 0.85rem;
    }
    .folders-heading { margin: 0 !important; }
    .folders-header-actions { display: flex; gap: 1rem; }

    .folder-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .folder-pill {
      padding: 0.4rem 1rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text-secondary);
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }
    .folder-pill:hover { border-color: #16a34a; }
    .folder-pill.active { background: #16a34a; border-color: #16a34a; color: white; }

    .folder-pill-count {
      display: inline-block;
      min-width: 1.1rem;
      padding: 0 0.3rem;
      margin-left: 0.3rem;
      border-radius: 999px;
      background: color-mix(in srgb, currentColor 15%, transparent);
      font-size: 0.72rem;
      font-weight: 700;
      line-height: 1.3rem;
      text-align: center;
    }

    .bulk-bar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-top: 1rem;
      padding: 0.75rem 1rem;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      font-size: 0.85rem;
      color: var(--text-secondary);
    }
    .bulk-bar select { flex: 1; max-width: 220px; }

    .cost-select {
      flex-shrink: 0;
      width: 18px;
      height: 18px;
      margin-right: 0.25rem;
      cursor: pointer;
      accent-color: #16a34a;
    }

    .folder-select {
      padding: 0.35rem 0.5rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface);
      color: var(--text-secondary);
      font-size: 0.78rem;
      max-width: 130px;
      cursor: pointer;
    }

    @media (max-width: 560px) {
      .folder-select { max-width: 100px; }
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
    .date-preview { font-size: 0.8rem; margin: 0.4rem 0 0; }
    .date-preview.ok { color: #16a34a; }
    .date-preview.warn { color: #ef4444; }

    .manage-link {
      display: block;
      margin-top: 0.4rem;
      background: none;
      border: none;
      padding: 0;
      font-size: 0.78rem;
      color: var(--text-muted);
      cursor: pointer;
      text-decoration: underline;
    }
    .manage-link:hover { color: var(--text-secondary); }

    .category-manager {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.85rem 1rem;
      margin: -0.25rem 0 1rem;
    }

    .category-list { list-style: none; margin: 0 0 0.75rem; padding: 0; }
    .category-list li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.3rem 0;
      font-size: 0.85rem;
      color: var(--text-primary);
      border-bottom: 1px solid var(--border);
    }
    .category-list li:last-child { border-bottom: none; }

    .category-in-use { font-size: 0.72rem; color: var(--text-muted); font-style: italic; }

    .category-row-label { display: flex; align-items: center; gap: 0.4rem; }
    .category-swatch { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .category-row-actions { display: flex; align-items: center; gap: 0.15rem; }

    .category-edit-btn {
      background: none; border: none; cursor: pointer; font-size: 0.8rem;
      padding: 0.15rem 0.35rem; border-radius: 6px; transition: background 0.15s;
    }
    .category-edit-btn:hover { background: var(--hover); }

    .category-edit-row { display: flex; align-items: center; gap: 0.4rem; flex: 1; }
    .category-edit-label { font-size: 0.85rem; color: var(--text-secondary); flex: 1; }

    .category-color-input {
      width: 34px;
      height: 32px;
      flex-shrink: 0;
      padding: 2px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface);
      cursor: pointer;
    }

    .category-remove {
      background: none; border: none; cursor: pointer; font-size: 0.9rem;
      padding: 0.15rem 0.35rem; border-radius: 6px; transition: background 0.15s;
    }
    .category-remove:hover { background: #fee2e2; }

    .category-add { display: flex; gap: 0.5rem; align-items: center; }
    .category-icon-input {
      width: 44px;
      flex-shrink: 0;
      text-align: center;
      padding: 0.6rem 0.4rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      font-size: 0.95rem;
    }

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

    .cost-thumb.pdf-preview { position: relative; display: block; }
    .pdf-badge {
      position: absolute;
      bottom: 3px;
      right: 3px;
      background: rgba(0,0,0,0.65);
      color: white;
      font-size: 0.55rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      padding: 0.1rem 0.3rem;
      border-radius: 4px;
    }

    .cost-main { flex: 1; min-width: 0; }

    .cost-category-badge {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.15rem 0.55rem;
      border-radius: 999px;
      margin-bottom: 0.35rem;
    }

    .cost-frequency-badge {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.15rem 0.55rem;
      border-radius: 999px;
      margin-left: 0.35rem;
      margin-bottom: 0.35rem;
      background: var(--hover);
      color: var(--text-muted);
    }
    .cost-frequency-badge.periodic { background: var(--accent-subtle); color: var(--accent); }

    .cost-title { font-size: 0.98rem; font-weight: 600; margin: 0 0 0.2rem; color: var(--text-primary); }
    .cost-notes { font-size: 0.85rem; color: var(--text-secondary); margin: 0 0 0.3rem; line-height: 1.4; }
    .cost-meta { display: flex; gap: 0.75rem; font-size: 0.78rem; color: var(--text-muted); }

    .cost-contact {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
      margin-top: 0.3rem;
      font-size: 0.78rem;
    }
    .cost-contact span { color: var(--text-secondary); font-weight: 600; }
    .cost-contact a { color: var(--accent); text-decoration: none; }
    .cost-contact a:hover { text-decoration: underline; }

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

  customCategories = signal<CustomCostCategory[]>([]);
  allCategories = computed<CostCategoryMeta[]>(() => {
    const overrides = new Map(this.customCategories().map(c => [c.value, c]));
    const builtIns = COST_CATEGORIES.map(c => {
      const o = overrides.get(c.value);
      return o ? { value: c.value, label: c.label, icon: o.icon, color: o.color, builtIn: true } : c;
    });
    const customs = this.customCategories()
      .filter(c => !COST_CATEGORIES.some(b => b.value === c.value))
      .sort((a, b) => a.order - b.order)
      .map(c => ({ value: c.value, label: c.label, icon: c.icon, color: c.color, builtIn: false }));
    return [...builtIns, ...customs];
  });

  items = signal<CostItem[]>([]);
  showForm = signal(false);
  isDragging = signal(false);
  selectedFile = signal<File | null>(null);
  formError = signal('');
  editingId = signal<string | null>(null);
  deletingItem = signal<CostItem | null>(null);
  lightboxItem = signal<CostItem | null>(null);

  showCategoryManager = signal(false);
  newCategoryLabel = signal('');
  newCategoryIcon = signal('🏷️');
  newCategoryColor = signal('#6b7280');
  categoryError = signal('');
  editingCategoryValue = signal<string | null>(null);
  editCategoryIcon = signal('');
  editCategoryColor = signal('#6b7280');

  customPayees = signal<CustomPayee[]>([]);
  showPayeeManager = signal(false);
  newPayeeName = signal('');
  payeeError = signal('');

  customFolders = signal<CostFolder[]>([]);
  selectedFolderId = signal<string | 'unfiled' | null>(null);
  showFolderManager = signal(false);
  newFolderName = signal('');
  folderError = signal('');

  selectionMode = signal(false);
  selectedItemIds = signal<Set<string>>(new Set());
  bulkMoveTarget = signal('');

  status = signal<CostStatus>('paid');
  frequency = signal<CostFrequency>('one-off');
  title = signal('');
  category = signal<CostCategory>('electricity');
  amount = signal('');
  date = signal('');
  payee = signal('');
  contactName = signal('');
  contactPhone = signal('');
  contactEmail = signal('');
  notes = signal('');

  paidItems = computed(() => this.items().filter(i => i.status === 'paid'));
  plannedItems = computed(() => this.items().filter(i => i.status === 'planned'));

  private filterByFolder(items: CostItem[]): CostItem[] {
    const sel = this.selectedFolderId();
    if (sel === null) return items;
    if (sel === 'unfiled') return items.filter(i => !i.folderId);
    return items.filter(i => i.folderId === sel);
  }

  visiblePaidItems = computed(() => this.filterByFolder(this.paidItems()));
  visiblePlannedItems = computed(() => this.filterByFolder(this.plannedItems()));

  folderTotals = computed(() => {
    const totals = new Map<string, number>();
    for (const item of this.paidItems()) {
      if (!item.amount) continue;
      const key = item.folderId ?? '__unfiled__';
      totals.set(key, (totals.get(key) ?? 0) + item.amount);
    }
    return totals;
  });

  unfiledTotal = computed(() => this.folderTotals().get('__unfiled__') ?? 0);

  folderTotal(folderId: string): number {
    return this.folderTotals().get(folderId) ?? 0;
  }

  /** Counts paid items only, matching the set that folderTotals/unfiledTotal sum up. */
  folderCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const item of this.paidItems()) {
      const key = item.folderId ?? '__unfiled__';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  });

  unfiledCount = computed(() => this.folderCounts().get('__unfiled__') ?? 0);

  folderCount(folderId: string): number {
    return this.folderCounts().get(folderId) ?? 0;
  }

  folderItemCount(folderId: string): number {
    return this.items().filter(i => i.folderId === folderId).length;
  }

  folderName(folderId: string): string {
    return this.customFolders().find(f => f.id === folderId)?.name ?? '';
  }

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

  categoryChartMax = computed(() => Math.max(1, ...this.categoryTotals().map(r => r.amount)));

  showReports = signal(true);

  /**
   * Grouped by payee, sorted by amount for display — but each payee's color slot is
   * assigned from their fixed registration order, never their rank here, so a payee's
   * color never changes as amounts shift. Unassigned/overflow bars are neutral gray,
   * never a categorical slot.
   */
  payeeChartData = computed(() => {
    const totals = new Map<string, number>();
    for (const item of this.paidItems()) {
      if (!item.amount) continue;
      const key = item.payee ?? '__unassigned__';
      totals.set(key, (totals.get(key) ?? 0) + item.amount);
    }

    const registrationOrder = this.customPayees();
    const rows = Array.from(totals.entries()).map(([key, amount]) => {
      if (key === '__unassigned__') {
        return { key, label: 'Unassigned', amount, colorSlot: -1 };
      }
      const idx = registrationOrder.findIndex(p => p.value === key);
      return { key, label: this.payeeName(key), amount, colorSlot: idx >= 0 ? idx % 8 : -1 };
    });

    rows.sort((a, b) => b.amount - a.amount);

    const MAX_BARS = 8;
    if (rows.length > MAX_BARS) {
      const head = rows.slice(0, MAX_BARS - 1);
      const tailAmount = rows.slice(MAX_BARS - 1).reduce((sum, r) => sum + r.amount, 0);
      head.push({ key: '__other__', label: 'Other', amount: tailAmount, colorSlot: -1 });
      return head;
    }
    return rows;
  });

  payeeChartMax = computed(() => Math.max(1, ...this.payeeChartData().map(r => r.amount)));

  barWidthPct(amount: number, max: number): number {
    return max > 0 ? Math.max(2, (amount / max) * 100) : 0;
  }

  canSubmit = computed(() => {
    const dateText = this.date().trim();
    const dateValid = !dateText || this.parseFlexibleDate(dateText) !== undefined;
    return this.title().trim().length > 0 && dateValid && !this.costsService.uploading();
  });

  ngOnInit() {
    this.costsService.getCosts().subscribe(items => this.items.set(items));
    this.costsService.getCategories().subscribe(categories => this.customCategories.set(categories));
    this.costsService.getPayees().subscribe(payees => this.customPayees.set(payees));
    this.costsService.getFolders().subscribe(folders => this.customFolders.set(folders));
  }

  async addFolder() {
    const name = this.newFolderName().trim();
    if (!name) return;
    if (this.customFolders().some(f => f.name.toLowerCase() === name.toLowerCase())) {
      this.folderError.set('A folder with that name already exists.');
      return;
    }
    this.folderError.set('');
    try {
      await this.costsService.addFolder(name);
      this.newFolderName.set('');
    } catch (err: any) {
      this.folderError.set(err.message);
    }
  }

  async deleteFolder(f: CostFolder) {
    if (this.folderItemCount(f.id) > 0) return;
    await this.costsService.deleteFolder(f.id);
    if (this.selectedFolderId() === f.id) this.selectedFolderId.set(null);
  }

  async moveItem(item: CostItem, folderId: string) {
    await this.costsService.moveToFolder(item.id, folderId || null);
  }

  toggleSelectionMode() {
    this.selectionMode.set(!this.selectionMode());
    this.selectedItemIds.set(new Set());
  }

  toggleItemSelected(id: string) {
    const next = new Set(this.selectedItemIds());
    if (next.has(id)) next.delete(id); else next.add(id);
    this.selectedItemIds.set(next);
  }

  async bulkMove() {
    const ids = Array.from(this.selectedItemIds());
    if (ids.length === 0) return;
    await this.costsService.moveManyToFolder(ids, this.bulkMoveTarget() || null);
    this.selectedItemIds.set(new Set());
    this.selectionMode.set(false);
    this.bulkMoveTarget.set('');
  }

  categoryMeta(value: CostCategory): CostCategoryMeta {
    return this.allCategories().find(c => c.value === value)
      ?? { value, label: value, icon: '📌', color: '#6b7280', builtIn: false };
  }

  categoryBg(value: CostCategory): string {
    return `color-mix(in srgb, ${this.categoryMeta(value).color} 15%, var(--surface))`;
  }

  payeeName(value: string): string {
    return this.customPayees().find(p => p.value === value)?.name ?? value;
  }

  payeeInUse(value: string): boolean {
    return this.items().some(i => i.payee === value);
  }

  private slugifyPayee(name: string): string {
    return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
  }

  async addPayee() {
    const name = this.newPayeeName().trim();
    if (!name) return;

    const value = this.slugifyPayee(name);
    if (!value) {
      this.payeeError.set('Enter a valid payee name.');
      return;
    }
    if (this.customPayees().some(p => p.value === value)) {
      this.payeeError.set('That payee already exists.');
      return;
    }

    this.payeeError.set('');
    try {
      const order = await this.costsService.nextPayeeOrder();
      await this.costsService.addPayee(value, name, order);
      this.newPayeeName.set('');
    } catch (err: any) {
      this.payeeError.set(err.message);
    }
  }

  async removePayee(p: CustomPayee) {
    if (this.payeeInUse(p.value)) return;
    await this.costsService.deletePayee(p.value);
    if (this.payee() === p.value) this.payee.set('');
  }

  categoryInUse(value: string): boolean {
    return this.items().some(i => i.category === value);
  }

  startCategoryEdit(c: CostCategoryMeta) {
    this.editingCategoryValue.set(c.value);
    this.editCategoryIcon.set(c.icon);
    this.editCategoryColor.set(c.color);
  }

  async saveCategoryEdit(c: CostCategoryMeta) {
    const icon = this.editCategoryIcon().trim() || c.icon;
    const color = this.editCategoryColor() || c.color;
    const existingOrder = this.customCategories().find(x => x.value === c.value)?.order ?? 0;
    await this.costsService.upsertCategory(c.value, c.label, icon, color, existingOrder);
    this.editingCategoryValue.set(null);
  }

  private slugifyCategory(label: string): string {
    return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
  }

  async addCustomCategory() {
    const label = this.newCategoryLabel().trim();
    if (!label) return;

    const value = this.slugifyCategory(label);
    if (!value) {
      this.categoryError.set('Enter a valid category name.');
      return;
    }
    if (this.allCategories().some(c => c.value === value)) {
      this.categoryError.set('That category already exists.');
      return;
    }

    this.categoryError.set('');
    try {
      const order = await this.costsService.nextCustomCategoryOrder();
      await this.costsService.upsertCategory(value, label, this.newCategoryIcon().trim() || '🏷️', this.newCategoryColor(), order);
      this.newCategoryLabel.set('');
      this.newCategoryIcon.set('🏷️');
      this.newCategoryColor.set('#6b7280');
    } catch (err: any) {
      this.categoryError.set(err.message);
    }
  }

  async removeCustomCategory(cat: CostCategoryMeta) {
    if (cat.builtIn || this.categoryInUse(cat.value)) return;
    await this.costsService.deleteCategory(cat.value);
    if (this.category() === cat.value) this.category.set('electricity');
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
    this.frequency.set(item.frequency ?? 'one-off');
    this.title.set(item.title);
    this.category.set(item.category);
    this.amount.set(item.amount !== undefined ? String(item.amount) : '');
    this.date.set(item.date ? this.toDateDisplayValue(item.date) : '');
    this.payee.set(item.payee ?? '');
    this.contactName.set(item.contactName ?? '');
    this.contactPhone.set(item.contactPhone ?? '');
    this.contactEmail.set(item.contactEmail ?? '');
    this.notes.set(item.notes || '');
    this.showForm.set(true);
  }

  markDone(item: CostItem) {
    this.editingId.set(item.id);
    this.status.set('paid');
    this.frequency.set(item.frequency ?? 'one-off');
    this.title.set(item.title);
    this.category.set(item.category);
    this.amount.set(item.amount !== undefined ? String(item.amount) : '');
    this.date.set(item.date ? this.toDateDisplayValue(item.date) : this.toDateDisplayValue(new Date()));
    this.payee.set(item.payee ?? '');
    this.contactName.set(item.contactName ?? '');
    this.contactPhone.set(item.contactPhone ?? '');
    this.contactEmail.set(item.contactEmail ?? '');
    this.notes.set(item.notes || '');
    this.showForm.set(true);
  }

  private toDateDisplayValue(date: Date): string {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${d.getFullYear()}`;
  }

  /** Accepts dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, yyyy-mm-dd, or anything Date can natively parse (e.g. "15 March 2024") — pasted straight from a bill. */
  private parseFlexibleDate(input: string): Date | undefined {
    const trimmed = input.trim();
    if (!trimmed) return undefined;

    const dmy = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (dmy) {
      const day = Number(dmy[1]);
      const month = Number(dmy[2]);
      const year = Number(dmy[3]) < 100 ? Number(dmy[3]) + 2000 : Number(dmy[3]);
      const d = new Date(year, month - 1, day);
      return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day ? d : undefined;
    }

    const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
      const year = Number(iso[1]);
      const month = Number(iso[2]);
      const day = Number(iso[3]);
      const d = new Date(year, month - 1, day);
      return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day ? d : undefined;
    }

    const native = new Date(trimmed);
    return isNaN(native.getTime()) ? undefined : native;
  }

  parsedDatePreview = computed(() => {
    const parsed = this.parseFlexibleDate(this.date());
    return parsed
      ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed)
      : null;
  });

  cancelForm() {
    this.showForm.set(false);
    this.editingId.set(null);
    this.selectedFile.set(null);
    this.status.set('paid');
    this.frequency.set('one-off');
    this.title.set('');
    this.category.set('electricity');
    this.amount.set('');
    this.date.set('');
    this.payee.set('');
    this.contactName.set('');
    this.contactPhone.set('');
    this.contactEmail.set('');
    this.notes.set('');
    this.formError.set('');
  }

  async submit() {
    if (!this.title().trim()) return;
    this.formError.set('');

    const parsedAmount = this.amount().trim() ? Number(this.amount()) : undefined;
    const parsedDate = this.parseFlexibleDate(this.date());

    if (this.editingId()) {
      try {
        await this.costsService.updateCost(this.editingId()!, {
          title: this.title().trim(),
          category: this.category(),
          status: this.status(),
          frequency: this.frequency(),
          notes: this.notes().trim(),
          ...(parsedAmount !== undefined ? { amount: parsedAmount } : {}),
          ...(parsedDate ? { date: parsedDate } : {}),
          ...(this.payee() ? { payee: this.payee() } : {}),
          ...(this.contactName() ? { contactName: this.contactName().trim() } : {}),
          ...(this.contactPhone() ? { contactPhone: this.contactPhone().trim() } : {}),
          ...(this.contactEmail() ? { contactEmail: this.contactEmail().trim() } : {}),
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
      frequency: this.frequency(),
      currency: 'EUR',
      notes: this.notes().trim(),
      amount: parsedAmount,
      date: parsedDate,
      payee: this.payee() || undefined,
      contactName: this.contactName().trim() || undefined,
      contactPhone: this.contactPhone().trim() || undefined,
      contactEmail: this.contactEmail().trim() || undefined,
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
