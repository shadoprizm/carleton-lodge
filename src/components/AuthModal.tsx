import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Mail, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { SUPPORT_EMAIL, supportMailto } from '../lib/contact';
import { Link } from 'react-router';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMode = 'sign-in' | 'code' | 'reset';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export const AuthModal = ({ isOpen, onClose }: AuthModalProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const { signIn, requestSignInCode, verifySignInCode, sendPasswordReset } = useAuth();

  const closeModal = useCallback(() => {
    setError('');
    setMessage('');
    setCode('');
    setMode('sign-in');
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => emailRef.current?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [closeModal, isOpen]);

  const validateEmail = () => {
    if (email.trim()) return true;
    setError('Enter the email address used for your lodge account.');
    return false;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateEmail()) return;

    setError('');
    setMessage('');
    setLoading(true);

    if (mode === 'reset') {
      const { error: resetError } = await sendPasswordReset(email.trim());
      setLoading(false);
      if (resetError) {
        setError('We could not send the reset email. Please try again or contact the Secretary.');
      } else {
        setMessage('If this email belongs to a lodge account, a password-reset link is on its way.');
      }
      return;
    }

    if (mode === 'code') {
      const normalizedCode = code.replace(/\D/g, '').slice(0, 6);
      if (normalizedCode.length !== 6) {
        setLoading(false);
        setError('Enter the six-digit code from your email.');
        return;
      }

      const { error: codeError } = await verifySignInCode(email.trim(), normalizedCode);
      setLoading(false);
      if (codeError) {
        setError('That code is incorrect or has expired. Request a new code and try again.');
      } else {
        setEmail('');
        setPassword('');
        setCode('');
        closeModal();
      }
      return;
    }

    const { error: signInError } = await signIn(email.trim(), password);
    setLoading(false);

    if (signInError) {
      setError('The email or password is incorrect, or this account is unavailable.');
    } else {
      setEmail('');
      setPassword('');
      closeModal();
    }
  };

  const handleSignInCode = async () => {
    if (!validateEmail()) return;
    setError('');
    setMessage('');
    setLoading(true);
    const { error: codeError } = await requestSignInCode(email.trim());
    setLoading(false);

    if (codeError) {
      setError('We could not send a sign-in code. Please wait a few minutes and try again.');
    } else {
      setMode('code');
      setMessage('If this email belongs to a lodge account, a six-digit sign-in code is on its way.');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.button
            type="button"
            aria-label="Close member sign in"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-sm"
            onClick={closeModal}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-md rounded-xl bg-white p-7 shadow-2xl sm:p-8"
          >
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close"
              className="absolute right-3 top-3 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
            >
              <X size={24} />
            </button>

            <h2 id={titleId} className="pr-10 text-3xl font-serif text-gray-900">
              {mode === 'reset' ? 'Reset Your Password' : mode === 'code' ? 'Enter Your Sign-In Code' : 'Member Sign In'}
            </h2>
            <p id={descriptionId} className="mb-6 mt-2 text-base leading-relaxed text-gray-600">
              {mode === 'reset'
                ? 'Enter your lodge account email and we will send a secure reset link.'
                : mode === 'code'
                  ? 'Enter the six-digit code sent to your personal email address.'
                  : 'Sign in with your password, or ask us to email you a one-time code.'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="member-email" className="mb-1 block text-base font-medium text-gray-800">
                  Email address
                </label>
                <input
                  ref={emailRef}
                  id="member-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  readOnly={mode === 'code'}
                  autoComplete="email"
                  maxLength={254}
                  className="min-h-12 w-full rounded-md border border-gray-400 px-4 py-2 text-base outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-900"
                  required
                />
              </div>

              {mode === 'sign-in' && (
                <div>
                  <label htmlFor="member-password" className="mb-1 block text-base font-medium text-gray-800">
                    Password
                  </label>
                  <input
                    id="member-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    className="min-h-12 w-full rounded-md border border-gray-400 px-4 py-2 text-base outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-900"
                    required
                  />
                </div>
              )}

              {mode === 'code' && (
                <div>
                  <label htmlFor="member-sign-in-code" className="mb-1 block text-base font-medium text-gray-800">
                    Six-digit code
                  </label>
                  <input
                    id="member-sign-in-code"
                    type="text"
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    className="min-h-12 w-full rounded-md border border-gray-400 px-4 py-2 text-center text-2xl font-semibold tracking-[0.35em] outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-900"
                    required
                  />
                </div>
              )}

              <div aria-live="polite" aria-atomic="true">
                {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
                {message && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="min-h-12 w-full rounded-md bg-blue-900 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {loading ? 'Please wait…' : mode === 'reset' ? 'Email My Reset Link' : mode === 'code' ? 'Verify Code' : 'Sign In'}
              </button>
            </form>

            {mode === 'sign-in' ? (
              <div className="mt-5 space-y-3 border-t border-gray-200 pt-5">
                <button
                  type="button"
                  onClick={handleSignInCode}
                  disabled={loading}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-blue-900 px-4 py-3 text-base font-semibold text-blue-900 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900 focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  <Mail size={19} />
                  Email Me a One-Time Code
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('reset');
                    setError('');
                    setMessage('');
                  }}
                  className="min-h-11 w-full rounded-md text-base font-medium text-blue-900 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                >
                  I forgot my password
                </button>
              </div>
            ) : mode === 'code' ? (
              <div className="mt-5 space-y-2 border-t border-gray-200 pt-5">
                <button
                  type="button"
                  onClick={handleSignInCode}
                  disabled={loading}
                  className="min-h-11 w-full rounded-md text-base font-medium text-blue-900 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900 disabled:opacity-50"
                >
                  Send another code
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('sign-in');
                    setCode('');
                    setError('');
                    setMessage('');
                  }}
                  className="min-h-11 w-full rounded-md text-base font-medium text-blue-900 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                >
                  Use my password instead
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode('sign-in');
                  setError('');
                  setMessage('');
                }}
                className="mt-5 min-h-11 w-full rounded-md text-base font-medium text-blue-900 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
              >
                Back to sign in
              </button>
            )}

            <p className="mt-5 text-center text-sm leading-relaxed text-gray-600">
              Haven&apos;t used the members&apos; website before?{' '}
              <Link
                to="/activate"
                onClick={closeModal}
                className="font-semibold text-blue-900 underline"
              >
                Activate your membership
              </Link>
            </p>

            <p className="mt-3 text-center text-sm leading-relaxed text-gray-600">
              Still need help? Email{' '}
              <a className="font-semibold text-blue-900 underline" href={supportMailto('Help signing in')}>
                {SUPPORT_EMAIL}
              </a>
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
