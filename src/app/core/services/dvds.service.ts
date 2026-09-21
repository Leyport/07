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
import { CustomDvdGenre, DvdFolder, DvdFormat, DvdGenre, DvdItem, DVD_GENRES } from '../models/dvd-item.model';
import { environment } from '../../../environments/environment';

export interface DvdUploadProgress {
  progress: number;
  error?: string;
}

export interface DvdInput {
  title: string;
  year?: number;
  genre: DvdGenre;
  format: DvdFormat;
  summary: string;
  director?: string;
  addedBy?: string;
}

/** One candidate film found on a scanned photo, awaiting user review before it's saved. */
export interface DvdScanCandidate {
  title: string;
  year?: number;
  genre: DvdGenre;
  summary: string;
  director?: string;
}

@Injectable({ providedIn: 'root' })
export class DvdsService {
  private app: FirebaseApp;
  private db: Firestore;
  private storage: FirebaseStorage;

  uploading = signal(false);
  uploadProgress = signal(0);

  scanning = signal(false);
  scanError = signal('');

  private appCheckInitialized = false;

  constructor() {
    this.app = getApps().length ? getApps()[0] : initializeApp(environment.firebase);
    this.db = getFirestore(this.app);
    this.storage = getStorage(this.app);
  }

  getDvds(): Observable<DvdItem[]> {
    return new Observable(observer => {
      const dvdsRef = collection(this.db, 'dvds');
      const q = query(dvdsRef, orderBy('order', 'desc'));
      const unsubscribe = onSnapshot(q, snapshot => {
        const items = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
          addedAt: d.data()['addedAt']?.toDate?.() ?? new Date(),
        })) as DvdItem[];
        observer.next(items);
      }, err => observer.error(err));

