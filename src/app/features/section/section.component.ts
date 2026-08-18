import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MediaService } from '../../core/services/media.service';
import { MediaItem, SectionType } from '../../core/models/media-item.model';

@Component({
  selector: 'app-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="section-page" [style.--section-color]="color">

      <div class="section-header">
        <div class="section-icon">{{ icon }}</div>
        <div>
          <h1 class="section-title">{{ title }}</h1>
          <p class="section-count">
            @if (mediaItems().length > 0) {
              {{ mediaItems().length }} item{{ mediaItems().length !== 1 ? 's' : '' }}
            } @else {
              No items yet — add the first one below
            }
          </p>
        </div>
      </div>

      <!-- Upload area -->
      <div class="upload-area" [class.dragover]="isDragging()" (dragover)="onDragOver($event)" (dragleave)="isDragging.set(false)" (drop)="onDrop($event)">
        @if (!showUploadForm()) {
          <div class="upload-prompt" (click)="showUploadForm.set(true)">
            <div class="upload-icon">📎</div>
            <p class="upload-text">Click to add a photo or video</p>
            <p class="upload-hint">or drag and drop here</p>
          </div>
        } @else {
          <div class="upload-form">
            <h3 class="form-title">Add new item</h3>
            <div class="form-group">
              <label>Title</label>
              <input [value]="uploadTitle()" (input)="uploadTitle.set($any($event.target).value)" type="text" placeholder="e.g. Turn on the water" class="form-input" />
            </div>
            <div class="form-group">
              <label>Description (optional)</label>
              <textarea [value]="uploadDescription()" (input)="uploadDescription.set($any($event.target).value)" placeholder="Any extra details..." class="form-input" rows="2"></textarea>
            </div>
            <div class="form-group">
              <label>Photo or Video</label>
              <div class="file-drop" [class.has-file]="selectedFile()" (click)="fileInput.click()">
                @if (selectedFile()) {
                  <span>✅ {{ selectedFile()!.name }}</span>
                } @else {
                  <span>📁 Choose file...</span>
                }
                <input #fileInput type="file" accept="image/*,video/*" (change)="onFileSelected($event)" hidden />
              </div>
            </div>
            @if (mediaService.uploading()) {
              <div class="progress-bar">
                <div class="progress-fill" [style.width.%]="mediaService.uploadProgress()"></div>
              </div>
              <p class="progress-text">Uploading... {{ mediaService.uploadProgress() }}%</p>
            }
            @if (uploadError()) {
              <p class="error-text">{{ uploadError() }}</p>
            }
            <div class="form-actions">
              <button class="btn-secondary" (click)="cancelUpload()">Cancel</button>
              <button class="btn-primary" (click)="submitUpload()" [disabled]="!canSubmit()">
                Upload
              </button>
            </div>
          </div>
        }
      </div>

      <!-- Media grid -->
      @if (mediaItems().length > 0) {
        <div class="media-grid">
          @for (item of mediaItems(); track item.id) {
            <div class="media-card" [class.editing]="editingId() === item.id">
              <div class="media-preview" (click)="openLightbox(item)">
                @if (item.type === 'image') {
                  <img [src]="item.thumbnailUrl || item.url" [alt]="item.title" loading="lazy" />
                } @else {
                  <div class="video-thumb">
                    @if (item.thumbnailUrl) {
                      <img [src]="item.thumbnailUrl" [alt]="item.title" loading="lazy" />
                    } @else {
                      <video [src]="item.url" preload="metadata"></video>
                    }
                    <div class="play-overlay">▶</div>
                  </div>
                }
                <div class="media-badge">{{ item.type === 'video' ? '🎥' : '📷' }}</div>
              </div>
              <div class="media-info">
                @if (editingId() === item.id) {
                  <input [value]="editTitle" (input)="editTitle = $any($event.target).value" class="edit-input" />
                  <textarea [value]="editDescription" (input)="editDescription = $any($event.target).value" class="edit-input" rows="2"></textarea>
                  <div class="edit-actions">
                    <button class="btn-small" (click)="saveEdit(item)">Save</button>
                    <button class="btn-small btn-cancel" (click)="editingId.set(null)">Cancel</button>
                  </div>
                } @else {
                  <h3 class="media-title">{{ item.title }}</h3>
                  @if (item.description) {
                    <p class="media-desc">{{ item.description }}</p>
                  }
                  <div class="media-actions">
                    <button class="action-btn" (click)="startEdit(item)" title="Edit">✏️</button>
                    <button class="action-btn danger" (click)="confirmDelete(item)" title="Delete">🗑️</button>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- Lightbox -->
      @if (lightboxItem()) {
        <div class="lightbox" (click)="lightboxItem.set(null)">
          <div class="lightbox-content" (click)="$event.stopPropagation()">
            <button class="lightbox-close" (click)="lightboxItem.set(null)">✕</button>
            @if (lightboxItem()!.type === 'image') {
              <img [src]="lightboxItem()!.url" [alt]="lightboxItem()!.title" />
            } @else {
              <video [src]="lightboxItem()!.url" controls autoplay></video>
            }
            <div class="lightbox-caption">
              <h3>{{ lightboxItem()!.title }}</h3>
              @if (lightboxItem()!.description) {
                <p>{{ lightboxItem()!.description }}</p>
              }
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
    .section-page { max-width: 900px; margin: 0 auto; }

    .section-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .section-icon { font-size: 3rem; }

    .section-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: clamp(1.6rem, 4vw, 2.2rem);
      font-weight: 700;
      margin: 0 0 0.25rem;
      color: var(--text-primary);
    }

    .section-count { margin: 0; color: var(--text-muted); font-size: 0.9rem; }

    /* Upload area */
    .upload-area {
      background: var(--surface);
      border: 2px dashed var(--border);
      border-radius: 16px;
      margin-bottom: 2rem;
      transition: border-color 0.2s;
    }

    .upload-area.dragover { border-color: var(--section-color); background: color-mix(in srgb, var(--section-color) 5%, var(--surface)); }

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
    }

    .form-input:focus { outline: none; border-color: var(--section-color); }

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

    .file-drop:hover { border-color: var(--section-color); }
    .file-drop.has-file { color: var(--text-primary); border-color: var(--section-color); }

    .progress-bar { height: 6px; background: var(--border); border-radius: 3px; margin: 1rem 0 0.25rem; overflow: hidden; }
    .progress-fill { height: 100%; background: var(--section-color); border-radius: 3px; transition: width 0.3s; }
    .progress-text { font-size: 0.85rem; color: var(--text-secondary); margin: 0 0 1rem; }
    .error-text { color: #ef4444; font-size: 0.85rem; margin: 0 0 1rem; }

    .form-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }

    .btn-primary {
      padding: 0.6rem 1.4rem;
      background: var(--section-color);
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
      transition: all 0.2s;
    }

    .btn-secondary:hover { background: var(--hover); }

    /* Media grid */
    .media-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 1.25rem;
    }

    .media-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .media-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }

    .media-preview {
      position: relative;
      aspect-ratio: 16/10;
      overflow: hidden;
      cursor: pointer;
      background: var(--hover);
    }

    .media-preview img, .media-preview video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s;
    }

    .media-preview:hover img, .media-preview:hover video { transform: scale(1.03); }

    .video-thumb { position: relative; width: 100%; height: 100%; }

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

    .media-preview:hover .play-overlay { background: rgba(0,0,0,0.45); }

    .media-badge {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      background: rgba(0,0,0,0.5);
      border-radius: 6px;
      padding: 0.15rem 0.4rem;
      font-size: 0.75rem;
    }

    .media-info { padding: 0.875rem; }
    .media-title { font-size: 0.95rem; font-weight: 600; margin: 0 0 0.25rem; color: var(--text-primary); }
    .media-desc { font-size: 0.82rem; color: var(--text-secondary); margin: 0 0 0.5rem; line-height: 1.4; }

    .media-actions { display: flex; gap: 0.25rem; justify-content: flex-end; margin-top: 0.5rem; }

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
    }

    .edit-actions { display: flex; gap: 0.4rem; }

    .btn-small {
      padding: 0.3rem 0.75rem;
      font-size: 0.8rem;
      border-radius: 6px;
      border: 1px solid var(--border);
      cursor: pointer;
      background: var(--section-color);
      color: white;
      font-weight: 600;
    }

    .btn-small.btn-cancel { background: transparent; color: var(--text-secondary); }

    /* Lightbox */
    .lightbox {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }

    .lightbox-content {
      position: relative;
      max-width: 90vw;
      max-height: 90vh;
      background: var(--surface);
      border-radius: 16px;
      overflow: hidden;
    }

    .lightbox-content img, .lightbox-content video {
      max-width: 90vw;
      max-height: 75vh;
      display: block;
    }

    .lightbox-close {
      position: absolute;
      top: 0.75rem;
      right: 0.75rem;
      background: rgba(0,0,0,0.5);
      color: white;
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 1rem;
      cursor: pointer;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .lightbox-caption {
      padding: 1rem 1.25rem;
    }

    .lightbox-caption h3 { margin: 0 0 0.25rem; font-size: 1rem; color: var(--text-primary); }
    .lightbox-caption p { margin: 0; font-size: 0.875rem; color: var(--text-secondary); }

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
export class SectionComponent implements OnInit {
  private route = inject(ActivatedRoute);
  mediaService = inject(MediaService);

  section!: SectionType;
  title = '';
  icon = '';
  color = '';

  mediaItems = signal<MediaItem[]>([]);
  showUploadForm = signal(false);
  isDragging = signal(false);
  selectedFile = signal<File | null>(null);
  lightboxItem = signal<MediaItem | null>(null);
  deletingItem = signal<MediaItem | null>(null);
  editingId = signal<string | null>(null);
  uploadError = signal('');

  uploadTitle = signal('');
  uploadDescription = signal('');
  editTitle = '';
  editDescription = '';

  canSubmit = computed(() =>
    this.uploadTitle().trim().length > 0 &&
    this.selectedFile() !== null &&
    !this.mediaService.uploading()
  );

  ngOnInit() {
    const data = this.route.snapshot.data;
    this.section = data['section'];
    this.title = data['title'];
    this.icon = data['icon'];
    this.color = data['color'];

    this.mediaService.getMediaBySection(this.section).subscribe(items => {
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
    const file = event.dataTransfer?.files[0];
    if (file) {
      this.selectedFile.set(file);
      this.showUploadForm.set(true);
    }
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.selectedFile.set(file);
  }

  cancelUpload() {
    this.showUploadForm.set(false);
    this.selectedFile.set(null);
    this.uploadTitle.set('');
    this.uploadDescription.set('');
    this.uploadError.set('');
  }

  submitUpload() {
    const file = this.selectedFile();
    if (!file || !this.uploadTitle().trim()) return;

    this.uploadError.set('');
    this.mediaService.uploadMedia(file, this.section, this.uploadTitle().trim(), this.uploadDescription().trim())
      .subscribe({
        next: result => {
          if (result.error) {
            this.uploadError.set(result.error);
          } else if (result.progress === 100) {
            this.cancelUpload();
          }
        },
        error: err => this.uploadError.set(err.message)
      });
  }

  openLightbox(item: MediaItem) {
    this.lightboxItem.set(item);
  }

  startEdit(item: MediaItem) {
    this.editingId.set(item.id);
    this.editTitle = item.title;
    this.editDescription = item.description;
  }

  async saveEdit(item: MediaItem) {
    await this.mediaService.updateMedia(item.id, this.editTitle, this.editDescription);
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
