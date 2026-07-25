import { createClient } from '@supabase/supabase-js';

// The lodge runs on its own dedicated Supabase project, which keeps its tables
// in the standard `public` schema (so no schema override is needed).
//
// These values are baked in rather than read from the environment. The anon key
// is a public, RLS-protected client key — it ships in the browser bundle either
// way — and reading the URL from an env var meant a stale value in the hosting
// dashboard could silently point the site at the old shared project. One source
// of truth, nothing to misconfigure per-environment.
export const SUPABASE_URL = 'https://isnxsygngysxgzeuhmjm.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzbnhzeWduZ3lzeGd6ZXVobWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4OTkxNDQsImV4cCI6MjEwMDQ3NTE0NH0.PVR9vaMo2i_3Qk2UFLmhDA_i-M7G0BCNZQudCsXeeYA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type Event = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  event_end_time: string | null;
  location: string;
  location_address: string | null;
  poc_name: string | null;
  poc_contact: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type HistoryEntry = {
  id: string;
  title: string;
  content: string;
  year: number | null;
  image_url: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  email: string;
  is_admin: boolean;
  force_password_change: boolean;
  last_sign_in_at: string | null;
  created_at: string;
  updated_at: string;
};

export type { AdminSection, AdminSectionPermission, AdminPermissionLevel } from './adminPermissions';

export type LodgePosition = {
  id: string;
  name: string;
  display_order: number;
  created_at: string;
};

export type MemberProfile = {
  id: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  join_date: string | null;
  position_id: string | null;
  bio: string | null;
  visible_to_members: boolean;
  created_at: string;
  updated_at: string;
};

export type MemberWithPosition = MemberProfile & {
  position: LodgePosition | null;
};

export type LodgeMember = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  join_date: string | null;
  position_id: string | null;
  bio: string | null;
  visible_to_members: boolean;
  linked_profile_id: string | null;
  created_at: string;
  updated_at: string;
};

export type LodgeMemberWithPosition = LodgeMember & {
  lodge_positions: LodgePosition | null;
};

export type Summons = {
  id: string;
  title: string;
  month: string;
  content: string;
  pdf_url: string | null;
  published_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type NotificationPreferences = {
  id: string;
  email_notifications: boolean;
  notify_new_summons: boolean;
  notify_new_events: boolean;
  notify_event_updates: boolean;
  created_at: string;
  updated_at: string;
};

export type DocumentCategory = {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type Document = {
  id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  storage_bucket: string | null;
  tags: string[];
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentWithCategory = Document & {
  document_categories: DocumentCategory | null;
};

export type PhotoAlbum = {
  id: string;
  title: string;
  description: string | null;
  cover_photo_id: string | null;
  cover_image_url: string | null;
  cover_image_path: string | null;
  visibility: 'public' | 'members' | 'admin';
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Photo = {
  id: string;
  album_id: string | null;
  title: string | null;
  description: string | null;
  storage_path: string;
  public_url: string;
  original_filename: string;
  file_size: number;
  width: number;
  height: number;
  taken_at: string | null;
  visibility: 'public' | 'members' | 'admin' | 'inherit';
  uploaded_by: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type PhotoAlbumWithCover = PhotoAlbum & {
  cover_photo: Photo | null;
  photo_count?: number;
};

/**
 * Get a proxy URL for a file that hides the Supabase storage URL.
 * This returns a URL on the same domain (e.g., /file/bucket/path/to/file.pdf)
 * instead of the full Supabase storage URL.
 */
export function getProxyFileUrl(bucket: string, path: string): string {
  return `/file/${bucket}/${path}`;
}

/**
 * Fetch a file through the proxy with authentication.
 * Returns a Blob URL that can be used for previews/downloads.
 * The URL will be on the same domain (blob: URL or proxied URL).
 */
export async function fetchFileThroughProxy(
  bucket: string,
  path: string,
  sessionToken: string | null
): Promise<{ url: string; blob?: Blob }> {
  // Get a signed URL first (for authentication)
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60);

  if (error || !data?.signedUrl) {
    throw new Error('Failed to get file URL');
  }

  // Fetch the file through our proxy to hide the Supabase URL
  const proxyUrl = getProxyFileUrl(bucket, path);
  const headers: Record<string, string> = {};
  
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }

  const response = await fetch(proxyUrl, { headers });
  
  if (!response.ok) {
    throw new Error('Failed to fetch file');
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  
  return { url: blobUrl, blob };
}
