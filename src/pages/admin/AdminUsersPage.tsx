import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Search, Shield, User } from 'lucide-react';
import { supabase, type Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ADMIN_SECTIONS,
  type AdminSection,
  type AdminSectionPermission,
} from '../../lib/adminPermissions';

type UserFilter = 'all' | 'admins' | 'delegated' | 'members';
type SectionAccess = 'none' | 'read' | 'write';

type SectionPermissionDraft = {
  access: SectionAccess;
  canApprove: boolean;
};

type UserAccessDraft = {
  isAdmin: boolean;
  sections: Record<AdminSection, SectionPermissionDraft>;
};

type SaveStatus = {
  type: 'success' | 'error';
  message: string;
};

const FILTER_OPTIONS: Array<{ value: UserFilter; label: string }> = [
  { value: 'all', label: 'All users' },
  { value: 'admins', label: 'Full administrators' },
  { value: 'delegated', label: 'Delegated access' },
  { value: 'members', label: 'No admin access' },
];

const ACCESS_OPTIONS: Array<{ value: SectionAccess; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'read', label: 'View' },
  { value: 'write', label: 'Edit' },
];

const permissionHasAccess = (permission: AdminSectionPermission) =>
  permission.can_read || permission.can_write || permission.can_approve;

const permissionToDraft = (
  section: AdminSection,
  permission: AdminSectionPermission | undefined
): SectionPermissionDraft => ({
  access: permission?.can_write
    ? 'write'
    : permission && permissionHasAccess(permission)
      ? 'read'
      : 'none',
  canApprove: section === 'events' && !!permission?.can_approve,
});

const createUserDraft = (
  profile: Profile,
  profilePermissions: AdminSectionPermission[]
): UserAccessDraft => ({
  isAdmin: profile.is_admin,
  sections: Object.fromEntries(
    ADMIN_SECTIONS.map((section) => [
      section.id,
      permissionToDraft(
        section.id,
        profilePermissions.find((permission) => permission.section === section.id)
      ),
    ])
  ) as Record<AdminSection, SectionPermissionDraft>,
});

const draftToFlags = (section: AdminSection, draft: SectionPermissionDraft) => ({
  can_read: draft.access !== 'none' || (section === 'events' && draft.canApprove),
  can_write: section !== 'activity' && draft.access === 'write',
  can_approve: section === 'events' && draft.canApprove,
});

const draftHasChanges = (
  profile: Profile,
  profilePermissions: AdminSectionPermission[],
  draft: UserAccessDraft
) => {
  if (profile.is_admin !== draft.isAdmin) return true;

  return ADMIN_SECTIONS.some((section) => {
    const existing = profilePermissions.find((permission) => permission.section === section.id);
    const next = draftToFlags(section.id, draft.sections[section.id]);

    return (
      !!existing?.can_read !== next.can_read ||
      !!existing?.can_write !== next.can_write ||
      !!existing?.can_approve !== next.can_approve
    );
  });
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    return String(error.message);
  }
  return 'Something went wrong. Please try again.';
};

const getRole = (profile: Profile, profilePermissions: AdminSectionPermission[]) => {
  if (profile.is_admin) return 'admin';
  return profilePermissions.some(permissionHasAccess) ? 'delegated' : 'member';
};

const getAccessSummary = (profile: Profile, profilePermissions: AdminSectionPermission[]) => {
  if (profile.is_admin) return 'Full access to every section';

  const summaries = ADMIN_SECTIONS.flatMap((section) => {
    const permission = profilePermissions.find((item) => item.section === section.id);
    if (!permission || !permissionHasAccess(permission)) return [];

    const access = permission.can_write ? 'Edit' : 'View';
    return [`${section.label}: ${access}${permission.can_approve ? ' + approve' : ''}`];
  });

  if (summaries.length === 0) return 'No section access';
  if (summaries.length <= 2) return summaries.join(' · ');
  return `${summaries.slice(0, 2).join(' · ')} · +${summaries.length - 2}`;
};

const formatJoinedDate = (date: string) =>
  new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

type PermissionMatrixProps = {
  profileId: string;
  sections: Record<AdminSection, SectionPermissionDraft>;
  onAccessChange: (section: AdminSection, access: SectionAccess) => void;
  onApprovalChange: (approved: boolean) => void;
};

