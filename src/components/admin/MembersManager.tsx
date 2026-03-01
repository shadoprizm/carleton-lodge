import { useState, useEffect } from 'react';
import { supabase, LodgeMemberWithPosition, LodgePosition, Profile } from '../../lib/supabase';
import { X, Plus, Edit2, Trash2, Link, Unlink, CheckCircle } from 'lucide-react';

type LinkModalState = {
  member: LodgeMemberWithPosition;
};

export const MembersManager = () => {
  const [members, setMembers] = useState<LodgeMemberWithPosition[]>([]);
  const [positions, setPositions] = useState<LodgePosition[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'officers' | 'members'>('officers');
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<LodgeMemberWithPosition | null>(null);
  const [linkModal, setLinkModal] = useState<LinkModalState | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    join_date: '',
    position_id: '',
    bio: '',
    visible_to_members: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const [membersRes, positionsRes, profilesRes] = await Promise.all([
      supabase
        .from('lodge_members')
        .select('*, lodge_positions (*)')
        .order('full_name', { ascending: true }),
      supabase
        .from('lodge_positions')
        .select('*')
        .order('display_order', { ascending: true }),
      supabase
        .from('profiles')
        .select('*')
        .order('email', { ascending: true }),
    ]);

    if (membersRes.data) setMembers(membersRes.data as LodgeMemberWithPosition[]);
    if (positionsRes.data) setPositions(positionsRes.data);
    if (profilesRes.data) setProfiles(profilesRes.data);

    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const memberData = {
      full_name: formData.full_name,
      email: formData.email || null,
      phone: formData.phone || null,
      address: formData.address || null,
      join_date: formData.join_date || null,
      position_id: formData.position_id || null,
      bio: formData.bio || null,
      visible_to_members: formData.visible_to_members,
    };

    if (editingMember) {
      await supabase
        .from('lodge_members')
        .update(memberData)
        .eq('id', editingMember.id);
    } else {
      await supabase
        .from('lodge_members')
        .insert(memberData);
    }

    setShowForm(false);
    setEditingMember(null);
    resetForm();
    fetchData();
  };

  const handleEdit = (member: LodgeMemberWithPosition) => {
    setEditingMember(member);
    setFormData({
      full_name: member.full_name,
      email: member.email || '',
      phone: member.phone || '',
      address: member.address || '',
      join_date: member.join_date || '',
      position_id: member.position_id || '',
      bio: member.bio || '',
      visible_to_members: member.visible_to_members,
    });
    setShowForm(true);
  };

  const handleDelete = async (memberId: string) => {
    if (confirm('Are you sure you want to remove this member from the roster?')) {
      await supabase
        .from('lodge_members')
        .delete()
        .eq('id', memberId);
      fetchData();
    }
  };

  const handleLinkSave = async () => {
    if (!linkModal) return;
    await supabase
      .from('lodge_members')
      .update({ linked_profile_id: selectedProfileId || null })
      .eq('id', linkModal.member.id);
    setLinkModal(null);
    setSelectedProfileId('');
    fetchData();
  };

  const handleUnlink = async (memberId: string) => {
    if (confirm('Remove the account link from this roster entry?')) {
      await supabase
        .from('lodge_members')
        .update({ linked_profile_id: null })
        .eq('id', memberId);
      fetchData();
    }
  };

  const openLinkModal = (member: LodgeMemberWithPosition) => {
    setLinkModal({ member });
    setSelectedProfileId(member.linked_profile_id || '');
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      address: '',
      join_date: '',
      position_id: '',
      bio: '',
      visible_to_members: true,
    });
  };

  const getProfileEmail = (profileId: string) => {
    return profiles.find(p => p.id === profileId)?.email ?? profileId;
  };

  const officers = members.filter(m => !!m.lodge_positions);
  const regularMembers = members.filter(m => !m.lodge_positions);
  const displayedMembers = activeTab === 'officers' ? officers : regularMembers;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-serif text-gray-900">Lodge Roster</h3>
        <button
          onClick={() => {
            resetForm();
            setEditingMember(null);
            setShowForm(true);
          }}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800 transition-colors"
        >
          <Plus size={18} />
          <span>Add Member</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-serif text-gray-900">
              {editingMember ? 'Edit Member' : 'New Member'}
            </h4>
            <button onClick={() => { setShowForm(false); setEditingMember(null); resetForm(); }} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="e.g. John Smith"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-900 focus:border-blue-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                  <span className="ml-1 text-xs font-normal text-gray-400">(used to link account on sign-in)</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-900 focus:border-blue-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
              <select
                value={formData.position_id}
                onChange={(e) => setFormData({ ...formData, position_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-900 focus:border-blue-900"
              >
                <option value="">Select position...</option>
                {positions.map(position => (
                  <option key={position.id} value={position.id}>
                    {position.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-900 focus:border-blue-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Join Date</label>
                <input
                  type="date"
                  value={formData.join_date}
                  onChange={(e) => setFormData({ ...formData, join_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-900 focus:border-blue-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-900 focus:border-blue-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-900 focus:border-blue-900"
              />
            </div>

            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.visible_to_members}
                  onChange={(e) => setFormData({ ...formData, visible_to_members: e.target.checked })}
                  className="h-4 w-4 text-blue-900 border-gray-300 rounded focus:ring-blue-900"
                />
                <span className="text-sm text-gray-700">Visible in members directory</span>
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingMember(null); resetForm(); }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800 transition-colors"
              >
                {editingMember ? 'Save Changes' : 'Add Member'}
              </button>
            </div>
          </form>
        </div>
      )}

      {linkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h4 className="text-lg font-serif text-gray-900">Link Account</h4>
              <button onClick={() => setLinkModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Link <strong>{linkModal.member.full_name}</strong>'s roster entry to a registered account.
                Once linked, that user will be recognised as this member when they log in.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Account</label>
                <select
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-900 focus:border-blue-900"
                >
                  <option value="">-- No link (unlink) --</option>
                  {profiles.map(profile => (
                    <option key={profile.id} value={profile.id}>
                      {profile.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setLinkModal(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLinkSave}
                className="px-6 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800 transition-colors"
              >
                Save Link
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('officers')}
          className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'officers'
              ? 'border-blue-900 text-blue-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Lodge Officers
          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'officers' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>
            {officers.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'members'
              ? 'border-blue-900 text-blue-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Regular Members
          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'members' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>
            {regularMembers.length}
          </span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-600">Loading roster...</div>
      ) : displayedMembers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {activeTab === 'officers'
            ? 'No officers found. Add a member with a position assigned.'
            : 'No regular members found. Add a member without a position to see them here.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700">Name</th>
                {activeTab === 'officers' && (
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Position</th>
                )}
                <th className="text-left py-3 px-4 font-medium text-gray-700">Email</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Account</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedMembers.map(member => (
                <tr key={member.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">{member.full_name}</td>
                  {activeTab === 'officers' && (
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {member.lodge_positions?.name || <span className="text-gray-400 italic">None</span>}
                    </td>
                  )}
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {member.email || <span className="text-gray-400">—</span>}
                  </td>
                  <td className="py-3 px-4">
                    {member.linked_profile_id ? (
                      <div className="flex items-center space-x-1.5">
                        <CheckCircle size={14} className="text-green-600 shrink-0" />
                        <span className="text-xs text-green-700 truncate max-w-[140px]">
                          {getProfileEmail(member.linked_profile_id)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Not linked</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleEdit(member)}
                        className="text-blue-900 hover:text-blue-700"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      {member.linked_profile_id ? (
                        <button
                          onClick={() => handleUnlink(member.id)}
                          className="text-amber-600 hover:text-amber-800"
                          title="Unlink account"
                        >
                          <Unlink size={16} />
                        </button>
                      ) : (
                        <button
                          onClick={() => openLinkModal(member)}
                          className="text-gray-500 hover:text-blue-900"
                          title="Link to account"
                        >
                          <Link size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(member.id)}
                        className="text-red-500 hover:text-red-700"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
