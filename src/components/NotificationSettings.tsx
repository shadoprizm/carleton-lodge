import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, X, Check } from 'lucide-react';
import { supabase, NotificationPreferences } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface NotificationSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationSettings = ({ isOpen, onClose }: NotificationSettingsProps) => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      fetchPreferences();
    }
  }, [isOpen, user]);

  const fetchPreferences = async () => {
    if (!user) return;

    setLoading(true);
    const { data } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (data) {
      setPreferences(data);
    } else {
      setPreferences({
        id: user.id,
        email_notifications: false,
        notify_new_summons: true,
        notify_new_events: true,
        notify_event_updates: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    setLoading(false);
  };

  const handleToggle = (field: keyof NotificationPreferences) => {
    if (!preferences) return;

    setPreferences({
      ...preferences,
      [field]: !preferences[field],
    });
  };

  const handleSave = async () => {
    if (!preferences || !user) return;

    setSaving(true);
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        id: user.id,
        email_notifications: preferences.email_notifications,
        notify_new_summons: preferences.notify_new_summons,
        notify_new_events: preferences.notify_new_events,
        notify_event_updates: preferences.notify_event_updates,
        updated_at: new Date().toISOString(),
      });

    if (!error) {
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1500);
    }
    setSaving(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-lg shadow-2xl max-w-md w-full"
      >
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Bell className="text-blue-900" size={28} />
            <h2 className="text-2xl font-serif text-gray-900">Notification Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-600">Loading preferences...</div>
          ) : preferences ? (
            <div className="space-y-6">
              <div className="pb-4 border-b border-gray-200">
                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 mb-1">Email Notifications</p>
                    <p className="text-sm text-gray-600">
                      Enable to receive email notifications for lodge updates
                    </p>
                  </div>
                  <div className="ml-4">
                    <button
                      onClick={() => handleToggle('email_notifications')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        preferences.email_notifications ? 'bg-blue-900' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          preferences.email_notifications ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </label>
              </div>

              {preferences.email_notifications && (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-gray-700">Notify me when:</p>

                  <label className="flex items-start cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={preferences.notify_new_summons}
                      onChange={() => handleToggle('notify_new_summons')}
                      className="mt-1 h-4 w-4 text-blue-900 border-gray-300 rounded focus:ring-blue-900"
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
                      className="mt-1 h-4 w-4 text-blue-900 border-gray-300 rounded focus:ring-blue-900"
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
                      className="mt-1 h-4 w-4 text-blue-900 border-gray-300 rounded focus:ring-blue-900"
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
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || saveSuccess}
            className={`px-6 py-2 rounded-md text-white transition-colors flex items-center space-x-2 ${
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
    </div>
  );
};
