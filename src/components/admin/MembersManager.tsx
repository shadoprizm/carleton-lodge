import { useEffect, useRef, useState } from 'react';
import { supabase, LodgeMemberPosition, LodgeMemberWithPosition, LodgePosition, Profile } from '../../lib/supabase';
import { ChevronDown, X, Plus, Edit2, Trash2, Link, Unlink, CheckCircle, Loader2, Mail, Search, UserRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { memberPositions, positionNames, sortedPositions } from '../../lib/lodgePositions';

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

function hasLodgePosition(member: LodgeMemberWithPosition) {
  return memberPositions(member).some(position => !isRegularMemberPosition(position));
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

const websiteAccountReady = (
  member: LodgeMemberWithPosition,
  linkedProfile: Profile | undefined,
) => Boolean(
  member.linked_profile_id
  && member.website_activated_at
  && linkedProfile?.force_password_change === false
);

const websiteAccountStatus = (
  member: LodgeMemberWithPosition,
  linkedProfile: Profile | undefined,
) => {
  if (websiteAccountReady(member, linkedProfile)) {
    return { label: 'Website active', className: 'bg-green-100 text-green-800' };
  }
  if (linkedProfile?.force_password_change) {
    return { label: 'Password setup needed', className: 'bg-amber-100 text-amber-800' };
  }
  if (member.website_activation_requested_at || member.website_activated_at || member.linked_profile_id) {
    return { label: 'Activation started', className: 'bg-amber-100 text-amber-800' };
  }
  return { label: 'Website not started', className: 'bg-gray-100 text-gray-600' };
};

const websiteInvitationStatus = (member: LodgeMemberWithPosition) =>
  member.website_activation_invited_at
    ? { label: 'Invitation sent', className: 'bg-blue-100 text-blue-800' }
    : { label: 'Not invited', className: 'bg-gray-100 text-gray-600' };

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

const formatMemberTimestamp = (date: string | null) =>
  date
    ? new Date(date).toLocaleString('en-CA', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Not yet';

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
  const [activeTab, setActiveTab] = useState<'positions' | 'members'>('positions');
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
  const [rosterNotice, setRosterNotice] = useState<{
    kind: 'success' | 'warning';
    message: string;
  } | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    alternate_phone: '',
    address: '',
    spouse_name: '',
    grand_lodge_membership_number: '',
    join_date: '',
    position_ids: [] as string[],
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

    const [membersRes, positionsRes, assignmentsRes, profilesRes] = await Promise.all([
      supabase
        .rpc('get_managed_lodge_members'),
      supabase
        .from('lodge_positions')
        .select('*')
        .order('display_order', { ascending: true }),
      supabase
        .from('lodge_member_positions')
        .select('*'),
      supabase
        .from('profiles')
        .select('*')
        .order('email', { ascending: true }),
    ]);

    const loadedPositions = (positionsRes.data as LodgePosition[] | null) ?? [];
    const positionById = new Map(loadedPositions.map(position => [position.id, position]));
    const assignmentMap = new Map<string, LodgePosition[]>();

    for (const assignment of (assignmentsRes.data as LodgeMemberPosition[] | null) ?? []) {
      const position = positionById.get(assignment.position_id);
      if (!position) continue;
      const assignedPositions = assignmentMap.get(assignment.member_id) ?? [];
      assignedPositions.push(position);
      assignmentMap.set(assignment.member_id, assignedPositions);
    }

    setPositions(loadedPositions);
    if (membersRes.data) {
      setMembers((membersRes.data as Omit<LodgeMemberWithPosition, 'lodge_positions' | 'positions'>[]).map(member => ({
        ...member,
        lodge_positions: positionById.get(member.position_id ?? '') ?? null,
        positions: sortedPositions(assignmentMap.get(member.id) ?? []),
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
      alternate_phone: formData.alternate_phone.trim() || null,
      address: formData.address.trim() || null,
      spouse_name: formData.spouse_name.trim() || null,
      grand_lodge_membership_number: formData.grand_lodge_membership_number.trim() || null,
      join_date: formData.join_date || null,
      bio: formData.bio.trim() || null,
      visible_to_members: formData.visible_to_members,
    };

    const isNewMember = !editingMember;
    let memberId = editingMember?.id ?? null;
    let result;

    if (editingMember) {
      result = await supabase
        .from('lodge_members')
        .update(memberData)
        .eq('id', editingMember.id);
    } else {
      const createResult = await supabase
        .from('lodge_members')
        .insert({ ...memberData, position_id: null })
        .select('id')
        .single();
      result = createResult;
      memberId = createResult.data?.id ?? null;
    }

    if (result.error) {
      const duplicateNumber = result.error.code === '23505'
        && result.error.message.includes('lodge_members_grand_lodge_number_unique_idx');
      setFormError(duplicateNumber
        ? 'That Grand Lodge membership number is already assigned to another roster record.'
        : result.error.message || 'The member record could not be saved.');
      setFormSaving(false);
      return;
    }

    if (!memberId) {
      setFormError('The member record was saved, but its identifier could not be confirmed.');
      setFormSaving(false);
      return;
    }

    const assignmentResult = await supabase.rpc('set_lodge_member_positions', {
      target_member_id: memberId,
      target_position_ids: formData.position_ids,
    });

    if (assignmentResult.error) {
      setFormError(assignmentResult.error.message || 'The Lodge positions could not be saved.');
      setFormSaving(false);
      return;
    }

    if (isNewMember) {
      const { data: mailboxData, error: mailboxError } = await supabase.functions.invoke(
        'provision-member-mailboxes',
        {
          body: {
            mode: 'run',
            confirmed: true,
            memberIds: [memberId],
          },
        },
      );
      const mailboxResult = mailboxData?.results?.[0] as {
        address?: unknown;
        error?: unknown;
        ok?: unknown;
      } | undefined;

      if (mailboxError || mailboxResult?.ok !== true) {
        const fallback = typeof mailboxResult?.error === 'string'
          ? mailboxResult.error
          : 'The mailbox could not be provisioned.';
        setRosterNotice({
          kind: 'warning',
          message: `${memberData.full_name} was added to the roster, but the personal Lodge mailbox needs a retry from Lodge Email administration. ${await functionErrorMessage(mailboxError, mailboxData, fallback)}`,
        });
      } else {
        const address = typeof mailboxResult.address === 'string'
          ? mailboxResult.address
          : 'The personal Lodge mailbox';
        setRosterNotice({
          kind: 'success',
          message: `${memberData.full_name} was added to the roster and ${address} was provisioned. No activation email was sent.`,
        });
      }
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
      alternate_phone: member.alternate_phone || '',
      address: member.address || '',
      spouse_name: member.spouse_name || '',
      grand_lodge_membership_number: member.grand_lodge_membership_number || '',
      join_date: member.join_date || '',
      position_ids: memberPositions(member).map(position => position.id),
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

    const delivered = data?.notificationStatus === 'sent';
    const lodgeEmail = typeof data?.lodgeEmail === 'string' ? data.lodgeEmail : 'the personal Lodge mailbox';
    setLoginSuccess(
      `${lodgeEmail} is provisioned. The non-expiring activation instructions ${delivered ? 'have been sent' : 'are safely queued for delivery'}.`
    );
    fetchData();
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      alternate_phone: '',
      address: '',
      spouse_name: '',
      grand_lodge_membership_number: '',
      join_date: '',
      position_ids: [],
      bio: '',
      visible_to_members: true,
    });
  };

  const getProfileEmail = (profileId: string) => {
    return profiles.find(p => p.id === profileId)?.email ?? profileId;
  };

  const assignablePositions = positions.filter(position => !isRegularMemberPosition(position));
  const officerPositions = assignablePositions.filter(position => position.position_type === 'OFFICER');
  const functionalPositions = assignablePositions.filter(position => position.position_type === 'FUNCTIONAL');
  const positionHolders = members.filter(hasLodgePosition);
  const regularMembers = members.filter(member => !hasLodgePosition(member));
  const displayedMembers = activeTab === 'positions' ? positionHolders : regularMembers;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredMembers = normalizedSearch
    ? displayedMembers.filter((member) =>
      [
        member.full_name,
        member.email,
        member.lodge_email,
        member.phone,
        member.alternate_phone,
        member.address,
        member.spouse_name,
        member.grand_lodge_membership_number,
        ...memberPositions(member).map(position => position.name),
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
              setRosterNotice(null);
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

      {rosterNotice ? (
        <p
          role={rosterNotice.kind === 'warning' ? 'alert' : undefined}
          aria-live="polite"
          className={`rounded-md border px-3 py-2 text-sm ${
            rosterNotice.kind === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          {rosterNotice.message}
        </p>
      ) : null}

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
                <label htmlFor="member-full-name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  id="member-full-name"
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="e.g. John Smith"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-900 focus:border-blue-900"
                />
              </div>

              <div>
                <label htmlFor="member-personal-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Personal Email Address
                  <span className="ml-1 text-xs font-normal text-gray-400">(private sign-in, recovery, and welcome delivery)</span>
                </label>
                <input
                  id="member-personal-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-900 focus:border-blue-900"
                />
              </div>
            </div>

            <fieldset>
              <legend className="block text-sm font-medium text-gray-700">Lodge Positions and Functional Roles</legend>
              <p className="mt-1 text-xs leading-5 text-gray-500">Select every current responsibility. Leave all unchecked for a regular member.</p>
              <div className="mt-3 grid gap-4 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-2">
                {[
                  { label: 'Lodge Officers', values: officerPositions },
                  { label: 'Functional and Elected Roles', values: functionalPositions },
                ].map(group => (
                  <div key={group.label}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{group.label}</p>
                    <div className="mt-2 space-y-2">
                      {group.values.map(position => (
                        <label key={position.id} className="flex min-h-10 items-center gap-2 rounded-md px-2 hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={formData.position_ids.includes(position.id)}
                            onChange={(event) => setFormData(current => ({
                              ...current,
                              position_ids: event.target.checked
                                ? [...current.position_ids, position.id]
                                : current.position_ids.filter(positionId => positionId !== position.id),
                            }))}
                            className="h-4 w-4 rounded border-gray-300 text-blue-900 focus:ring-blue-900"
                          />
                          <span className="text-sm text-gray-800">{position.name}</span>
                          {position.max_holders > 1 ? (
                            <span className="ml-auto text-xs text-gray-400">up to {position.max_holders}</span>
                          ) : null}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="member-primary-phone" className="block text-sm font-medium text-gray-700 mb-1">Primary Phone</label>
                <input
                  id="member-primary-phone"
                  type="tel"
                  maxLength={50}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-900 focus:border-blue-900"
                />
              </div>

              <div>
                <label htmlFor="member-alternate-phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Alternate Phone
                  <span className="ml-1 text-xs font-normal text-gray-400">(private)</span>
                </label>
                <input
                  id="member-alternate-phone"
                  type="tel"
                  maxLength={50}
                  value={formData.alternate_phone}
                  onChange={(e) => setFormData({ ...formData, alternate_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-900 focus:border-blue-900"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="member-address" className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                  <span className="ml-1 text-xs font-normal text-gray-400">(private)</span>
                </label>
                <textarea
                  id="member-address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                  maxLength={500}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-900 focus:border-blue-900"
                />
              </div>

              <div>
                <label htmlFor="member-spouse-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Spouse Name
                  <span className="ml-1 text-xs font-normal text-gray-400">(private)</span>
                </label>
                <input
                  id="member-spouse-name"
                  type="text"
                  maxLength={200}
                  value={formData.spouse_name}
                  onChange={(e) => setFormData({ ...formData, spouse_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-900 focus:border-blue-900"
                  autoComplete="off"
                />
              </div>
            </div>

            <div>
              <label htmlFor="member-join-date" className="block text-sm font-medium text-gray-700 mb-1">Join Date</label>
              <input
                id="member-join-date"
                type="date"
                value={formData.join_date}
                onChange={(e) => setFormData({ ...formData, join_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-900 focus:border-blue-900 md:max-w-[calc(50%-0.5rem)]"
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
              <h4 className="text-lg font-serif text-gray-900">Send Activation Instructions</h4>
              <button onClick={closeLoginModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Send <strong>{loginModal.member.full_name}</strong> a permanent link to the membership activation page.
                The member requests a fresh six-digit code only when they are ready.
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
                      A branded message sent to their personal address with a link to <strong>carpmasons.ca/activate</strong>.
                      The instructions do not expire. Their personal Lodge mailbox is provisioned before this message is sent.
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
                {loginSaving ? 'Queuing...' : 'Send Instructions'}
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
            setActiveTab('positions');
            setExpandedMemberId(null);
          }}
          className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'positions'
              ? 'border-blue-900 text-blue-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Position Holders
          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'positions' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>
            {positionHolders.length}
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
            placeholder="Search names, contact details, positions, or Lodge numbers"
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
          {activeTab === 'positions'
            ? 'No position holders found. Add a member with one or more positions assigned.'
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
            const roleLabel = positionNames(member, 'Regular member');
            const linkedProfile = profiles.find(profile => profile.id === member.linked_profile_id);
            const accountReady = websiteAccountReady(member, linkedProfile);
            const accountStatus = websiteAccountStatus(member, linkedProfile);
            const invitationStatus = websiteInvitationStatus(member);

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
                    {!accountReady ? (
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${invitationStatus.className}`}>
                        {invitationStatus.label}
                      </span>
                    ) : null}
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${accountStatus.className}`}>
                      {accountReady ? <CheckCircle size={12} aria-hidden="true" /> : null}
                      {accountStatus.label}
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
                          <p><span className="font-medium text-gray-900">Primary phone:</span> {displayValue(member.phone)}</p>
                          <p><span className="font-medium text-gray-900">Alternate phone:</span> {displayValue(member.alternate_phone)}</p>
                          <p className="whitespace-pre-line"><span className="font-medium text-gray-900">Address:</span> {displayValue(member.address)}</p>
                          <p><span className="font-medium text-gray-900">Spouse:</span> {displayValue(member.spouse_name)}</p>
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
                              {accountReady ? (
                                <CheckCircle size={16} className="mt-0.5 shrink-0 text-green-600" aria-hidden="true" />
                              ) : (
                                <UserRound size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                              )}
                              <span className="break-all">{getProfileEmail(member.linked_profile_id)}</span>
                            </div>
                          ) : (
                            <span className="text-gray-500">No website account linked</span>
                          )}
                          <span className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${accountStatus.className}`}>
                            {accountReady ? <CheckCircle size={12} aria-hidden="true" /> : null}
                            {accountStatus.label}
                          </span>
                          <dl className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-xs text-gray-600">
                            {accountReady ? (
                              <div><dt className="inline font-medium text-gray-800">Activated:</dt> <dd className="inline">{formatMemberTimestamp(member.website_activated_at)}</dd></div>
                            ) : (
                              <>
                                <div><dt className="inline font-medium text-gray-800">Invitation sent:</dt> <dd className="inline">{formatMemberTimestamp(member.website_activation_invited_at)}</dd></div>
                                <div><dt className="inline font-medium text-gray-800">Code requested:</dt> <dd className="inline">{formatMemberTimestamp(member.website_activation_requested_at)}</dd></div>
                              </>
                            )}
                          </dl>
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

                        {!accountReady ? (
                          <button
                            type="button"
                            onClick={() => openLoginModal(member)}
                            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                            aria-label={`Send activation instructions to ${member.full_name}`}
                          >
                            <Mail size={15} aria-hidden="true" />
                            {member.website_activation_invited_at ? 'Resend activation instructions' : 'Send activation instructions'}
                          </button>
                        ) : null}

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
