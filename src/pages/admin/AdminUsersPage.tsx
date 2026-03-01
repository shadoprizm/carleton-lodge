import { useState, useEffect } from 'react';
import { Shield, ShieldOff } from 'lucide-react';
import { supabase, Profile } from '../../lib/supabase';

export const AdminUsersPage = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setProfiles(data);
    setLoading(false);
  };

  const toggleAdmin = async (userId: string, currentStatus: boolean) => {
    await supabase
      .from('profiles')
      .update({ is_admin: !currentStatus })
      .eq('id', userId);
    fetchProfiles();
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-serif text-slate-900">User Management</h2>
        <p className="text-sm text-slate-500 mt-1">Manage user accounts and admin privileges</p>
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
                  <td className="py-3 px-4">
                    <button
                      onClick={() => toggleAdmin(profile.id, profile.is_admin)}
                      className={`inline-flex items-center space-x-1.5 text-xs font-medium px-3 py-1.5 rounded-md border transition-colors ${
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
