export type MediaType = 'image' | 'video';
export type SectionType = 'opening' | 'closing' | 'tips' | 'photos';

export interface MediaItem {
  id: string;
  section: SectionType;
  title: string;
  description: string;
  type: MediaType;
  url: string;
  thumbnailUrl?: string;
  thumbnailPath?: string;
  storagePath: string;
  uploadedAt: Date;
  uploadedBy?: string;
  photoDate?: Date;
  order: number;
}
