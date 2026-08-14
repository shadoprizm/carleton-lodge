import { useEffect, useState } from 'react';
import { CalendarDays, ExternalLink, Mail, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { LodgePosition, MemberDirectoryProfileWithPosition, supabase } from '../lib/supabase';
import {
  LODGE_MEMBER_POSITION_RELATION_SELECT,
  positionNames,
  sortedPositions,
} from '../lib/lodgePositions';

function initials(name: string) {
  return name
    .replace(/^(W\.?\s*Bro\.?|V\.?W\.?\s*Bro\.?|R\.?W\.?\s*Bro\.?|Bro\.?)\s*/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}

function formatJoinDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(date);
}

export const MemberProfilePage = () => {
  const { memberId } = useParams();
  const { user } = useAuth();
  const [member, setMember] = useState<MemberDirectoryProfileWithPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!memberId) return;
    let active = true;

    const loadMember = async () => {
      const { data, error } = await supabase
        .from('lodge_members')
        .select(`id, full_name, phone, join_date, position_id, bio, visible_to_members, linked_profile_id, lodge_email, mailbox_status, mailbox_provisioned_at, mailbox_activated_at, created_at, updated_at, ${LODGE_MEMBER_POSITION_RELATION_SELECT}`)
        .eq('id', memberId)
        .maybeSingle();

      if (!active) return;
      setLoading(false);
      if (error || !data) {
        setNotFound(true);
        return;
      }
      const loadedMember = data as unknown as Omit<MemberDirectoryProfileWithPosition, 'positions'> & {
        lodge_member_positions?: Array<{ lodge_positions: LodgePosition | null }>;
      };
      setMember({
        ...loadedMember,
        positions: sortedPositions(
          (loadedMember.lodge_member_positions ?? [])
            .map(assignment => assignment.lodge_positions)
            .filter((position): position is LodgePosition => position !== null),
        ),
      });
    };

    loadMember();
    return () => { active = false; };
  }, [memberId]);

  if (loading) {
    return <div className="min-h-screen bg-slate-50 px-4 pt-32 text-center text-base text-slate-600" role="status">Loading member profile…</div>;
  }

  if (notFound || !member) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 pb-16 pt-32 text-center">
        <UserRound className="mx-auto text-slate-400" size={46} />
        <h1 className="mt-4 text-3xl font-serif text-slate-900">Member profile unavailable</h1>
        <p className="mt-2 text-lg text-slate-600">This profile may be private or no longer in the lodge directory.</p>
        <Link to="/members" className="mt-6 inline-flex min-h-12 items-center rounded-lg bg-slate-900 px-6 font-semibold text-amber-300">Return to Members</Link>
      </div>
    );
  }

  const isOwnProfile = member.linked_profile_id === user?.id;

  return (
    <div className="min-h-screen bg-slate-50 pb-16 pt-20">
      <section className="bg-slate-950 px-4 py-10 text-white sm:py-14">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-4 border-amber-300/40 bg-amber-700 text-4xl font-serif font-bold">
            {initials(member.full_name)}
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">Member profile</p>
            <h1 className="mt-2 text-4xl font-serif sm:text-5xl">{member.full_name}</h1>
            <p className="mt-2 text-xl text-slate-200">{positionNames(member)}</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link to="/members" className="inline-flex min-h-11 items-center rounded-md font-semibold text-blue-900 underline underline-offset-4">← Back to Officers & Members</Link>

        <div className="mt-5 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <main className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-serif text-slate-900">About</h2>
            {member.bio ? (
              <p className="mt-4 whitespace-pre-wrap break-words text-lg leading-relaxed text-slate-700">{member.bio}</p>
            ) : (
              <p className="mt-4 text-lg text-slate-600">No biography has been added yet.</p>
            )}

            {member.join_date && (
              <div className="mt-7 flex items-start gap-3 border-t border-slate-200 pt-6">
                <CalendarDays className="mt-0.5 shrink-0 text-amber-700" size={22} />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Member since</p>
                  <p className="mt-1 text-base font-medium text-slate-800">{formatJoinDate(member.join_date)}</p>
                </div>
              </div>
            )}
          </main>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-serif text-slate-900">Contact</h2>
              <div className="mt-4 space-y-3">
                {member.lodge_email ? (
                  <a href={`mailto:${member.lodge_email}`} className="flex min-h-12 items-center gap-3 rounded-lg bg-amber-50 p-3 font-semibold text-blue-950 underline underline-offset-4">
                    <Mail className="shrink-0 text-amber-700" size={20} />
                    <span className="min-w-0 break-all">{member.lodge_email}</span>
                  </a>
                ) : (
                  <p className="text-sm text-slate-500">Lodge email not yet activated.</p>
                )}
                {member.phone && (
                  <a href={`tel:${member.phone}`} className="flex min-h-12 items-center gap-3 rounded-lg bg-slate-50 p-3 font-semibold text-slate-800 underline underline-offset-4">
                    <Phone className="shrink-0 text-blue-900" size={20} /> {member.phone}
                  </a>
                )}
              </div>
              <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
                <ShieldCheck className="mt-0.5 shrink-0" size={15} />
                Contact details on this page are visible only to signed-in lodge members.
              </p>
            </section>

            {isOwnProfile && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
                <h2 className="text-xl font-serif text-slate-900">This is your profile</h2>
                <div className="mt-4 space-y-3">
                  <Link to="/my-lodge/profile" className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-slate-900 px-4 font-semibold text-amber-300">
                    Edit My Profile
                  </Link>
                  {member.lodge_email && member.mailbox_status === 'active' ? (
                    <>
                    <a href="https://webmail.mxroute.com/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 font-semibold text-amber-300">
                      Open My Lodge Email <ExternalLink size={18} />
                    </a>
                    <Link to="/my-lodge/email#connect-device-heading" className="inline-flex min-h-11 w-full items-center justify-center rounded-lg font-semibold text-blue-950 underline underline-offset-4">
                      Connect a phone or computer
                    </Link>
                    </>
                  ) : member.lodge_email ? (
                    <Link to="/my-lodge/email" className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-slate-300 px-4 font-semibold text-slate-900">
                      Finish Email Setup
                    </Link>
                  ) : null}
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};