      return () => unsubscribe();
    });
  }

  /** Saves one disc with no photo — used both by the manual "add" form and to bulk-save reviewed scan candidates. */
  async addDvd(input: DvdInput): Promise<void> {
    const dvdsRef = collection(this.db, 'dvds');
    const existing = await getDocs(query(dvdsRef));

    await addDoc(dvdsRef, {
      title: input.title,
      genre: input.genre,
      format: input.format,
      summary: input.summary || '',
      ...(input.year !== undefined ? { year: input.year } : {}),
      ...(input.director ? { director: input.director } : {}),
      ...(input.addedBy ? { addedBy: input.addedBy } : {}),
      addedAt: new Date(),
      order: existing.size
    });
  }

  /** Saves one disc with a photo attached — used by the manual "add" form when the user wants a picture of that specific case. */
  addDvdWithPhoto(input: DvdInput, file: File): Observable<DvdUploadProgress> {
    return new Observable(observer => {
      this.uploading.set(true);

      const ext = file.name.split('.').pop();
      const photoPath = `dvds/${Date.now()}.${ext}`;
      const storageRef = ref(this.storage, photoPath);
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
          try {
            const photoUrl = await getDownloadURL(uploadTask.snapshot.ref);
            const dvdsRef = collection(this.db, 'dvds');
            const existing = await getDocs(query(dvdsRef));

            await addDoc(dvdsRef, {
              title: input.title,
              genre: input.genre,
              format: input.format,
              summary: input.summary || '',
              photoUrl,
              photoPath,
              ...(input.year !== undefined ? { year: input.year } : {}),
              ...(input.director ? { director: input.director } : {}),
              ...(input.addedBy ? { addedBy: input.addedBy } : {}),
              addedAt: new Date(),
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
        }
      );
    });
  }

  async updateDvd(
    id: string,
    updates: Partial<Pick<DvdItem, 'title' | 'year' | 'genre' | 'format' | 'summary' | 'director'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'dvds', id), { ...updates });
  }

  async moveToFolder(dvdId: string, folderId: string | null): Promise<void> {
    await updateDoc(doc(this.db, 'dvds', dvdId), { folderId });
  }

  async deleteDvd(item: DvdItem): Promise<void> {
    if (item.photoPath) {
      await deleteObject(ref(this.storage, item.photoPath)).catch(() => {});
    }
    await deleteDoc(doc(this.db, 'dvds', item.id));
  }

  /** Custom genres and built-in overrides — doc ID is always the genre's `value`. */
  getGenres(): Observable<CustomDvdGenre[]> {
    return new Observable(observer => {
      const genresRef = collection(this.db, 'dvdGenres');
      const q = query(genresRef, orderBy('order', 'asc'));
      const unsubscribe = onSnapshot(q, snapshot => {
        observer.next(snapshot.docs.map(d => d.data()) as CustomDvdGenre[]);
      }, err => observer.error(err));

      return () => unsubscribe();
    });
  }

  async upsertGenre(value: string, label: string, icon: string, color: string, order?: number): Promise<void> {
    const data: CustomDvdGenre = { value, label, icon, color, order: order ?? 0 };
    await setDoc(doc(this.db, 'dvdGenres', value), data);
  }

  async nextCustomGenreOrder(): Promise<number> {
    const existing = await getDocs(query(collection(this.db, 'dvdGenres')));
    return existing.size;
  }

  async deleteGenre(value: string): Promise<void> {
    await deleteDoc(doc(this.db, 'dvdGenres', value));
  }

  /** Folders for grouping discs — no built-ins, plain auto-generated Firestore doc IDs. */
  getFolders(): Observable<DvdFolder[]> {
    return new Observable(observer => {
      const foldersRef = collection(this.db, 'dvdFolders');
      const q = query(foldersRef, orderBy('order', 'asc'));
      const unsubscribe = onSnapshot(q, snapshot => {
        const folders = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as DvdFolder[];
        observer.next(folders);
      }, err => observer.error(err));

      return () => unsubscribe();
    });
  }

  async addFolder(name: string): Promise<void> {
    const foldersRef = collection(this.db, 'dvdFolders');
    const existing = await getDocs(query(foldersRef));
    await addDoc(foldersRef, { name, order: existing.size });
  }

  async deleteFolder(id: string): Promise<void> {
    await deleteDoc(doc(this.db, 'dvdFolders', id));
  }

  /**
   * Sends each photo to Gemini (via Firebase AI Logic) and asks it to identify every distinct
   * film visible — a close-up of one cover returns one candidate, a wide shelf photo can return
   * many. Loads `firebase/ai` on demand so people who never scan don't pay for it in the bundle.
   */
  async scanPhotos(files: File[]): Promise<DvdScanCandidate[]> {
    this.scanning.set(true);
    this.scanError.set('');

    try {
      await this.ensureAppCheck();

      const { getAI, getGenerativeModel, GoogleAIBackend, Schema } = await import('firebase/ai');

      const ai = getAI(this.app, { backend: new GoogleAIBackend() });
      const model = getGenerativeModel(ai, {
        model: 'gemini-3.6-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: Schema.array({
            items: Schema.object({
              properties: {
                title: Schema.string({ description: 'The film\'s title, exactly as officially released.' }),
                year: Schema.integer({ description: 'Best-guess theatrical release year.' }),
                genre: Schema.enumString({
                  enum: DVD_GENRES.map(g => g.value),
                  description: 'The single best-fitting genre from the given list.'
                }),
                summary: Schema.string({ description: 'A 2-3 sentence plot summary, no spoilers for the ending.' }),
                director: Schema.string({ description: 'The director\'s name, if known.' }),
              },
              optionalProperties: ['year', 'director'],
            })
          })
        }
      });

      const results: DvdScanCandidate[] = [];
      for (const file of files) {
        const inlineData = await this.fileToInlineData(file);
        const prompt = 'This photo shows one or more physical DVD, Blu-ray, or box-set cases (front cover or spine). ' +
          'Identify each distinct film or TV box-set you can see. Ignore duplicates of the same title. ' +
          'For each one, return its title, best-guess release year, one genre from the allowed list, a short plot summary, and the director if you know it.';

        const result = await model.generateContent([prompt, { inlineData }]);
        const text = result.response.text();
        try {
          const parsed = JSON.parse(text) as DvdScanCandidate[];
          results.push(...parsed);
        } catch {
          // Skip a photo Gemini couldn't return valid JSON for rather than failing the whole batch.
        }
      }

      return results;
    } catch (err: any) {
      this.scanError.set(err.message || 'Something went wrong scanning those photos.');
      return [];
    } finally {
      this.scanning.set(false);
    }
  }

  /**
   * The Gemini API (fronted by Firebase AI Logic) requires a valid App Check token on every
   * request — Google now mandates reCAPTCHA Enterprise as the web attestation provider (v3
   * Classic is no longer accepted for new App Check registrations). Initialized once, lazily —
   * only scanning needs this, everything else (Firestore/Storage) works fine without it. In dev,
   * falls back to the App Check debug provider (localhost can't be added to a production
   * reCAPTCHA Enterprise key), whose token must be registered once in Firebase Console →
   * App Check → debug tokens.
   */
  private async ensureAppCheck(): Promise<void> {
    if (this.appCheckInitialized) return;
    this.appCheckInitialized = true;

    const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import('firebase/app-check');

    if (!environment.production) {
      (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }

    initializeAppCheck(this.app, {
      provider: new ReCaptchaEnterpriseProvider(environment.recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }

  private fileToInlineData(file: File): Promise<{ data: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] ?? '';
        resolve({ data: base64, mimeType: file.type || 'image/jpeg' });
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}
