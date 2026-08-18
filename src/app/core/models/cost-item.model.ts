export type CostCategory = 'electricity' | 'water' | 'gas' | 'tax' | 'insurance' | 'renovation' | 'other';
export type CostStatus = 'paid' | 'planned';

export interface CostCategoryMeta {
  value: CostCategory;
  label: string;
  icon: string;
}

export const COST_CATEGORIES: CostCategoryMeta[] = [
  { value: 'electricity', label: 'Electricity', icon: '⚡' },
  { value: 'water', label: 'Water', icon: '💧' },
  { value: 'gas', label: 'Gas', icon: '🔥' },
  { value: 'tax', label: 'Tax', icon: '🏛️' },
  { value: 'insurance', label: 'Insurance', icon: '🛡️' },
  { value: 'renovation', label: 'Renovation', icon: '🔨' },
  { value: 'other', label: 'Other', icon: '📌' },
];

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
