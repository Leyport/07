// A free-form slug — built-in categories below, plus whatever custom ones users add.
export type CostCategory = string;
export type CostStatus = 'paid' | 'planned';

export interface CostCategoryMeta {
  value: CostCategory;
  label: string;
  icon: string;
  builtIn: boolean;
}

/** Permanent categories that ship with the app. Never deletable — existing bills are already tagged with these. */
export const COST_CATEGORIES: CostCategoryMeta[] = [
  { value: 'electricity', label: 'Electricity', icon: '⚡', builtIn: true },
  { value: 'water', label: 'Water', icon: '💧', builtIn: true },
  { value: 'gas', label: 'Gas', icon: '🔥', builtIn: true },
  { value: 'tax', label: 'Tax', icon: '🏛️', builtIn: true },
  { value: 'insurance', label: 'Insurance', icon: '🛡️', builtIn: true },
  { value: 'renovation', label: 'Renovation', icon: '🔨', builtIn: true },
  { value: 'other', label: 'Other', icon: '📌', builtIn: true },
];

/** A user-added category, stored in Firestore so it can be removed again later. */
export interface CustomCostCategory {
  id: string;
  value: string;
  label: string;
  icon: string;
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
  notes: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: 'image' | 'pdf';
  storagePath?: string;
  uploadedAt: Date;
  uploadedBy?: string;
  order: number;
}
