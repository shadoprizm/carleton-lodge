import { useState, useEffect } from 'react';
import { Plus, Trash2, MapPin, Clock, Calendar, ExternalLink, Pencil, X, Check } from 'lucide-react';
import { supabase, Event } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PlacesAutocomplete } from '../../components/PlacesAutocomplete';

const getMapsUrl = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

const emptyForm = {
  title: '',
  description: '',
  event_date: '',
  event_time: '',
  event_end_time: '',
  location: '',
  location_address: '',
  poc_name: '',
  poc_contact: '',
};

export const AdminEventsPage = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState(emptyForm);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: true });
    if (data) setEvents(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('events').insert({
      ...formData,
      description: formData.description || null,
      event_time: formData.event_time || null,
      event_end_time: formData.event_end_time || null,
      location_address: formData.location_address || null,
      poc_name: formData.poc_name || null,
      poc_contact: formData.poc_contact || null,
      created_by: user?.id,
    });
    setShowForm(false);
    setFormData(emptyForm);
    fetchEvents();
  };

  const startEdit = (event: Event) => {
    setEditingId(event.id);
    setEditData({
      title: event.title,
      description: event.description || '',
      event_date: event.event_date,
      event_time: event.event_time || '',
      event_end_time: event.event_end_time || '',
      location: event.location,
      location_address: event.location_address || '',
      poc_name: event.poc_name || '',
      poc_contact: event.poc_contact || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData(emptyForm);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    await supabase
      .from('events')
      .update({
        ...editData,
        description: editData.description || null,
        event_time: editData.event_time || null,
        event_end_time: editData.event_end_time || null,
        location_address: editData.location_address || null,
        poc_name: editData.poc_name || null,
        poc_contact: editData.poc_contact || null,
      })
      .eq('id', editingId);
    setEditingId(null);
    setEditData(emptyForm);
    fetchEvents();
  };

  const handleDelete = async (eventId: string) => {
    if (confirm('Delete this event?')) {
      await supabase.from('events').delete().eq('id', eventId);
      fetchEvents();
    }
  };

  const inputClass = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900';

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-serif text-slate-900">Events</h2>
          <p className="text-sm text-slate-500 mt-1">Schedule and manage lodge events</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); }}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-900 text-amber-300 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          <Plus size={16} />
          <span>Add Event</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-6">
          <h3 className="text-base font-semibold text-slate-900 mb-4">New Event</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input type="text" required value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description
                <span className="text-slate-400 font-normal ml-1">(optional)</span>
              </label>
              <textarea value={formData.description} rows={3}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input type="date" required value={formData.event_date}
                onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Start Time
                  <span className="text-slate-400 font-normal ml-1">(optional)</span>
                </label>
                <input type="time" value={formData.event_time}
                  onChange={(e) => setFormData({ ...formData, event_time: e.target.value })}
                  className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  End Time
                  <span className="text-slate-400 font-normal ml-1">(optional)</span>
                </label>
                <input type="time" value={formData.event_end_time}
                  onChange={(e) => setFormData({ ...formData, event_end_time: e.target.value })}
                  className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location Name</label>
              <input type="text" required placeholder="e.g. Carleton Lodge Hall" value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Street Address
                <span className="text-slate-400 font-normal ml-1">(optional — used for Google Maps link)</span>
              </label>
              <PlacesAutocomplete
                value={formData.location_address}
                onChange={(v) => setFormData({ ...formData, location_address: v })}
                className={inputClass + ' pr-8'}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Point of Contact
                  <span className="text-slate-400 font-normal ml-1">(optional)</span>
                </label>
                <input type="text" placeholder="e.g. John Smith" value={formData.poc_name}
                  onChange={(e) => setFormData({ ...formData, poc_name: e.target.value })}
                  className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  POC Phone / Email
                  <span className="text-slate-400 font-normal ml-1">(optional)</span>
                </label>
                <input type="text" placeholder="e.g. 613-555-0100" value={formData.poc_contact}
                  onChange={(e) => setFormData({ ...formData, poc_contact: e.target.value })}
                  className={inputClass} />
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button type="submit"
                className="px-5 py-2 text-sm bg-slate-900 text-amber-300 rounded-lg hover:bg-slate-800 transition-colors">
                Create Event
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading events...</div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div key={event.id} className="border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors">
              {editingId === event.id ? (
                <div className="p-5 bg-slate-50">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-slate-900">Edit Event</h4>
                    <button onClick={cancelEdit} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                  <form onSubmit={handleUpdate} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
                      <input type="text" required value={editData.title}
                        onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                        className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Description
                        <span className="text-slate-400 font-normal ml-1">(optional)</span>
                      </label>
                      <textarea value={editData.description} rows={3}
                        onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                        className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                      <input type="date" required value={editData.event_date}
                        onChange={(e) => setEditData({ ...editData, event_date: e.target.value })}
                        className={inputClass} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Start Time
                          <span className="text-slate-400 font-normal ml-1">(optional)</span>
                        </label>
                        <input type="time" value={editData.event_time}
                          onChange={(e) => setEditData({ ...editData, event_time: e.target.value })}
                          className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          End Time
                          <span className="text-slate-400 font-normal ml-1">(optional)</span>
                        </label>
                        <input type="time" value={editData.event_end_time}
                          onChange={(e) => setEditData({ ...editData, event_end_time: e.target.value })}
                          className={inputClass} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Location Name</label>
                      <input type="text" required placeholder="e.g. Carleton Lodge Hall" value={editData.location}
                        onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                        className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Street Address
                        <span className="text-slate-400 font-normal ml-1">(optional — Google Maps link)</span>
                      </label>
                      <PlacesAutocomplete
                        value={editData.location_address}
                        onChange={(v) => setEditData({ ...editData, location_address: v })}
                        className={inputClass + ' pr-8'}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Point of Contact
                          <span className="text-slate-400 font-normal ml-1">(optional)</span>
                        </label>
                        <input type="text" placeholder="e.g. John Smith" value={editData.poc_name}
                          onChange={(e) => setEditData({ ...editData, poc_name: e.target.value })}
                          className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          POC Phone / Email
                          <span className="text-slate-400 font-normal ml-1">(optional)</span>
                        </label>
                        <input type="text" placeholder="e.g. 613-555-0100" value={editData.poc_contact}
                          onChange={(e) => setEditData({ ...editData, poc_contact: e.target.value })}
                          className={inputClass} />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2 pt-1">
                      <button type="button" onClick={cancelEdit}
                        className="px-3 py-1.5 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors">
                        Cancel
                      </button>
                      <button type="submit"
                        className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-slate-900 text-amber-300 rounded-lg hover:bg-slate-800 transition-colors">
                        <Check size={14} />
                        Save Changes
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="flex items-start justify-between p-4">
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900">{event.title}</h4>
                    {event.description && (
                      <p className="text-sm text-slate-500 mt-1">{event.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
                      <span className="flex items-center space-x-1">
                        <Calendar size={12} />
                        <span>{new Date(event.event_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      </span>
                      {event.event_time && (
                        <span className="flex items-center space-x-1">
                          <Clock size={12} />
                          <span>{event.event_time}</span>
                        </span>
                      )}
                      <span className="flex items-center space-x-1">
                        <MapPin size={12} />
                        {event.location_address ? (
                          <a href={getMapsUrl(event.location_address)} target="_blank" rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1">
                            {event.location}
                            <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span>{event.location}</span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <button onClick={() => startEdit(event)}
                      className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Edit event">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => handleDelete(event.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete event">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {events.length === 0 && (
            <div className="text-center py-12 text-slate-500">No events scheduled.</div>
          )}
        </div>
      )}
    </div>
  );
};
