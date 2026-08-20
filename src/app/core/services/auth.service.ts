import { Injectable, signal, computed } from '@angular/core';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInWithPopup,
  GoogleAuthProvider, signOut, User, Auth
} from 'firebase/auth';
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot, Firestore
} from 'firebase/firestore';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth: Auth;
  private db: Firestore;
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
    const app = getApps().length ? getApps()[0] : initializeApp(environment.firebase);
    this.auth = getAuth(app);
    this.db = getFirestore(app);

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
