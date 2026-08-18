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
  visibility: EventVisibility;
  event_status: EventStatus;
  status_note: string | null;
  notify_members: boolean;
  include_in_lodge_guide: boolean;
  source_issuer: string | null;
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
  created_at: string;
  updated_at: string;
};

export type MemberActivitySummary = {
  profile_id: string;
  full_name: string | null;
  email: string;
  joined_at: string;
  last_login_at: string | null;
  last_seen_at: string | null;
};

export type { AdminSection, AdminSectionPermission, AdminPermissionLevel } from './adminPermissions';

export type LodgePosition = {
  id: string;
  name: string;
  display_order: number;
  position_type: LodgePositionType;
  max_holders: number;
  created_at: string;
};

export type LodgePositionType = 'OFFICER' | 'FUNCTIONAL';

export type LodgeMemberPosition = {
  member_id: string;
  position_id: string;
  is_primary: boolean;
  assigned_at: string;
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
  alternate_phone: string | null;
  address: string | null;
  spouse_name: string | null;
  grand_lodge_membership_number: string | null;
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
  website_activation_invited_at: string | null;
  website_activation_requested_at: string | null;
  website_activated_at: string | null;
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
  positions: LodgePosition[];
};

export type MemberDirectoryProfile = Omit<
  LodgeMember,
  | 'email'
  | 'alternate_phone'
  | 'address'
  | 'spouse_name'
  | 'grand_lodge_membership_number'
  | 'mailbox_quota_mb'
  | 'mailbox_send_limit'
>;

export type MemberDirectoryProfileWithPosition = MemberDirectoryProfile & {
  lodge_positions: LodgePosition | null;
  positions: LodgePosition[];
};

export type MyMemberProfile = {
  id: string;
  full_name: string;
  phone: string | null;
  alternate_phone: string | null;
  address: string | null;
  spouse_name: string | null;
  join_date: string | null;
  position_id: string | null;
  position_name: string | null;
  bio: string | null;
  visible_to_members: boolean;
  lodge_email: string | null;
  mailbox_status: MailboxStatus;
  grand_lodge_membership_number: string | null;
  created_at: string;
  updated_at: string;
};

export type Summons = {
  id: string;
  title: string;
  month: string;
  content: string;
  pdf_url: string | null;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  published_at: string;
  created_by: string | null;
  notify_members: boolean;
  include_in_lodge_guide: boolean;
  source_issuer: string | null;
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
  notice_type: 'general' | 'memorial';
  notify_members: boolean;
  include_in_lodge_guide: boolean;
  source_issuer: string | null;
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
    | 'district_event'
    | 'grand_lodge_page'
    | 'district_page'
    | 'external_lodge_page';
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
  received_for_addresses: string[];
  subject: string | null;
  text_body: string | null;
  html_body: string | null;
  headers: Record<string, unknown>;
  attachments: Array<Record<string, unknown>>;
  raw_payload: Record<string, unknown>;
  message_sha256: string | null;
  retention_until: string;
  purge_claimed_at: string | null;
  content_purged_at: string | null;
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
  destination: 'carleton' | 'district';
  district_lodge_id: string | null;
  title: string;
  month: string;
  issue_date: string | null;
  content: string;
  notify_members: boolean;
  include_in_lodge_guide: boolean;
};

export type MailroomDistrictLodgeDraft = {
  id: string;
  district_name: 'Ottawa District 1' | 'Ottawa District 2';
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
  destination: 'carleton' | 'district';
  district_name: 'Ottawa District 1' | 'Ottawa District 2' | null;
  district_lodge_id: string | null;
  source_issuer: string;
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
  is_memorial_service: boolean;
  visibility: EventVisibility;
  notify_members: boolean;
  include_in_lodge_guide: boolean;
};

export type MailroomAnnouncementDraft = {
  title: string;
  body: string;
  priority: Announcement['priority'];
  visibility: Announcement['visibility'];
  notice_type: Announcement['notice_type'];
  expires_at: string | null;
  notify_members: boolean;
  include_in_lodge_guide: boolean;
  source_issuer: string;
};

export type MailroomLibraryDraft = {
  title: string;
  summary: string;
  source: string;
  source_url: string;
  source_file_name: string;
  source_storage_path: string;
  file_name: string;
  tags: string[];
  rights_reviewed: boolean;
  include_in_lodge_guide: boolean;
};

export type MailroomClassification =
  | 'carleton_summons'
  | 'district_summons'
  | 'carleton_event'
  | 'district_event'
  | 'memorial_notice'
  | 'announcement'
  | 'library_item'
  | 'sensitive_hold'
  | 'no_action';

