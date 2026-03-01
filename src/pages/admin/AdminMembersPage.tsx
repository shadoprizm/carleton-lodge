import { MembersManager } from '../../components/admin/MembersManager';

export const AdminMembersPage = () => {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-serif text-slate-900">Members</h2>
        <p className="text-sm text-slate-500 mt-1">Manage lodge member profiles and positions</p>
      </div>
      <MembersManager />
    </div>
  );
};
