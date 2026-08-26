// A free-form slug — built-in categories below, plus whatever custom ones users add.
export type CostCategory = string;
export type CostStatus = 'paid' | 'planned';

export interface CostCategoryMeta {
  value: CostCategory;
  label: string;
  icon: string;
  color: string;
  builtIn: boolean;
}

/** Permanent categories that ship with the app. Never deletable — existing bills are already tagged with these. Icon/color can still be edited. */
export const COST_CATEGORIES: CostCategoryMeta[] = [
  { value: 'electricity', label: 'Electricity', icon: '⚡', color: '#f59e0b', builtIn: true },
  { value: 'water', label: 'Water', icon: '💧', color: '#3b82f6', builtIn: true },
  { value: 'gas', label: 'Gas', icon: '🔥', color: '#f97316', builtIn: true },
  { value: 'tax', label: 'Tax', icon: '🏛️', color: '#64748b', builtIn: true },
  { value: 'insurance', label: 'Insurance', icon: '🛡️', color: '#0d9488', builtIn: true },
  { value: 'renovation', label: 'Renovation', icon: '🔨', color: '#9333ea', builtIn: true },
  { value: 'other', label: 'Other', icon: '📌', color: '#6b7280', builtIn: true },
];

/**
 * A category customization stored in Firestore, keyed by its `value`. Either overrides the
 * icon/color of a built-in category, or (if `value` doesn't match a built-in) defines a
 * brand-new custom category the user added themselves.
 */
export interface CustomCostCategory {
  value: string;
  label: string;
  icon: string;
  color: string;
  order: number;
}

/** A payee, stored in Firestore keyed by `value` — an extensible list, same pattern as categories but with no built-ins. */
export interface CustomPayee {
  value: string;
  name: string;
  order: number;
}

/** A folder for grouping cost items (e.g. a project spanning several bills). No built-ins — starts empty. */
export interface CostFolder {
  id: string;
  name: string;
  order: number;
}

export interface CostItem {
  id: string;
  title: string;
  category: CostCategory;
  status: CostStatus;
  amount?: number;
  currency: string;
  date?: Date;
  payee?: string;
  folderId?: string | null;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  notes: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: 'image' | 'pdf';
  thumbnailUrl?: string;
  thumbnailPath?: string;
  storagePath?: string;
  uploadedAt: Date;
  uploadedBy?: string;
  order: number;
}
