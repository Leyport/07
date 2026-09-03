import { Injectable, signal } from '@angular/core';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore, collection, getDocs, addDoc, deleteDoc,
  doc, query, orderBy, onSnapshot, updateDoc, setDoc, writeBatch, Firestore
} from 'firebase/firestore';
import {
  getStorage, ref, uploadBytesResumable,
  getDownloadURL, deleteObject, FirebaseStorage
} from 'firebase/storage';
import { Observable } from 'rxjs';
import { CostCategory, CostFolder, CostFrequency, CostItem, CostStatus, CustomCostCategory, CustomPayee } from '../models/cost-item.model';
import { environment } from '../../../environments/environment';

export interface CostUploadProgress {
  progress: number;
  error?: string;
}

export interface CostInput {
  title: string;
  category: CostCategory;
  status: CostStatus;
  frequency: CostFrequency;
  amount?: number;
  currency: string;
  date?: Date;
  payee?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
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
        thumbnailUrl?: string; thumbnailPath?: string;
      }) => {
        try {
          const costsRef = collection(this.db, 'costs');
          const existing = await getDocs(query(costsRef));

          await addDoc(costsRef, {
            title: input.title,
            category: input.category,
            status: input.status,
            frequency: input.frequency,
            currency: input.currency,
            notes: input.notes || '',
            ...(input.amount !== undefined ? { amount: input.amount } : {}),
            ...(input.date ? { date: input.date } : {}),
            ...(input.payee ? { payee: input.payee } : {}),
            ...(input.contactName ? { contactName: input.contactName } : {}),
            ...(input.contactPhone ? { contactPhone: input.contactPhone } : {}),
            ...(input.contactEmail ? { contactEmail: input.contactEmail } : {}),
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

          let thumbFields: { thumbnailUrl: string; thumbnailPath: string } | Record<string, never> = {};
          if (attachmentType === 'pdf') {
            const thumbBlob = await this.generatePdfThumbnail(file);
            if (thumbBlob) {
              const thumbnailPath = `costs/thumbs/${Date.now()}_thumb.jpg`;
              const thumbRef = ref(this.storage, thumbnailPath);
              await uploadBytesResumable(thumbRef, thumbBlob);
              const thumbnailUrl = await getDownloadURL(thumbRef);
              thumbFields = { thumbnailUrl, thumbnailPath };
            }
          }

          await finish({ attachmentUrl, attachmentName: file.name, attachmentType, storagePath, ...thumbFields });
        }
      );
    });
  }

  /** Renders a PDF's first page to a JPEG thumbnail (max 640px on the long edge) using pdf.js, loaded on demand. */
  private async generatePdfThumbnail(file: File, maxDim = 640): Promise<Blob | null> {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      const page = await pdf.getPage(1);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = maxDim / Math.max(baseViewport.width, baseViewport.height);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;

      return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    } catch {
      return null;
    }
  }

  async updateCost(
    id: string,
    updates: Partial<Pick<CostItem, 'title' | 'category' | 'status' | 'frequency' | 'amount' | 'date' | 'payee' | 'contactName' | 'contactPhone' | 'contactEmail' | 'notes'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'costs', id), { ...updates });
  }

  async moveToFolder(costId: string, folderId: string | null): Promise<void> {
    await updateDoc(doc(this.db, 'costs', costId), { folderId });
  }

  async moveManyToFolder(costIds: string[], folderId: string | null): Promise<void> {
    const batch = writeBatch(this.db);
    for (const id of costIds) {
      batch.update(doc(this.db, 'costs', id), { folderId });
    }
    await batch.commit();
  }

  async deleteCost(item: CostItem): Promise<void> {
    if (item.storagePath) {
      await deleteObject(ref(this.storage, item.storagePath)).catch(() => {});
    }
    if (item.thumbnailPath) {
      await deleteObject(ref(this.storage, item.thumbnailPath)).catch(() => {});
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

  /** Folders for grouping cost items — no built-ins, plain auto-generated Firestore doc IDs. */
  getFolders(): Observable<CostFolder[]> {
    return new Observable(observer => {
      const foldersRef = collection(this.db, 'costFolders');
      const q = query(foldersRef, orderBy('order', 'asc'));
      const unsubscribe = onSnapshot(q, snapshot => {
        const folders = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as CostFolder[];
        observer.next(folders);
      }, err => observer.error(err));

      return () => unsubscribe();
    });
  }

  async addFolder(name: string): Promise<void> {
    const foldersRef = collection(this.db, 'costFolders');
    const existing = await getDocs(query(foldersRef));
    await addDoc(foldersRef, { name, order: existing.size });
  }

  async deleteFolder(id: string): Promise<void> {
    await deleteDoc(doc(this.db, 'costFolders', id));
  }
}
