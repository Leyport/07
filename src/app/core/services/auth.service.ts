import { Injectable, signal, computed } from '@angular/core';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInWithPopup,
  GoogleAuthProvider, signOut, User, Auth
} from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private app: FirebaseApp;
  private auth: Auth;
  private db: Firestore | null = null;
  private profileUnsub: (() => void) | null = null;

  user = signal<User | null>(null);
  loading = signal(true);

  /** Whether the signed-in user's users/{uid} doc has approved: true. False while signed out. */
  approved = signal(false);
  admin = signal(false);
  profileLoading = signal(true);

  /** True once it's safe to show write UI (upload forms, edit/delete). */
  canWrite = computed(() => this.user() !== null && (this.approved() || this.admin()));

  constructor() {
    this.app = getApps().length ? getApps()[0] : initializeApp(environment.firebase);
    this.auth = getAuth(this.app);

    onAuthStateChanged(this.auth, async u => {
      this.user.set(u);
      this.loading.set(false);
      this.profileUnsub?.();
      this.profileUnsub = null;

      if (!u) {
        this.approved.set(false);
        this.admin.set(false);
        this.profileLoading.set(false);
        return;
      }

      this.profileLoading.set(true);
      // Firestore is only needed once someone's actually signed in — load it on demand
      // so the initial app bundle (auth alone) stays small.
      const { getFirestore, doc, getDoc, setDoc, onSnapshot } = await import('firebase/firestore');
      if (!this.db) this.db = getFirestore(this.app);

      const userRef = doc(this.db, 'users', u.uid);

      const snap = await getDoc(userRef).catch(() => null);
      if (!snap || !snap.exists()) {
        // First sign-in — request access. Always starts unapproved; only an admin can flip this.
        await setDoc(userRef, {
          email: u.email ?? '',
          displayName: u.displayName ?? '',
          photoURL: u.photoURL ?? '',
          approved: false,
          admin: false,
          requestedAt: new Date(),
        }).catch(() => {});
      }

      this.profileUnsub = onSnapshot(userRef, s => {
        const data = s.data();
        this.approved.set(data?.['approved'] === true);
        this.admin.set(data?.['admin'] === true);
        this.profileLoading.set(false);
      }, () => this.profileLoading.set(false));
    });
  }

  signInWithGoogle(): Promise<void> {
    return signInWithPopup(this.auth, new GoogleAuthProvider()).then(() => {});
  }

  signOut(): Promise<void> {
    return signOut(this.auth);
  }
}
