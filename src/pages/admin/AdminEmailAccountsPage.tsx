import { LodgeEmailAccountsManager } from '../../components/admin/LodgeEmailAccountsManager';

export const AdminEmailAccountsPage = () => (
  <div>
    <div className="mb-6">
      <h2 className="text-xl font-serif text-slate-900">Lodge Email Accounts</h2>
      <p className="mt-1 text-sm text-slate-500">Manage Lodge-owned role mailboxes, agreements, credentials, and officer handovers</p>
    </div>
    <LodgeEmailAccountsManager />
  </div>
);
