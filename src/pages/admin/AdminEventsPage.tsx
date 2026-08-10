import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  MapPin,
  Clock,
  Calendar,
  ExternalLink,
  Pencil,
  X,
  Check,
  CheckCircle2,
  Mail,
  XCircle,
} from 'lucide-react';
import { supabase, Event, EventStatus, EventSubmission, EventVisibility } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PlacesAutocomplete } from '../../components/PlacesAutocomplete';
import { RichTextEditor } from '../../components/RichTextEditor';
import { prepareRichTextForStorage, richTextHasEmbeds, richTextToPlainText } from '../../utils/richText';
import { formatDateOnly } from '../../utils/dateTime';

const getMapsUrl = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

const submissionEmptyForm = {
  title: '',
  description: '',
  event_date: '',
  event_time: '',
  event_end_time: '',
  location: '',
  location_address: '',
  poc_name: '',
  poc_contact: '',
  visibility: 'members' as EventVisibility,
};

const eventEditEmptyForm = {
  ...submissionEmptyForm,
  event_status: 'scheduled' as EventStatus,
  status_note: '',
};

export const AdminEventsPage = () => {
  const { user, hasAdminPermission } = useAuth();
  const canWrite = hasAdminPermission('events', 'write');
  const canApprove = hasAdminPermission('events', 'approve');
  const [events, setEvents] = useState<Event[]>([]);
  const [submissions, setSubmissions] = useState<EventSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState(submissionEmptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState(eventEditEmptyForm);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    const [eventsResult, submissionsResult] = await Promise.all([
      supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true }),
      supabase
        .from('event_submissions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
    ]);

    if (eventsResult.data) setEvents(eventsResult.data);
    if (submissionsResult.data) {
      setSubmissions(submissionsResult.data as EventSubmission[]);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      setError('You must be logged in to submit events.');
      return;
    }

    setError(null);
    const descriptionHtml = prepareRichTextForStorage(formData.description);
    const { error } = await supabase.from('event_submissions').insert({
      ...formData,
      title: formData.title.trim(),
      description: descriptionHtml || null,
      location: formData.location.trim(),
      event_time: formData.event_time || null,
      event_end_time: formData.event_end_time || null,
      location_address: formData.location_address.trim() || null,
      poc_name: formData.poc_name.trim() || null,
      poc_contact: formData.poc_contact.trim() || null,
      created_by: user.id,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setShowForm(false);
    setFormData(submissionEmptyForm);
    fetchEvents();
  };

  const reviewSubmission = async (
    submission: EventSubmission,
    status: 'approved' | 'rejected'
  ) => {
    if (!canApprove) return;

    const reviewNotes = status === 'rejected'
      ? window.prompt('Optional note for the member explaining why this was not approved:', '') ?? undefined
      : undefined;

    if (status === 'rejected' && reviewNotes === undefined) return;

    const action = status === 'approved' ? 'approve' : 'reject';
    if (!window.confirm(`${action[0].toUpperCase()}${action.slice(1)} “${submission.title}”?`)) {
      return;
    }

    setError(null);
    const { error: reviewError } = await supabase
      .from('event_submissions')
      .update({
        status,
        review_notes: reviewNotes?.trim() || null,
      })
      .eq('id', submission.id)
      .eq('status', 'pending');

    if (reviewError) {
      setError(reviewError.message);
      return;
    }

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
      visibility: event.visibility,
      event_status: event.event_status,
      status_note: event.status_note || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData(eventEditEmptyForm);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setError(null);
    const descriptionHtml = prepareRichTextForStorage(editData.description);
    const { error } = await supabase
      .from('events')
      .update({
        ...editData,
        title: editData.title.trim(),
        description: descriptionHtml || null,
        location: editData.location.trim(),
        event_time: editData.event_time || null,
        event_end_time: editData.event_end_time || null,
        location_address: editData.location_address.trim() || null,
        poc_name: editData.poc_name.trim() || null,
        poc_contact: editData.poc_contact.trim() || null,
        status_note: editData.status_note.trim() || null,
      })
      .eq('id', editingId);
    if (error) {
      setError(error.message);
      return;
    }
    setEditingId(null);
    setEditData(eventEditEmptyForm);
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
          <p className="text-sm text-slate-500 mt-1">Review member submissions and manage published events</p>
          {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
        </div>
        {user ? (
          <button
            onClick={() => { setShowForm(!showForm); setEditingId(null); }}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-900 text-amber-300 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            <Plus size={16} />
            <span>Submit Event</span>
          </button>
        ) : (
          <span className="text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-3 py-1">
            {canApprove ? 'Approval access' : 'Read only'}
          </span>
        )}
      </div>

      {user && showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-6">
          <h3 className="text-base font-semibold text-slate-900 mb-1">Submit New Event</h3>
          <p className="text-xs text-slate-500 mb-4">
            Every new event, including administrator submissions, must be approved before publication.
          </p>
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
              <RichTextEditor
                value={formData.description}
                onChange={(description) => setFormData({ ...formData, description })}
              />
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Audience</label>
              <select
                value={formData.visibility}
                onChange={(e) => setFormData({ ...formData, visibility: e.target.value as EventVisibility })}
                className={inputClass}
              >
                <option value="members">Lodge members only</option>
                <option value="public">Everyone (public website)</option>
                <option value="admin">Administrators only</option>
              </select>
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
                Submit for Approval
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Pending Approvals</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {canApprove
                ? 'Review these member submissions before they reach the public calendar.'
                : 'You can view the queue; an authorized approver must make the decision.'}
            </p>
          </div>
          <span className="inline-flex min-w-7 h-7 items-center justify-center rounded-full bg-amber-100 text-amber-800 text-xs font-semibold px-2">
            {submissions.length}
          </span>
        </div>

        <div className="space-y-3">
          {submissions.map((submission) => (
            <div key={submission.id} className="border border-amber-200 bg-amber-50/40 rounded-xl p-4">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h4 className="font-semibold text-slate-900">{submission.title}</h4>
                    <span className="text-[11px] font-medium uppercase tracking-wide text-amber-800 bg-amber-100 rounded-full px-2 py-0.5">
                      Pending
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-700">
                      {submission.visibility === 'public' ? 'Public' : submission.visibility === 'admin' ? 'Admins only' : 'Members only'}
                    </span>
                  </div>
                  {(richTextToPlainText(submission.description) || richTextHasEmbeds(submission.description)) && (
                    <p className="text-sm text-slate-600 mt-1">
                      {richTextToPlainText(submission.description) || 'Contains embedded media or files.'}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={13} />
                      {formatDateOnly(submission.event_date, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    {submission.event_time && (
                      <span className="flex items-center gap-1.5">
                        <Clock size={13} />
                        {submission.event_time}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <MapPin size={13} />
                      {submission.location}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Mail size={13} />
                      {submission.submitter_email}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Submitted {new Date(submission.created_at).toLocaleString('en-CA')}
                  </p>
                </div>

                {canApprove && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => reviewSubmission(submission, 'rejected')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 border border-red-200 bg-white rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <XCircle size={15} />
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => reviewSubmission(submission, 'approved')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors"
                    >
                      <CheckCircle2 size={15} />
                      Approve
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {submissions.length === 0 && (
            <div className="border border-dashed border-slate-200 rounded-xl py-8 text-center text-sm text-slate-500">
              No event submissions are waiting for approval.
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6 mb-3">
        <h3 className="text-base font-semibold text-slate-900">Published Events</h3>
      </div>

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
                      <RichTextEditor
                        value={editData.description}
                        onChange={(description) => setEditData({ ...editData, description })}
                      />
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
                      <label className="block text-xs font-medium text-slate-600 mb-1">Audience</label>
                      <select
                        value={editData.visibility}
                        onChange={(e) => setEditData({ ...editData, visibility: e.target.value as EventVisibility })}
                        className={inputClass}
                      >
                        <option value="public">Everyone (public website)</option>
                        <option value="members">Lodge members only</option>
                        <option value="admin">Administrators only</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Event status</label>
                      <select
                        value={editData.event_status}
                        onChange={(e) => setEditData({ ...editData, event_status: e.target.value as EventStatus })}
                        className={inputClass}
                      >
                        <option value="scheduled">Scheduled</option>
                        <option value="postponed">Postponed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    {editData.event_status !== 'scheduled' && (
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Status message</label>
                        <textarea
                          value={editData.status_note}
                          onChange={(e) => setEditData({ ...editData, status_note: e.target.value })}
                          maxLength={500}
                          rows={2}
                          placeholder="Explain the cancellation or postponement and what members should do."
                          className={inputClass}
                        />
                      </div>
                    )}
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
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-slate-900">{event.title}</h4>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-700">
                        {event.visibility === 'public' ? 'Public' : event.visibility === 'admin' ? 'Admins only' : 'Members only'}
                      </span>
                      {event.event_status !== 'scheduled' && (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                          event.event_status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {event.event_status}
                        </span>
                      )}
                    </div>
                    {event.status_note && (
                      <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm font-medium text-slate-700">
                        {event.status_note}
                      </p>
                    )}
                    {(richTextToPlainText(event.description) || richTextHasEmbeds(event.description)) && (
                      <p className="text-sm text-slate-500 mt-1">
                        {richTextToPlainText(event.description) || 'Contains embedded media or files.'}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
                      <span className="flex items-center space-x-1">
                        <Calendar size={12} />
                        <span>{formatDateOnly(event.event_date, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</span>
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
                  {canWrite && <div className="flex items-center gap-1 ml-4">
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
                  </div>}
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
