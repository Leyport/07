// A free-form slug — built-in genres below, plus whatever custom ones users add.
export type DvdGenre = string;
export type DvdFormat = 'dvd' | 'bluray' | 'boxset';

export interface DvdGenreMeta {
  value: DvdGenre;
  label: string;
  icon: string;
  color: string;
  builtIn: boolean;
}

/** Permanent genres that ship with the app. Never deletable — existing discs may already be tagged with these. Icon/color can still be edited. */
export const DVD_GENRES: DvdGenreMeta[] = [
  { value: 'action', label: 'Action', icon: '💥', color: '#dc2626', builtIn: true },
  { value: 'comedy', label: 'Comedy', icon: '😂', color: '#eab308', builtIn: true },
  { value: 'drama', label: 'Drama', icon: '🎭', color: '#7c3aed', builtIn: true },
  { value: 'horror', label: 'Horror', icon: '🔪', color: '#1f2937', builtIn: true },
  { value: 'scifi-fantasy', label: 'Sci-Fi & Fantasy', icon: '🚀', color: '#0891b2', builtIn: true },
  { value: 'animation-family', label: 'Animation & Family', icon: '🧸', color: '#f97316', builtIn: true },
  { value: 'documentary', label: 'Documentary', icon: '🎥', color: '#0d9488', builtIn: true },
  { value: 'thriller', label: 'Thriller', icon: '🕵️', color: '#334155', builtIn: true },
  { value: 'tv-boxset', label: 'TV Series / Box Set', icon: '📺', color: '#4338ca', builtIn: true },
  { value: 'other', label: 'Other', icon: '📌', color: '#6b7280', builtIn: true },
];

/**
 * A genre customization stored in Firestore, keyed by its `value`. Either overrides the
 * icon/color of a built-in genre, or (if `value` doesn't match a built-in) defines a
 * brand-new custom genre the user added themselves.
 */
export interface CustomDvdGenre {
  value: string;
  label: string;
  icon: string;
  color: string;
  order: number;
}

/** A folder for grouping discs (e.g. "Kids' shelf", "To watch"). No built-ins — starts empty. */
export interface DvdFolder {
  id: string;
  name: string;
  order: number;
}

export interface DvdItem {
  id: string;
  title: string;
  year?: number;
  genre: DvdGenre;
  format: DvdFormat;
  summary: string;
  director?: string;
  folderId?: string | null;
  photoUrl?: string;
  photoPath?: string;
  addedAt: Date;
  addedBy?: string;
  order: number;
}
