import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  created_at: string;
  updated_at: string;
};

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
