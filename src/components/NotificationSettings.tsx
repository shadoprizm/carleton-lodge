import { useCallback, useId, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Bell, X, Check } from 'lucide-react';
import { supabase, NotificationPreferences } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface NotificationSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

type NotificationToggle =
  | 'email_notifications'
  | 'notify_new_summons'
  | 'notify_new_events'
  | 'notify_event_updates'
  | 'notify_announcements';

const focusableSelector = [
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export const NotificationSettings = ({ isOpen, onClose }: NotificationSettingsProps) => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  const fetchPreferences = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (loadError) {
      setError('Your notification preferences could not be loaded. Please try again.');
    } else if (data) {
      setPreferences(data);
    } else {
      setPreferences({
        id: user.id,
        email_notifications: false,
        notify_new_summons: true,
        notify_new_events: true,
        notify_event_updates: false,
        notify_announcements: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (isOpen && user) void fetchPreferences();
  }, [fetchPreferences, isOpen, user]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => dialogRef.current?.focus(), 0);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey
        && (document.activeElement === first || document.activeElement === dialogRef.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [isOpen, onClose]);

  const handleToggle = (field: NotificationToggle) => {
    if (!preferences) return;

    setPreferences({
      ...preferences,
      [field]: !preferences[field],
    });
  };

  const handleSave = async () => {
    if (!preferences || !user) return;

    setSaving(true);
    setError('');
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        id: user.id,
        email_notifications: preferences.email_notifications,
        notify_new_summons: preferences.notify_new_summons,
        notify_new_events: preferences.notify_new_events,
        notify_event_updates: preferences.notify_event_updates,
        notify_announcements: preferences.notify_announcements,
        updated_at: new Date().toISOString(),
      });

    if (!error) {
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1500);
    } else {
      setError('Your preferences could not be saved. Please try again.');
    }
    setSaving(false);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close notification settings"
        onClick={onClose}
        className="absolute inset-0 z-0 h-full w-full cursor-default bg-slate-950/65"
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-xl bg-white shadow-2xl outline-none"
      >
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Bell className="text-blue-900" size={28} />
            <h2 id={titleId} className="text-2xl font-serif text-gray-900">Notification Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notification settings"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          <p id={descriptionId} className="mb-5 text-sm leading-6 text-gray-600">
            Choose which lodge updates should be emailed to you. You can change these settings at any time.
          </p>
          {loading ? (
            <div className="text-center py-8 text-gray-600" role="status">Loading preferences…</div>
          ) : preferences ? (
            <div className="space-y-6">
              <div className="pb-4 border-b border-gray-200">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 mb-1">Email Notifications</p>
                    <p id="email-notifications-description" className="text-sm text-gray-600">
                      Enable to receive email notifications for lodge updates
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle('email_notifications')}
                    role="switch"
                    aria-checked={preferences.email_notifications}
                    aria-describedby="email-notifications-description"
                    className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900 focus-visible:ring-offset-2 ${
                      preferences.email_notifications ? 'bg-blue-900' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform ${
                        preferences.email_notifications ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                    <span className="sr-only">Email notifications</span>
                  </button>
                </div>
              </div>

              {preferences.email_notifications && (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-gray-700">Notify me when:</p>

                  <label className="flex items-start cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={preferences.notify_announcements}
                      onChange={() => handleToggle('notify_announcements')}
                      className="mt-0.5 h-5 w-5 text-blue-900 border-gray-300 rounded focus:ring-blue-900"
                    />
                    <div className="ml-3">
                      <p className="text-gray-900">New lodge announcement is posted</p>
                      <p className="text-sm text-gray-600">
                        Receive important notices that are also saved on My Lodge
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={preferences.notify_new_summons}
                      onChange={() => handleToggle('notify_new_summons')}
                      className="mt-0.5 h-5 w-5 text-blue-900 border-gray-300 rounded focus:ring-blue-900"
                    />
                    <div className="ml-3">
                      <p className="text-gray-900">New summons is posted</p>
                      <p className="text-sm text-gray-600">
                        Get notified when a new monthly summons is published
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={preferences.notify_new_events}
                      onChange={() => handleToggle('notify_new_events')}
                      className="mt-0.5 h-5 w-5 text-blue-900 border-gray-300 rounded focus:ring-blue-900"
                    />
                    <div className="ml-3">
                      <p className="text-gray-900">New event is created</p>
                      <p className="text-sm text-gray-600">
                        Stay informed about upcoming lodge events
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={preferences.notify_event_updates}
                      onChange={() => handleToggle('notify_event_updates')}
                      className="mt-0.5 h-5 w-5 text-blue-900 border-gray-300 rounded focus:ring-blue-900"
                    />
                    <div className="ml-3">
                      <p className="text-gray-900">Event is updated or cancelled</p>
                      <p className="text-sm text-gray-600">
                        Receive updates when event details change
                      </p>
                    </div>
                  </label>
                </div>
              )}
            </div>
          ) : null}
          {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || saveSuccess || loading || !preferences}
            className={`min-h-11 px-6 py-2 rounded-md text-white transition-colors flex items-center space-x-2 ${
              saveSuccess
                ? 'bg-green-600'
                : 'bg-blue-900 hover:bg-blue-800'
            } disabled:opacity-50`}
          >
            {saveSuccess ? (
              <>
                <Check size={18} />
                <span>Saved!</span>
              </>
            ) : (
              <span>{saving ? 'Saving...' : 'Save Preferences'}</span>
            )}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
};
