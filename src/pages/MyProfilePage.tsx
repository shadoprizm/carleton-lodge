import { type FormEvent, useEffect, useState } from 'react';
import {
  BadgeCheck,
  CalendarDays,
  Eye,
  EyeOff,
  IdCard,
  Mail,
  MapPinHouse,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Link } from 'react-router';
import { supportMailto } from '../lib/contact';
import { type MyMemberProfile, supabase } from '../lib/supabase';

type EditableProfile = {
  phone: string;
  address: string;
  bio: string;
};

const emptyForm: EditableProfile = {
  phone: '',
  address: '',
  bio: '',
};

function profileForm(profile: MyMemberProfile): EditableProfile {
  return {
    phone: profile.phone ?? '',
    address: profile.address ?? '',
    bio: profile.bio ?? '',
  };
}

function firstProfile(data: unknown): MyMemberProfile | null {
  return Array.isArray(data) && data.length > 0
    ? data[0] as MyMemberProfile
    : null;
}

function formatJoinDate(value: string | null) {
  if (!value) return 'Not recorded';
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(date);
}

export const MyProfilePage = () => {
  const [profile, setProfile] = useState<MyMemberProfile | null>(null);
  const [form, setForm] = useState<EditableProfile>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      const { data, error } = await supabase.rpc('get_my_member_profile');
      if (!active) return;

      if (error) {
        setLoadError('Your member profile could not be loaded. Please refresh the page or contact the Lodge Secretary.');
        setLoading(false);
        return;
      }

      const loadedProfile = firstProfile(data);
      setProfile(loadedProfile);
      setForm(loadedProfile ? profileForm(loadedProfile) : emptyForm);
      setLoading(false);
    };

    loadProfile();
    return () => { active = false; };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || saving) return;

    setSaving(true);
    setSaveError('');
    setSaveSuccess('');

    const { data, error } = await supabase.rpc('update_my_member_profile', {
      new_phone: form.phone,
      new_address: form.address,
      new_bio: form.bio,
    });

    if (error) {
      setSaveError(error.message || 'Your changes could not be saved. Please try again.');
      setSaving(false);
      return;
    }

    const updatedProfile = firstProfile(data);
    if (!updatedProfile) {
      setSaveError('Your changes could not be confirmed. Please refresh the page before trying again.');
      setSaving(false);
      return;
    }

    setProfile(updatedProfile);
    setForm(profileForm(updatedProfile));
    setSaveSuccess('Your member profile has been updated.');
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 pt-32 text-center text-base text-slate-600" role="status">
        Loading your member profile…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 pb-16 pt-32">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <UserRound className="mx-auto text-red-700" size={46} />
          <h1 className="mt-4 text-3xl font-serif text-slate-900">Profile unavailable</h1>
          <p className="mt-3 text-lg text-slate-600" role="alert">{loadError}</p>
          <Link to="/my-lodge" className="mt-6 inline-flex min-h-12 items-center rounded-lg bg-slate-900 px-6 font-semibold text-amber-300">
            Return to My Lodge
          </Link>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 pb-16 pt-32">
        <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm sm:p-10">
          <ShieldCheck className="mx-auto text-amber-700" size={48} />
          <h1 className="mt-4 text-3xl font-serif text-slate-900">Connect your member profile</h1>
          <p className="mt-3 text-lg leading-relaxed text-slate-600">
            Your website login is not linked to a Lodge roster record yet. The Lodge Secretary can connect it for you.
          </p>
          <a href={supportMailto('Please connect my Lodge member profile')} className="mt-7 inline-flex min-h-12 items-center rounded-lg bg-slate-900 px-6 font-semibold text-amber-300">
            Ask for profile help
          </a>
          <div>
            <Link to="/my-lodge" className="mt-4 inline-flex min-h-11 items-center font-semibold text-blue-900 underline underline-offset-4">
              Return to My Lodge
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16 pt-20">
      <section className="bg-slate-950 px-4 py-10 text-white sm:py-14">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">My Lodge</p>
          <h1 className="mt-2 text-4xl font-serif sm:text-5xl">My Profile</h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-slate-200">
            Keep your contact information and biography current. Official membership details remain managed by Lodge administration.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link to="/my-lodge" className="inline-flex min-h-11 items-center font-semibold text-blue-900 underline underline-offset-4">
          ← Back to My Lodge
        </Link>

        <div className="mt-5 grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
          <aside className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                  <UserRound size={28} />
                </span>
                <div>
                  <h2 className="text-2xl font-serif text-slate-900">{profile.full_name}</h2>
                  <p className="mt-1 font-medium text-slate-600">{profile.position_name ?? 'Lodge Member'}</p>
                </div>
              </div>

              <dl className="mt-6 space-y-4 border-t border-slate-200 pt-5">
                <div className="flex gap-3">
                  <CalendarDays className="mt-0.5 shrink-0 text-amber-700" size={20} />
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Member since</dt>
                    <dd className="mt-1 text-slate-800">{formatJoinDate(profile.join_date)}</dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <IdCard className="mt-0.5 shrink-0 text-amber-700" size={20} />
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Grand Lodge membership number</dt>
                    <dd className="mt-1 font-semibold text-slate-800">
                      {profile.grand_lodge_membership_number ?? 'Not recorded'}
                    </dd>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">Only you and authorised roster managers can view this number.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Mail className="mt-0.5 shrink-0 text-amber-700" size={20} />
                  <div className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lodge email</dt>
                    <dd className="mt-1 break-all text-slate-800">{profile.lodge_email ?? 'Not activated'}</dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  {profile.visible_to_members
                    ? <Eye className="mt-0.5 shrink-0 text-emerald-700" size={20} />
                    : <EyeOff className="mt-0.5 shrink-0 text-slate-500" size={20} />}
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Directory status</dt>
                    <dd className="mt-1 text-slate-800">{profile.visible_to_members ? 'Visible to signed-in members' : 'Hidden from the member directory'}</dd>
                  </div>
                </div>
              </dl>
            </section>

            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-slate-700">
              Name, office, join date, directory status, email accounts, and membership number can only be changed by Lodge administration.
            </p>
          </aside>

          <main className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3">
              <BadgeCheck className="text-amber-700" size={25} />
              <h2 className="text-2xl font-serif text-slate-900">Information you can update</h2>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-6">
              <div>
                <label htmlFor="member-phone" className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Phone size={17} className="text-amber-700" /> Phone number
                </label>
                <input
                  id="member-phone"
                  type="tel"
                  maxLength={50}
                  value={form.phone}
                  onChange={(event) => setForm(current => ({ ...current, phone: event.target.value }))}
                  className="mt-2 min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base text-slate-900 focus:border-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                  autoComplete="tel"
                />
                <p className="mt-2 text-sm text-slate-500">Shown to signed-in Lodge members when your directory profile is visible.</p>
              </div>

              <div>
                <label htmlFor="member-address" className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <MapPinHouse size={17} className="text-amber-700" /> Home address
                </label>
                <textarea
                  id="member-address"
                  rows={3}
                  maxLength={500}
                  value={form.address}
                  onChange={(event) => setForm(current => ({ ...current, address: event.target.value }))}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 text-base text-slate-900 focus:border-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                  autoComplete="street-address"
                />
                <p className="mt-2 flex items-start gap-2 text-sm text-slate-500">
                  <ShieldCheck className="mt-0.5 shrink-0" size={15} />
                  Private. Visible only to you and authorised roster managers.
                </p>
              </div>

              <div>
                <label htmlFor="member-bio" className="text-sm font-semibold text-slate-800">Biography</label>
                <textarea
                  id="member-bio"
                  rows={7}
                  maxLength={2000}
                  value={form.bio}
                  onChange={(event) => setForm(current => ({ ...current, bio: event.target.value }))}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 text-base text-slate-900 focus:border-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                  aria-describedby="member-bio-help member-bio-count"
                />
                <div className="mt-2 flex justify-between gap-4 text-sm text-slate-500">
                  <p id="member-bio-help">Shown to signed-in Lodge members when your directory profile is visible.</p>
                  <p id="member-bio-count" className="shrink-0">{form.bio.length}/2000</p>
                </div>
              </div>

              <div aria-live="polite" className="space-y-2">
                {saveError ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{saveError}</p> : null}
                {saveSuccess ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{saveSuccess}</p> : null}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={() => {
                    setForm(profileForm(profile));
                    setSaveError('');
                    setSaveSuccess('');
                  }}
                  disabled={saving}
                  className="min-h-12 rounded-lg border border-slate-300 px-5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Reset changes
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-slate-900 px-6 font-semibold text-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save size={18} /> {saving ? 'Saving…' : 'Save profile'}
                </button>
              </div>
            </form>
          </main>
        </div>
      </div>
    </div>
  );
};
