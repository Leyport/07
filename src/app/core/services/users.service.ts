import { Injectable } from '@angular/core';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, updateDoc, Firestore } from 'firebase/firestore';
import { Observable } from 'rxjs';
import { AppUser } from '../models/app-user.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private db: Firestore;

  constructor() {
    const app = getApps().length ? getApps()[0] : initializeApp(environment.firebase);
    this.db = getFirestore(app);
  }

  getUsers(): Observable<AppUser[]> {
    return new Observable(observer => {
      const usersRef = collection(this.db, 'users');
      const unsubscribe = onSnapshot(usersRef, snapshot => {
        const users = snapshot.docs.map(d => ({
          uid: d.id,
          ...d.data(),
          requestedAt: d.data()['requestedAt']?.toDate?.() ?? undefined,
        })) as AppUser[];
        observer.next(users);
      }, err => observer.error(err));

      return () => unsubscribe();
    });
  }

  async setApproved(uid: string, approved: boolean): Promise<void> {
    await updateDoc(doc(this.db, 'users', uid), { approved });
  }
}
