import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Clock, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';

interface Event {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  description: string;
  location: string;
  location_address: string | null;
}

const getMapsUrl = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

export const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateEvents, setSelectedDateEvents] = useState<Event[]>([]);

  useEffect(() => {
    fetchEvents();
  }, [currentDate]);

  const fetchEvents = async () => {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .gte('event_date', startOfMonth.toISOString().split('T')[0])
      .lte('event_date', endOfMonth.toISOString().split('T')[0])
      .order('event_date', { ascending: true });

    if (!error && data) {
      setEvents(data);
    }
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

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
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(clickedDate);

    const dateString = clickedDate.toISOString().split('T')[0];
    const dayEvents = events.filter(event => event.event_date === dateString);
    setSelectedDateEvents(dayEvents);
  };

  const getEventsForDate = (day: number) => {
    const dateString = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
      .toISOString()
      .split('T')[0];
    return events.filter(event => event.event_date === dateString);
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

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
          <h2 className="text-4xl md:text-5xl font-serif text-amber-100 text-center mb-4">
            Lodge Calendar
          </h2>
          <p className="text-center text-amber-200/60 text-sm mb-12">
            Click on a day to see scheduled events
          </p>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg border border-amber-600/30 p-6 md:p-8">
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
                const isToday = day === new Date().getDate() &&
                  currentDate.getMonth() === new Date().getMonth() &&
                  currentDate.getFullYear() === new Date().getFullYear();

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
                  {selectedDate.toLocaleDateString('en-US', {
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
                        {event.description && (
                          <p className="text-slate-300 text-sm mb-3">
                            {event.description}
                          </p>
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
        </motion.div>
      </div>
    </section>
  );
};
