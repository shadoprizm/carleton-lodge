import { useEffect, useState } from 'react';
import { AlertTriangle, BellRing, Info } from 'lucide-react';
import { Announcement, supabase } from '../lib/supabase';
import { RichTextContent } from './RichTextContent';
import { useAuth } from '../contexts/AuthContext';

const priorityStyles: Record<Announcement['priority'], string> = {
  normal: 'border-blue-200 bg-blue-50 text-blue-950',
  important: 'border-amber-300 bg-amber-50 text-amber-950',
  urgent: 'border-red-300 bg-red-50 text-red-950',
};

const PriorityIcon = ({ priority }: { priority: Announcement['priority'] }) => {
  if (priority === 'urgent') return <AlertTriangle size={24} aria-hidden="true" />;
  if (priority === 'important') return <BellRing size={24} aria-hidden="true" />;
  return <Info size={24} aria-hidden="true" />;
};

export const Announcements = ({ limit = 3 }: { limit?: number }) => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    let active = true;

    const loadAnnouncements = async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(limit);

      if (active && !error) setAnnouncements((data as Announcement[] | null) ?? []);
    };

    void loadAnnouncements();
    return () => {
      active = false;
    };
  }, [limit, user?.id]);

  if (announcements.length === 0) return null;

  return (
    <section aria-labelledby="lodge-announcements-heading" className="bg-white px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <h2 id="lodge-announcements-heading" className="mb-4 text-2xl font-serif text-slate-900">Lodge Announcements</h2>
        <div className="space-y-3">
          {announcements.map((announcement) => (
            <article
              key={announcement.id}
              className={`rounded-xl border p-5 sm:p-6 ${priorityStyles[announcement.priority]}`}
              aria-label={`${announcement.priority} announcement: ${announcement.title}`}
            >
              <div className="flex items-start gap-4">
                <span className="mt-0.5 shrink-0"><PriorityIcon priority={announcement.priority} /></span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-serif">{announcement.title}</h3>
                    {announcement.priority !== 'normal' && (
                      <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold uppercase tracking-wide">
                        {announcement.priority}
                      </span>
                    )}
                  </div>
                  <RichTextContent html={announcement.body} compact className="mt-2 text-base" />
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
