import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, KeyRound, Mail, Monitor, Printer, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { EmailAgreementReceipt, MyLodgeEmailAccount, supabase } from '../lib/supabase';
import { SUPPORT_EMAIL, supportMailto } from '../lib/contact';
import { MIN_MAILBOX_PASSWORD_LENGTH } from '../lib/mailboxPassword';
import { validateMailboxSetup } from '../lib/lodgeEmailGovernance';
import { LODGE_EMAIL_SETUP } from '../../supabase/functions/_shared/lodge-email-settings';

const WEBMAIL_URL = LODGE_EMAIL_SETUP.webmailUrl;

function functionErrorMessage(error: unknown, fallback: string) {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    return context.clone().json().then((body: { error?: unknown } | null) =>
      typeof body?.error === 'string' ? body.error : fallback
    ).catch(() => fallback);
  }
  return Promise.resolve(error instanceof Error && error.message ? error.message : fallback);
}

const accountStatusLabel = (account: MyLodgeEmailAccount) => {
  if (account.status === 'ACTIVE' && !account.needs_agreement) return 'Active';
  if (account.needs_agreement && !account.needs_password_setup) return 'Agreement required';
  if (['INVITATION_PENDING', 'TERMS_PENDING', 'PASSWORD_SETUP_PENDING'].includes(account.status)) return 'Setup required';
  if (account.status === 'NOT_PROVISIONED' || account.status === 'PROVISIONING') return 'Being prepared';
  if (account.status === 'SUSPENDED') return 'Suspended';
  if (account.status === 'DISABLED') return 'Not assigned';
  return 'Needs attention';
};

const blockingAccountMessage = (account: MyLodgeEmailAccount) => {
  if (account.status === 'NOT_PROVISIONED' || account.status === 'PROVISIONING') {
    return {
      title: 'Your Lodge mailbox is being prepared',
      body: 'There is nothing you need to do yet. Lodge administration will send a secure setup link when the mailbox is ready.',
    };
  }
  if (account.status === 'SUSPENDED') {
    return {
      title: 'This Lodge mailbox is suspended',
      body: 'Mailbox access has been paused by Lodge administration. Contact Lodge Support if you believe this is an error.',
    };
  }
  if (account.status === 'DISABLED') {
    return {
      title: 'This officer mailbox is no longer assigned to you',
      body: 'Your website access to this Lodge-owned role account has ended. Contact Lodge Support if the officer assignment has not changed.',
    };
  }
  if (account.status === 'ERROR') {
    return {
      title: 'This mailbox needs administrative attention',
      body: 'Setup could not be completed automatically. Lodge Support can safely retry it without deleting the mailbox or its contents.',
    };
  }
  return null;
};

