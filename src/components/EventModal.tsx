import { useState } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventCreated: () => void;
}

export const EventModal = ({ isOpen, onClose, onEventCreated }: EventModalProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [location, setLocation] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
  const [pocName, setPocName] = useState('');
  const [pocContact, setPocContact] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setLoading(true);

    const { error } = await supabase.from('events').insert({
      title: title.trim(),
      description: (description ?? '').trim() || '',
      event_date: eventDate,
      event_time: eventTime || null,
      event_end_time: eventEndTime || null,
      location: location.trim(),
      location_address: locationAddress.trim() || null,
      poc_name: pocName.trim() || null,
      poc_contact: pocContact.trim() || null,
      created_by: user.id,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setTitle('');
      setDescription('');
      setEventDate('');
      setEventTime('');
      setEventEndTime('');
      setLocation('');
      setLocationAddress('');
      setPocName('');
      setPocContact('');
      onEventCreated();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-white rounded-lg shadow-2xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>

            <h2 className="text-3xl font-serif text-gray-900 mb-6">
              Create New Event
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Event Title
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-900 focus:border-transparent outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                  <span className="text-gray-400 font-normal ml-1">(optional)</span>
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-900 focus:border-transparent outline-none transition-all"
                />
              </div>

              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  id="date"
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-900 focus:border-transparent outline-none transition-all"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                    <span className="text-gray-400 font-normal ml-1">(optional)</span>
                  </label>
                  <input
                    id="time"
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-900 focus:border-transparent outline-none transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-1">
                    End Time
                    <span className="text-gray-400 font-normal ml-1">(optional)</span>
                  </label>
                  <input
                    id="endTime"
                    type="time"
                    value={eventEndTime}
                    onChange={(e) => setEventEndTime(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-900 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                  Location Name
                </label>
                <input
                  id="location"
                  type="text"
                  placeholder="e.g. Carleton Lodge Hall"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-900 focus:border-transparent outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label htmlFor="locationAddress" className="block text-sm font-medium text-gray-700 mb-1">
                  Street Address
                  <span className="text-gray-400 font-normal ml-1">(optional — used for Google Maps link)</span>
                </label>
                <input
                  id="locationAddress"
                  type="text"
                  placeholder="e.g. 123 Main St, Ottawa, ON K1A 0A1"
                  value={locationAddress}
                  onChange={(e) => setLocationAddress(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-900 focus:border-transparent outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="pocName" className="block text-sm font-medium text-gray-700 mb-1">
                    Point of Contact
                    <span className="text-gray-400 font-normal ml-1">(optional)</span>
                  </label>
                  <input
                    id="pocName"
                    type="text"
                    placeholder="e.g. John Smith"
                    value={pocName}
                    onChange={(e) => setPocName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-900 focus:border-transparent outline-none transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="pocContact" className="block text-sm font-medium text-gray-700 mb-1">
                    POC Phone / Email
                    <span className="text-gray-400 font-normal ml-1">(optional)</span>
                  </label>
                  <input
                    id="pocContact"
                    type="text"
                    placeholder="e.g. 613-555-0100"
                    value={pocContact}
                    onChange={(e) => setPocContact(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-900 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>

              {error && (
                <p className="text-red-600 text-sm">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-900 text-white py-3 rounded-md hover:bg-blue-800 transition-colors font-medium disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Event'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
