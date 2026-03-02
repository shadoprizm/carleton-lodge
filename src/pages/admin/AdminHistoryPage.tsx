import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit2, Image as ImageIcon, X, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface HistoryEra {
  id: string;
  title: string;
  year_start: number;
  year_end: number | null;
  slug: string;
  summary: string;
  content: string;
  image_url: string | null;
  display_order: number;
  created_at: string;
}

interface HistoryMilestone {
  id: string;
  era_id: string;
  title: string;
  date: string;
  description: string;
  image_url: string | null;
  created_at: string;
}

export const AdminHistoryPage = () => {
  const [eras, setEras] = useState<HistoryEra[]>([]);
  const [milestones, setMilestones] = useState<HistoryMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'eras' | 'milestones'>('eras');
  const [expandedEras, setExpandedEras] = useState<Set<string>>(new Set());
  
  // Era form state
  const [showEraForm, setShowEraForm] = useState(false);
  const [editingEra, setEditingEra] = useState<HistoryEra | null>(null);
  const [eraFormData, setEraFormData] = useState({
    title: '',
    year_start: '',
    year_end: '',
    slug: '',
    summary: '',
    content: '',
    image_url: '',
    display_order: '',
  });

  // Milestone form state
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<HistoryMilestone | null>(null);
  const [milestoneFormData, setMilestoneFormData] = useState({
    era_id: '',
    title: '',
    date: '',
    description: '',
    image_url: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [erasRes, milestonesRes] = await Promise.all([
      supabase.from('history_eras').select('*').order('display_order'),
      supabase.from('history_milestones').select('*').order('date'),
    ]);
    
    if (erasRes.data) {
      setEras(erasRes.data);
      // Expand all eras by default
      setExpandedEras(new Set(erasRes.data.map(e => e.id)));
    }
    if (milestonesRes.data) {
      setMilestones(milestonesRes.data);
    }
    setLoading(false);
  };

  const toggleEra = (id: string) => {
    setExpandedEras(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Era handlers
  const openEraForm = (era?: HistoryEra) => {
    if (era) {
      setEditingEra(era);
      setEraFormData({
        title: era.title,
        year_start: era.year_start.toString(),
        year_end: era.year_end?.toString() || '',
        slug: era.slug,
        summary: era.summary,
        content: era.content,
        image_url: era.image_url || '',
        display_order: era.display_order.toString(),
      });
    } else {
      setEditingEra(null);
      const nextOrder = eras.length > 0 ? Math.max(...eras.map(e => e.display_order)) + 1 : 1;
      setEraFormData({
        title: '',
        year_start: '',
        year_end: '',
        slug: '',
        summary: '',
        content: '',
        image_url: '',
        display_order: nextOrder.toString(),
      });
    }
    setShowEraForm(true);
    setShowMilestoneForm(false);
  };

  const handleEraSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      title: eraFormData.title,
      year_start: parseInt(eraFormData.year_start),
      year_end: eraFormData.year_end ? parseInt(eraFormData.year_end) : null,
      slug: eraFormData.slug || eraFormData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      summary: eraFormData.summary,
      content: eraFormData.content,
      image_url: eraFormData.image_url || null,
      display_order: parseInt(eraFormData.display_order) || 1,
    };

    if (editingEra) {
      await supabase.from('history_eras').update(payload).eq('id', editingEra.id);
    } else {
      await supabase.from('history_eras').insert(payload);
    }
    
    setShowEraForm(false);
    setEditingEra(null);
    fetchData();
  };

  const handleDeleteEra = async (id: string) => {
    // Check if era has milestones
    const eraMilestones = milestones.filter(m => m.era_id === id);
    const confirmMsg = eraMilestones.length > 0
      ? `This era has ${eraMilestones.length} milestone(s). Delete anyway?`
      : 'Delete this era?';
    
    if (confirm(confirmMsg)) {
      // Delete associated milestones first
      if (eraMilestones.length > 0) {
        await supabase.from('history_milestones').delete().eq('era_id', id);
      }
      await supabase.from('history_eras').delete().eq('id', id);
      fetchData();
    }
  };

  // Milestone handlers
  const openMilestoneForm = (milestone?: HistoryMilestone, eraId?: string) => {
    if (milestone) {
      setEditingMilestone(milestone);
      setMilestoneFormData({
        era_id: milestone.era_id,
        title: milestone.title,
        date: milestone.date,
        description: milestone.description,
        image_url: milestone.image_url || '',
      });
    } else {
      setEditingMilestone(null);
      setMilestoneFormData({
        era_id: eraId || (eras[0]?.id || ''),
        title: '',
        date: '',
        description: '',
        image_url: '',
      });
    }
    setShowMilestoneForm(true);
    setShowEraForm(false);
  };

  const handleMilestoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      era_id: milestoneFormData.era_id,
      title: milestoneFormData.title,
      date: milestoneFormData.date,
      description: milestoneFormData.description,
      image_url: milestoneFormData.image_url || null,
    };

    if (editingMilestone) {
      await supabase.from('history_milestones').update(payload).eq('id', editingMilestone.id);
    } else {
      await supabase.from('history_milestones').insert(payload);
    }
    
    setShowMilestoneForm(false);
    setEditingMilestone(null);
    fetchData();
  };

  const handleDeleteMilestone = async (id: string) => {
    if (confirm('Delete this milestone?')) {
      await supabase.from('history_milestones').delete().eq('id', id);
      fetchData();
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'era' | 'milestone') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(type);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `history/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('lodge-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('lodge-images')
        .getPublicUrl(filePath);

      if (type === 'era') {
        setEraFormData(prev => ({ ...prev, image_url: publicUrl }));
      } else {
        setMilestoneFormData(prev => ({ ...prev, image_url: publicUrl }));
      }
    } catch (err) {
      console.error('Error uploading image:', err);
      alert('Failed to upload image');
    } finally {
      setUploadingImage(null);
    }
  };

  const getEraMilestones = (eraId: string) => {
    return milestones.filter(m => m.era_id === eraId).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-serif text-slate-900">History</h2>
          <p className="text-sm text-slate-500 mt-1">Manage historical eras and milestones</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => openMilestoneForm()}
            className="flex items-center space-x-2 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <Clock size={15} />
            <span>Add Milestone</span>
          </button>
          <button
            onClick={() => openEraForm()}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-900 text-amber-300 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            <Plus size={16} />
            <span>Add Era</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6">
        {(['eras', 'milestones'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab}
            <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {tab === 'eras' ? eras.length : milestones.length}
            </span>
          </button>
        ))}
      </div>

      {/* Era Form */}
      {showEraForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold text-slate-900">
              {editingEra ? 'Edit Era' : 'New Era'}
            </h3>
            <button onClick={() => setShowEraForm(false)} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleEraSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={eraFormData.title}
                  onChange={(e) => setEraFormData({ ...eraFormData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Slug</label>
                <input
                  type="text"
                  required
                  value={eraFormData.slug}
                  onChange={(e) => setEraFormData({ ...eraFormData, slug: e.target.value })}
                  placeholder="auto-generated-if-empty"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Year</label>
                <input
                  type="number"
                  required
                  value={eraFormData.year_start}
                  onChange={(e) => setEraFormData({ ...eraFormData, year_start: e.target.value })}
                  placeholder="e.g. 1904"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">End Year</label>
                <input
                  type="number"
                  value={eraFormData.year_end}
                  onChange={(e) => setEraFormData({ ...eraFormData, year_end: e.target.value })}
                  placeholder="Leave blank if ongoing"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Display Order</label>
                <input
                  type="number"
                  value={eraFormData.display_order}
                  onChange={(e) => setEraFormData({ ...eraFormData, display_order: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Summary</label>
              <input
                type="text"
                required
                value={eraFormData.summary}
                onChange={(e) => setEraFormData({ ...eraFormData, summary: e.target.value })}
                placeholder="Brief summary shown on timeline"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
              <textarea
                required
                value={eraFormData.content}
                onChange={(e) => setEraFormData({ ...eraFormData, content: e.target.value })}
                rows={6}
                placeholder="Full content for the era detail page (use blank lines between paragraphs)"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cover Image</label>
              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  value={eraFormData.image_url}
                  onChange={(e) => setEraFormData({ ...eraFormData, image_url: e.target.value })}
                  placeholder="https://..."
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e, 'era')}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage === 'era'}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {uploadingImage === 'era' ? 'Uploading...' : 'Upload'}
                </button>
              </div>
              {eraFormData.image_url && (
                <div className="mt-2 w-32 h-20 rounded-lg overflow-hidden bg-slate-100">
                  <img src={eraFormData.image_url} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowEraForm(false)}
                className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-sm bg-slate-900 text-amber-300 rounded-lg hover:bg-slate-800 transition-colors"
              >
                {editingEra ? 'Save Changes' : 'Add Era'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Milestone Form */}
      {showMilestoneForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold text-slate-900">
              {editingMilestone ? 'Edit Milestone' : 'New Milestone'}
            </h3>
            <button onClick={() => setShowMilestoneForm(false)} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleMilestoneSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Era</label>
              <select
                required
                value={milestoneFormData.era_id}
                onChange={(e) => setMilestoneFormData({ ...milestoneFormData, era_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="">Select an era...</option>
                {eras.map((era) => (
                  <option key={era.id} value={era.id}>{era.title} ({era.year_start})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input
                type="text"
                required
                value={milestoneFormData.title}
                onChange={(e) => setMilestoneFormData({ ...milestoneFormData, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input
                type="date"
                required
                value={milestoneFormData.date}
                onChange={(e) => setMilestoneFormData({ ...milestoneFormData, date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                required
                value={milestoneFormData.description}
                onChange={(e) => setMilestoneFormData({ ...milestoneFormData, description: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Image URL (optional)</label>
              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  value={milestoneFormData.image_url}
                  onChange={(e) => setMilestoneFormData({ ...milestoneFormData, image_url: e.target.value })}
                  placeholder="https://..."
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="milestone-image-upload"
                  onChange={(e) => handleImageUpload(e, 'milestone')}
                />
                <label
                  htmlFor="milestone-image-upload"
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {uploadingImage === 'milestone' ? 'Uploading...' : 'Upload'}
                </label>
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowMilestoneForm(false)}
                className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-sm bg-slate-900 text-amber-300 rounded-lg hover:bg-slate-800 transition-colors"
              >
                {editingMilestone ? 'Save Changes' : 'Add Milestone'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading...</div>
      ) : activeTab === 'eras' ? (
        <div className="space-y-4">
          {eras.map((era) => {
            const eraMilestones = getEraMilestones(era.id);
            const isExpanded = expandedEras.has(era.id);
            return (
              <div key={era.id} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-slate-50">
                  <button
                    onClick={() => toggleEra(era.id)}
                    className="flex items-center space-x-3 flex-1 text-left"
                  >
                    {isExpanded ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                    {era.image_url ? (
                      <img src={era.image_url} alt={era.title} className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center">
                        <ImageIcon size={20} className="text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg font-serif font-bold text-slate-900">{era.year_start}</span>
                        {era.year_end && <span className="text-slate-400">- {era.year_end}</span>}
                        <h4 className="font-semibold text-slate-900">{era.title}</h4>
                      </div>
                      <p className="text-sm text-slate-500 line-clamp-1">{era.summary}</p>
                    </div>
                    <span className="text-xs text-slate-400 bg-white px-2 py-1 rounded-full border border-slate-200">
                      Order: {era.display_order}
                    </span>
                  </button>
                  <div className="flex items-center space-x-1 ml-4">
                    <button
                      onClick={() => openMilestoneForm(undefined, era.id)}
                      className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                      title="Add milestone to this era"
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      onClick={() => openEraForm(era)}
                      className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteEra(era.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                {isExpanded && eraMilestones.length > 0 && (
                  <div className="border-t border-slate-200 bg-white">
                    <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Milestones ({eraMilestones.length})
                    </div>
                    {eraMilestones.map((milestone) => (
                      <div key={milestone.id} className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Clock size={14} className="text-amber-600" />
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-slate-900">{milestone.title}</span>
                              <span className="text-xs text-slate-500">
                                {new Date(milestone.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500 line-clamp-1">{milestone.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => openMilestoneForm(milestone)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteMilestone(milestone.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {eras.length === 0 && (
            <div className="text-center py-12 text-slate-500">No eras yet. Create your first era to get started.</div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {milestones.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No milestones yet.</div>
          ) : (
            milestones.map((milestone) => {
              const era = eras.find(e => e.id === milestone.era_id);
              return (
                <div key={milestone.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
                  <div className="flex items-start space-x-3 flex-1">
                    <Clock size={18} className="text-amber-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-slate-900">{milestone.title}</span>
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {new Date(milestone.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1 line-clamp-2">{milestone.description}</p>
                      {era && (
                        <span className="text-xs text-slate-400 mt-1 block">
                          Era: {era.title}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 ml-4">
                    <button
                      onClick={() => openMilestoneForm(milestone)}
                      className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteMilestone(milestone.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
