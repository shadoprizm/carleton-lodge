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
  visibility: EventVisibility;
  event_status: EventStatus;
  status_note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type EventVisibility = 'public' | 'members' | 'admin';
export type EventStatus = 'scheduled' | 'cancelled' | 'postponed';
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
  visibility: EventVisibility;
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
  lodge_email: string | null;
  mailbox_status: MailboxStatus;
  mailbox_quota_mb: number;
  mailbox_send_limit: number;
  mailbox_provisioned_at: string | null;
  mailbox_activated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MailboxStatus =
  | 'unprovisioned'
  | 'provisioning'
  | 'pending_activation'
  | 'active'
  | 'error'
  | 'suspended';

export type LodgeEmailAccountType = 'MEMBER' | 'OFFICER' | 'FUNCTIONAL';
export type LodgeEmailAccountStatus =
  | 'NOT_PROVISIONED'
  | 'PROVISIONING'
  | 'INVITATION_PENDING'
  | 'TERMS_PENDING'
  | 'PASSWORD_SETUP_PENDING'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'DISABLED'
  | 'ERROR';
export type LodgeEmailCredentialStatus =
  | 'UNKNOWN'
  | 'PROVISIONED_LOCKED'
  | 'USER_SET'
  | 'ROTATED'
  | 'ERROR';

