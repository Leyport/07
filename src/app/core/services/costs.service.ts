import { Injectable, signal } from '@angular/core';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore, collection, getDocs, addDoc, deleteDoc,
  doc, query, orderBy, onSnapshot, updateDoc, setDoc, Firestore
} from 'firebase/firestore';
import {
  getStorage, ref, uploadBytesResumable,
  getDownloadURL, deleteObject, FirebaseStorage
} from 'firebase/storage';
import { Observable } from 'rxjs';
import { CostCategory, CostItem, CostStatus, CustomCostCategory, CustomPayee } from '../models/cost-item.model';
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
  payee?: string;
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
            ...(input.payee ? { payee: input.payee } : {}),
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
    updates: Partial<Pick<CostItem, 'title' | 'category' | 'status' | 'amount' | 'date' | 'payee' | 'notes'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'costs', id), { ...updates });
  }

  async deleteCost(item: CostItem): Promise<void> {
    if (item.storagePath) {
      await deleteObject(ref(this.storage, item.storagePath)).catch(() => {});
    }
    await deleteDoc(doc(this.db, 'costs', item.id));
  }

  /** Custom categories and built-in overrides — doc ID is always the category's `value`. */
  getCategories(): Observable<CustomCostCategory[]> {
    return new Observable(observer => {
      const categoriesRef = collection(this.db, 'costCategories');
      const q = query(categoriesRef, orderBy('order', 'asc'));
      const unsubscribe = onSnapshot(q, snapshot => {
        const items = snapshot.docs.map(d => d.data()) as CustomCostCategory[];
        observer.next(items);
      }, err => observer.error(err));

      return () => unsubscribe();
    });
  }

  /** Creates a new custom category, or overrides the icon/color of an existing (possibly built-in) one — keyed by `value`. */
  async upsertCategory(value: string, label: string, icon: string, color: string, order?: number): Promise<void> {
    const data: CustomCostCategory = { value, label, icon, color, order: order ?? 0 };
    await setDoc(doc(this.db, 'costCategories', value), data);
  }

  async nextCustomCategoryOrder(): Promise<number> {
    const existing = await getDocs(query(collection(this.db, 'costCategories')));
    return existing.size;
  }

  async deleteCategory(value: string): Promise<void> {
    await deleteDoc(doc(this.db, 'costCategories', value));
  }

  /** Payees — an extensible list of names, doc ID is always the payee's `value` (no built-ins). */
  getPayees(): Observable<CustomPayee[]> {
    return new Observable(observer => {
      const payeesRef = collection(this.db, 'costPayees');
      const q = query(payeesRef, orderBy('order', 'asc'));
      const unsubscribe = onSnapshot(q, snapshot => {
        observer.next(snapshot.docs.map(d => d.data()) as CustomPayee[]);
      }, err => observer.error(err));

      return () => unsubscribe();
    });
  }

  async addPayee(value: string, name: string, order: number): Promise<void> {
    const data: CustomPayee = { value, name, order };
    await setDoc(doc(this.db, 'costPayees', value), data);
  }

  async nextPayeeOrder(): Promise<number> {
    const existing = await getDocs(query(collection(this.db, 'costPayees')));
    return existing.size;
  }

  async deletePayee(value: string): Promise<void> {
    await deleteDoc(doc(this.db, 'costPayees', value));
  }
}