export type MailroomProposal = {
  publication_target: 'carleton' | 'district' | 'mixed' | 'hold';
  classification: 'summons' | 'event' | 'announcement' | 'mixed' | 'other';
  classification_tags: MailroomClassification[];
  source_scope: 'carleton' | 'district_1' | 'district_2' | 'outside_scope' | 'unknown';
  source_issuer: string;
  sensitivity: 'normal' | 'memorial' | 'sensitive';
  needs_attachment_content: boolean;
  confidence: number;
  summary: string;
  summons: MailroomSummonsDraft | null;
  district_lodge: MailroomDistrictLodgeDraft | null;
  events: MailroomEventDraft[];
  announcements: MailroomAnnouncementDraft[];
  library_items: MailroomLibraryDraft[];
  warnings: string[];
  source_file?: {
    storage_path: string;
    file_name: string;
    file_size: number;
    content_type: string;
    provider_attachment_id: string;
  } | null;
  source_files: Array<{
    kind: 'attachment' | 'email_body';
    storage_path: string;
    file_name: string;
    file_size: number;
    content_type: string;
    provider_attachment_id: string;
    sha256: string;
  }>;
};

export type MailroomImport = {
  id: string;
  inbound_email_id: string;
  status: 'queued' | 'drafting' | 'needs_review' | 'approved' | 'rejected' | 'failed' | 'duplicate';
  processing_mode: 'manual' | 'shadow' | 'active';
  sender_email: string;
  sender_verified: boolean;
  classification: MailroomProposal['classification'] | null;
  classification_tags: MailroomClassification[];
  source_scope: MailroomProposal['source_scope'];
  source_issuer: string | null;
  confidence: number | null;
  summary: string | null;
  extracted_payload: MailroomProposal;
  approved_payload: MailroomProposal | null;
  source_file_sha256: string | null;
  source_attachment_sha256: string[];
  model: string | null;
  prompt_version: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_summons_id: string | null;
  published_event_ids: string[];
  published_announcement_ids: string[];
  published_district_summons_id: string | null;
  published_district_event_ids: string[];
  published_document_ids: string[];
  attempt_count: number;
  max_attempts: number;
  available_at: string;
  locked_at: string | null;
  duplicate_of_import_id: string | null;
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
  aliases: string[];
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
  source_issuer: string | null;
  include_in_lodge_guide: boolean;
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
  lodge_id: string | null;
  summons_id: string | null;
  district_name: 'Ottawa District 1' | 'Ottawa District 2';
  trusted_source_id: string | null;
  external_uid: string | null;
  source_url: string | null;
  source_checked_at: string | null;
  source_issuer: string | null;
  include_in_lodge_guide: boolean;
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

export type TrustedKnowledgeSourceAuthority =
  | 'grand_lodge'
  | 'district_1'
  | 'district_2'
  | 'lodge';

export type TrustedKnowledgeSource = {
  id: string;
  name: string;
  authority: TrustedKnowledgeSourceAuthority;
  district_name: 'Ottawa District 1' | 'Ottawa District 2' | null;
  source_kind: 'page' | 'calendar_ics';
  source_url: string;
  domain: string;
  enabled: boolean;
  allow_live_search: boolean;
  refresh_interval_minutes: number;
  fetch_status: 'pending' | 'refreshing' | 'healthy' | 'unchanged' | 'error';
  last_checked_at: string | null;
  last_success_at: string | null;
  last_changed_at: string | null;
  last_http_status: number | null;
  last_error: string | null;
  consecutive_failures: number;
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
  summons_id: string | null;
  display_order: number;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  storage_bucket: string | null;
  tags: string[];
  uploaded_by: string | null;
  source_issuer: string | null;
  source_url: string | null;
  rights_reviewed: boolean;
  include_in_lodge_guide: boolean;
  source_mailroom_import_id: string | null;
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

export const PHOTO_BUCKET = 'lodge-photos';

/** Long enough to browse an album without images expiring mid-scroll. */
const PHOTO_URL_TTL_SECONDS = 3600;

/**
 * The photo bucket is private, so album/photo `visibility` protects the bytes
 * and not just the rows. Displaying an image therefore means minting a
 * short-lived signed URL for it, the same way the document library and summons
 * already do. Signed in one batch per view rather than one request per image.
 *
 * Paths the caller isn't allowed to read simply don't come back, so a missing
 * entry means "not permitted" and the caller renders its empty state.
 */
export async function signPhotoPaths(paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(unique, PHOTO_URL_TTL_SECONDS);

  if (error || !data) return new Map();

  const signedUrls = new Map<string, string>();

  for (const entry of data) {
    if (entry.path && entry.signedUrl && !entry.error) {
      signedUrls.set(entry.path, entry.signedUrl);
    }
  }

  return signedUrls;
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
