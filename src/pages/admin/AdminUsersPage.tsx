import { useState, useEffect } from 'react';
import { Shield, ShieldOff, ChevronRight, ChevronDown } from 'lucide-react';
import { supabase, Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ADMIN_SECTIONS, AdminSection, AdminSectionPermission } from '../../lib/adminPermissions';

type ProfileWithLastLogin = Profile & {
  last_sign_in_at: string | null;
};

type LastSignInRow = {
  id: string;
  last_sign_in_at: string | null;
};

export const AdminUsersPage = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<ProfileWithLastLogin[]>([]);
  const [permissions, setPermissions] = useState<Record<string, AdminSectionPermission[]>>({});
  const [loading, setLoading] = useState(true);
  const [lastLoginError, setLastLoginError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set());

  const toggleSectionExpanded = (profileId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) {
        next.delete(profileId);
      } else {
        next.add(profileId);
      }
      return next;
    });
  };

  useEffect(() => {
    setExpandedSections(new Set());
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    setLastLoginError(null);

    const [profilesRes, signInsRes, permissionsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase.rpc('get_admin_user_last_signins'),
      supabase.from('admin_section_permissions').select('*'),
    ]);

    if (profilesRes.data) {
      const signInsById = new Map(
        ((signInsRes.data as LastSignInRow[] | null) ?? []).map((row) => [row.id, row.last_sign_in_at])
      );

      setProfiles(
        profilesRes.data.map((profile) => ({
          ...profile,
          last_sign_in_at: signInsById.get(profile.id) ?? profile.last_sign_in_at ?? null,
        }))
      );
    }

    if (signInsRes.error) {
      console.warn('Could not load last login timestamps:', signInsRes.error.message);
      setLastLoginError(signInsRes.error.message);
    }

    if (permissionsRes.data) {
      const next: Record<string, AdminSectionPermission[]> = {};
      ((permissionsRes.data as AdminSectionPermission[]) ?? []).forEach((permission) => {
        next[permission.profile_id] = [...(next[permission.profile_id] ?? []), permission];
      });
      setPermissions(next);
    }

    setLoading(false);
  };

  const toggleAdmin = async (userId: string, currentStatus: boolean) => {
    await supabase
      .from('profiles')
      .update({ is_admin: !currentStatus })
      .eq('id', userId);
    fetchProfiles();
  };

  const getPermission = (profileId: string, section: AdminSection) =>
    permissions[profileId]?.find((permission) => permission.section === section) ?? null;

  const getSectionAccessSummary = (profileId: string) => {
    const granted = permissions[profileId]?.length ?? 0;
    return granted > 0
      ? `${granted} section${granted === 1 ? '' : 's'} granted`
      : 'No section access';
  };

  const setPermissionFlag = async (
    profileId: string,
    section: AdminSection,
    field: 'can_read' | 'can_write',
    enabled: boolean
  ) => {
    const existing = getPermission(profileId, section);
    const next = {
      can_read: existing?.can_read ?? false,
      can_write: existing?.can_write ?? false,
      [field]: enabled,
    };

    if (field === 'can_write' && enabled) {
      next.can_read = true;
    }

    if (field === 'can_read' && !enabled) {
      next.can_write = false;
    }

    if (!next.can_read && !next.can_write) {
      if (existing) {
        await supabase.from('admin_section_permissions').delete().eq('id', existing.id);
      }
      fetchProfiles();
      return;
    }

    if (existing) {
      await supabase
        .from('admin_section_permissions')
        .update(next)
        .eq('id', existing.id);
    } else {
      await supabase.from('admin_section_permissions').insert({
        profile_id: profileId,
        section,
        can_read: next.can_read,
        can_write: next.can_write,
        granted_by: user?.id ?? null,
      });
    }

    fetchProfiles();
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-serif text-slate-900">User Management</h2>
        <p className="text-sm text-slate-500 mt-1">Manage full admins and section-level read/write access</p>
        {lastLoginError && (
          <p className="text-xs text-amber-700 mt-2">
            Last login data unavailable. Apply latest Supabase migrations and refresh.
          </p>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading users...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 font-semibold text-slate-600">Email</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-600">Role</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-600">Joined</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-600">Last Login</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-600 min-w-[360px]">Section Access</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 text-slate-900">{profile.email}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      profile.is_admin
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {profile.is_admin ? 'Admin' : 'Member'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {new Date(profile.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {profile.last_sign_in_at
                      ? new Date(profile.last_sign_in_at).toLocaleString('en-CA', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                      : 'Never'}
                  </td>
                  <td className="py-3 px-4">
                    {profile.is_admin ? (
                      <span className="text-xs text-slate-500">Full access to every section</span>
                    ) : (
                      <div>
                        <button
                          type="button"
                          onClick={() => toggleSectionExpanded(profile.id)}
                          aria-expanded={expandedSections.has(profile.id)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                        >
                          {expandedSections.has(profile.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <span>{expandedSections.has(profile.id) ? 'Hide' : 'Show'} section access</span>
                          <span className="text-slate-400">({getSectionAccessSummary(profile.id)})</span>
                        </button>
                        {expandedSections.has(profile.id) && (
                          <div className="grid sm:grid-cols-2 gap-2 mt-2">
                            {ADMIN_SECTIONS.map((section) => {
                              const permission = getPermission(profile.id, section.id);
                              return (
                                <div key={section.id} className="border border-slate-200 rounded-lg px-2.5 py-2">
                                  <div className="text-xs font-medium text-slate-700 mb-1">{section.label}</div>
                                  <div className="flex items-center gap-3 text-xs text-slate-600">
                                    <label className="inline-flex items-center gap-1.5">
                                      <input
                                        type="checkbox"
                                        checked={!!permission?.can_read || !!permission?.can_write}
                                        onChange={(event) => setPermissionFlag(profile.id, section.id, 'can_read', event.target.checked)}
                                        className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                                      />
                                      Read
                                    </label>
                                    <label className="inline-flex items-center gap-1.5">
                                      <input
                                        type="checkbox"
                                        checked={!!permission?.can_write}
                                        onChange={(event) => setPermissionFlag(profile.id, section.id, 'can_write', event.target.checked)}
                                        className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                                      />
                                      Write
                                    </label>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => toggleAdmin(profile.id, profile.is_admin)}
                      disabled={profile.id === user?.id}
                      className={`inline-flex items-center space-x-1.5 text-xs font-medium px-3 py-1.5 rounded-md border transition-colors ${
                        profile.id === user?.id
                          ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                          :
                        profile.is_admin
                          ? 'border-red-200 text-red-700 hover:bg-red-50'
                          : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {profile.is_admin ? (
                        <>
                          <ShieldOff size={13} />
                          <span>Remove Admin</span>
                        </>
                      ) : (
                        <>
                          <Shield size={13} />
                          <span>Make Admin</span>
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {profiles.length === 0 && (
            <div className="text-center py-12 text-slate-500">No users found.</div>
          )}
        </div>
      )}
    </div>
  );
};
