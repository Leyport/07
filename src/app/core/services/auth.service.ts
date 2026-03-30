import { Injectable, signal } from '@angular/core';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInWithPopup,
  GoogleAuthProvider, signOut, User, Auth
} from 'firebase/auth';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth: Auth;

  user = signal<User | null>(null);
  loading = signal(true);

  constructor() {
    const app = getApps().length ? getApps()[0] : initializeApp(environment.firebase);
    this.auth = getAuth(app);

    onAuthStateChanged(this.auth, u => {
      this.user.set(u);
      this.loading.set(false);
    });
  }

  signInWithGoogle(): Promise<void> {
    return signInWithPopup(this.auth, new GoogleAuthProvider()).then(() => {});
  }

  signOut(): Promise<void> {
    return signOut(this.auth);
  }
}
