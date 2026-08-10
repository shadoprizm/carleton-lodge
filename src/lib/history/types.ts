/**
 * Data model for the public history archive under /history.
 *
 * This is static, curated, source-grounded data (see k3-handoff/). It is
 * deliberately separate from the Supabase `history_eras`/`history_milestones`
 * tables, which continue to feed the Lodge Guide knowledge search and the
 * admin history editor.
 */

export type DatePrecision = 'exact' | 'month' | 'year' | 'circa' | 'range';

export type Confidence = 'high' | 'medium' | 'unresolved';

export type ImageType =
  | 'historical_photo'
  | 'document_scan'
  | 'map'
  | 'modern_artifact_photo'
  | 'modern_photo'
  | 'ai_reconstruction';

export type RightsStatus =
  | 'cleared'
  | 'permission_required'
  | 'rights_check_required'
  | 'lodge_owned';

export type GalleryCategory =
  | 'historical_photographs'
  | 'buildings'
  | 'people'
  | 'documents_maps'
  | 'artifacts'
  | 'modern_lodge_history'
  | 'ai_reconstructions';

/** Image metadata per k3-handoff/IMAGE_POLICY.md, extended with a gallery category. */
export interface HistoryImage {
  id: string;
  title: string;
  dateLabel?: string;
  imageType: ImageType;
  sourceInstitution: string;
  sourceIdentifier?: string;
  rightsStatus: RightsStatus;
  creditLine: string;
  caption: string;
  alt: string;
  /** Root-relative path inside static/ — only set when the asset actually exists on disk. */
  localPath?: string;
  sourceUrl?: string;
  galleryCategory: GalleryCategory;
  /** Full provenance retained even when the front end shows a shorter credit. */
  provenance?: string;
  /** How the asset is (or will be) acquired — shown on pending placeholder cards. */
  acquisitionNote?: string;
  chapterIds?: string[];
}

export interface HistoryEvent {
  id: string;
  /** Raw date string as recorded in the source data, e.g. `1925/1926` or `1921-05`. */
  date: string;
  /** Normalized key used only for chronological ordering. */
  sortKey: string;
  precision: DatePrecision;
  dateLabel: string;
  title: string;
  summary: string;
  confidence: Confidence;
  sources: string[];
  chapterIds?: string[];
}

export interface HistorySource {
  id: string;
  title: string;
  publisherAuthor: string;
  url: string;
  locator: string;
  sourceType: string;
  confidence: string;
  notes: string;
}

export interface HistoryPerson {
  id: string;
  name: string;
  role: string;
  dateLabel?: string;
  bio: string;
  confidence: Confidence;
  sources: string[];
  imageId?: string;
  category: 'founder' | 'charter_member' | 'key_figure';
}

export interface HistoryPlace {
  id: string;
  name: string;
  dateLabel?: string;
  description: string;
  sources: string[];
  imageIds: string[];
}

export interface HistoryArtifact {
  id: string;
  name: string;
  description: string;
  status: 'held' | 'reported_unconfirmed' | 'pending_documentation';
  sources: string[];
  imageId?: string;
}

export interface HistoryChapter {
  id: string;
  slug: string;
  title: string;
  yearLabel: string;
  tagline: string;
  description: string;
  /** Key into the icon map in components/history/ChapterCard.tsx. */
  icon: string;
}

export interface OpenQuestion {
  id: string;
  title: string;
  known: string[];
  needed: string[];
  bestLead?: string;
}
