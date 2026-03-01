import { SummonsManager } from '../../components/admin/SummonsManager';

export const AdminSummonsPage = () => {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-serif text-slate-900">Summons</h2>
        <p className="text-sm text-slate-500 mt-1">Publish and manage monthly summons</p>
      </div>
      <SummonsManager />
    </div>
  );
};
