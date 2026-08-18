import { Injectable, signal } from '@angular/core';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore, collection, getDocs, addDoc, deleteDoc,
  doc, query, where, orderBy, onSnapshot, updateDoc, Firestore
} from 'firebase/firestore';
import {
  getStorage, ref, uploadBytesResumable,
  getDownloadURL, deleteObject, FirebaseStorage
} from 'firebase/storage';
import { Observable } from 'rxjs';
import { MediaItem, SectionType } from '../models/media-item.model';
import { environment } from '../../../environments/environment';

export interface UploadProgress {
  progress: number;
  url?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class MediaService {
  private app: FirebaseApp;
  private db: Firestore;
  private storage: FirebaseStorage;

  uploading = signal(false);
  uploadProgress = signal(0);

  constructor() {
    this.app = getApps().length
      ? getApps()[0]
      : initializeApp(environment.firebase);
    this.db = getFirestore(this.app);
    this.storage = getStorage(this.app);
  }

  getMediaBySection(section: SectionType): Observable<MediaItem[]> {
    return new Observable(observer => {
      const mediaRef = collection(this.db, 'media');
      const q = query(
        mediaRef,
        where('section', '==', section),
        orderBy('order', 'asc')
      );
      const unsubscribe = onSnapshot(q, snapshot => {
        const items = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
          uploadedAt: d.data()['uploadedAt']?.toDate?.() ?? new Date(),
          photoDate: d.data()['photoDate']?.toDate?.() ?? d.data()['photoDate']
        })) as MediaItem[];
        observer.next(items);
      }, err => observer.error(err));

      return () => unsubscribe();
    });
  }

  uploadMedia(
    file: File,
    section: SectionType,
    title: string,
    description: string,
    uploadedBy?: string,
    photoDate?: Date
  ): Observable<UploadProgress> {
    return new Observable(observer => {
      const ext = file.name.split('.').pop();
      const storagePath = `media/${section}/${Date.now()}.${ext}`;
      const storageRef = ref(this.storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      this.uploading.set(true);

      uploadTask.on(
        'state_changed',
        snapshot => {
          const progress = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          this.uploadProgress.set(progress);
          observer.next({ progress });
        },
        error => {
          this.uploading.set(false);
          observer.next({ progress: 0, error: error.message });
          observer.complete();
        },
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            const type = file.type.startsWith('video/') ? 'video' : 'image';

            const thumb = await this.createThumbnail(file);
            let thumbnailUrl: string | undefined;
            let thumbnailPath: string | undefined;
            if (thumb) {
              thumbnailPath = `media/${section}/thumbs/${Date.now()}_thumb.jpg`;
              const thumbRef = ref(this.storage, thumbnailPath);
              await uploadBytesResumable(thumbRef, thumb);
              thumbnailUrl = await getDownloadURL(thumbRef);
            }

            const mediaRef = collection(this.db, 'media');
            const existing = await getDocs(
              query(mediaRef, where('section', '==', section))
            );

            await addDoc(mediaRef, {
              section,
              title,
              description,
              type,
              url,
              storagePath,
              uploadedAt: new Date(),
              ...(uploadedBy ? { uploadedBy } : {}),
              ...(photoDate ? { photoDate } : {}),
              ...(thumbnailUrl ? { thumbnailUrl, thumbnailPath } : {}),
              order: existing.size
            });

            this.uploading.set(false);
            this.uploadProgress.set(0);
            observer.next({ progress: 100, url });
            observer.complete();
          } catch (err: any) {
            this.uploading.set(false);
            observer.next({ progress: 0, error: err.message });
            observer.complete();
          }
        }
      );
    });
  }

  /** Generates a small JPEG thumbnail (max 640px on the long edge) from an image or video file. */
  private async createThumbnail(file: File, maxDim = 640): Promise<Blob | null> {
    try {
      if (file.type.startsWith('image/')) {
        const bitmap = await createImageBitmap(file);
        const blob = await this.drawToThumbnailBlob(bitmap, bitmap.width, bitmap.height, maxDim);
        bitmap.close();
        return blob;
      }
      if (file.type.startsWith('video/')) {
        return await this.videoFrameToThumbnailBlob(file, maxDim);
      }
    } catch {
      return null;
    }
    return null;
  }

  private drawToThumbnailBlob(
    source: CanvasImageSource,
    sourceWidth: number,
    sourceHeight: number,
    maxDim: number
  ): Promise<Blob | null> {
    const scale = Math.min(1, maxDim / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sourceWidth * scale);
    canvas.height = Math.round(sourceHeight * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  }

  private videoFrameToThumbnailBlob(file: File, maxDim: number): Promise<Blob | null> {
    return new Promise(resolve => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      let settled = false;
      const finish = (blob: Blob | null) => {
        if (settled) return;
        settled = true;
        URL.revokeObjectURL(url);
        resolve(blob);
      };

      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.src = url;
      video.onloadeddata = () => {
        video.currentTime = Math.min(0.1, (video.duration || 1) / 2);
      };
      video.onseeked = () => {
        this.drawToThumbnailBlob(video, video.videoWidth, video.videoHeight, maxDim).then(finish);
      };
      video.onerror = () => finish(null);
      setTimeout(() => finish(null), 8000);
    });
  }

  async deleteMedia(item: MediaItem): Promise<void> {
    const storageRef = ref(this.storage, item.storagePath);
    await deleteObject(storageRef);
    if (item.thumbnailPath) {
      await deleteObject(ref(this.storage, item.thumbnailPath)).catch(() => {});
    }
    await deleteDoc(doc(this.db, 'media', item.id));
  }

  async updateMedia(id: string, title: string, description: string): Promise<void> {
    await updateDoc(doc(this.db, 'media', id), { title, description });
  }
}
