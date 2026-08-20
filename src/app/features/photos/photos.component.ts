import { Component, inject, signal, computed, OnInit, HostListener } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MediaService } from '../../core/services/media.service';
import { AuthService } from '../../core/services/auth.service';
import { MediaItem } from '../../core/models/media-item.model';

@Component({
  selector: 'app-photos',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="photos-page">

      <div class="page-header">
        <div class="page-icon">📸</div>
        <div>
          <h1 class="page-title">Photos</h1>
          <p class="page-count">
            @if (mediaItems().length > 0) {
              @if (selectedYear() !== null) {
                {{ filteredItems().length }} from {{ selectedYear() }}
                <button type="button" class="clear-filter" (click)="selectedYear.set(null)">· show all {{ mediaItems().length }}</button>
              } @else {
                {{ mediaItems().length }} photo{{ mediaItems().length !== 1 ? 's' : '' }} & video{{ mediaItems().length !== 1 ? 's' : '' }}
              }
            } @else {
              No photos yet
            }
          </p>
        </div>
      </div>

      @if (availableYears().length > 1) {
        <div class="year-filter">
          <button type="button" class="year-pill" [class.active]="selectedYear() === null" (click)="selectedYear.set(null)">
            All
          </button>
          @for (y of availableYears(); track y) {
            <button type="button" class="year-pill" [class.active]="selectedYear() === y" (click)="selectedYear.set(y)">
              {{ y }}
            </button>
          }
        </div>
      }

      <!-- Upload area — shown only to approved users -->
      @if (auth.canWrite()) {
        <div class="upload-area" [class.dragover]="isDragging()"
             (dragover)="onDragOver($event)" (dragleave)="isDragging.set(false)" (drop)="onDrop($event)">
          @if (!showUploadForm()) {
            <div class="upload-prompt" (click)="showUploadForm.set(true)">
              <div class="upload-icon">📎</div>
              <p class="upload-text">Click to add photos or videos</p>
              <p class="upload-hint">or drag and drop here</p>
            </div>
          } @else {
            <div class="upload-form">
              <h3 class="form-title">Add photos or videos</h3>
              <div class="form-group">
                <label>Description <span class="label-hint">(applied to all)</span></label>
                <textarea [value]="uploadDescription()" (input)="uploadDescription.set($any($event.target).value)"
                  placeholder="What are these photos of?" class="form-input" rows="2"></textarea>
              </div>
              <div class="form-group">
                <label>Files</label>
                <div class="file-drop" [class.has-file]="selectedFiles().length > 0" (click)="fileInput.click()">
                  @if (selectedFiles().length > 0) {
                    <span>✅ {{ selectedFiles().length }} file{{ selectedFiles().length !== 1 ? 's' : '' }} selected</span>
                  } @else {
                    <span>📁 Choose photos or videos…</span>
                  }
                  <input #fileInput type="file" accept="image/*,video/*" multiple (change)="onFileSelected($event)" hidden />
                </div>
                @if (selectedFiles().length > 1) {
                  <ul class="file-list">
                    @for (f of selectedFiles(); track f.name) {
                      <li>{{ f.name }}</li>
                    }
                  </ul>
                }
              </div>
              @if (mediaService.uploading()) {
                <div class="progress-bar">
                  <div class="progress-fill" [style.width.%]="mediaService.uploadProgress()"></div>
                </div>
                <p class="progress-text">
                  Uploading {{ uploadingIndex() + 1 }} of {{ selectedFiles().length }}… {{ mediaService.uploadProgress() }}%
                </p>
              }
              @if (uploadError()) {
                <p class="error-text">{{ uploadError() }}</p>
              }
              <div class="form-actions">
                <button class="btn-secondary" (click)="cancelUpload()">Cancel</button>
                <button class="btn-primary" (click)="submitUpload()" [disabled]="!canSubmit()">
                  Upload {{ selectedFiles().length > 1 ? selectedFiles().length + ' files' : '' }}
                </button>
              </div>
            </div>
          }
        </div>
      } @else if (auth.user()) {
        <div class="signin-prompt">
          <span class="signin-icon">⏳</span>
          <p>Your account is waiting for approval. Once approved you'll be able to upload photos and videos.</p>
        </div>
      } @else {
        <div class="signin-prompt">
          <span class="signin-icon">🔒</span>
          <p>Sign in with Google to upload photos and videos.</p>
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

      <!-- Photo grid -->
      @if (filteredItems().length > 0) {
        <div class="photo-grid">
          @for (item of filteredItems(); track item.id) {
            <div class="photo-card" [class.editing]="editingId() === item.id">
              <div class="photo-preview" (click)="openLightbox(item)">
                @if (item.type === 'image') {
                  <img [src]="item.thumbnailUrl || item.url" [alt]="item.description || item.title" loading="lazy" />
                } @else {
                  <div class="video-thumb">
                    @if (item.thumbnailUrl) {
                      <img [src]="item.thumbnailUrl" [alt]="item.description || item.title" loading="lazy" />
                    } @else {
                      <video [src]="item.url" preload="metadata"></video>
                    }
                    <div class="play-overlay">▶</div>
                  </div>
                }
                <div class="media-badge">{{ item.type === 'video' ? '🎥' : '📷' }}</div>
              </div>

              <!-- Hover metadata panel -->
              <div class="photo-meta">
                @if (item.photoDate) {
                  <div class="meta-row">
                    <span class="meta-label">Taken</span>
                    <span class="meta-value">{{ item.photoDate | date:'d MMM yyyy' }}</span>
                  </div>
                }
                <div class="meta-row">
                  <span class="meta-label">Uploaded</span>
                  <span class="meta-value">{{ item.uploadedAt | date:'d MMM yyyy' }}</span>
                </div>
                @if (item.uploadedBy) {
                  <div class="meta-row">
                    <span class="meta-label">By</span>
                    <span class="meta-value">{{ item.uploadedBy }}</span>
                  </div>
                }
              </div>

              @if (item.description || auth.canWrite()) {
                <div class="photo-info">
                  @if (editingId() === item.id) {
                    <textarea [value]="editDescription" (input)="editDescription = $any($event.target).value"
                      class="edit-input" rows="2" placeholder="Description"></textarea>
                    <div class="edit-actions">
                      <button class="btn-small" (click)="saveEdit(item)">Save</button>
                      <button class="btn-small btn-cancel" (click)="editingId.set(null)">Cancel</button>
                    </div>
                  } @else {
                    @if (item.description) {
                      <p class="photo-desc">{{ item.description }}</p>
                    }
                    @if (auth.canWrite()) {
                      <div class="photo-actions">
                        <button class="action-btn" (click)="startEdit(item)" title="Edit">✏️</button>
                        <button class="action-btn danger" (click)="confirmDelete(item)" title="Delete">🗑️</button>
                      </div>
                    }
                  }
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- Carousel lightbox -->
      @if (lightboxIndex() !== null) {
        <div class="carousel-backdrop"
             (click)="closeLightbox()"
             (touchstart)="onTouchStart($event)"
             (touchend)="onTouchEnd($event)">

          <!-- Prev arrow -->
          @if (lightboxIndex()! > 0) {
            <button class="carousel-nav carousel-prev" (click)="$event.stopPropagation(); prevItem()">&#8249;</button>
          }

          <!-- Media content -->
          <div class="carousel-content" (click)="$event.stopPropagation()">
            <div class="carousel-header">
              <span class="carousel-counter">{{ lightboxIndex()! + 1 }} / {{ filteredItems().length }}</span>
              <button class="carousel-close" (click)="closeLightbox()">✕</button>
            </div>
            @if (lightboxItem()!.type === 'image') {
              <img class="carousel-media" [src]="lightboxItem()!.url" [alt]="lightboxItem()!.description || lightboxItem()!.title" />
            } @else {
              <video class="carousel-media" [src]="lightboxItem()!.url" controls autoplay></video>
            }
            @if (lightboxItem()!.description) {
              <div class="carousel-caption">{{ lightboxItem()!.description }}</div>
            }
          </div>

          <!-- Next arrow -->
          @if (lightboxIndex()! < filteredItems().length - 1) {
            <button class="carousel-nav carousel-next" (click)="$event.stopPropagation(); nextItem()">&#8250;</button>
          }

        </div>
      }

      <!-- Delete confirm -->
      @if (deletingItem()) {
        <div class="lightbox" (click)="deletingItem.set(null)">
          <div class="confirm-dialog" (click)="$event.stopPropagation()">
            <h3>Delete this photo?</h3>
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
    .photos-page { max-width: 1000px; margin: 0 auto; }

    .page-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .page-icon { font-size: 3rem; }

    .page-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: clamp(1.6rem, 4vw, 2.2rem);
      font-weight: 700;
      margin: 0 0 0.25rem;
      color: var(--text-primary);
    }

    .page-count { margin: 0; color: var(--text-muted); font-size: 0.9rem; }

    .clear-filter {
      background: none;
      border: none;
      padding: 0;
      margin-left: 0.2rem;
      font-size: 0.9rem;
      color: var(--text-muted);
      text-decoration: underline;
      cursor: pointer;
    }
    .clear-filter:hover { color: var(--text-secondary); }

    .year-filter {
      display: flex;
      gap: 0.5rem;
      overflow-x: auto;
      padding-bottom: 0.35rem;
      margin: 1rem 0 1.5rem;
      scrollbar-width: thin;
    }
    .year-pill {
      flex-shrink: 0;
      padding: 0.4rem 1rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-secondary);
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }
    .year-pill:hover { border-color: #9333ea; }
    .year-pill.active { background: #9333ea; border-color: #9333ea; color: white; }

    /* Upload area */
    .upload-area {
      background: var(--surface);
      border: 2px dashed var(--border);
      border-radius: 16px;
      margin-bottom: 2rem;
      transition: border-color 0.2s;
    }

    .upload-area.dragover { border-color: #9333ea; background: color-mix(in srgb, #9333ea 5%, var(--surface)); }

    .upload-prompt {
      padding: 2.5rem;
      text-align: center;
      cursor: pointer;
    }

    .upload-prompt:hover .upload-icon { transform: scale(1.1); }

    .upload-icon { font-size: 2.5rem; transition: transform 0.2s; }
    .upload-text { font-size: 1rem; font-weight: 600; color: var(--text-primary); margin: 0.5rem 0 0.25rem; }
    .upload-hint { font-size: 0.85rem; color: var(--text-muted); margin: 0; }

    .upload-form { padding: 1.5rem; }
    .form-title { font-size: 1.1rem; font-weight: 600; margin: 0 0 1rem; color: var(--text-primary); }

    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.4rem; }

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

    .form-input:focus { outline: none; border-color: #9333ea; }

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

    .file-drop:hover { border-color: #9333ea; }
    .file-drop.has-file { color: var(--text-primary); border-color: #9333ea; }

    .label-hint { font-weight: 400; color: var(--text-muted); font-size: 0.8rem; }

    .file-list {
      margin: 0.4rem 0 0;
      padding: 0.5rem 0.75rem;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      list-style: none;
      max-height: 120px;
      overflow-y: auto;
    }

    .file-list li {
      font-size: 0.8rem;
      color: var(--text-secondary);
      padding: 0.15rem 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .progress-bar { height: 6px; background: var(--border); border-radius: 3px; margin: 1rem 0 0.25rem; overflow: hidden; }
    .progress-fill { height: 100%; background: #9333ea; border-radius: 3px; transition: width 0.3s; }
    .progress-text { font-size: 0.85rem; color: var(--text-secondary); margin: 0 0 1rem; }
    .error-text { color: #ef4444; font-size: 0.85rem; margin: 0 0 1rem; }

    .form-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }

    .btn-primary {
      padding: 0.6rem 1.4rem;
      background: #9333ea;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }

    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary:not(:disabled):hover { opacity: 0.9; }

    .btn-secondary {
      padding: 0.6rem 1.2rem;
      background: transparent;
      color: var(--text-secondary);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 0.9rem;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-secondary:hover { background: var(--hover); }

    /* Sign-in prompt */
    .signin-prompt {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: 2rem;
      margin-bottom: 2rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      text-align: center;
    }

    .signin-icon { font-size: 2rem; }

    .signin-prompt p { margin: 0; color: var(--text-secondary); font-size: 0.95rem; }

    .btn-signin {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1.2rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      color: var(--text-primary);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-signin:hover { background: var(--hover); }

    /* Photo grid */
    .photo-grid {
      columns: 3;
      column-gap: 1rem;
    }

    @media (max-width: 700px) { .photo-grid { columns: 2; } }
    @media (max-width: 420px) { .photo-grid { columns: 1; } }

    .photo-card {
      break-inside: avoid;
      margin-bottom: 1rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .photo-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }

    .photo-preview {
      position: relative;
      overflow: hidden;
      cursor: pointer;
      background: var(--hover);
    }

    .photo-preview img {
      width: 100%;
      height: auto;
      display: block;
      transition: transform 0.3s;
    }

    .photo-preview:hover img { transform: scale(1.03); }

    .video-thumb { position: relative; aspect-ratio: 16/10; }

    .video-thumb video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .play-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.5rem;
      background: rgba(0,0,0,0.3);
      color: white;
      transition: background 0.2s;
    }

    .photo-preview:hover .play-overlay { background: rgba(0,0,0,0.45); }

    .media-badge {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      background: rgba(0,0,0,0.5);
      border-radius: 6px;
      padding: 0.15rem 0.4rem;
      font-size: 0.75rem;
    }

    /* Hover metadata panel */
    .photo-meta {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.25s ease, padding 0.25s ease;
      background: var(--hover);
      border-top: 1px solid transparent;
      padding: 0 0.875rem;
    }

    .photo-card:hover .photo-meta {
      max-height: 120px;
      padding: 0.6rem 0.875rem;
      border-top-color: var(--border);
    }

    .meta-row {
      display: flex;
      gap: 0.5rem;
      align-items: baseline;
      line-height: 1.6;
    }

    .meta-label {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      flex: 0 0 52px;
    }

    .meta-value {
      font-size: 0.8rem;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .photo-info { padding: 0.75rem; }

    .photo-desc {
      font-size: 0.875rem;
      color: var(--text-secondary);
      margin: 0 0 0.4rem;
      line-height: 1.5;
    }

    .photo-actions { display: flex; gap: 0.25rem; justify-content: flex-end; }

    .action-btn {
      background: none;
      border: none;
      font-size: 1rem;
      cursor: pointer;
      padding: 0.3rem 0.4rem;
      border-radius: 6px;
      transition: background 0.15s;
    }

    .action-btn:hover { background: var(--hover); }
    .action-btn.danger:hover { background: #fee2e2; }

    .edit-input {
      width: 100%;
      padding: 0.4rem 0.6rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg);
      color: var(--text-primary);
      font-size: 0.875rem;
      font-family: inherit;
      box-sizing: border-box;
      margin-bottom: 0.4rem;
      resize: vertical;
    }

    .edit-actions { display: flex; gap: 0.4rem; }

    .btn-small {
      padding: 0.3rem 0.75rem;
      font-size: 0.8rem;
      border-radius: 6px;
      border: 1px solid var(--border);
      cursor: pointer;
      background: #9333ea;
      color: white;
      font-weight: 600;
    }

    .btn-small.btn-cancel { background: transparent; color: var(--text-secondary); }

    /* Carousel */
    .carousel-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.92);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      touch-action: pan-y;
    }

    .carousel-content {
      position: relative;
      max-width: min(92vw, 960px);
      max-height: 92vh;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .carousel-header {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 0 0.5rem;
    }

    .carousel-counter {
      font-size: 0.85rem;
      color: rgba(255,255,255,0.6);
      font-variant-numeric: tabular-nums;
    }

    .carousel-close {
      background: rgba(255,255,255,0.15);
      color: white;
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }

    .carousel-close:hover { background: rgba(255,255,255,0.3); }

    .carousel-media {
      display: block;
      max-width: min(92vw, 960px);
      max-height: 78vh;
      object-fit: contain;
      border-radius: 8px;
    }

    .carousel-caption {
      margin-top: 0.75rem;
      font-size: 0.9rem;
      color: rgba(255,255,255,0.75);
      text-align: center;
      max-width: 560px;
    }

    .carousel-nav {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(255,255,255,0.15);
      color: white;
      border: none;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      font-size: 1.75rem;
      line-height: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
      z-index: 10;
      flex-shrink: 0;
    }

    .carousel-nav:hover { background: rgba(255,255,255,0.3); }
    .carousel-prev { left: 1rem; }
    .carousel-next { right: 1rem; }

    @media (max-width: 600px) {
      .carousel-nav { width: 36px; height: 36px; font-size: 1.4rem; }
      .carousel-prev { left: 0.25rem; }
      .carousel-next { right: 0.25rem; }
    }

    /* Confirm dialog */
    .confirm-dialog {
      background: var(--surface);
      border-radius: 16px;
      padding: 2rem;
      max-width: 360px;
      width: 100%;
      text-align: center;
    }

    .confirm-dialog h3 { margin: 0 0 0.5rem; font-size: 1.1rem; color: var(--text-primary); }
    .confirm-dialog p { margin: 0 0 1.5rem; color: var(--text-secondary); font-size: 0.9rem; }
    .confirm-actions { display: flex; gap: 0.75rem; justify-content: center; }

    .btn-danger {
      padding: 0.6rem 1.4rem;
      background: #ef4444;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-danger:hover { background: #dc2626; }
  `]
})
export class PhotosComponent implements OnInit {
  mediaService = inject(MediaService);
  auth = inject(AuthService);

  mediaItems = signal<MediaItem[]>([]);
  showUploadForm = signal(false);
  isDragging = signal(false);
  selectedFiles = signal<File[]>([]);
  uploadingIndex = signal(0);
  lightboxIndex = signal<number | null>(null);

  selectedYear = signal<number | null>(null);

  private itemYear(item: MediaItem): number {
    return (item.photoDate ?? item.uploadedAt).getFullYear();
  }

  availableYears = computed(() => {
    const years = new Set(this.mediaItems().map(i => this.itemYear(i)));
    return Array.from(years).sort((a, b) => b - a);
  });

  filteredItems = computed(() => {
    const year = this.selectedYear();
    return year === null ? this.mediaItems() : this.mediaItems().filter(i => this.itemYear(i) === year);
  });

  lightboxItem = computed(() => {
    const i = this.lightboxIndex();
    return i !== null ? this.filteredItems()[i] ?? null : null;
  });
  deletingItem = signal<MediaItem | null>(null);
  editingId = signal<string | null>(null);
  uploadError = signal('');
  uploadDescription = signal('');
  editDescription = '';

  private touchStartX = 0;
  private touchStartY = 0;

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    if (this.lightboxIndex() === null) return;
    if (e.key === 'ArrowRight') this.nextItem();
    if (e.key === 'ArrowLeft') this.prevItem();
    if (e.key === 'Escape') this.closeLightbox();
  }

  canSubmit = computed(() =>
    this.selectedFiles().length > 0 && !this.mediaService.uploading()
  );

  ngOnInit() {
    this.mediaService.getMediaBySection('photos').subscribe(items => {
      this.mediaItems.set(items);
    });
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(false);
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.selectedFiles.set(Array.from(files));
      this.showUploadForm.set(true);
    }
  }

  onFileSelected(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (files && files.length > 0) this.selectedFiles.set(Array.from(files));
  }

  cancelUpload() {
    this.showUploadForm.set(false);
    this.selectedFiles.set([]);
    this.uploadingIndex.set(0);
    this.uploadDescription.set('');
    this.uploadError.set('');
  }

  async submitUpload() {
    const files = this.selectedFiles();
    if (files.length === 0) return;

    const description = this.uploadDescription().trim();
    const uploadedBy = this.auth.user()?.displayName || this.auth.user()?.email || undefined;

    for (let i = 0; i < files.length; i++) {
      this.uploadingIndex.set(i);
      const file = files[i];
      const title = file.name.replace(/\.[^.]+$/, '');

      let photoDate: Date | undefined;
      try {
        const exifr = await import('exifr');
        const exif = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate']);
        photoDate = exif?.DateTimeOriginal ?? exif?.CreateDate ?? undefined;
      } catch { /* no EXIF */ }

      const ok = await new Promise<boolean>(resolve => {
        this.mediaService.uploadMedia(file, 'photos', title, description, uploadedBy, photoDate)
          .subscribe({
            next: result => {
              if (result.error) { this.uploadError.set(result.error); resolve(false); }
              else if (result.progress === 100) resolve(true);
            },
            error: err => { this.uploadError.set(err.message); resolve(false); }
          });
      });

      if (!ok) return;
    }

    this.cancelUpload();
  }

  openLightbox(item: MediaItem) {
    const i = this.filteredItems().indexOf(item);
    if (i !== -1) this.lightboxIndex.set(i);
  }

  closeLightbox() { this.lightboxIndex.set(null); }

  nextItem() {
    const i = this.lightboxIndex();
    if (i !== null && i < this.filteredItems().length - 1) this.lightboxIndex.set(i + 1);
  }

  prevItem() {
    const i = this.lightboxIndex();
    if (i !== null && i > 0) this.lightboxIndex.set(i - 1);
  }

  onTouchStart(e: TouchEvent) {
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
  }

  onTouchEnd(e: TouchEvent) {
    const dx = e.changedTouches[0].clientX - this.touchStartX;
    const dy = e.changedTouches[0].clientY - this.touchStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      dx < 0 ? this.nextItem() : this.prevItem();
    }
  }

  startEdit(item: MediaItem) {
    this.editingId.set(item.id);
    this.editDescription = item.description;
  }

  async saveEdit(item: MediaItem) {
    await this.mediaService.updateMedia(item.id, item.title, this.editDescription);
    this.editingId.set(null);
  }

  confirmDelete(item: MediaItem) {
    this.deletingItem.set(item);
  }

  async deleteItem() {
    const item = this.deletingItem();
    if (item) {
      await this.mediaService.deleteMedia(item);
      this.deletingItem.set(null);
    }
  }
}