export const MailboxSetupPage = () => {
  const [searchParams] = useSearchParams();
  const [accounts, setAccounts] = useState<MyLodgeEmailAccount[]>([]);
  const [selectedId, setSelectedId] = useState(searchParams.get('account') ?? '');
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [actionToken, setActionToken] = useState('');
  const [actionPurpose, setActionPurpose] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const [receipt, setReceipt] = useState<EmailAgreementReceipt | null>(null);

  useEffect(() => {
    const hashParameters = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = hashParameters.get('token');
    const purpose = hashParameters.get('purpose');
    if (token) {
      setActionToken(token);
      setActionPurpose(purpose ?? '');
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    const { data, error: accountError } = await supabase.rpc('get_my_lodge_email_accounts');
    if (accountError) {
      setError('We could not load your Lodge email details. Please refresh the page.');
      setAccounts([]);
      setLoading(false);
      return;
    }
    const loaded = (data as MyLodgeEmailAccount[] | null) ?? [];
    setAccounts(loaded);
    setSelectedId(current => loaded.some(account => account.id === current)
      ? current
      : loaded[0]?.id ?? '');
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    setPassword('');
    setConfirmation('');
    setAgreementAccepted(false);
    setError('');
    setSuccess('');
    setResetRequested(false);
    setReceipt(null);
  }, [selectedId]);

  const account = useMemo(
    () => accounts.find(item => item.id === selectedId) ?? null,
    [accounts, selectedId]
  );
  const blockingMessage = account ? blockingAccountMessage(account) : null;
  const isSecureTokenAction = !!actionToken && ['ROLE_ACTIVATION', 'PASSWORD_RESET'].includes(actionPurpose);
  const needsSetup = !!account && (
    account.needs_agreement
    || account.needs_password_setup
    || account.status !== 'ACTIVE'
    || isSecureTokenAction
  );

  useEffect(() => {
    if (account?.status !== 'ACTIVE' || window.location.hash !== '#connect-device-heading') return;
    window.requestAnimationFrame(() => {
      document.getElementById('connect-device-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [account?.status]);

  const copyAddress = async () => {
    if (!account) return;
    await navigator.clipboard.writeText(account.address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  const completeSetup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!account) return;
    setError('');
    setSuccess('');

    const requiresPassword = account.needs_password_setup || isSecureTokenAction;
    const validationError = validateMailboxSetup({
      needsAgreement: account.needs_agreement,
      agreementAccepted,
      requiresPassword,
      password,
      confirmation,
      requiresSecureToken: account.account_type !== 'MEMBER' || isSecureTokenAction,
      hasSecureToken: !!actionToken,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    if (account.account_type === 'MEMBER' && !isSecureTokenAction) {
      const { error: activationError } = await supabase.functions.invoke('activate-member-mailbox', {
        body: {
          accountId: account.id,
          password: requiresPassword ? password : undefined,
          agreementAccepted,
          policyVersionId: account.policy_version_id,
        },
      });
      if (activationError) {
        setSaving(false);
        setError(await functionErrorMessage(
          activationError,
          'We could not activate your mailbox. Please try again or contact Lodge Support.'
        ));
        return;
      }
    } else {
      if (!actionToken) {
        setSaving(false);
        setError('Open the current secure activation or password-reset link sent to your personal email.');
        return;
      }
      const { error: activationError } = await supabase.functions.invoke('manage-lodge-email', {
        body: {
          action: 'complete_account_action',
          accountId: account.id,
          token: actionToken,
          password,
          agreementAccepted,
          policyVersionId: account.policy_version_id,
        },
      });
      if (activationError) {
        setSaving(false);
        setError(await functionErrorMessage(
          activationError,
          'The secure Lodge email setup could not be completed.'
        ));
        return;
      }
      setActionToken('');
      setActionPurpose('');
    }

    setPassword('');
    setConfirmation('');
    setAgreementAccepted(false);
    setSuccess(isSecureTokenAction && actionPurpose === 'PASSWORD_RESET'
      ? 'Your Lodge mailbox password has been changed.'
      : 'Your Lodge mailbox is active and ready to use.');
    await loadAccounts();
    setSaving(false);
  };

  const requestPasswordReset = async () => {
    if (!account) return;
    setError('');
    setResetRequested(false);
    const { error: requestError } = await supabase.functions.invoke('manage-lodge-email', {
      body: {
        action: 'request_password_reset',
        accountId: account.id,
        requestId: crypto.randomUUID(),
      },
    });
    if (requestError) {
      setError(await functionErrorMessage(requestError, 'The password-reset email could not be sent.'));
      return;
    }
    setResetRequested(true);
  };

  const loadReceipt = async () => {
    if (!account) return;
    setError('');
    const { data, error: receiptError } = await supabase.rpc('get_email_agreement_receipt', {
      target_account_id: account.id,
    });
    if (receiptError) {
      setError('The agreement receipt could not be loaded.');
      return;
    }
    setReceipt(((data as EmailAgreementReceipt[] | null) ?? [])[0] ?? null);
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 pb-16 pt-28">
      <div className="mx-auto max-w-3xl">
        <Link to="/my-lodge" className="inline-flex min-h-11 items-center rounded-md font-semibold text-blue-900 underline underline-offset-4 print:hidden">
          ← Back to My Lodge
        </Link>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-slate-950 px-6 py-7 text-white sm:px-9">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-300 text-slate-950">
                <Mail size={25} />
              </span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">Member email</p>
                <h1 className="mt-1 text-3xl font-serif">Your Lodge Mailboxes</h1>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-9">
            {loading ? (
              <p className="text-center text-base text-slate-600" role="status">Loading your mailboxes…</p>
            ) : accounts.length === 0 ? (
              <StatusMessage
                title="Your Lodge mailbox is being prepared"
                body="There is nothing you need to do yet. Lodge administration can prepare your account from the member administration page."
              />
            ) : (
              <>
                {accounts.length > 1 && (
                  <div className="mb-7 grid gap-2 sm:grid-cols-2 print:hidden" aria-label="Choose a Lodge email account">
                    {accounts.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={`rounded-xl border p-4 text-left ${item.id === selectedId ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900'}`}
                      >
                        <span className={`block text-xs font-bold uppercase tracking-wide ${item.id === selectedId ? 'text-amber-300' : 'text-amber-700'}`}>
                          {item.account_type === 'MEMBER' ? 'Personal Lodge Email' : `${item.position_name ?? item.display_name} Account`}
                        </span>
                        <span className="mt-1 block break-all font-semibold">{item.address}</span>
                        <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${item.id === selectedId ? 'bg-white/10 text-slate-100' : 'bg-slate-100 text-slate-700'}`}>
                          {accountStatusLabel(item)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {account && (
                  <>
                    {success && <p className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900" role="status">{success}</p>}
                    {blockingMessage ? (
                      <StatusMessage title={blockingMessage.title} body={blockingMessage.body} />
                    ) : needsSetup ? (
                      <div>
                        <div className="text-center">
                          <ShieldCheck className="mx-auto text-emerald-600" size={44} />
                          <h2 className="mt-4 text-3xl font-serif text-slate-900">
                            {actionPurpose === 'PASSWORD_RESET' ? 'Choose a new mailbox password' : account.needs_agreement ? 'Review the Lodge email agreement' : 'Finish mailbox setup'}
                          </h2>
                          <p className="mx-auto mt-2 max-w-xl text-lg leading-relaxed text-slate-600">
                            {account.account_type === 'MEMBER'
                              ? 'This is your personal Lodge-provided email address. It remains separate from any officer account you may hold.'
                              : `The ${account.position_name ?? account.display_name} mailbox belongs to Carleton Lodge No. 465. Your access is temporary while you hold this responsibility.`}
                          </p>
                          <MailboxAddress email={account.address} copied={copied} onCopy={copyAddress} />
                        </div>

                        <form onSubmit={completeSetup} className="mx-auto mt-8 max-w-2xl space-y-6">
                          {account.needs_agreement && (
                            <AgreementPanel account={account} accepted={agreementAccepted} onAcceptedChange={setAgreementAccepted} />
                          )}

                          {(account.needs_password_setup || isSecureTokenAction) && (
                            <div className="mx-auto max-w-lg space-y-5">
                              <p className="rounded-lg bg-blue-50 p-4 text-sm leading-relaxed text-blue-950">
                                Choose a password that is different from your website password. It is sent securely to MXroute and is never stored by this website.
                              </p>
                              <div>
                                <label htmlFor="mailbox-password" className="mb-1 block text-base font-semibold text-slate-800">Lodge email password</label>
                                <input
                                  id="mailbox-password"
                                  type="password"
                                  value={password}
                                  onChange={event => setPassword(event.target.value)}
                                  autoComplete="new-password"
                                  minLength={MIN_MAILBOX_PASSWORD_LENGTH}
                                  maxLength={128}
                                  className="min-h-12 w-full rounded-lg border border-slate-400 px-4 text-base outline-none focus:ring-2 focus:ring-slate-900"
                                  required
                                />
                                <p className="mt-1 text-sm text-slate-600">At least {MIN_MAILBOX_PASSWORD_LENGTH} characters, with uppercase, lowercase, and a number.</p>
                              </div>
                              <div>
                                <label htmlFor="mailbox-password-confirmation" className="mb-1 block text-base font-semibold text-slate-800">Type it again</label>
                                <input
                                  id="mailbox-password-confirmation"
                                  type="password"
                                  value={confirmation}
                                  onChange={event => setConfirmation(event.target.value)}
                                  autoComplete="new-password"
                                  minLength={MIN_MAILBOX_PASSWORD_LENGTH}
                                  maxLength={128}
                                  className="min-h-12 w-full rounded-lg border border-slate-400 px-4 text-base outline-none focus:ring-2 focus:ring-slate-900"
                                  required
                                />
                              </div>
                            </div>
                          )}

                          {account.account_type !== 'MEMBER' && !actionToken && (
                            <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                              Open the newest secure activation link sent to your verified personal email. If it has expired, ask Lodge administration to resend it.
                            </p>
                          )}
                          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
                          <button
                            type="submit"
                            disabled={saving || (account.account_type !== 'MEMBER' && !actionToken)}
                            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-4 text-lg font-bold text-amber-300 disabled:opacity-60"
                          >
                            <KeyRound size={20} /> {saving ? 'Saving…' : account.needs_password_setup || isSecureTokenAction ? 'Activate and Save Password' : 'Accept Agreement'}
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="text-center" aria-live="polite">
                        <CheckCircle2 className="mx-auto text-emerald-600" size={48} />
                        <h2 className="mt-4 text-3xl font-serif text-slate-900">Your Lodge email is ready</h2>
                        <p className="mt-2 text-lg text-slate-600">
                          {account.account_type === 'MEMBER'
                            ? 'Your personal Lodge address:'
                            : `${account.position_name ?? account.display_name} — a Lodge-owned role mailbox:`}
                        </p>
                        <MailboxAddress email={account.address} copied={copied} onCopy={copyAddress} />
                        <div className="mt-7 flex flex-wrap justify-center gap-3 print:hidden">
                          <a
                            href={WEBMAIL_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-slate-900 px-7 py-4 text-lg font-bold text-amber-300"
                          >
                            Open Webmail <ExternalLink size={20} />
                          </a>
                          <button type="button" onClick={requestPasswordReset} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-slate-300 px-6 py-4 font-bold text-slate-800">
                            <KeyRound size={19} /> Change / Reset Password
                          </button>
                          <button type="button" onClick={loadReceipt} className="inline-flex min-h-14 items-center justify-center rounded-xl border border-slate-300 px-6 py-4 font-bold text-slate-800">
                            Review Agreement
                          </button>
                        </div>
                        {resetRequested && <p className="mx-auto mt-5 max-w-xl rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">A secure password-reset link has been sent to your verified personal email.</p>}
                        {error && <p className="mx-auto mt-5 max-w-xl rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
                        {receipt && <AgreementReceiptView receipt={receipt} />}
                        <DeviceSetupGuide email={account.address} />
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AgreementPanel = ({ account, accepted, onAcceptedChange }: { account: MyLodgeEmailAccount; accepted: boolean; onAcceptedChange: (accepted: boolean) => void }) => (
  <section className="rounded-xl border border-slate-200 bg-slate-50 p-5 sm:p-6" aria-labelledby="email-agreement-heading">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 id="email-agreement-heading" className="text-xl font-serif text-slate-900">{account.policy_title}</h3>
      <span className="text-xs font-semibold text-slate-500">Version {account.policy_version} · Effective {new Date(account.policy_effective_at).toLocaleDateString('en-CA')}</span>
    </div>
    <div className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-700" tabIndex={0}>
      {account.policy_content.split('\n').filter(Boolean).map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 20)}`}>{paragraph}</p>
      ))}
    </div>
    <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <input
        type="checkbox"
        checked={accepted}
        onChange={event => onAcceptedChange(event.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 rounded border-slate-400 text-blue-900 focus:ring-blue-900"
      />
      <span className="text-sm font-medium leading-relaxed text-slate-900">{account.policy_acknowledgement}</span>
    </label>
  </section>
);

const AgreementReceiptView = ({ receipt }: { receipt: EmailAgreementReceipt }) => (
  <section className="agreement-receipt-print mx-auto mt-8 max-w-2xl rounded-xl border border-slate-200 bg-white p-6 text-left shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Agreement receipt</p>
        <h3 className="mt-1 text-2xl font-serif text-slate-900">{receipt.agreement_title}</h3>
      </div>
      <button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 font-semibold text-slate-800 print:hidden">
        <Printer size={17} /> Print
      </button>
    </div>
    <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
      <div><dt className="font-semibold text-slate-500">Member</dt><dd className="text-slate-900">{receipt.member_name}</dd></div>
      <div><dt className="font-semibold text-slate-500">Mailbox</dt><dd className="break-all text-slate-900">{receipt.email_address}</dd></div>
      {receipt.position_name && <div><dt className="font-semibold text-slate-500">Position</dt><dd className="text-slate-900">{receipt.position_name}</dd></div>}
      <div><dt className="font-semibold text-slate-500">Version</dt><dd className="text-slate-900">{receipt.agreement_version}</dd></div>
      <div><dt className="font-semibold text-slate-500">Effective</dt><dd className="text-slate-900">{new Date(receipt.effective_at).toLocaleString('en-CA')}</dd></div>
      <div><dt className="font-semibold text-slate-500">Accepted</dt><dd className="text-slate-900">{new Date(receipt.accepted_at).toLocaleString('en-CA')}</dd></div>
    </dl>
    <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">{receipt.acknowledgement}</p>
    <div className="mt-5 space-y-3 text-sm leading-relaxed text-slate-700">
      {receipt.policy_content.split('\n').filter(Boolean).map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 18)}`}>{paragraph}</p>)}
    </div>
  </section>
);

const MailboxAddress = ({ email, copied, onCopy }: { email: string; copied: boolean; onCopy: () => void }) => (
  <div className="mx-auto mt-5 flex max-w-xl flex-col items-stretch gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-center">
    <strong className="min-w-0 flex-1 break-all px-2 text-lg text-slate-900">{email}</strong>
    <button type="button" onClick={onCopy} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 font-semibold text-slate-800 print:hidden">
      <Copy size={18} /> {copied ? 'Copied' : 'Copy address'}
    </button>
  </div>
);

const StatusMessage = ({ title, body }: { title: string; body: string }) => (
  <div className="py-6 text-center">
    <Mail className="mx-auto text-amber-700" size={44} />
    <h2 className="mt-4 text-3xl font-serif text-slate-900">{title}</h2>
    <p className="mx-auto mt-3 max-w-xl text-lg leading-relaxed text-slate-600">{body}</p>
    <a href={supportMailto('Help with my Lodge mailbox')} className="mt-6 inline-flex min-h-12 items-center rounded-lg border border-slate-300 px-5 font-semibold text-blue-900 underline underline-offset-4">
      Email {SUPPORT_EMAIL}
    </a>
  </div>
);

type DeviceChoice = 'iphone' | 'android' | 'outlook' | 'mac' | 'thunderbird' | 'webmail';

const DeviceSetupGuide = ({ email }: { email: string }) => {
  const [device, setDevice] = useState<DeviceChoice>('iphone');
  const [settingsCopied, setSettingsCopied] = useState(false);

  const copySettings = async () => {
    await navigator.clipboard.writeText([
      `Email / username: ${email}`,
      'Account type: IMAP',
      `Incoming server: ${LODGE_EMAIL_SETUP.incoming.hostname}`,
      `Incoming port: ${LODGE_EMAIL_SETUP.incoming.port}`,
      `Incoming security: ${LODGE_EMAIL_SETUP.incoming.security}`,
      `Outgoing server: ${LODGE_EMAIL_SETUP.outgoing.hostname}`,
      `Outgoing port: ${LODGE_EMAIL_SETUP.outgoing.port}`,
      `Outgoing security: ${LODGE_EMAIL_SETUP.outgoing.security}`,
      'Outgoing authentication: Password required',
      'IMAP path prefix: leave blank',
    ].join('\n'));
    setSettingsCopied(true);
    window.setTimeout(() => setSettingsCopied(false), 2500);
  };

  const deviceSteps: Record<DeviceChoice, string[]> = {
    iphone: [
      'Open Settings. Tap Apps, then Mail, then Mail Accounts.',
      'Tap Add Account. If asked to choose a provider, tap Add Other Account, then Mail Account.',
      'Enter your name, full Lodge email address, and mailbox password. Use “Carleton Lodge” as the description.',
      `Choose IMAP. Use ${LODGE_EMAIL_SETUP.incoming.hostname} for both Incoming and Outgoing Mail Server. The username for both is your full Lodge email address.`,
      'Tap Next, leave Mail turned on, and turn Contacts, Calendars, and Notes off. Tap Save.',
    ],
    android: [
      'Open the Gmail app. Tap your profile picture, then Add another account.',
      'Choose Other, enter your full Lodge email address, and select Manual setup.',
      'Choose Personal (IMAP). Enter your mailbox password.',
      `Use ${LODGE_EMAIL_SETUP.incoming.hostname} as the incoming server with port ${LODGE_EMAIL_SETUP.incoming.port} and ${LODGE_EMAIL_SETUP.incoming.security}.`,
      `Use ${LODGE_EMAIL_SETUP.outgoing.hostname} as the outgoing SMTP server with port ${LODGE_EMAIL_SETUP.outgoing.port} and ${LODGE_EMAIL_SETUP.outgoing.security}. Turn on Require sign-in.`,
    ],
    outlook: [
      'Open Outlook and choose Add Account. Enter your full Lodge email address.',
      'Choose Advanced setup or Manual setup, then choose IMAP.',
      `Set the incoming server to ${LODGE_EMAIL_SETUP.incoming.hostname}, port ${LODGE_EMAIL_SETUP.incoming.port}, with ${LODGE_EMAIL_SETUP.incoming.security}.`,
      `Set the outgoing SMTP server to ${LODGE_EMAIL_SETUP.outgoing.hostname}, port ${LODGE_EMAIL_SETUP.outgoing.port}, with ${LODGE_EMAIL_SETUP.outgoing.security} and authentication required.`,
      'For both servers, use your full Lodge email address as the username and your mailbox password.',
    ],
    mac: [
      'Open System Settings, select Internet Accounts, and choose Add Account.',
      'Choose Add Other Account, then Mail Account.',
      'Enter your name, full Lodge email address, and mailbox password. Choose IMAP if prompted.',
      `Use ${LODGE_EMAIL_SETUP.incoming.hostname} for both incoming and outgoing servers. Use your full Lodge email as the username.`,
      `If advanced settings are requested, use incoming port ${LODGE_EMAIL_SETUP.incoming.port} and outgoing port ${LODGE_EMAIL_SETUP.outgoing.port}, both with ${LODGE_EMAIL_SETUP.incoming.security}.`,
    ],
    thunderbird: [
      'Open Thunderbird and choose Add Mail Account.',
      'Enter your name, full Lodge email address, and mailbox password, then choose Configure manually.',
      `For Incoming, choose IMAP, ${LODGE_EMAIL_SETUP.incoming.hostname}, port ${LODGE_EMAIL_SETUP.incoming.port}, ${LODGE_EMAIL_SETUP.incoming.security}, and Normal password.`,
      `For Outgoing, choose SMTP, ${LODGE_EMAIL_SETUP.outgoing.hostname}, port ${LODGE_EMAIL_SETUP.outgoing.port}, ${LODGE_EMAIL_SETUP.outgoing.security}, and Normal password.`,
      'Use your full Lodge email address as the username for both servers, then choose Done.',
    ],
    webmail: [
      'Select Open Webmail on this page.',
      'Use your full Lodge email address as the username.',
      'Enter the mailbox password you chose during Lodge email setup.',
      'Webmail works in a browser and does not require changes to your phone or computer.',
    ],
  };

  const choices: Array<{ value: DeviceChoice; label: string; icon: typeof Smartphone }> = [
    { value: 'iphone', label: 'iPhone / iPad', icon: Smartphone },
    { value: 'android', label: 'Android', icon: Smartphone },
    { value: 'outlook', label: 'Outlook', icon: Monitor },
    { value: 'mac', label: 'Apple Mail', icon: Monitor },
    { value: 'thunderbird', label: 'Thunderbird', icon: Monitor },
    { value: 'webmail', label: 'Webmail', icon: Mail },
  ];

  return (
    <section className="mt-10 border-t border-slate-200 pt-8 text-left print:hidden" aria-labelledby="connect-device-heading">
      <div className="text-center">
        <Smartphone className="mx-auto text-blue-900" size={38} />
        <h2 id="connect-device-heading" className="mt-3 text-3xl font-serif text-slate-900">Email Setup</h2>
        <p className="mx-auto mt-2 max-w-xl text-base leading-relaxed text-slate-600">Choose your device or Webmail and follow each step.</p>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3" role="tablist" aria-label="Choose a mail app">
        {choices.map(choice => {
          const Icon = choice.icon;
          const selected = device === choice.value;
          return (
            <button key={choice.value} type="button" role="tab" aria-selected={selected} onClick={() => setDevice(choice.value)} className={`flex min-h-14 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold ${selected ? 'border-slate-900 bg-slate-900 text-amber-300' : 'border-slate-300 bg-white text-slate-800'}`}>
              <Icon size={18} /> {choice.label}
            </button>
          );
        })}
      </div>
      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:p-6" role="tabpanel">
        <ol className="space-y-4">
          {deviceSteps[device].map((step, index) => (
            <li key={step} className="flex gap-3 text-base leading-relaxed text-slate-700">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-900 font-bold text-white">{index + 1}</span>
              <span className="pt-1">{step}</span>
            </li>
          ))}
        </ol>
        {device === 'webmail' && <a href={WEBMAIL_URL} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-lg bg-slate-900 px-5 font-bold text-amber-300">Open Webmail <ExternalLink size={18} /></a>}
      </div>
      <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-5">
        <h3 className="text-lg font-bold text-slate-900">Secure server settings</h3>
        <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div><dt className="font-semibold text-slate-500">Username</dt><dd className="break-all font-medium text-slate-900">{email}</dd></div>
          <div><dt className="font-semibold text-slate-500">Account type</dt><dd className="font-medium text-slate-900">IMAP</dd></div>
          <div><dt className="font-semibold text-slate-500">Incoming</dt><dd className="font-medium text-slate-900">{LODGE_EMAIL_SETUP.incoming.hostname} · Port {LODGE_EMAIL_SETUP.incoming.port} · {LODGE_EMAIL_SETUP.incoming.security}</dd></div>
          <div><dt className="font-semibold text-slate-500">Outgoing</dt><dd className="font-medium text-slate-900">{LODGE_EMAIL_SETUP.outgoing.hostname} · Port {LODGE_EMAIL_SETUP.outgoing.port} · {LODGE_EMAIL_SETUP.outgoing.security}</dd></div>
          <div><dt className="font-semibold text-slate-500">Authentication</dt><dd className="font-medium text-slate-900">Password required for both</dd></div>
          <div><dt className="font-semibold text-slate-500">IMAP path prefix</dt><dd className="font-medium text-slate-900">Leave blank</dd></div>
        </dl>
        <button type="button" onClick={copySettings} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-blue-300 bg-white px-4 font-semibold text-blue-950">
          <Copy size={17} /> {settingsCopied ? 'Settings copied' : 'Copy all settings'}
        </button>
      </div>
      <p className="mt-4 rounded-lg bg-slate-100 p-4 text-sm leading-relaxed text-slate-600">
        Your mailbox password is never displayed or stored by the Lodge website. If your mail app reports an error, confirm that the full email address is used as the username for both incoming and outgoing mail.
      </p>
      <button type="button" onClick={() => window.location.reload()} className="mx-auto mt-5 flex min-h-11 items-center gap-2 rounded-lg px-4 font-semibold text-blue-900 underline underline-offset-4">
        <RefreshCw size={17} /> Refresh mailbox status
      </button>
    </section>
  );
};
