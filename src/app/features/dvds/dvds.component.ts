import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { DvdsService, DvdInput, DvdScanCandidate } from '../../core/services/dvds.service';
import { AuthService } from '../../core/services/auth.service';
import { DVD_GENRES, DvdFolder, DvdFormat, DvdGenre, DvdGenreMeta, DvdItem, CustomDvdGenre } from '../../core/models/dvd-item.model';

/** A scan result awaiting user review, with a local id so it can be edited/removed before saving. */
interface ScanRow extends DvdScanCandidate {
  rowId: string;
}

@Component({
  selector: 'app-dvds',
  standalone: true,
  imports: [],
  template: `
    <div class="dvds-page">

      <div class="page-header">
        <div class="page-icon">📀</div>
        <div>
          <h1 class="page-title">DVD Library</h1>
          <p class="page-count">{{ items().length }} disc{{ items().length !== 1 ? 's' : '' }} catalogued</p>
        </div>
      </div>

      <!-- Search -->
      <div class="search-bar">
        <span class="search-icon">🔎</span>
        <input [value]="searchQuery()" (input)="searchQuery.set($any($event.target).value)"
          type="text" placeholder="Search the library by title..." class="search-input" />
        @if (searchQuery()) {
          <button type="button" class="search-clear" (click)="searchQuery.set('')" title="Clear search">✕</button>
        }
      </div>

      <!-- Genres & folders -->
      @if (items().length > 0) {
        <div class="browse-card">
          <div class="browse-header">
            <h2 class="section-heading browse-heading">🎬 Genres</h2>
            @if (auth.canWrite()) {
              <button type="button" class="manage-link" (click)="showGenreManager.set(!showGenreManager())">
                {{ showGenreManager() ? 'Done' : '⚙️ Manage' }}
              </button>
            }
          </div>

          <div class="pill-row">
            <button type="button" class="pill" [class.active]="selectedGenre() === null" (click)="selectedGenre.set(null)">
              All <span class="pill-count">{{ items().length }}</span>
            </button>
            @for (g of allGenres(); track g.value) {
              @if (genreCount(g.value) > 0) {
                <button type="button" class="pill" [class.active]="selectedGenre() === g.value" (click)="selectedGenre.set(g.value)">
                  {{ g.icon }} {{ g.label }} <span class="pill-count">{{ genreCount(g.value) }}</span>
                </button>
              }
            }
          </div>

          @if (showGenreManager()) {
            <div class="manager">
              <ul class="manager-list">
                @for (g of allGenres(); track g.value) {
                  <li>
                    @if (editingGenreValue() === g.value) {
                      <div class="manager-edit-row">
                        <input [value]="editGenreIcon()" (input)="editGenreIcon.set($any($event.target).value)"
                          type="text" maxlength="4" class="icon-input" />
                        <input [value]="editGenreColor()" (input)="editGenreColor.set($any($event.target).value)"
                          type="color" class="color-input" />
                        <span class="manager-edit-label">{{ g.label }}</span>
                        <button type="button" class="btn-small" (click)="saveGenreEdit(g)">Save</button>
                        <button type="button" class="btn-small btn-cancel" (click)="editingGenreValue.set(null)">Cancel</button>
                      </div>
                    } @else {
                      <span class="manager-row-label">
                        <span class="swatch" [style.background]="g.color"></span>
                        {{ g.icon }} {{ g.label }}
                      </span>
                      <div class="manager-row-actions">
                        <button type="button" class="icon-btn" (click)="startGenreEdit(g)" title="Change icon/color">✏️</button>
                        @if (!g.builtIn) {
                          @if (genreInUse(g.value)) {
                            <span class="in-use" title="Used by an existing disc — remove or recategorize it first">in use</span>
                          } @else {
                            <button type="button" class="icon-btn" (click)="removeCustomGenre(g)" title="Remove genre">🗑️</button>
                          }
                        }
                      </div>
                    }
                  </li>
                }
              </ul>
              <div class="manager-add">
                <input [value]="newGenreIcon()" (input)="newGenreIcon.set($any($event.target).value)"
                  type="text" maxlength="4" placeholder="🏷️" class="icon-input" />
                <input [value]="newGenreColor()" (input)="newGenreColor.set($any($event.target).value)"
                  type="color" class="color-input" />
                <input [value]="newGenreLabel()" (input)="newGenreLabel.set($any($event.target).value)"
                  type="text" placeholder="New genre name" class="form-input" (keydown.enter)="addCustomGenre()" />
                <button type="button" class="btn-secondary" (click)="addCustomGenre()">Add</button>
              </div>
              @if (genreError()) { <p class="error-text">{{ genreError() }}</p> }
            </div>
          }

          <div class="browse-header folders-header">
            <h2 class="section-heading browse-heading">📁 Folders</h2>
            @if (auth.canWrite()) {
              <button type="button" class="manage-link" (click)="showFolderManager.set(!showFolderManager())">
                {{ showFolderManager() ? 'Done' : '⚙️ Manage' }}
              </button>
            }
          </div>

          <div class="pill-row">
            <button type="button" class="pill" [class.active]="selectedFolderId() === null" (click)="selectedFolderId.set(null)">
              All
            </button>
            <button type="button" class="pill" [class.active]="selectedFolderId() === 'unfiled'" (click)="selectedFolderId.set('unfiled')">
              📥 Unfiled
              @if (unfiledCount() > 0) { <span class="pill-count">{{ unfiledCount() }}</span> }
            </button>
            @for (f of customFolders(); track f.id) {
              <button type="button" class="pill" [class.active]="selectedFolderId() === f.id" (click)="selectedFolderId.set(f.id)">
                📁 {{ f.name }}
                @if (folderCount(f.id) > 0) { <span class="pill-count">{{ folderCount(f.id) }}</span> }
              </button>
            }
          </div>

          @if (showFolderManager()) {
            <div class="manager">
              <ul class="manager-list">
                @for (f of customFolders(); track f.id) {
                  <li>
                    <span>📁 {{ f.name }}</span>
                    @if (folderItemCount(f.id) === 0) {
                      <button type="button" class="icon-btn" (click)="deleteFolder(f)" title="Delete folder">🗑️</button>
                    } @else {
                      <span class="in-use">{{ folderItemCount(f.id) }} disc{{ folderItemCount(f.id) !== 1 ? 's' : '' }} — move out first</span>
                    }
                  </li>
                }
                @if (customFolders().length === 0) {
                  <li><span class="in-use">No folders yet.</span></li>
                }
              </ul>
              <div class="manager-add">
                <input [value]="newFolderName()" (input)="newFolderName.set($any($event.target).value)"
                  type="text" placeholder="New folder name" class="form-input" (keydown.enter)="addFolder()" />
                <button type="button" class="btn-secondary" (click)="addFolder()">Add</button>
              </div>
              @if (folderError()) { <p class="error-text">{{ folderError() }}</p> }
            </div>
          }
        </div>
      }

      <!-- Scan / add -->
      @if (auth.canWrite()) {
        <div class="scan-card">
          <div class="scan-entry">
            <button type="button" class="btn-scan" (click)="cameraInput.click()">📷 Take a photo</button>
            <button type="button" class="btn-scan" (click)="galleryInput.click()">🖼️ Choose photos</button>
            <button type="button" class="btn-secondary" (click)="showForm.set(!showForm())">
              {{ showForm() ? 'Cancel manual add' : '✏️ Add manually' }}
            </button>
            <input #cameraInput type="file" accept="image/*" capture="environment" (change)="onScanInputChange($event)" hidden />
            <input #galleryInput type="file" accept="image/*" multiple (change)="onScanInputChange($event)" hidden />
          </div>
          <p class="scan-hint">Photograph a cover for one disc, or a whole shelf of spines at once — AI will pick out every title it can see so you can confirm before saving.</p>

          <!-- Scan review -->
          @if (showScanPanel()) {
            <div class="scan-review">
              @if (dvdsService.scanning()) {
                <div class="scan-loading">🔍 Scanning... this can take a few seconds per photo.</div>
              }
              @if (dvdsService.scanError()) {
                <p class="error-text">{{ dvdsService.scanError() }}</p>
              }
              @if (scanResults().length > 0) {
                <h3 class="form-title">{{ scanResults().length }} film{{ scanResults().length !== 1 ? 's' : '' }} found — review before saving</h3>
                <div class="scan-rows">
                  @for (row of scanResults(); track row.rowId) {
                    <div class="scan-row">
                      <button type="button" class="scan-remove" (click)="removeScanRow(row.rowId)" title="Discard">✕</button>
                      <div class="scan-row-fields">
                        <input [value]="row.title" (input)="updateScanRow(row.rowId, { title: $any($event.target).value })"
                          type="text" placeholder="Title" class="form-input" />
                        <div class="form-row">
                          <input [value]="row.year ?? ''" (input)="updateScanRow(row.rowId, { year: $any($event.target).value ? +$any($event.target).value : undefined })"
                            type="number" placeholder="Year" class="form-input scan-year" />
                          <select [value]="row.genre" (change)="updateScanRow(row.rowId, { genre: $any($event.target).value })" class="form-input">
                            @for (g of allGenres(); track g.value) {
                              <option [value]="g.value">{{ g.icon }} {{ g.label }}</option>
                            }
                          </select>
                          <input [value]="row.director ?? ''" (input)="updateScanRow(row.rowId, { director: $any($event.target).value })"
                            type="text" placeholder="Director (optional)" class="form-input" />
                        </div>
                        <textarea [value]="row.summary" (input)="updateScanRow(row.rowId, { summary: $any($event.target).value })"
                          placeholder="Plot summary" class="form-input" rows="2"></textarea>
                      </div>
                    </div>
                  }
                </div>
                <div class="form-actions">
                  <button class="btn-secondary" (click)="cancelScan()">Discard all</button>
                  <button class="btn-primary" (click)="saveScanResults()" [disabled]="scanSaving()">
                    {{ scanSaving() ? 'Saving...' : 'Save ' + scanResults().length + ' to library' }}
                  </button>
                </div>
              } @else if (!dvdsService.scanning()) {
                <div class="form-actions">
                  <button class="btn-secondary" (click)="cancelScan()">Close</button>
                </div>
              }
            </div>
          }

          <!-- Manual add / edit form -->
          @if (showForm()) {
            <div class="manual-form" id="dvd-form" [class.just-opened]="formJustOpened()">
              <h3 class="form-title">{{ editingId() ? '✏️ Editing: ' + title() : 'Add a disc' }}</h3>

              <div class="form-group">
                <label>Title</label>
                <input [value]="title()" (input)="title.set($any($event.target).value)" type="text" placeholder="e.g. The Princess Bride" class="form-input" />
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Year <span class="label-hint">(optional)</span></label>
                  <input [value]="year()" (input)="year.set($any($event.target).value)" type="number" placeholder="e.g. 1987" class="form-input" />
                </div>
                <div class="form-group">
                  <label>Format</label>
                  <div class="status-toggle">
                    <button type="button" class="status-btn" [class.active]="format() === 'dvd'" (click)="format.set('dvd')">DVD</button>
                    <button type="button" class="status-btn" [class.active]="format() === 'bluray'" (click)="format.set('bluray')">Blu-ray</button>
                    <button type="button" class="status-btn" [class.active]="format() === 'boxset'" (click)="format.set('boxset')">Box set</button>
                  </div>
                </div>
              </div>

              <div class="form-group">
                <label>Genre</label>
                <select [value]="genre()" (change)="genre.set($any($event.target).value)" class="form-input">
                  @for (g of allGenres(); track g.value) {
                    <option [value]="g.value">{{ g.icon }} {{ g.label }}</option>
                  }
                </select>
              </div>

              <div class="form-group">
                <label>Director <span class="label-hint">(optional)</span></label>
                <input [value]="director()" (input)="director.set($any($event.target).value)" type="text" class="form-input" />
              </div>

              <div class="form-group">
                <label>Summary</label>
                <textarea [value]="summary()" (input)="summary.set($any($event.target).value)" placeholder="A short plot summary..." class="form-input" rows="3"></textarea>
              </div>

              @if (!editingId()) {
                <div class="form-group">
                  <label>Photo <span class="label-hint">(optional — a picture of this specific case)</span></label>
                  <div class="file-drop" [class.has-file]="selectedFile()" (click)="fileInput.click()">
                    @if (selectedFile()) {
                      <span>✅ {{ selectedFile()!.name }}</span>
                    } @else {
                      <span>📁 Choose a photo...</span>
                    }
                    <input #fileInput type="file" accept="image/*" (change)="onFileSelected($event)" hidden />
                  </div>
                </div>
              }

              @if (dvdsService.uploading()) {
                <div class="progress-bar">
                  <div class="progress-fill" [style.width.%]="dvdsService.uploadProgress()"></div>
                </div>
                <p class="progress-text">Uploading... {{ dvdsService.uploadProgress() }}%</p>
              }
              @if (formError()) { <p class="error-text">{{ formError() }}</p> }

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
          <p>Your account is waiting for approval. Once approved you'll be able to catalogue discs.</p>
        </div>
      } @else {
        <div class="signin-prompt">
          <span class="signin-icon">🔒</span>
          <p>Sign in with Google to catalogue discs.</p>
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

      <!-- Library grid -->
      @if (visibleItems().length > 0) {
        <div class="dvd-grid">
          @for (item of visibleItems(); track item.id) {
            <div class="dvd-card">
              <div class="dvd-poster" [style.background]="item.photoUrl ? null : genreBg(item.genre)" (click)="item.photoUrl ? lightboxItem.set(item) : null">
                @if (item.photoUrl) {
                  <img [src]="item.photoUrl" [alt]="item.title" loading="lazy" />
                } @else {
                  <span class="dvd-poster-icon">{{ genreMeta(item.genre).icon }}</span>
                }
                <span class="dvd-format-badge">{{ formatLabel(item.format) }}</span>
              </div>
              <div class="dvd-info">
                <h3 class="dvd-title">{{ item.title }}{{ item.year ? ' (' + item.year + ')' : '' }}</h3>
                <div class="dvd-genre-badge" [style.background]="genreBg(item.genre)" [style.color]="genreMeta(item.genre).color">
                  {{ genreMeta(item.genre).icon }} {{ genreMeta(item.genre).label }}
                </div>
                @if (item.director) { <p class="dvd-director">Dir. {{ item.director }}</p> }
                @if (item.summary) { <p class="dvd-summary">{{ item.summary }}</p> }
                @if (item.folderId) { <p class="dvd-folder">📁 {{ folderName(item.folderId) }}</p> }
              </div>
              @if (auth.canWrite()) {
                <div class="dvd-actions">
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
      } @else if (items().length > 0) {
        <p class="empty-state">No discs match your search/filters.</p>
      } @else {
        <p class="empty-state">No discs catalogued yet — scan a shelf or add one manually to get started.</p>
      }

      <!-- Photo lightbox -->
      @if (lightboxItem()) {
        <div class="lightbox" (click)="lightboxItem.set(null)">
          <div class="lightbox-content" (click)="$event.stopPropagation()">
            <button class="lightbox-close" (click)="lightboxItem.set(null)">✕</button>
            <img [src]="lightboxItem()!.photoUrl" [alt]="lightboxItem()!.title" />
            <div class="lightbox-caption">
              <h3>{{ lightboxItem()!.title }}</h3>
            </div>
          </div>
        </div>
      }

      <!-- Delete confirm -->
      @if (deletingItem()) {
        <div class="lightbox" (click)="deletingItem.set(null)">
          <div class="confirm-dialog" (click)="$event.stopPropagation()">
            <h3>Delete this disc?</h3>
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
    .dvds-page { max-width: 1000px; margin: 0 auto; }

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

    /* Search */
    .search-bar {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 0.65rem 1rem;
      margin-bottom: 1.5rem;
    }
    .search-icon { flex-shrink: 0; }
    .search-input {
      flex: 1;
      border: none;
      outline: none;
      background: none;
      color: var(--text-primary);
      font-size: 0.95rem;
      font-family: inherit;
    }
    .search-clear { background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 0.85rem; padding: 0.2rem; }
    .search-clear:hover { color: var(--text-primary); }

    /* Browse (genres/folders) */
    .browse-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.5rem;
    }
    .browse-header { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.85rem; }
    .folders-header { margin-top: 1.25rem; }
    .browse-heading { margin: 0 !important; }

    .pill-row { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .pill {
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
    .pill:hover { border-color: #dc2626; }
    .pill.active { background: #dc2626; border-color: #dc2626; color: white; }
    .pill-count {
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

    .manage-link {
      background: none; border: none; padding: 0; font-size: 0.78rem;
      color: var(--text-muted); cursor: pointer; text-decoration: underline;
    }
    .manage-link:hover { color: var(--text-secondary); }

    .manager {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.85rem 1rem;
      margin-top: 0.85rem;
    }
    .manager-list { list-style: none; margin: 0 0 0.75rem; padding: 0; }
    .manager-list li {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.3rem 0; font-size: 0.85rem; color: var(--text-primary);
      border-bottom: 1px solid var(--border);
    }
    .manager-list li:last-child { border-bottom: none; }
    .in-use { font-size: 0.72rem; color: var(--text-muted); font-style: italic; }
    .manager-row-label { display: flex; align-items: center; gap: 0.4rem; }
    .swatch { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .manager-row-actions { display: flex; align-items: center; gap: 0.15rem; }
    .icon-btn { background: none; border: none; cursor: pointer; font-size: 0.85rem; padding: 0.15rem 0.35rem; border-radius: 6px; transition: background 0.15s; }
    .icon-btn:hover { background: var(--hover); }
    .manager-edit-row { display: flex; align-items: center; gap: 0.4rem; flex: 1; }
    .manager-edit-label { font-size: 0.85rem; color: var(--text-secondary); flex: 1; }
    .manager-add { display: flex; gap: 0.5rem; align-items: center; }
    .icon-input {
      width: 44px; flex-shrink: 0; text-align: center; padding: 0.6rem 0.4rem;
      border: 1px solid var(--border); border-radius: 8px; background: var(--surface); font-size: 0.95rem;
    }
    .color-input { width: 34px; height: 32px; flex-shrink: 0; padding: 2px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); cursor: pointer; }
    .btn-small { padding: 0.3rem 0.7rem; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text-primary); font-size: 0.78rem; cursor: pointer; }
    .btn-small.btn-cancel { color: var(--text-muted); }

    /* Scan / add */
    .scan-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .scan-entry { display: flex; flex-wrap: wrap; gap: 0.75rem; }
    .btn-scan {
      padding: 0.6rem 1.2rem; background: #dc2626; color: white; border: none; border-radius: 8px;
      font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s;
    }
    .btn-scan:hover { opacity: 0.9; }
    .scan-hint { font-size: 0.82rem; color: var(--text-muted); margin: 0.6rem 0 0; }

    .scan-review { margin-top: 1.25rem; padding-top: 1.25rem; border-top: 1px solid var(--border); }
    .scan-loading { font-size: 0.9rem; color: var(--text-secondary); }
    .scan-rows { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem; }
    .scan-row {
      display: flex; gap: 0.5rem; align-items: flex-start;
      background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 0.85rem;
    }
    .scan-row-fields { flex: 1; display: flex; flex-direction: column; gap: 0.5rem; }
    .scan-year { max-width: 90px; flex: 0 0 auto; }
    .scan-remove {
      flex-shrink: 0; background: none; border: none; cursor: pointer; font-size: 0.85rem;
      color: var(--text-muted); padding: 0.2rem 0.35rem; border-radius: 6px;
    }
    .scan-remove:hover { background: #fee2e2; color: #dc2626; }

    .manual-form { margin-top: 1.25rem; padding-top: 1.25rem; border-top: 1px solid var(--border); scroll-margin-top: 5rem; }
    .manual-form.just-opened { animation: form-flash 1s ease-out; }
    @keyframes form-flash {
      0% { box-shadow: 0 0 0 3px var(--accent); background: var(--accent-subtle); }
      100% { box-shadow: 0 0 0 0px transparent; }
    }
    .form-title { font-size: 1.1rem; font-weight: 600; margin: 0 0 1rem; color: var(--text-primary); }

    .form-row { display: flex; gap: 1rem; }
    .form-row .form-group, .form-row .form-input { flex: 1; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.4rem; }
    .label-hint { font-weight: 400; color: var(--text-muted); font-size: 0.8rem; }

    .form-input {
      width: 100%; padding: 0.6rem 0.8rem; border: 1px solid var(--border); border-radius: 8px;
      background: var(--bg); color: var(--text-primary); font-size: 0.95rem; font-family: inherit;
      box-sizing: border-box; transition: border-color 0.2s; resize: vertical;
    }
    .form-input:focus { outline: none; border-color: #dc2626; }

    .status-toggle { display: flex; gap: 0.5rem; }
    .status-btn {
      flex: 1; padding: 0.6rem 0.8rem; border: 1px solid var(--border); border-radius: 8px;
      background: var(--bg); color: var(--text-secondary); font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.15s;
    }
    .status-btn.active { border-color: #dc2626; background: color-mix(in srgb, #dc2626 10%, var(--bg)); color: var(--text-primary); }

    .file-drop {
      padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px; cursor: pointer;
      background: var(--bg); color: var(--text-secondary); font-size: 0.9rem; transition: border-color 0.2s;
    }
    .file-drop:hover { border-color: #dc2626; }
    .file-drop.has-file { color: var(--text-primary); border-color: #dc2626; }

    .progress-bar { height: 6px; background: var(--border); border-radius: 3px; margin: 1rem 0 0.25rem; overflow: hidden; }
    .progress-fill { height: 100%; background: #dc2626; border-radius: 3px; transition: width 0.3s; }
    .progress-text { font-size: 0.85rem; color: var(--text-secondary); margin: 0 0 1rem; }
    .error-text { color: #ef4444; font-size: 0.85rem; margin: 0 0 1rem; }

    .form-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
    .btn-primary {
      padding: 0.6rem 1.4rem; background: #dc2626; color: white; border: none; border-radius: 8px;
      font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s;
    }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary:not(:disabled):hover { opacity: 0.9; }
    .btn-secondary {
      padding: 0.6rem 1.2rem; background: transparent; color: var(--text-secondary);
      border: 1px solid var(--border); border-radius: 8px; font-size: 0.9rem; cursor: pointer; transition: background 0.2s;
    }
    .btn-secondary:hover { background: var(--hover); }
    .btn-danger { padding: 0.6rem 1.4rem; background: #ef4444; color: white; border: none; border-radius: 8px; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
    .btn-danger:hover { background: #dc2626; }

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

    .section-heading {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }
    .empty-state { color: var(--text-muted); text-align: center; padding: 2rem; }

    /* Library grid */
    .dvd-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
      gap: 1.25rem;
    }
    .dvd-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .dvd-poster {
      position: relative;
      aspect-ratio: 2 / 3;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--hover);
    }
    .dvd-poster img { width: 100%; height: 100%; object-fit: cover; display: block; cursor: pointer; }
    .dvd-poster-icon { font-size: 2.5rem; }
    .dvd-format-badge {
      position: absolute; bottom: 6px; right: 6px; background: rgba(0,0,0,0.65); color: white;
      font-size: 0.6rem; font-weight: 700; letter-spacing: 0.03em; padding: 0.15rem 0.4rem; border-radius: 4px;
    }
    .dvd-info { padding: 0.85rem; flex: 1; display: flex; flex-direction: column; gap: 0.35rem; }
    .dvd-title { font-size: 0.92rem; font-weight: 600; margin: 0; color: var(--text-primary); line-height: 1.3; }
    .dvd-genre-badge {
      align-self: flex-start; font-size: 0.68rem; font-weight: 600; padding: 0.12rem 0.5rem; border-radius: 999px;
    }
    .dvd-director { font-size: 0.75rem; color: var(--text-muted); margin: 0; font-style: italic; }
    .dvd-summary {
      font-size: 0.78rem; color: var(--text-secondary); margin: 0; line-height: 1.4;
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
    }
    .dvd-folder { font-size: 0.72rem; color: var(--text-muted); margin: 0; }

    .dvd-actions { display: flex; align-items: center; gap: 0.15rem; padding: 0 0.85rem 0.85rem; }
    .folder-select {
      flex: 1; min-width: 0; padding: 0.3rem 0.4rem; border: 1px solid var(--border); border-radius: 6px;
      background: var(--surface); color: var(--text-secondary); font-size: 0.72rem; cursor: pointer;
    }
    .action-btn { background: none; border: none; font-size: 0.9rem; cursor: pointer; padding: 0.3rem 0.4rem; border-radius: 6px; transition: background 0.15s; flex-shrink: 0; }
    .action-btn:hover { background: var(--hover); }
    .action-btn.danger:hover { background: #fee2e2; }

    /* Lightbox */
    .lightbox {
      position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex;
      align-items: center; justify-content: center; z-index: 1000; padding: 1rem;
    }
    .lightbox-content { position: relative; max-width: 90vw; max-height: 90vh; background: var(--surface); border-radius: 16px; overflow: hidden; }
    .lightbox-content img { max-width: 90vw; max-height: 75vh; display: block; }
    .lightbox-close {
      position: absolute; top: 0.75rem; right: 0.75rem; background: rgba(0,0,0,0.5); color: white;
      border: none; width: 32px; height: 32px; border-radius: 50%; font-size: 1rem; cursor: pointer;
      z-index: 10; display: flex; align-items: center; justify-content: center;
    }
    .lightbox-caption { padding: 1rem 1.25rem; }
    .lightbox-caption h3 { margin: 0; font-size: 1rem; color: var(--text-primary); }

    .confirm-dialog { background: var(--surface); border-radius: 16px; padding: 2rem; max-width: 360px; width: 100%; text-align: center; }
    .confirm-dialog h3 { margin: 0 0 0.5rem; font-size: 1.1rem; color: var(--text-primary); }
    .confirm-dialog p { margin: 0 0 1.5rem; color: var(--text-secondary); font-size: 0.9rem; }
    .confirm-actions { display: flex; gap: 0.75rem; justify-content: center; }

    @media (max-width: 560px) {
      .form-row { flex-direction: column; gap: 0; }
      .dvd-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.85rem; }
    }
  `]
})
export class DvdsComponent implements OnInit {
  dvdsService = inject(DvdsService);
  auth = inject(AuthService);

