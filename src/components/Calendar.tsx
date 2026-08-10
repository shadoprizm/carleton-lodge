import { useCallback, useState, useEffect } from 'react';
import { CalendarPlus, ChevronDown, ChevronLeft, ChevronRight, MapPin, Clock, ExternalLink, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { RichTextContent } from './RichTextContent';
import { useAuth } from '../contexts/AuthContext';
import { EventModal } from './EventModal';
import { dateKey, formatDateOnly, formatTime, formatTimeRange, todayDateKey } from '../utils/dateTime';
import { downloadCalendarEvent } from '../utils/calendarExport';

interface Event {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  event_end_time: string | null;
  description: string | null;
  location: string;
  location_address: string | null;
  event_status: 'scheduled' | 'cancelled' | 'postponed';
  status_note: string | null;
}

const getMapsUrl = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

const getDaysInMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

export const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateEvents, setSelectedDateEvents] = useState<Event[]>([]);
  const [isSubmissionOpen, setIsSubmissionOpen] = useState(false);
  const { user } = useAuth();

  const fetchEvents = useCallback(async () => {
    const startOfMonth = dateKey(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = dateKey(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      getDaysInMonth(currentDate)
    );

    const { data, error } = await supabase
      .from('events')
      .select('id, title, event_date, event_time, event_end_time, description, location, location_address, event_status, status_note')
      .gte('event_date', startOfMonth)
      .lte('event_date', endOfMonth)
      .order('event_date', { ascending: true });

    if (!error && data) {
      setEvents(data);
    }
  }, [currentDate]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    const fetchUpcomingEvents = async () => {
      setListLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select('id, title, event_date, event_time, event_end_time, description, location, location_address, event_status, status_note')
        .gte('event_date', todayDateKey())
        .order('event_date', { ascending: true })
        .order('event_time', { ascending: true })
        .limit(50);

      if (error) {
        setListError('Upcoming events could not be loaded. Please try again shortly.');
      } else {
        setUpcomingEvents(data ?? []);
      }
      setListLoading(false);
    };

    void fetchUpcomingEvents();
  }, []);

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDate(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDate(null);
  };

  const handleDateClick = (day: number) => {
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day, 12);
    setSelectedDate(clickedDate);

    const dateString = dateKey(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dayEvents = events.filter(event => event.event_date === dateString);
    setSelectedDateEvents(dayEvents);
  };

  const getEventsForDate = (day: number) => {
    const dateString = dateKey(currentDate.getFullYear(), currentDate.getMonth(), day);
    return events.filter(event => event.event_date === dateString);
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const monthName = currentDate.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
  const todayKey = todayDateKey();

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  return (
    <section id="calendar" className="py-24 bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl md:text-5xl font-serif text-amber-100 text-center mb-4">
            Lodge Calendar
          </h1>
          <p className="text-center text-amber-100/80 text-base mb-6">
            Upcoming lodge events are listed first. Open the monthly calendar if you prefer the traditional grid.
          </p>
          {user && (
            <div className="flex justify-center mb-10">
              <button
                type="button"
                onClick={() => setIsSubmissionOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors font-medium"
              >
                <Plus size={18} />
                Submit an Event
              </button>
            </div>
          )}

          <section aria-labelledby="upcoming-event-list" className="mb-8">
            <h3 id="upcoming-event-list" className="mb-4 text-2xl font-serif text-amber-100">Upcoming Events</h3>
            {listLoading ? (
              <p className="rounded-lg border border-amber-600/20 bg-slate-800/60 p-6 text-center text-amber-100" role="status">Loading upcoming events…</p>
            ) : listError ? (
              <p className="rounded-lg border border-red-400/30 bg-red-950/30 p-5 text-red-100" role="alert">{listError}</p>
            ) : upcomingEvents.length === 0 ? (
              <p className="rounded-lg border border-amber-600/20 bg-slate-800/60 p-6 text-center text-amber-100">No upcoming events are posted. Please check again soon.</p>
            ) : (
              <div className="space-y-4">
                {upcomingEvents.map((event) => (
                  <article key={event.id} className="rounded-xl border border-amber-600/30 bg-slate-800/70 p-5 sm:p-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                      <div className="w-full shrink-0 rounded-lg bg-slate-950 px-4 py-4 text-center sm:w-44">
                        <p className="text-lg font-serif text-amber-100">{formatDateOnly(event.event_date, { weekday: 'short', month: 'long', day: 'numeric' })}</p>
                        <p className="mt-1 text-base font-semibold text-amber-300">{formatTimeRange(event.event_time, event.event_end_time) ?? 'Time to be confirmed'}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-2xl font-serif text-amber-100">{event.title}</h4>
                          {event.event_status !== 'scheduled' && (
                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${event.event_status === 'cancelled' ? 'bg-red-200 text-red-950' : 'bg-amber-200 text-amber-950'}`}>
                              {event.event_status}
                            </span>
                          )}
                        </div>
                        {event.status_note && <p className="mt-3 rounded-md border border-amber-500/30 bg-slate-950/50 p-3 font-medium text-amber-100">{event.status_note}</p>}
                        {event.description && <RichTextContent html={event.description} tone="dark" compact className="mt-3 text-base" />}
                        <p className="mt-4 flex items-start gap-2 text-base text-slate-200"><MapPin className="mt-0.5 shrink-0 text-amber-400" size={19} /><span>{event.location}{event.location_address && <span className="block text-slate-300">{event.location_address}</span>}</span></p>
                        <div className="mt-5 flex flex-wrap gap-3">
                          <button type="button" onClick={() => downloadCalendarEvent(event)} className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-amber-600 px-5 py-3 font-semibold text-white hover:bg-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">
                            <CalendarPlus size={19} /> Add to Calendar
                          </button>
                          {event.location_address && <a href={getMapsUrl(event.location_address)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-amber-500/50 px-5 py-3 font-semibold text-amber-100 hover:bg-slate-700"><MapPin size={18} /> Get Directions</a>}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <details className="group bg-slate-800/50 backdrop-blur-sm rounded-lg border border-amber-600/30">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-lg px-6 py-4 text-lg font-semibold text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
              View Monthly Calendar
              <ChevronDown className="transition-transform group-open:rotate-180" size={22} />
            </summary>
            <div className="border-t border-amber-600/30 p-6 md:p-8">
            <div className="flex items-center justify-between mb-8">
              <button
                onClick={previousMonth}
                className="p-2 text-amber-100 hover:text-amber-200 hover:bg-slate-700/50 rounded-lg transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft size={24} />
              </button>

              <h3 className="text-2xl md:text-3xl font-serif text-amber-100">
                {monthName}
              </h3>

              <button
                onClick={nextMonth}
                className="p-2 text-amber-100 hover:text-amber-200 hover:bg-slate-700/50 rounded-lg transition-colors"
                aria-label="Next month"
              >
                <ChevronRight size={24} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div
                  key={day}
                  className="text-center text-sm font-semibold text-amber-200 py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, index) => {
                const dayEvents = day ? getEventsForDate(day) : [];
                const hasEvents = dayEvents.length > 0;
                const isSelected = selectedDate &&
                  day === selectedDate.getDate() &&
                  currentDate.getMonth() === selectedDate.getMonth() &&
                  currentDate.getFullYear() === selectedDate.getFullYear();
                const isToday = day
                  ? dateKey(currentDate.getFullYear(), currentDate.getMonth(), day) === todayKey
                  : false;

                return (
                  <button
                    key={index}
                    onClick={() => day && handleDateClick(day)}
                    disabled={!day}
                    className={`
                      aspect-square p-2 rounded-lg transition-all
                      ${!day ? 'invisible' : ''}
                      ${isSelected ? 'bg-amber-600 text-white ring-2 ring-amber-400' : ''}
                      ${!isSelected && isToday ? 'bg-slate-700 text-amber-100 ring-1 ring-amber-600/50' : ''}
                      ${!isSelected && !isToday && hasEvents ? 'bg-slate-700/50 text-amber-100 hover:bg-slate-700' : ''}
                      ${!isSelected && !isToday && !hasEvents ? 'text-slate-400 hover:bg-slate-700/30 hover:text-amber-100' : ''}
                    `}
                  >
                    <div className="flex flex-col items-center justify-center h-full">
                      <span className="text-sm md:text-base font-medium">{day}</span>
                      {hasEvents && (
                        <div className="flex gap-1 mt-1">
                          {dayEvents.slice(0, 3).map((_, i) => (
                            <div
                              key={i}
                              className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-amber-500'}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedDate && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.3 }}
                className="mt-8 pt-8 border-t border-amber-600/30"
              >
                <h4 className="text-xl font-serif text-amber-100 mb-4">
                  {formatDateOnly(dateKey(
                    selectedDate.getFullYear(),
                    selectedDate.getMonth(),
                    selectedDate.getDate()
                  ), {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </h4>

                {selectedDateEvents.length > 0 ? (
                  <div className="space-y-4">
                    {selectedDateEvents.map(event => (
                      <div
                        key={event.id}
                        className="bg-slate-700/30 rounded-lg p-4 border border-amber-600/20"
                      >
                        <h5 className="text-lg font-semibold text-amber-100 mb-2">
                          {event.title}
                        </h5>
                        {event.event_status !== 'scheduled' && (
                          <span className={`mb-3 inline-flex rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
                            event.event_status === 'cancelled'
                              ? 'bg-red-200 text-red-950'
                              : 'bg-amber-200 text-amber-950'
                          }`}>
                            {event.event_status}
                          </span>
                        )}
                        {event.status_note && (
                          <p className="mb-3 rounded-md border border-amber-500/30 bg-slate-900/40 p-3 text-sm font-medium text-amber-100">
                            {event.status_note}
                          </p>
                        )}
                        {event.description && (
                          <RichTextContent
                            html={event.description}
                            tone="dark"
                            className="mb-4 text-sm"
                          />
                        )}
                        <div className="flex flex-wrap gap-4 text-sm">
                          {event.event_time && (
                            <span className="flex items-center gap-1.5 text-amber-200/70">
                              <Clock size={14} />
                              {formatTime(event.event_time)}
                            </span>
                          )}
                          {event.location && (
                            <span className="flex items-center gap-1.5 text-amber-200/70">
                              <MapPin size={14} />
                              {event.location_address ? (
                                <a
                                  href={getMapsUrl(event.location_address)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1 underline underline-offset-2"
                                >
                                  {event.location}
                                  <ExternalLink size={12} />
                                </a>
                              ) : (
                                <span>{event.location}</span>
                              )}
                            </span>
                          )}
                        </div>
                        {event.location_address && (
                          <a
                            href={getMapsUrl(event.location_address)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 flex items-center gap-2 text-xs text-slate-400 hover:text-amber-300 transition-colors group"
                          >
                            <div className="w-full rounded-md overflow-hidden border border-amber-600/20 hover:border-amber-500/40 transition-colors bg-slate-800/60 px-3 py-2 flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                <MapPin size={12} className="text-amber-500 flex-shrink-0" />
                                <span className="text-slate-300 group-hover:text-amber-200 transition-colors">{event.location_address}</span>
                              </span>
                              <span className="flex items-center gap-1 text-amber-500 group-hover:text-amber-300 transition-colors font-medium whitespace-nowrap ml-3">
                                Open in Maps
                                <ExternalLink size={11} />
                              </span>
                            </div>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic">No events scheduled for this day</p>
                )}
              </motion.div>
            )}
            </div>
          </details>
        </motion.div>
      </div>
      <EventModal
        isOpen={isSubmissionOpen}
        onClose={() => setIsSubmissionOpen(false)}
        onEventSubmitted={() => undefined}
      />
    </section>
  );
};
