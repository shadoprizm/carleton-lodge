import { MembersManager } from '../../components/admin/MembersManager';
import { Link } from 'react-router';

export const AdminMembersPage = () => {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-serif text-slate-900">Members</h2>
          <p className="text-sm text-slate-500 mt-1">Manage lodge member profiles and positions</p>
        </div>
        <Link to="/admin/email-accounts" className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">
          Manage officer mailbox handovers
        </Link>
      </div>
      <MembersManager />
    </div>
  );
};