  items = signal<DvdItem[]>([]);
  customGenres = signal<CustomDvdGenre[]>([]);
  customFolders = signal<DvdFolder[]>([]);

  allGenres = computed<DvdGenreMeta[]>(() => {
    const overrides = new Map(this.customGenres().map(g => [g.value, g]));
    const builtIns = DVD_GENRES.map(g => {
      const o = overrides.get(g.value);
      return o ? { value: g.value, label: g.label, icon: o.icon, color: o.color, builtIn: true } : g;
    });
    const customs = this.customGenres()
      .filter(g => !DVD_GENRES.some(b => b.value === g.value))
      .sort((a, b) => a.order - b.order)
      .map(g => ({ value: g.value, label: g.label, icon: g.icon, color: g.color, builtIn: false }));
    return [...builtIns, ...customs];
  });

  searchQuery = signal('');
  selectedGenre = signal<DvdGenre | null>(null);
  selectedFolderId = signal<string | 'unfiled' | null>(null);

  visibleItems = computed(() => {
    let list = this.items();
    const q = this.searchQuery().trim().toLowerCase();
    if (q) list = list.filter(i => i.title.toLowerCase().includes(q));

    const genre = this.selectedGenre();
    if (genre) list = list.filter(i => i.genre === genre);

    const folder = this.selectedFolderId();
    if (folder === 'unfiled') list = list.filter(i => !i.folderId);
    else if (folder) list = list.filter(i => i.folderId === folder);

    return list;
  });

  genreCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const item of this.items()) counts.set(item.genre, (counts.get(item.genre) ?? 0) + 1);
    return counts;
  });
  genreCount(value: string): number { return this.genreCounts().get(value) ?? 0; }

  folderCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const item of this.items()) {
      const key = item.folderId ?? '__unfiled__';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  });
  unfiledCount = computed(() => this.folderCounts().get('__unfiled__') ?? 0);
  folderCount(id: string): number { return this.folderCounts().get(id) ?? 0; }
  folderItemCount(id: string): number { return this.items().filter(i => i.folderId === id).length; }
  folderName(id: string): string { return this.customFolders().find(f => f.id === id)?.name ?? ''; }

  genreMeta(value: DvdGenre): DvdGenreMeta {
    return this.allGenres().find(g => g.value === value) ?? { value, label: value, icon: '📌', color: '#6b7280', builtIn: false };
  }
  genreBg(value: DvdGenre): string {
    return `color-mix(in srgb, ${this.genreMeta(value).color} 15%, var(--surface))`;
  }
  genreInUse(value: string): boolean {
    return this.items().some(i => i.genre === value);
  }

  formatLabel(format: DvdFormat): string {
    return format === 'bluray' ? 'Blu-ray' : format === 'boxset' ? 'Box set' : 'DVD';
  }

  // Genre manager
  showGenreManager = signal(false);
  newGenreLabel = signal('');
  newGenreIcon = signal('🏷️');
  newGenreColor = signal('#6b7280');
  genreError = signal('');
  editingGenreValue = signal<string | null>(null);
  editGenreIcon = signal('');
  editGenreColor = signal('#6b7280');

  startGenreEdit(g: DvdGenreMeta) {
    this.editingGenreValue.set(g.value);
    this.editGenreIcon.set(g.icon);
    this.editGenreColor.set(g.color);
  }

  async saveGenreEdit(g: DvdGenreMeta) {
    const icon = this.editGenreIcon().trim() || g.icon;
    const color = this.editGenreColor() || g.color;
    const existingOrder = this.customGenres().find(x => x.value === g.value)?.order ?? 0;
    await this.dvdsService.upsertGenre(g.value, g.label, icon, color, existingOrder);
    this.editingGenreValue.set(null);
  }

  private slugify(label: string): string {
    return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
  }

  async addCustomGenre() {
    const label = this.newGenreLabel().trim();
    if (!label) return;
    const value = this.slugify(label);
    if (!value) { this.genreError.set('Enter a valid genre name.'); return; }
    if (this.allGenres().some(g => g.value === value)) { this.genreError.set('That genre already exists.'); return; }

    this.genreError.set('');
    try {
      const order = await this.dvdsService.nextCustomGenreOrder();
      await this.dvdsService.upsertGenre(value, label, this.newGenreIcon().trim() || '🏷️', this.newGenreColor(), order);
      this.newGenreLabel.set('');
      this.newGenreIcon.set('🏷️');
      this.newGenreColor.set('#6b7280');
    } catch (err: any) {
      this.genreError.set(err.message);
    }
  }

  async removeCustomGenre(g: DvdGenreMeta) {
    if (g.builtIn || this.genreInUse(g.value)) return;
    await this.dvdsService.deleteGenre(g.value);
    if (this.genre() === g.value) this.genre.set('other');
  }

  // Folder manager
  showFolderManager = signal(false);
  newFolderName = signal('');
  folderError = signal('');

  async addFolder() {
    const name = this.newFolderName().trim();
    if (!name) return;
    if (this.customFolders().some(f => f.name.toLowerCase() === name.toLowerCase())) {
      this.folderError.set('A folder with that name already exists.');
      return;
    }
    this.folderError.set('');
    try {
      await this.dvdsService.addFolder(name);
      this.newFolderName.set('');
    } catch (err: any) {
      this.folderError.set(err.message);
    }
  }

  async deleteFolder(f: DvdFolder) {
    if (this.folderItemCount(f.id) > 0) return;
    await this.dvdsService.deleteFolder(f.id);
    if (this.selectedFolderId() === f.id) this.selectedFolderId.set(null);
  }

  async moveItem(item: DvdItem, folderId: string) {
    await this.dvdsService.moveToFolder(item.id, folderId || null);
  }

  // Scanning
  showScanPanel = signal(false);
  scanResults = signal<ScanRow[]>([]);
  scanSaving = signal(false);

  onScanInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    if (files.length) this.scanFiles(files);
  }

  async scanFiles(files: File[]) {
    this.showScanPanel.set(true);
    const found = await this.dvdsService.scanPhotos(files);
    const rows: ScanRow[] = found.map((c, i) => ({ ...c, rowId: `${Date.now()}-${i}` }));
    this.scanResults.update(existing => [...existing, ...rows]);
  }

  updateScanRow(rowId: string, updates: Partial<ScanRow>) {
    this.scanResults.update(rows => rows.map(r => r.rowId === rowId ? { ...r, ...updates } : r));
  }

  removeScanRow(rowId: string) {
    this.scanResults.update(rows => rows.filter(r => r.rowId !== rowId));
  }

  cancelScan() {
    this.showScanPanel.set(false);
    this.scanResults.set([]);
    this.dvdsService.scanError.set('');
  }

  async saveScanResults() {
    const rows = this.scanResults();
    if (!rows.length) return;
    this.scanSaving.set(true);
    const addedBy = this.auth.user()?.displayName || this.auth.user()?.email || undefined;
    try {
      for (const row of rows) {
        await this.dvdsService.addDvd({
          title: row.title.trim(),
          year: row.year,
          genre: row.genre,
          format: 'dvd',
          summary: row.summary.trim(),
          director: row.director?.trim() || undefined,
          addedBy,
        });
      }
      this.cancelScan();
    } catch (err: any) {
      this.dvdsService.scanError.set(err.message || 'Something went wrong saving those discs.');
    } finally {
      this.scanSaving.set(false);
    }
  }

  // Manual add / edit form
  showForm = signal(false);
  formJustOpened = signal(false);
  formError = signal('');
  editingId = signal<string | null>(null);
  selectedFile = signal<File | null>(null);
  deletingItem = signal<DvdItem | null>(null);
  lightboxItem = signal<DvdItem | null>(null);

  title = signal('');
  year = signal('');
  genre = signal<DvdGenre>('other');
  format = signal<DvdFormat>('dvd');
  director = signal('');
  summary = signal('');

  canSubmit = computed(() => this.title().trim().length > 0 && !this.dvdsService.uploading());

  ngOnInit() {
    this.dvdsService.getDvds().subscribe(items => this.items.set(items));
    this.dvdsService.getGenres().subscribe(genres => this.customGenres.set(genres));
    this.dvdsService.getFolders().subscribe(folders => this.customFolders.set(folders));
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.selectedFile.set(file);
  }

  startEdit(item: DvdItem) {
    this.editingId.set(item.id);
    this.title.set(item.title);
    this.year.set(item.year !== undefined ? String(item.year) : '');
    this.genre.set(item.genre);
    this.format.set(item.format);
    this.director.set(item.director ?? '');
    this.summary.set(item.summary || '');
    this.showForm.set(true);
    this.scrollToForm();
  }

  private scrollToForm() {
    this.formJustOpened.set(false);
    setTimeout(() => {
      document.getElementById('dvd-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.formJustOpened.set(true);
      setTimeout(() => this.formJustOpened.set(false), 1000);
    });
  }

  cancelForm() {
    this.showForm.set(false);
    this.editingId.set(null);
    this.selectedFile.set(null);
    this.title.set('');
    this.year.set('');
    this.genre.set('other');
    this.format.set('dvd');
    this.director.set('');
    this.summary.set('');
    this.formError.set('');
  }

  async submit() {
    if (!this.title().trim()) return;
    this.formError.set('');

    const parsedYear = this.year().trim() ? Number(this.year()) : undefined;

    if (this.editingId()) {
      try {
        await this.dvdsService.updateDvd(this.editingId()!, {
          title: this.title().trim(),
          genre: this.genre(),
          format: this.format(),
          summary: this.summary().trim(),
          director: this.director().trim() || undefined,
          ...(parsedYear !== undefined ? { year: parsedYear } : {}),
        });
        this.cancelForm();
      } catch (err: any) {
        this.formError.set(err.message);
      }
      return;
    }

    const addedBy = this.auth.user()?.displayName || this.auth.user()?.email || undefined;
    const input: DvdInput = {
      title: this.title().trim(),
      genre: this.genre(),
      format: this.format(),
      summary: this.summary().trim(),
      year: parsedYear,
      director: this.director().trim() || undefined,
      addedBy,
    };

    const file = this.selectedFile();
    if (file) {
      this.dvdsService.addDvdWithPhoto(input, file).subscribe({
        next: result => {
          if (result.error) this.formError.set(result.error);
          else if (result.progress === 100) this.cancelForm();
        },
        error: err => this.formError.set(err.message)
      });
    } else {
      try {
        await this.dvdsService.addDvd(input);
        this.cancelForm();
      } catch (err: any) {
        this.formError.set(err.message);
      }
    }
  }

  confirmDelete(item: DvdItem) {
    this.deletingItem.set(item);
  }

  async deleteItem() {
    const item = this.deletingItem();
    if (item) {
      await this.dvdsService.deleteDvd(item);
      this.deletingItem.set(null);
    }
  }
}
