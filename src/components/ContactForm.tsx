import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface FormState {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const SUBJECTS = [
  'General Enquiry',
  'Interested in Joining',
  'Visiting the Lodge',
  'Lodge History',
  'Events & Meetings',
  'Other',
];

export const ContactForm = () => {
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');

    const { error } = await supabase.from('contact_submissions').insert({
      name: form.name.trim(),
      email: form.email.trim(),
      subject: form.subject || 'General Enquiry',
      message: form.message.trim(),
    });

    if (error) {
      setErrorMsg('Something went wrong. Please try again or email us directly.');
      setStatus('error');
    } else {
      setStatus('success');
      setForm({ name: '', email: '', subject: '', message: '' });
    }
  };

  const inputClass =
    'w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-white/50 focus:bg-white/15 transition-all duration-200 text-sm';

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="max-w-2xl mx-auto mt-16"
    >
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
        <h3 className="text-2xl font-serif text-white mb-1">Send Us a Message</h3>
        <p className="text-white/60 text-sm font-light mb-8">
          We'll get back to you as soon as possible.
        </p>

        <AnimatePresence mode="wait">
          {status === 'success' ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center text-center py-10 gap-4"
            >
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle size={32} className="text-green-400" />
              </div>
              <div>
                <p className="text-white text-lg font-serif">Message Sent</p>
                <p className="text-white/60 text-sm mt-1">
                  Thank you for reaching out. We'll be in touch shortly.
                </p>
              </div>
              <button
                onClick={() => setStatus('idle')}
                className="mt-2 text-white/50 hover:text-white text-sm transition-colors underline"
              >
                Send another message
              </button>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/70 text-xs font-medium mb-1.5 uppercase tracking-wide">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={form.name}
                    onChange={handleChange}
                    placeholder="John Smith"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-white/70 text-xs font-medium mb-1.5 uppercase tracking-wide">
                    Email Address <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={form.email}
                    onChange={handleChange}
                    placeholder="john@example.com"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-white/70 text-xs font-medium mb-1.5 uppercase tracking-wide">
                  Subject
                </label>
                <select
                  name="subject"
                  value={form.subject}
                  onChange={handleChange}
                  className={`${inputClass} appearance-none cursor-pointer`}
                >
                  <option value="" className="bg-blue-900">Select a subject...</option>
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s} className="bg-blue-900">
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-white/70 text-xs font-medium mb-1.5 uppercase tracking-wide">
                  Message <span className="text-red-400">*</span>
                </label>
                <textarea
                  name="message"
                  required
                  rows={5}
                  value={form.message}
                  onChange={handleChange}
                  placeholder="Tell us how we can help..."
                  className={`${inputClass} resize-none`}
                />
              </div>

              {status === 'error' && (
                <div className="flex items-center gap-2 text-red-300 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                  <AlertCircle size={16} className="shrink-0" />
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'submitting'}
                className="w-full flex items-center justify-center gap-2 bg-white text-blue-900 font-semibold py-3 rounded-lg hover:bg-white/90 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
              >
                {status === 'submitting' ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Send Message
                  </>
                )}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