export type LodgeEmailAccount = {
  id: string;
  address: string;
  account_type: LodgeEmailAccountType;
  status: LodgeEmailAccountStatus;
  provider: 'mxroute';
  provider_mailbox_identifier: string | null;
  associated_member_id: string | null;
  position_id: string | null;
  current_authorized_member_id: string | null;
  display_name: string;
  enabled: boolean;
  handover_behavior: 'ROTATE_CREDENTIALS';
  agreement_required: boolean;
  credential_status: LodgeEmailCredentialStatus;
  provider_status: Record<string, unknown>;
  provisioned_at: string | null;
  activated_at: string | null;
  suspended_at: string | null;
  disabled_at: string | null;
  last_credential_rotation_at: string | null;
  last_handover_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MyLodgeEmailAccount = {
  id: string;
  address: string;
  account_type: LodgeEmailAccountType;
  status: LodgeEmailAccountStatus;
  display_name: string;
  position_id: string | null;
  position_name: string | null;
  credential_status: LodgeEmailCredentialStatus;
  provisioned_at: string | null;
  activated_at: string | null;
  last_credential_rotation_at: string | null;
  last_handover_at: string | null;
  policy_version_id: string;
  policy_title: string;
  policy_version: number;
  policy_content: string;
  policy_acknowledgement: string;
  policy_effective_at: string;
  agreement_accepted_at: string | null;
  needs_agreement: boolean;
  needs_password_setup: boolean;
};

export type EmailAgreementReceipt = {
  acceptance_id: string;
  member_name: string;
  email_address: string;
  position_name: string | null;
  agreement_title: string;
  agreement_version: number;
  effective_at: string;
  accepted_at: string;
  acknowledgement: string;
  policy_content: string;
};

export type EmailPolicyVersion = {
  id: string;
  policy_type: 'MEMBER_EMAIL_TERMS' | 'OFFICER_EMAIL_AGREEMENT';
  title: string;
  version: number;
  content: string;
  acknowledgement: string;
  effective_at: string;
  is_active: boolean;
  requires_reacceptance: boolean;
  created_by: string | null;
  created_at: string;
};

export type OfficerMailboxAssignment = {
  id: string;
  email_account_id: string;
  position_id: string;
  member_id: string;
  assignment_start: string;
  assignment_end: string | null;
  status: 'PENDING' | 'ACTIVE' | 'ENDED' | 'REVOKED' | 'CANCELLED';
  handover_id: string | null;
  assigned_by: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
};

export type OfficerEmailHandover = {
  id: string;
  email_account_id: string;
  position_id: string;
  outgoing_member_id: string | null;
  incoming_member_id: string | null;
  initiated_by: string;
  initiated_at: string;
  confirmed_at: string | null;
  state:
    | 'PENDING_CONFIRMATION'
    | 'INITIATED'
    | 'REVOKING_ACCESS'
    | 'ROTATING_CREDENTIALS'
    | 'WAITING_FOR_ACCEPTANCE'
    | 'WAITING_FOR_PASSWORD'
    | 'ACTIVE'
    | 'FAILED'
    | 'CANCELLED';
  outgoing_access_revoked_at: string | null;
  credentials_rotated_at: string | null;
  incoming_invited_at: string | null;
  incoming_accepted_at: string | null;
  incoming_activated_at: string | null;
  completed_at: string | null;
  failure_step: string | null;
  failure_message: string | null;
  reason: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
};

export type LodgeEmailAuditEvent = {
  id: string;
  event_type: string;
  email_account_id: string | null;
  member_id: string | null;
  position_id: string | null;
  handover_id: string | null;
  actor_profile_id: string | null;
  outcome: 'SUCCESS' | 'FAILURE' | 'WARNING';
  details: Record<string, unknown>;
  created_at: string;
};

export type LodgeMemberWithPosition = LodgeMember & {
  lodge_positions: LodgePosition | null;
};

export type MemberDirectoryProfile = Omit<
  LodgeMember,
  'email' | 'address' | 'mailbox_quota_mb' | 'mailbox_send_limit'
>;

export type MemberDirectoryProfileWithPosition = MemberDirectoryProfile & {
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
  notify_announcements: boolean;
  created_at: string;
  updated_at: string;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  priority: 'normal' | 'important' | 'urgent';
  visibility: 'public' | 'members';
  is_published: boolean;
  published_at: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type HelpTopic = {
  id: string;
  category: string;
  title: string;
  body: string;
  keywords: string[];
  url: string;
  visibility: 'public' | 'members';
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type LodgeSearchResult = {
  id: string;
  source_type:
    | 'event'
    | 'announcement'
    | 'summons'
    | 'document'
    | 'history'
    | 'member'
    | 'help'
    | 'district_lodge'
    | 'district_summons'
    | 'district_event';
  source_id: string;
  title: string;
  snippet: string;
  source_url: string;
  visibility: 'public' | 'members' | 'admin';
  source_updated_at: string;
  rank: number;
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

export type TrustedEmailSender = {
  id: string;
  email: string;
  label: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MailroomSummonsDraft = {
  title: string;
  month: string;
  issue_date: string | null;
  content: string;
};

export type MailroomDistrictLodgeDraft = {
  name: string;
  lodge_number: string;
  location: string;
  website_url: string;
  worshipful_master_name: string;
  secretary_name: string;
  contact_email: string;
  contact_phone: string;
  details_as_of: string | null;
};

export type MailroomEventDraft = {
  title: string;
  description: string;
  event_date: string | null;
  event_time: string | null;
  event_end_time: string | null;
  location: string;
  location_address: string;
  poc_name: string;
  poc_contact: string;
  event_kind: 'meeting' | 'emergent' | 'installation' | 'social' | 'official_visit' | 'other';
  degree: 'unspecified' | 'none' | 'first' | 'second' | 'third' | 'installation' | 'other';
  visibility: EventVisibility;
};

export type MailroomAnnouncementDraft = {
  title: string;
  body: string;
  priority: Announcement['priority'];
  visibility: Announcement['visibility'];
};

export type MailroomProposal = {
  publication_target: 'carleton' | 'district';
  classification: 'summons' | 'event' | 'announcement' | 'mixed' | 'other';
  confidence: number;
  summary: string;
  summons: MailroomSummonsDraft | null;
  district_lodge: MailroomDistrictLodgeDraft | null;
  events: MailroomEventDraft[];
  announcements: MailroomAnnouncementDraft[];
  warnings: string[];
  source_file?: {
    storage_path: string;
    file_name: string;
    file_size: number;
    content_type: string;
    provider_attachment_id: string;
  } | null;
};

export type MailroomImport = {
  id: string;
  inbound_email_id: string;
  status: 'drafting' | 'needs_review' | 'approved' | 'rejected' | 'failed';
  sender_email: string;
  sender_verified: boolean;
  classification: MailroomProposal['classification'] | null;
  confidence: number | null;
  summary: string | null;
  extracted_payload: MailroomProposal;
  approved_payload: MailroomProposal | null;
  source_file_sha256: string | null;
  model: string | null;
  prompt_version: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_summons_id: string | null;
  published_event_ids: string[];
  published_announcement_ids: string[];
  published_district_summons_id: string | null;
  published_district_event_ids: string[];
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type DistrictLodge = {
  id: string;
  district_name: string;
  name: string;
  lodge_number: string | null;
  slug: string;
  location: string | null;
  website_url: string | null;
  worshipful_master_name: string | null;
  secretary_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  details_as_of: string | null;
  created_at: string;
  updated_at: string;
};

export type DistrictSummons = {
  id: string;
  lodge_id: string;
  title: string;
  issue_label: string;
  issue_date: string | null;
  content: string;
  pdf_url: string | null;
  published_by: string | null;
  published_at: string;
  created_at: string;
  updated_at: string;
  district_lodges: DistrictLodge | null;
};

export type DistrictEventDegree =
  | 'unspecified'
  | 'none'
  | 'first'
  | 'second'
  | 'third'
  | 'installation'
  | 'other';

export type DistrictEvent = {
  id: string;
  lodge_id: string;
  summons_id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  event_end_time: string | null;
  location: string;
  location_address: string | null;
  event_kind: 'meeting' | 'emergent' | 'installation' | 'social' | 'official_visit' | 'other';
  degree: DistrictEventDegree;
  contact_name: string | null;
  contact_details: string | null;
  created_at: string;
  updated_at: string;
  district_lodges: DistrictLodge | null;
  district_summons: Pick<DistrictSummons, 'id' | 'title' | 'pdf_url'> | null;
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
