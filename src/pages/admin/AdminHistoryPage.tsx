import { useState, useEffect } from 'react';
import { Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import { supabase, HistoryEntry } from '../../lib/supabase';

export const AdminHistoryPage = () => {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    year: '',
    image_url: '',
    display_order: '',
  });

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('history_entries')
      .select('*')
      .order('display_order', { ascending: true });
    if (data) setEntries(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextOrder = entries.length > 0 ? Math.max(...entries.map((e) => e.display_order)) + 1 : 1;
    await supabase.from('history_entries').insert({
      title: formData.title,
      content: formData.content,
      year: formData.year ? parseInt(formData.year) : null,
      image_url: formData.image_url || null,
      display_order: formData.display_order ? parseInt(formData.display_order) : nextOrder,
    });
    setShowForm(false);
    setFormData({ title: '', content: '', year: '', image_url: '', display_order: '' });
    fetchEntries();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this history entry?')) {
      await supabase.from('history_entries').delete().eq('id', id);
      fetchEntries();
    }
  };

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-serif text-slate-900">History</h2>
          <p className="text-sm text-slate-500 mt-1">Manage the lodge's historical timeline</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-900 text-amber-300 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          <Plus size={16} />
          <span>Add Entry</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-6">
          <h3 className="text-base font-semibold text-slate-900 mb-4">New History Entry</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
                <input
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  placeholder="e.g. 1865"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
              <textarea
                required
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={5}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Image URL</label>
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Display Order</label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
                  placeholder="Auto"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-sm bg-slate-900 text-amber-300 rounded-lg hover:bg-slate-800 transition-colors"
              >
                Add Entry
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading history...</div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start justify-between p-4 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start space-x-4 flex-1">
                {entry.image_url && (
                  <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100">
                    <img src={entry.image_url} alt={entry.title} className="w-full h-full object-cover" />
                  </div>
                )}
                {!entry.image_url && (
                  <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <ImageIcon size={20} className="text-slate-400" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    {entry.year && (
                      <span className="text-lg font-serif font-bold text-slate-900">{entry.year}</span>
                    )}
                    <h4 className="font-semibold text-slate-900">{entry.title}</h4>
                  </div>
                  <p className="text-sm text-slate-500 mt-1 line-clamp-2">{entry.content}</p>
                  <span className="text-xs text-slate-400 mt-1 block">Order: {entry.display_order}</span>
                </div>
              </div>
              <button
                onClick={() => handleDelete(entry.id)}
                className="ml-4 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {entries.length === 0 && (
            <div className="text-center py-12 text-slate-500">No history entries yet.</div>
          )}
        </div>
      )}
    </div>
  );
};
