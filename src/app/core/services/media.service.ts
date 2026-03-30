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
          uploadedAt: d.data()['uploadedAt']?.toDate?.() ?? new Date()
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

  async deleteMedia(item: MediaItem): Promise<void> {
    const storageRef = ref(this.storage, item.storagePath);
    await deleteObject(storageRef);
    await deleteDoc(doc(this.db, 'media', item.id));
  }

  async updateMedia(id: string, title: string, description: string): Promise<void> {
    await updateDoc(doc(this.db, 'media', id), { title, description });
  }
}