const PermissionMatrix = ({
  profileId,
  sections,
  onAccessChange,
  onApprovalChange,
}: PermissionMatrixProps) => (
  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
    <div className="hidden grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-5 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
      <span>Section</span>
      <span>Access</span>
      <span className="w-36">Additional</span>
    </div>

    <div className="divide-y divide-slate-100">
      {ADMIN_SECTIONS.map((section) => {
        const sectionDraft = sections[section.id];
        const options = section.id === 'activity' ? ACCESS_OPTIONS.slice(0, 2) : ACCESS_OPTIONS;

        return (
          <div
            key={section.id}
            className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-5"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-800">{section.label}</div>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">{section.description}</p>
            </div>

            <fieldset>
              <legend className="sr-only">{section.label} access</legend>
              <div className="inline-flex rounded-lg bg-slate-100 p-1">
                {options.map((option) => (
                  <label key={option.value} className="cursor-pointer">
                    <input
                      type="radio"
                      name={`${profileId}-${section.id}-access`}
                      value={option.value}
                      checked={sectionDraft.access === option.value}
                      onChange={() => onAccessChange(section.id, option.value)}
                      aria-label={`${option.label} ${section.label}`}
                      className="peer sr-only"
                    />
                    <span className="block rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors peer-checked:bg-white peer-checked:text-slate-900 peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-slate-900 peer-focus-visible:ring-offset-1">
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="sm:w-36">
              {section.id === 'events' ? (
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={sectionDraft.canApprove}
                    onChange={(event) => onApprovalChange(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-amber-700 focus:ring-amber-600"
                  />
                  Approve submissions
                </label>
              ) : (
                <span className="hidden text-xs text-slate-300 sm:inline">—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

type UserAccordionItemProps = {
  profile: Profile;
  profilePermissions: AdminSectionPermission[];
  currentUserId: string | undefined;
  expanded: boolean;
  draft: UserAccessDraft | undefined;
  dirty: boolean;
  saving: boolean;
  confirmingRoleChange: boolean;
  status: SaveStatus | undefined;
  onToggle: () => void;
  onAdminChange: (isAdmin: boolean) => void;
  onAccessChange: (section: AdminSection, access: SectionAccess) => void;
  onApprovalChange: (approved: boolean) => void;
  onCancel: () => void;
  onSave: () => void;
  onConfirmSave: () => void;
  onDismissConfirmation: () => void;
};

const UserAccordionItem = ({
  profile,
  profilePermissions,
  currentUserId,
  expanded,
  draft,
  dirty,
  saving,
  confirmingRoleChange,
  status,
  onToggle,
  onAdminChange,
  onAccessChange,
  onApprovalChange,
  onCancel,
  onSave,
  onConfirmSave,
  onDismissConfirmation,
}: UserAccordionItemProps) => {
  const isCurrentUser = profile.id === currentUserId;
  const role = getRole(profile, profilePermissions);
  const roleLabel = role === 'admin' ? 'Full admin' : role === 'delegated' ? 'Delegated access' : 'Member';
  const roleClass =
    role === 'admin'
      ? 'bg-amber-100 text-amber-900'
      : role === 'delegated'
        ? 'bg-blue-50 text-blue-800'
        : 'bg-slate-100 text-slate-700';
  const panelId = `user-access-panel-${profile.id}`;
  const buttonId = `user-access-button-${profile.id}`;

  return (
    <article>
      <button
        id={buttonId}
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={`Manage access for ${profile.email}`}
        className="grid w-full gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900 sm:grid-cols-[minmax(0,1.35fr)_auto_minmax(0,1fr)_auto] sm:items-center sm:gap-5"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${role === 'admin' ? 'bg-slate-900 text-amber-300' : 'bg-slate-100 text-slate-500'}`}>
            {role === 'admin' ? <Shield size={17} /> : <User size={17} />}
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium text-slate-900">{profile.email}</span>
              {isCurrentUser ? (
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  You
                </span>
              ) : null}
              {dirty ? (
                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-800">
                  Unsaved changes
                </span>
              ) : null}
            </span>
            <span className="mt-1 block text-xs text-slate-500 sm:hidden">
              Joined {formatJoinedDate(profile.created_at)}
            </span>
          </span>
        </span>

        <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${roleClass}`}>
          {roleLabel}
        </span>

        <span className="min-w-0 text-xs leading-5 text-slate-500">
          {getAccessSummary(profile, profilePermissions)}
        </span>

        <span className="flex items-center justify-between gap-4 text-xs text-slate-400 sm:justify-end">
          <span className="hidden whitespace-nowrap sm:inline">{formatJoinedDate(profile.created_at)}</span>
          <ChevronDown
            size={18}
            aria-hidden="true"
            className={`shrink-0 transition-transform ${expanded ? 'rotate-180 text-slate-700' : ''}`}
          />
        </span>
      </button>

      {expanded && draft ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={buttonId}
          className="border-t border-slate-200 bg-slate-50 px-4 py-5 sm:px-6"
        >
          <div className="mb-5 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Full administrator</div>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                Grants complete access to every administration section. Turn this off to use the section permissions below.
              </p>
              {isCurrentUser ? (
                <p className="mt-1 text-xs font-medium text-slate-600">
                  You cannot remove your own full-administrator access here.
                </p>
              ) : null}
            </div>
            <label className={`inline-flex w-fit items-center gap-2 text-sm font-medium ${isCurrentUser ? 'cursor-not-allowed text-slate-400' : 'cursor-pointer text-slate-800'}`}>
              <input
                type="checkbox"
                checked={draft.isAdmin}
                onChange={(event) => onAdminChange(event.target.checked)}
                disabled={isCurrentUser}
                className="h-4 w-4 rounded border-slate-300 text-amber-700 focus:ring-amber-600 disabled:cursor-not-allowed"
              />
              Full administrator access
            </label>
          </div>

          {draft.isAdmin ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
              Full administrators automatically have view, edit, and approval access throughout the admin panel.
            </div>
          ) : (
            <PermissionMatrix
              profileId={profile.id}
              sections={draft.sections}
              onAccessChange={onAccessChange}
              onApprovalChange={onApprovalChange}
            />
          )}

          {status ? (
            <p
              role={status.type === 'error' ? 'alert' : 'status'}
              className={`mt-4 rounded-lg border px-4 py-3 text-sm ${status.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'}`}
            >
              {status.message}
            </p>
          ) : null}

          {confirmingRoleChange ? (
            <div role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-semibold">
                {draft.isAdmin ? 'Grant full administrator access?' : 'Remove full administrator access?'}
              </p>
              <p className="mt-1 text-xs leading-5 text-amber-900">
                {draft.isAdmin
                  ? `${profile.email} will be able to access and change every administration section.`
                  : `${profile.email} will only retain the specific section access selected here.`}
              </p>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={onDismissConfirmation}
                  className="rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-950 hover:bg-amber-100"
                >
                  Keep editing
                </button>
                <button
                  type="button"
                  onClick={onConfirmSave}
                  className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
                >
                  Confirm and save
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={!dirty || saving}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!dirty || saving || confirmingRoleChange}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
};

export const AdminUsersPage = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [permissions, setPermissions] = useState<Record<string, AdminSectionPermission[]>>({});
  const [drafts, setDrafts] = useState<Record<string, UserAccessDraft>>({});
  const [expandedProfileId, setExpandedProfileId] = useState<string | null>(null);
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null);
  const [confirmingProfileId, setConfirmingProfileId] = useState<string | null>(null);
  const [saveStatuses, setSaveStatuses] = useState<Record<string, SaveStatus | undefined>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadRequest, setLoadRequest] = useState(0);

  useEffect(() => {
    let active = true;

    const fetchProfiles = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const [profilesRes, permissionsRes] = await Promise.all([
          supabase.from('profiles').select('*').order('created_at', { ascending: false }),
          supabase.from('admin_section_permissions').select('*'),
        ]);

        if (profilesRes.error) throw profilesRes.error;
        if (permissionsRes.error) throw permissionsRes.error;
        if (!active) return;

        const nextPermissions: Record<string, AdminSectionPermission[]> = {};
        ((permissionsRes.data as AdminSectionPermission[]) ?? []).forEach((permission) => {
          nextPermissions[permission.profile_id] = [
            ...(nextPermissions[permission.profile_id] ?? []),
            permission,
          ];
        });

        setProfiles((profilesRes.data as Profile[]) ?? []);
        setPermissions(nextPermissions);
      } catch (error) {
        if (active) setLoadError(getErrorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchProfiles();
    return () => {
      active = false;
    };
  }, [loadRequest]);

  const filteredProfiles = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return profiles.filter((profile) => {
      const profilePermissions = permissions[profile.id] ?? [];
      const role = getRole(profile, profilePermissions);
      const matchesSearch = !normalizedQuery || profile.email.toLowerCase().includes(normalizedQuery);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'admins' && role === 'admin') ||
        (filter === 'delegated' && role === 'delegated') ||
        (filter === 'members' && role === 'member');

      return matchesSearch && matchesFilter;
    });
  }, [filter, permissions, profiles, searchQuery]);

  const clearSaveStatus = (profileId: string) => {
    setSaveStatuses((current) => ({ ...current, [profileId]: undefined }));
  };

  const toggleProfile = (profile: Profile) => {
    setExpandedProfileId((current) => (current === profile.id ? null : profile.id));
    setDrafts((current) =>
      current[profile.id]
        ? current
        : {
            ...current,
            [profile.id]: createUserDraft(profile, permissions[profile.id] ?? []),
          }
    );
    setConfirmingProfileId(null);
  };

  const updateDraft = (profileId: string, update: (draft: UserAccessDraft) => UserAccessDraft) => {
    setDrafts((current) => {
      const draft = current[profileId];
      return draft ? { ...current, [profileId]: update(draft) } : current;
    });
    clearSaveStatus(profileId);
    setConfirmingProfileId(null);
  };

  const changeSectionAccess = (
    profileId: string,
    section: AdminSection,
    access: SectionAccess
  ) => {
    updateDraft(profileId, (draft) => ({
      ...draft,
      sections: {
        ...draft.sections,
        [section]: {
          access,
          canApprove: section === 'events' && access !== 'none'
            ? draft.sections[section].canApprove
            : false,
        },
      },
    }));
  };

  const changeEventApproval = (profileId: string, approved: boolean) => {
    updateDraft(profileId, (draft) => ({
      ...draft,
      sections: {
        ...draft.sections,
        events: {
          access: approved && draft.sections.events.access === 'none'
            ? 'read'
            : draft.sections.events.access,
          canApprove: approved,
        },
      },
    }));
  };

  const cancelChanges = (profile: Profile) => {
    setDrafts((current) => ({
      ...current,
      [profile.id]: createUserDraft(profile, permissions[profile.id] ?? []),
    }));
    clearSaveStatus(profile.id);
    setConfirmingProfileId(null);
  };

  const persistChanges = async (profile: Profile) => {
    const draft = drafts[profile.id];
    if (!draft || savingProfileId) return;

    if (profile.id === user?.id && draft.isAdmin !== profile.is_admin) {
      setSaveStatuses((current) => ({
        ...current,
        [profile.id]: {
          type: 'error',
          message: 'You cannot change your own full-administrator access here.',
        },
      }));
      return;
    }

    setSavingProfileId(profile.id);
    setConfirmingProfileId(null);
    clearSaveStatus(profile.id);

    try {
      const currentPermissions = permissions[profile.id] ?? [];
      const upsertRows: Array<{
        profile_id: string;
        section: AdminSection;
        can_read: boolean;
        can_write: boolean;
        can_approve: boolean;
        granted_by: string | null;
      }> = [];
      const sectionsToDelete: AdminSection[] = [];

      ADMIN_SECTIONS.forEach((section) => {
        const existing = currentPermissions.find((permission) => permission.section === section.id);
        const next = draftToFlags(section.id, draft.sections[section.id]);
        const changed =
          !!existing?.can_read !== next.can_read ||
          !!existing?.can_write !== next.can_write ||
          !!existing?.can_approve !== next.can_approve;

        if (!changed) return;

        if (!next.can_read && !next.can_write && !next.can_approve) {
          if (existing) sectionsToDelete.push(section.id);
          return;
        }

        upsertRows.push({
          profile_id: profile.id,
          section: section.id,
          ...next,
          granted_by: existing?.granted_by ?? user?.id ?? null,
        });
      });

      if (upsertRows.length > 0) {
        const { error } = await supabase
          .from('admin_section_permissions')
          .upsert(upsertRows, { onConflict: 'profile_id,section' });
        if (error) throw error;
      }

      if (sectionsToDelete.length > 0) {
        const { error } = await supabase
          .from('admin_section_permissions')
          .delete()
          .eq('profile_id', profile.id)
          .in('section', sectionsToDelete);
        if (error) throw error;
      }

      if (draft.isAdmin !== profile.is_admin) {
        const { error } = await supabase
          .from('profiles')
          .update({ is_admin: draft.isAdmin })
          .eq('id', profile.id);
        if (error) throw error;
      }

      const now = new Date().toISOString();
      const nextPermissions = ADMIN_SECTIONS.flatMap((section) => {
        const next = draftToFlags(section.id, draft.sections[section.id]);
        if (!next.can_read && !next.can_write && !next.can_approve) return [];

        const existing = currentPermissions.find((permission) => permission.section === section.id);
        return [{
          id: existing?.id ?? `pending-${profile.id}-${section.id}`,
          profile_id: profile.id,
          section: section.id,
          ...next,
          granted_by: existing?.granted_by ?? user?.id ?? null,
          created_at: existing?.created_at ?? now,
          updated_at: now,
        } satisfies AdminSectionPermission];
      });

      setPermissions((current) => ({ ...current, [profile.id]: nextPermissions }));
      setProfiles((current) =>
        current.map((item) => item.id === profile.id ? { ...item, is_admin: draft.isAdmin } : item)
      );
      setSaveStatuses((current) => ({
        ...current,
        [profile.id]: { type: 'success', message: 'Access changes saved.' },
      }));
    } catch (error) {
      setSaveStatuses((current) => ({
        ...current,
        [profile.id]: { type: 'error', message: getErrorMessage(error) },
      }));
    } finally {
      setSavingProfileId(null);
    }
  };

  const requestSave = (profile: Profile) => {
    const draft = drafts[profile.id];
    if (!draft) return;

    if (draft.isAdmin !== profile.is_admin) {
      setConfirmingProfileId(profile.id);
      return;
    }

    void persistChanges(profile);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-serif text-slate-900">User Management</h2>
        <p className="mt-1 text-sm text-slate-500">
          Manage full administrators and section-level access.
        </p>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="relative block">
          <span className="sr-only">Search users</span>
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by email"
            className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
        </label>

        <label>
          <span className="sr-only">Filter users</span>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as UserFilter)}
            aria-label="Filter users"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 sm:w-48"
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      {!loading && !loadError ? (
        <p className="mb-3 text-xs text-slate-500" aria-live="polite">
          Showing {filteredProfiles.length} of {profiles.length} {profiles.length === 1 ? 'user' : 'users'}
        </p>
      ) : null}

      {loading ? (
        <div className="py-12 text-center text-slate-500">Loading users…</div>
      ) : loadError ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>Unable to load users: {loadError}</p>
          <button
            type="button"
            onClick={() => setLoadRequest((current) => current + 1)}
            className="mt-3 rounded-md border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-800 hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">
          {profiles.length === 0 ? 'No users found.' : 'No users match your search and filter.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white divide-y divide-slate-200">
          {filteredProfiles.map((profile) => {
            const profilePermissions = permissions[profile.id] ?? [];
            const draft = drafts[profile.id];
            const dirty = !!draft && draftHasChanges(profile, profilePermissions, draft);

            return (
              <UserAccordionItem
                key={profile.id}
                profile={profile}
                profilePermissions={profilePermissions}
                currentUserId={user?.id}
                expanded={expandedProfileId === profile.id}
                draft={draft}
                dirty={dirty}
                saving={savingProfileId === profile.id}
                confirmingRoleChange={confirmingProfileId === profile.id}
                status={saveStatuses[profile.id]}
                onToggle={() => toggleProfile(profile)}
                onAdminChange={(isAdmin) => updateDraft(profile.id, (current) => ({ ...current, isAdmin }))}
                onAccessChange={(section, access) => changeSectionAccess(profile.id, section, access)}
                onApprovalChange={(approved) => changeEventApproval(profile.id, approved)}
                onCancel={() => cancelChanges(profile)}
                onSave={() => requestSave(profile)}
                onConfirmSave={() => void persistChanges(profile)}
                onDismissConfirmation={() => setConfirmingProfileId(null)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
