import { Injectable, signal } from '@angular/core';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore, collection, getDocs, addDoc, deleteDoc,
  doc, query, orderBy, onSnapshot, updateDoc, setDoc, deleteField, Firestore
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
  /** A hotlinked poster URL (from searchPosters) chosen before the disc even exists yet. */
  photoUrl?: string;
}

/** One poster option from TMDb, at thumbnail size for the picker grid. */
export interface PosterOption {
  url: string;
}

/** One candidate film found on a scanned photo, awaiting user review before it's saved. */
export interface DvdScanCandidate {
  title: string;
  year?: number;
  genre: DvdGenre;
  summary: string;
  director?: string;
  /** A crop of the source photo around just this disc's case, if Gemini could locate it. */
  thumbnailBlob?: Blob;
}

interface ScanBoundingBox {
  yMin: number;
  xMin: number;
  yMax: number;
  xMax: number;
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
      ...(input.photoUrl ? { photoUrl: input.photoUrl } : {}),
      addedAt: new Date(),
      order: existing.size
    });
  }

  /**
   * Saves one disc with a photo attached — used by the manual "add" form when the user wants
   * a picture of that specific case, and by the scan-review flow's per-disc cropped thumbnails
   * (a plain Blob, not a File, since those are cropped client-side rather than user-selected).
   */
  addDvdWithPhoto(input: DvdInput, file: File | Blob): Observable<DvdUploadProgress> {
    return new Observable(observer => {
      this.uploading.set(true);

      const ext = (file.type.split('/')[1] || 'jpg').split('+')[0];
      const photoPath = `dvds/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
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

  /** Attaches or replaces an existing disc's own photo — uploads a new file, removes any prior one. */
  updateDvdPhoto(id: string, file: File | Blob, oldPhotoPath?: string | null): Observable<DvdUploadProgress> {
    return new Observable(observer => {
      this.uploading.set(true);

      const ext = (file.type.split('/')[1] || 'jpg').split('+')[0];
      const photoPath = `dvds/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
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
            if (oldPhotoPath) {
              await deleteObject(ref(this.storage, oldPhotoPath)).catch(() => {});
            }
            await updateDoc(doc(this.db, 'dvds', id), { photoUrl, photoPath });

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

  /** Sets an existing disc's photo to a hotlinked URL (a chosen TMDb poster) instead of an uploaded file. */
  async setPhotoUrl(id: string, photoUrl: string, oldPhotoPath?: string | null): Promise<void> {
    if (oldPhotoPath) {
      await deleteObject(ref(this.storage, oldPhotoPath)).catch(() => {});
    }
    await updateDoc(doc(this.db, 'dvds', id), { photoUrl, photoPath: deleteField() });
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
   * Looks up a film on TMDb by title (+ year, if known) and returns its available poster
   * artwork as thumbnail-sized image URLs, best-rated first, for a "pick one" grid. Hotlinks
   * TMDb's own image CDN rather than downloading/re-hosting — that's what it's there for.
   */
  async searchPosters(title: string, year?: number): Promise<PosterOption[]> {
    const headers = { Authorization: `Bearer ${environment.tmdbAccessToken}`, accept: 'application/json' };

    const searchUrl = new URL('https://api.themoviedb.org/3/search/movie');
    searchUrl.searchParams.set('query', title);
    if (year) searchUrl.searchParams.set('year', String(year));

    const searchRes = await fetch(searchUrl, { headers });
    if (!searchRes.ok) throw new Error(`TMDb search failed (${searchRes.status}).`);
    const searchData = await searchRes.json();
    const match = searchData.results?.[0];
    if (!match) return [];

    const imagesRes = await fetch(`https://api.themoviedb.org/3/movie/${match.id}/images`, { headers });
    if (!imagesRes.ok) throw new Error(`TMDb images lookup failed (${imagesRes.status}).`);
    const imagesData = await imagesRes.json();

    const posters = (imagesData.posters ?? []) as { file_path: string; vote_average: number; iso_639_1: string | null }[];
    return posters
      .filter(p => p.iso_639_1 === 'en' || p.iso_639_1 === null)
      .sort((a, b) => b.vote_average - a.vote_average)
      .slice(0, 6)
      .map(p => ({ url: `https://image.tmdb.org/t/p/w342${p.file_path}` }));
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

      // Vertex AI backend bills through this project's own linked Cloud Billing account
      // (this project is on the Blaze plan) rather than the Gemini Developer API's separate
      // AI Studio Prepay system, which has been unreliable for this project.
      const { getAI, getGenerativeModel, VertexAIBackend, Schema } = await import('firebase/ai');

      // 'global' rather than the SDK's default 'us-central1' — Google recommends it for
      // most models and it's where newer models are actually published first.
      const ai = getAI(this.app, { backend: new VertexAIBackend('global') });
      const model = getGenerativeModel(ai, {
        // Vertex AI's publisher model catalog differs from the Gemini Developer API's —
        // gemini-3.6-flash isn't published there. gemini-3.5-flash-lite is a current,
        // stable, general-use model available in regional (non-"global") locations.
        model: 'gemini-3.5-flash-lite',
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
                boundingBox: Schema.object({
                  description: 'A tight box around just this disc\'s case in the photo, normalized to a 0-1000 scale where (0,0) is the top-left corner and (1000,1000) is the bottom-right corner.',
                  properties: {
                    yMin: Schema.integer(), xMin: Schema.integer(),
                    yMax: Schema.integer(), xMax: Schema.integer(),
                  }
                }),
              },
              optionalProperties: ['year', 'director', 'boundingBox'],
            })
          })
        }
      });

      const results: DvdScanCandidate[] = [];
      for (const file of files) {
        const inlineData = await this.fileToInlineData(file);
        const prompt = 'This photo shows one or more physical DVD, Blu-ray, or box-set cases (front cover or spine). ' +
          'Identify each distinct film or TV box-set you can see. Ignore duplicates of the same title. ' +
          'For each one, return its title, best-guess release year, one genre from the allowed list, a short plot summary, ' +
          'the director if you know it, and a tight bounding box around just that disc\'s case.';

        const result = await model.generateContent([prompt, { inlineData }]);
        const text = result.response.text();
        try {
          const parsed = JSON.parse(text) as (DvdScanCandidate & { boundingBox?: ScanBoundingBox })[];
          let bitmap: ImageBitmap | null = null;

          for (const item of parsed) {
            if (item.boundingBox) {
              bitmap ??= await createImageBitmap(file).catch(() => null);
              if (bitmap) {
                item.thumbnailBlob = (await this.cropThumbnail(bitmap, item.boundingBox)) ?? undefined;
              }
              delete item.boundingBox;
            }
            results.push(item);
          }

          bitmap?.close();
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

  /** Crops a 0-1000-normalized bounding box out of a decoded photo into a small JPEG thumbnail. */
  private cropThumbnail(bitmap: ImageBitmap, box: ScanBoundingBox, maxDim = 480): Promise<Blob | null> {
    const x = Math.max(0, Math.round((box.xMin / 1000) * bitmap.width));
    const y = Math.max(0, Math.round((box.yMin / 1000) * bitmap.height));
    const w = Math.min(bitmap.width - x, Math.round(((box.xMax - box.xMin) / 1000) * bitmap.width));
    const h = Math.min(bitmap.height - y, Math.round(((box.yMax - box.yMin) / 1000) * bitmap.height));
    if (w <= 0 || h <= 0) return Promise.resolve(null);

    const scale = Math.min(1, maxDim / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, x, y, w, h, 0, 0, canvas.width, canvas.height);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
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
