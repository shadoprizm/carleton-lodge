export type AdminSection =
  | 'members'
  | 'events'
  | 'summons'
  | 'library'
  | 'history'
  | 'gallery'
  | 'contact';

export type AdminPermissionLevel = 'read' | 'write';

export type AdminSectionPermission = {
  id: string;
  profile_id: string;
  section: AdminSection;
  can_read: boolean;
  can_write: boolean;
  granted_by: string | null;
  created_at: string;
  updated_at: string;
};

export const ADMIN_SECTIONS: Array<{
  id: AdminSection;
  label: string;
  description: string;
}> = [
  { id: 'members', label: 'Members', description: 'Roster and officer records' },
  { id: 'events', label: 'Events', description: 'Calendar events' },
  { id: 'summons', label: 'Summons', description: 'Monthly summons documents' },
  { id: 'library', label: 'Library', description: 'Document library' },
  { id: 'history', label: 'History', description: 'History timeline' },
  { id: 'gallery', label: 'Gallery', description: 'Photo albums and photos' },
  { id: 'contact', label: 'Contact', description: 'Contact form submissions' },
];

export function hasSectionPermission(
  isAdmin: boolean,
  permissions: AdminSectionPermission[],
  section: AdminSection,
  level: AdminPermissionLevel = 'read'
) {
  if (isAdmin) return true;

  const permission = permissions.find((item) => item.section === section);
  if (!permission) return false;

  return level === 'write'
    ? permission.can_write
    : permission.can_read || permission.can_write;
}
