import { useEffect, useRef, useState } from 'react';
import { supabase, LodgeMemberWithPosition, LodgePosition, Profile } from '../../lib/supabase';
import { ChevronDown, X, Plus, Edit2, Trash2, Link, Unlink, CheckCircle, KeyRound, Loader2, Mail, Search, UserRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { proposedLodgeEmail } from '../../../supabase/functions/_shared/mailbox-address';

type LinkModalState = {
  member: LodgeMemberWithPosition;
};

type LoginModalState = {
  member: LodgeMemberWithPosition;
};

type DeleteModalState = {
  member: LodgeMemberWithPosition;
};

const REGULAR_MEMBER_POSITION_NAME = 'member';

function isRegularMemberPosition(position: LodgePosition | null | undefined) {
  return position?.name.trim().toLowerCase() === REGULAR_MEMBER_POSITION_NAME;
}

function isOfficer(member: LodgeMemberWithPosition) {
  return !!member.lodge_positions && !isRegularMemberPosition(member.lodge_positions);
}

const mailboxStatusLabel = (status: LodgeMemberWithPosition['mailbox_status']) => ({
  unprovisioned: 'Not created',
  provisioning: 'Creating…',
  pending_activation: 'Waiting for member',
  active: 'Active',
  error: 'Needs attention',
  suspended: 'Suspended',
}[status]);

const mailboxStatusClass = (status: LodgeMemberWithPosition['mailbox_status']) =>
  status === 'active'
    ? 'bg-green-100 text-green-800'
    : status === 'error' || status === 'suspended'
      ? 'bg-red-100 text-red-800'
      : 'bg-amber-100 text-amber-800';

const displayValue = (value: string | null | undefined, fallback = 'Not recorded') =>
  value || fallback;

const formatMemberDate = (date: string | null) =>
  date
    ? new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Not recorded';

const functionErrorMessage = async (
  error: unknown,
  data: unknown,
  fallback: string,
) => {
  const responseData = data as { error?: unknown } | null;
  let message = typeof responseData?.error === 'string'
    ? responseData.error
    : error instanceof Error
      ? error.message
      : fallback;
  const errorResponse = (error as { context?: unknown } | null)?.context;

  if (errorResponse instanceof Response) {
    const errorBody = await errorResponse.clone().json().catch(() => null) as { error?: unknown } | null;
    if (typeof errorBody?.error === 'string') {
      message = errorBody.error;
    }
  }

  return message;
};

export const MembersManager = () => {
  const { hasAdminPermission } = useAuth();
  const canWrite = hasAdminPermission('members', 'write');
  const [members, setMembers] = useState<LodgeMemberWithPosition[]>([]);
  const [positions, setPositions] = useState<LodgePosition[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'officers' | 'members'>('officers');
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<LodgeMemberWithPosition | null>(null);
  const [linkModal, setLinkModal] = useState<LinkModalState | null>(null);
  const [loginModal, setLoginModal] = useState<LoginModalState | null>(null);
  const [deleteModal, setDeleteModal] = useState<DeleteModalState | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginRequestId, setLoginRequestId] = useState('');
  const [loginSaving, setLoginSaving] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState<string | null>(null);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [mailboxDeletionConfirmed, setMailboxDeletionConfirmed] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    grand_lodge_membership_number: '',
    join_date: '',
    position_id: '',
    bio: '',
    visible_to_members: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (showForm) {
      formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }
  }, [editingMember?.id, showForm]);

  const fetchData = async () => {
    setLoading(true);

    const [membersRes, positionsRes, profilesRes] = await Promise.all([
      supabase
        .rpc('get_managed_lodge_members'),
      supabase
        .from('lodge_positions')
        .select('*')
        .order('display_order', { ascending: true }),
      supabase
        .from('profiles')
        .select('*')
        .order('email', { ascending: true }),
    ]);

    if (positionsRes.data) setPositions(positionsRes.data);
    if (membersRes.data) {
      setMembers((membersRes.data as Omit<LodgeMemberWithPosition, 'lodge_positions'>[]).map(member => ({
        ...member,
        lodge_positions: positionsRes.data?.find(position => position.id === member.position_id) ?? null,
      })));
    }
    if (profilesRes.data) setProfiles(profilesRes.data);

    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formSaving) return;

    setFormSaving(true);
    setFormError(null);

    const memberData = {
      full_name: formData.full_name.trim(),
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,
      address: formData.address.trim() || null,
      grand_lodge_membership_number: formData.grand_lodge_membership_number.trim() || null,
      join_date: formData.join_date || null,
      position_id: formData.position_id || null,
      bio: formData.bio.trim() || null,
      visible_to_members: formData.visible_to_members,
    };

    const result = editingMember
      ? await supabase
        .from('lodge_members')
        .update(memberData)
        .eq('id', editingMember.id)
      : await supabase
        .from('lodge_members')
        .insert(memberData);

    if (result.error) {
      const duplicateNumber = result.error.code === '23505'
        && result.error.message.includes('lodge_members_grand_lodge_number_unique_idx');
      setFormError(duplicateNumber
        ? 'That Grand Lodge membership number is already assigned to another roster record.'
        : result.error.message || 'The member record could not be saved.');
      setFormSaving(false);
      return;
    }

    setShowForm(false);
    setEditingMember(null);
    resetForm();
    await fetchData();
    setFormSaving(false);
  };

  const handleEdit = (member: LodgeMemberWithPosition) => {
    setEditingMember(member);
    setFormData({
      full_name: member.full_name,
      email: member.email || '',
      phone: member.phone || '',
      address: member.address || '',
      grand_lodge_membership_number: member.grand_lodge_membership_number || '',
      join_date: member.join_date || '',
      position_id: isOfficer(member) ? member.position_id || '' : '',
      bio: member.bio || '',
      visible_to_members: member.visible_to_members,
    });
    setFormError(null);
    setShowForm(true);
  };

  const openDeleteModal = (member: LodgeMemberWithPosition) => {
    if (deletingMemberId) return;
    setDeleteModal({ member });
    setMailboxDeletionConfirmed(false);
    setDeleteError(null);
    setDeleteSuccess(null);
  };

  const closeDeleteModal = () => {
    if (deletingMemberId) return;
    setDeleteModal(null);
    setMailboxDeletionConfirmed(false);
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (!deleteModal || deletingMemberId) return;

    const { member } = deleteModal;

    setDeletingMemberId(member.id);
    setDeleteError(null);
    setDeleteSuccess(null);

    try {
      const { data, error } = await supabase.functions.invoke('delete-member', {
        body: {
          memberId: member.id,
          confirmed: true,
          deleteMailboxContents: member.lodge_email ? mailboxDeletionConfirmed : false,
        },
      });

      if (error) {
        setDeleteError(await functionErrorMessage(error, data, 'The member could not be deleted.'));
        return;
      }
      if (data?.deleted !== true) {
        setDeleteError('The member could not be deleted. No success was reported.');
        return;
      }

      setDeleteSuccess(`${member.full_name} and the eligible linked account records were deleted.`);
      setDeleteModal(null);
      await fetchData();
    } catch (error) {
      setDeleteError(await functionErrorMessage(error, null, 'The member could not be deleted.'));
    } finally {
      setDeletingMemberId(null);
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

  const openLoginModal = (member: LodgeMemberWithPosition) => {
    setLoginModal({ member });
    setLoginEmail(member.email || (member.linked_profile_id ? getProfileEmail(member.linked_profile_id) : ''));
    setLoginRequestId(crypto.randomUUID());
    setLoginError(null);
    setLoginSuccess(null);
  };

  const closeLoginModal = () => {
    setLoginModal(null);
    setLoginEmail('');
    setLoginRequestId('');
    setLoginError(null);
    setLoginSuccess(null);
  };

  const handleLoginSave = async () => {
    if (!loginModal) return;
    if (!loginEmail.trim()) {
      setLoginError('Email is required.');
      return;
    }
    setLoginSaving(true);
    setLoginError(null);
    setLoginSuccess(null);

    const { data, error } = await supabase.functions.invoke('manage-member-login', {
      body: {
        memberId: loginModal.member.id,
        email: loginEmail.trim(),
        requestId: loginRequestId,
      },
    });

    setLoginSaving(false);

    if (error) {
      setLoginError(await functionErrorMessage(error, data, 'The account email could not be sent.'));
      return;
    }

    const lodgeEmail = typeof data?.lodgeEmail === 'string' ? data.lodgeEmail : proposedLodgeEmail(loginModal.member.full_name);
    const delivered = data?.notificationStatus === 'sent';
    setLoginSuccess(
      `${lodgeEmail} is ready for the member to activate. The welcome email ${delivered ? 'has been sent' : 'is safely queued for delivery'}.`
    );
    fetchData();
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      address: '',
      grand_lodge_membership_number: '',
      join_date: '',
      position_id: '',
      bio: '',
      visible_to_members: true,
    });
  };

  const getProfileEmail = (profileId: string) => {
    return profiles.find(p => p.id === profileId)?.email ?? profileId;
  };

  const officerPositions = positions.filter(position => !isRegularMemberPosition(position));
  const officers = members.filter(isOfficer);
  const regularMembers = members.filter(m => !isOfficer(m));
  const displayedMembers = activeTab === 'officers' ? officers : regularMembers;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredMembers = normalizedSearch
    ? displayedMembers.filter((member) =>
      [
        member.full_name,
        member.email,
        member.lodge_email,
        member.grand_lodge_membership_number,
        member.lodge_positions?.name,
      ].some((value) => value?.toLowerCase().includes(normalizedSearch))
    )
    : displayedMembers;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-serif text-gray-900">Lodge Roster</h3>
        {canWrite ? (
          <button
            onClick={() => {
              resetForm();
              setEditingMember(null);
              setFormError(null);
              setShowForm(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800 transition-colors"
          >
            <Plus size={18} />
            <span>Add Member</span>
          </button>
        ) : (
          <span className="text-xs font-medium text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-3 py-1">
            Read only
          </span>
        )}
      </div>

      {deleteSuccess ? (
        <p aria-live="polite" className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {deleteSuccess}
        </p>
      ) : null}

      {canWrite && showForm && (
        <div ref={formRef} id="member-form" className="scroll-mt-24 bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-serif text-gray-900">
              {editingMember ? 'Edit Member' : 'New Member'}
            </h4>
            <button onClick={() => { setShowForm(false); setEditingMember(null); setFormError(null); resetForm(); }} className="text-gray-400 hover:text-gray-600" aria-label="Close member form">
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
                  Personal Email Address
                  <span className="ml-1 text-xs font-normal text-gray-400">(private sign-in, recovery, and welcome delivery)</span>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Roster Type / Officer Position</label>
              <select
                value={formData.position_id}
                onChange={(e) => setFormData({ ...formData, position_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-900 focus:border-blue-900"
              >
                <option value="">Regular Member</option>
                {officerPositions.map(position => (
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
                  maxLength={50}
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
                maxLength={500}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-900 focus:border-blue-900"
              />
            </div>

            <div>
              <label htmlFor="grand-lodge-membership-number" className="block text-sm font-medium text-gray-700 mb-1">
                Grand Lodge Membership Number
                <span className="ml-1 text-xs font-normal text-gray-400">(private to this member and roster managers)</span>
              </label>
              <input
                id="grand-lodge-membership-number"
                type="text"
                maxLength={50}
                value={formData.grand_lodge_membership_number}
                onChange={(e) => setFormData({ ...formData, grand_lodge_membership_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-900 focus:border-blue-900"
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={3}
                maxLength={2000}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-900 focus:border-blue-900"
              />
            </div>

            {formError ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {formError}
              </p>
            ) : null}

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
                onClick={() => { setShowForm(false); setEditingMember(null); setFormError(null); resetForm(); }}
                disabled={formSaving}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formSaving}
                className="px-6 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                {formSaving ? 'Saving…' : editingMember ? 'Save Changes' : 'Add Member'}
              </button>
            </div>
          </form>
        </div>
      )}

      {canWrite && linkModal && (
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

      {canWrite && loginModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h4 className="text-lg font-serif text-gray-900">Send Member Account Email</h4>
              <button onClick={closeLoginModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Create or reset secure website access for <strong>{loginModal.member.full_name}</strong> and prepare their lodge mailbox.
                You will not create or see either password—the member will choose their own.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Personal Sign-in & Recovery Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-900 focus:border-blue-900"
                  placeholder="member@example.com"
                />
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <Mail size={17} className="mt-0.5 shrink-0 text-amber-700" />
                  <div>
                    <p className="text-sm font-medium text-amber-900">What the member receives</p>
                    <p className="mt-1 text-xs leading-5 text-amber-800">
                      A branded welcome message sent to their personal address, their new <strong>{loginModal.member.lodge_email || proposedLodgeEmail(loginModal.member.full_name)}</strong> address,
                      and one secure link that guides them through website and mailbox activation.
                    </p>
                  </div>
                </div>
              </div>

              {loginError && <p className="text-sm text-red-600">{loginError}</p>}
              {loginSuccess && (
                <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                  {loginSuccess}
                </p>
              )}
            </div>
            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={closeLoginModal}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleLoginSave}
                disabled={loginSaving || !!loginSuccess}
                className="px-6 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800 transition-colors disabled:opacity-60"
              >
                {loginSaving
                  ? 'Queuing...'
                  : loginModal.member.linked_profile_id
                    ? 'Send Access Email'
                    : 'Set Up Account & Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {canWrite && deleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onKeyDown={(event) => {
            if (event.key === 'Escape') closeDeleteModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-member-title"
            aria-describedby="delete-member-description"
            className="w-full max-w-lg rounded-lg bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-200 p-6">
              <h4 id="delete-member-title" className="text-lg font-serif text-gray-900">
                Permanently delete member?
              </h4>
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deletingMemberId !== null}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                aria-label="Close delete member dialog"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <p id="delete-member-description" className="text-sm leading-6 text-gray-700">
                <strong>{deleteModal.member.full_name}</strong> will be permanently removed from the Lodge roster.
              </p>

              {(deleteModal.member.linked_profile_id || deleteModal.member.lodge_email) && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="font-semibold">Linked records included</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {deleteModal.member.linked_profile_id ? <li>The linked website login</li> : null}
                    {deleteModal.member.lodge_email ? <li>{deleteModal.member.lodge_email} Lodge mailbox</li> : null}
                  </ul>
                </div>
              )}

              {deleteModal.member.lodge_email ? (
                <label className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                  <input
                    type="checkbox"
                    checked={mailboxDeletionConfirmed}
                    onChange={(event) => setMailboxDeletionConfirmed(event.target.checked)}
                    disabled={deletingMemberId !== null}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-red-300 text-red-700 focus:ring-red-700"
                  />
                  <span>
                    I understand that <strong>{deleteModal.member.lodge_email}</strong> and all email stored in that mailbox will be permanently deleted.
                  </span>
                </label>
              ) : null}

              <p className="text-sm font-medium text-red-700">
                This cannot be undone. Agreement and completed officer-history records are retained as audit snapshots.
              </p>

              {deleteError ? (
                <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  <p className="font-semibold">Nothing was deleted</p>
                  <p className="mt-1 leading-5">{deleteError}</p>
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 p-6">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deletingMemberId !== null}
                autoFocus
                className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deletingMemberId !== null || Boolean(deleteModal.member.lodge_email && !mailboxDeletionConfirmed)}
                className="inline-flex min-w-44 items-center justify-center gap-2 rounded-md bg-red-700 px-5 py-2 font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingMemberId === deleteModal.member.id ? <Loader2 size={16} className="animate-spin" /> : null}
                {deletingMemberId === deleteModal.member.id ? 'Checking and deleting…' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex border-b border-gray-200">
        <button
          onClick={() => {
            setActiveTab('officers');
            setExpandedMemberId(null);
          }}
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
          onClick={() => {
            setActiveTab('members');
            setExpandedMemberId(null);
          }}
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

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <label className="relative block">
          <span className="sr-only">Search roster</span>
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by name, email, position, or Grand Lodge number"
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-blue-900 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        {!loading ? (
          <p className="text-xs text-gray-500" aria-live="polite">
            Showing {filteredMembers.length} of {displayedMembers.length}
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-600">Loading roster...</div>
      ) : displayedMembers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {activeTab === 'officers'
            ? 'No officers found. Add a member with a position assigned.'
            : 'No regular members found. Add a member as a regular member to see them here.'}
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center text-sm text-gray-500">
          No roster entries match your search.
        </div>
      ) : (
        <div className="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {filteredMembers.map((member) => {
            const expanded = expandedMemberId === member.id;
            const buttonId = `roster-member-button-${member.id}`;
            const panelId = `roster-member-panel-${member.id}`;
            const roleLabel = isOfficer(member)
              ? member.lodge_positions?.name || 'Officer'
              : 'Regular member';

            return (
              <article key={member.id}>
                <button
                  id={buttonId}
                  type="button"
                  onClick={() => setExpandedMemberId((current) => current === member.id ? null : member.id)}
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  aria-label={`Manage roster entry for ${member.full_name}`}
                  className="grid w-full gap-3 px-4 py-4 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-900 sm:grid-cols-[minmax(0,1.3fr)_auto_auto_auto] sm:items-center sm:gap-5"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-900">
                      <UserRound size={17} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-gray-900">{member.full_name}</span>
                      <span className="mt-0.5 block truncate text-xs text-gray-500">
                        {member.email || 'No personal email recorded'}
                      </span>
                    </span>
                  </span>

                  <span className="w-fit rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                    {roleLabel}
                  </span>

                  <span className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${mailboxStatusClass(member.mailbox_status)}`}>
                      Mailbox: {mailboxStatusLabel(member.mailbox_status)}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${member.linked_profile_id ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {member.linked_profile_id ? <CheckCircle size={12} aria-hidden="true" /> : null}
                      {member.linked_profile_id ? 'Account linked' : 'No account'}
                    </span>
                  </span>

                  <ChevronDown
                    size={18}
                    aria-hidden="true"
                    className={`justify-self-end text-gray-400 transition-transform ${expanded ? 'rotate-180 text-gray-700' : ''}`}
                  />
                </button>

                {expanded ? (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className="border-t border-gray-200 bg-gray-50 px-4 py-5 sm:px-6"
                  >
                    <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-lg border border-gray-200 bg-white p-4">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Personal contact</dt>
                        <dd className="mt-3 space-y-2 text-sm text-gray-700">
                          <p><span className="font-medium text-gray-900">Email:</span> {displayValue(member.email)}</p>
                          <p><span className="font-medium text-gray-900">Phone:</span> {displayValue(member.phone)}</p>
                          <p className="whitespace-pre-line"><span className="font-medium text-gray-900">Address:</span> {displayValue(member.address)}</p>
                        </dd>
                      </div>

                      <div className="rounded-lg border border-gray-200 bg-white p-4">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Membership</dt>
                        <dd className="mt-3 space-y-2 text-sm text-gray-700">
                          <p><span className="font-medium text-gray-900">Roster type:</span> {roleLabel}</p>
                          <p><span className="font-medium text-gray-900">Grand Lodge No.:</span> {displayValue(member.grand_lodge_membership_number)}</p>
                          <p><span className="font-medium text-gray-900">Joined:</span> {formatMemberDate(member.join_date)}</p>
                          <p><span className="font-medium text-gray-900">Directory:</span> {member.visible_to_members ? 'Visible to members' : 'Hidden'}</p>
                        </dd>
                      </div>

                      <div className="rounded-lg border border-gray-200 bg-white p-4">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Website account</dt>
                        <dd className="mt-3 text-sm text-gray-700">
                          {member.linked_profile_id ? (
                            <div className="flex items-start gap-2">
                              <CheckCircle size={16} className="mt-0.5 shrink-0 text-green-600" aria-hidden="true" />
                              <span className="break-all">{getProfileEmail(member.linked_profile_id)}</span>
                            </div>
                          ) : (
                            <span className="text-gray-500">No website account linked</span>
                          )}
                        </dd>
                      </div>

                      <div className="rounded-lg border border-gray-200 bg-white p-4">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Lodge mailbox</dt>
                        <dd className="mt-3 space-y-2 text-sm text-gray-700">
                          <p className="break-all">{member.lodge_email || 'Not created'}</p>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${mailboxStatusClass(member.mailbox_status)}`}>
                            {mailboxStatusLabel(member.mailbox_status)}
                          </span>
                        </dd>
                      </div>

                      {member.bio ? (
                        <div className="rounded-lg border border-gray-200 bg-white p-4 sm:col-span-2 xl:col-span-4">
                          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Biography</dt>
                          <dd className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-700">{member.bio}</dd>
                        </div>
                      ) : null}
                    </dl>

                    {canWrite ? (
                      <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-200 pt-4">
                        <button
                          type="button"
                          onClick={() => handleEdit(member)}
                          className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-900 hover:bg-blue-50"
                          title="Edit"
                          aria-label={`Edit ${member.full_name}`}
                        >
                          <Edit2 size={15} aria-hidden="true" />
                          Edit member
                        </button>

                        {member.linked_profile_id ? (
                          <button
                            type="button"
                            onClick={() => handleUnlink(member.id)}
                            className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50"
                            aria-label={`Unlink account for ${member.full_name}`}
                          >
                            <Unlink size={15} aria-hidden="true" />
                            Unlink account
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openLinkModal(member)}
                            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                            aria-label={`Link account for ${member.full_name}`}
                          >
                            <Link size={15} aria-hidden="true" />
                            Link account
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => openLoginModal(member)}
                          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                          aria-label={`${member.linked_profile_id ? 'Send account access email to' : 'Set up account for'} ${member.full_name}`}
                        >
                          <KeyRound size={15} aria-hidden="true" />
                          {member.linked_profile_id ? 'Send account email' : 'Set up account'}
                        </button>

                        <button
                          type="button"
                          onClick={() => openDeleteModal(member)}
                          disabled={deletingMemberId !== null}
                          className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto"
                          aria-label={`Delete ${member.full_name}`}
                          aria-haspopup="dialog"
                        >
                          {deletingMemberId === member.id
                            ? <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                            : <Trash2 size={15} aria-hidden="true" />}
                          Delete member
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
