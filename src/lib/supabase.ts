import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: 'carletonlodge' }
});

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

export type EventSubmissionStatus = 'pending' | 'approved' | 'rejected';

export type EventSubmission = {
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
  status: EventSubmissionStatus;
  created_by: string;
  submitter_email: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  published_event_id: string | null;
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

export type NotificationOutboxItem = {
  id: string;
  channel: 'email';
  notification_type: string;
  recipient_profile_id: string | null;
  recipient_email: string;
  payload: Record<string, unknown>;
  status: 'queued' | 'processing' | 'sent' | 'failed' | 'cancelled';
  provider: string | null;
  provider_message_id: string | null;
  idempotency_key: string;
  attempt_count: number;
  max_attempts: number;
  available_at: string;
  locked_at: string | null;
  sent_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type InboundEmail = {
  id: string;
  provider: string;
  provider_message_id: string;
  from_address: string | null;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string | null;
  text_body: string | null;
  html_body: string | null;
  headers: Record<string, unknown>;
  attachments: Array<Record<string, unknown>>;
  raw_payload: Record<string, unknown>;
  processing_status: 'received' | 'processing' | 'processed' | 'ignored' | 'failed';
  received_at: string;
  processed_at: string | null;
  last_error: string | null;
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

export async function getSignedStorageUrl(
  bucket: string,
  path: string | null | undefined,
  expiresInSeconds = 3600
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

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
