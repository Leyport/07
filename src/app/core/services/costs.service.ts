import { Injectable, signal } from '@angular/core';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore, collection, getDocs, addDoc, deleteDoc,
  doc, query, orderBy, onSnapshot, updateDoc, Firestore
} from 'firebase/firestore';
import {
  getStorage, ref, uploadBytesResumable,
  getDownloadURL, deleteObject, FirebaseStorage
} from 'firebase/storage';
import { Observable } from 'rxjs';
import { CostCategory, CostItem, CostStatus } from '../models/cost-item.model';
import { environment } from '../../../environments/environment';

export interface CostUploadProgress {
  progress: number;
  error?: string;
}

export interface CostInput {
  title: string;
  category: CostCategory;
  status: CostStatus;
  amount?: number;
  currency: string;
  date?: Date;
  notes: string;
  uploadedBy?: string;
}

@Injectable({ providedIn: 'root' })
export class CostsService {
  private app: FirebaseApp;
  private db: Firestore;
  private storage: FirebaseStorage;

  uploading = signal(false);
  uploadProgress = signal(0);

  constructor() {
    this.app = getApps().length ? getApps()[0] : initializeApp(environment.firebase);
    this.db = getFirestore(this.app);
    this.storage = getStorage(this.app);
  }

  getCosts(): Observable<CostItem[]> {
    return new Observable(observer => {
      const costsRef = collection(this.db, 'costs');
      const q = query(costsRef, orderBy('order', 'desc'));
      const unsubscribe = onSnapshot(q, snapshot => {
        const items = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
          uploadedAt: d.data()['uploadedAt']?.toDate?.() ?? new Date(),
          date: d.data()['date']?.toDate?.() ?? d.data()['date']
        })) as CostItem[];
        observer.next(items);
      }, err => observer.error(err));

      return () => unsubscribe();
    });
  }

  addCost(input: CostInput, file?: File | null): Observable<CostUploadProgress> {
    return new Observable(observer => {
      this.uploading.set(true);

      const finish = async (attachment?: {
        attachmentUrl: string; attachmentName: string; attachmentType: 'image' | 'pdf'; storagePath: string;
      }) => {
        try {
          const costsRef = collection(this.db, 'costs');
          const existing = await getDocs(query(costsRef));

          await addDoc(costsRef, {
            title: input.title,
            category: input.category,
            status: input.status,
            currency: input.currency,
            notes: input.notes || '',
            ...(input.amount !== undefined ? { amount: input.amount } : {}),
            ...(input.date ? { date: input.date } : {}),
            ...(input.uploadedBy ? { uploadedBy: input.uploadedBy } : {}),
            ...(attachment ?? {}),
            uploadedAt: new Date(),
            order: existing.size
          });

          this.uploading.set(false);
          this.uploadProgress.set(0);
          observer.next({ progress: 100 });
          observer.complete();
        } catch (err: any) {
          this.uploading.set(false);
          observer.next({ progress: 0, error: err.message });
          observer.complete();
        }
      };

      if (!file) {
        finish();
        return;
      }

      const ext = file.name.split('.').pop();
      const storagePath = `costs/${Date.now()}.${ext}`;
      const storageRef = ref(this.storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        snapshot => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          this.uploadProgress.set(progress);
          observer.next({ progress });
        },
        error => {
          this.uploading.set(false);
          observer.next({ progress: 0, error: error.message });
          observer.complete();
        },
        async () => {
          const attachmentUrl = await getDownloadURL(uploadTask.snapshot.ref);
          const attachmentType = file.type === 'application/pdf' ? 'pdf' : 'image';
          await finish({ attachmentUrl, attachmentName: file.name, attachmentType, storagePath });
        }
      );
    });
  }

  async updateCost(
    id: string,
    updates: Partial<Pick<CostItem, 'title' | 'category' | 'status' | 'amount' | 'date' | 'notes'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'costs', id), { ...updates });
  }

  async deleteCost(item: CostItem): Promise<void> {
    if (item.storagePath) {
      await deleteObject(ref(this.storage, item.storagePath)).catch(() => {});
    }
    await deleteDoc(doc(this.db, 'costs', item.id));
  }
}
