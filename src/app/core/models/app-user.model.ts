export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  approved: boolean;
  admin: boolean;
  requestedAt?: Date;
}
