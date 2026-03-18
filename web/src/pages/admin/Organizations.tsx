import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { DataTable } from '../../components/admin/DataTable';
import { StatusBadge } from '../../components/admin/StatusBadge';
import { useAdminAuth } from '../../hooks/useAdminAuth';

interface Org {
  id: string;
  name: string;
  slackWorkspaceId: string;
  isActive: boolean;
  teamCount: number;
  memberCount: number;
  createdAt: string;
}

export default function AdminOrganizations() {
  const { isSuperAdmin } = useAdminAuth();
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<Org[]>([]);

  useEffect(() => {
    if (!isSuperAdmin) { navigate('/admin/dashboard'); return; }
    fetch('/api/admin/organizations', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(setOrgs);
  }, [isSuperAdmin, navigate]);

  const toggleOrg = async (org: Org) => {
    const res = await fetch(`/api/admin/organizations/${org.id}/toggle`, {
      method: 'PATCH', credentials: 'include'
    });
    if (res.ok) {
      setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, isActive: !o.isActive } : o));
    }
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-6">Organizations</h1>
      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'slackWorkspaceId', label: 'Workspace ID' },
          { key: 'teamCount', label: 'Teams' },
          { key: 'memberCount', label: 'Members' },
          {
            key: 'isActive', label: 'Status',
            render: (o) => <StatusBadge variant={o.isActive ? 'active' : 'inactive'} label={o.isActive ? 'Active' : 'Inactive'} />
          },
          {
            key: 'actions', label: '',
            render: (o) => (
              <button
                onClick={(e) => { e.stopPropagation(); toggleOrg(o); }}
                className="text-xs text-white/40 hover:text-white transition-colors"
              >
                {o.isActive ? 'Disable' : 'Enable'}
              </button>
            )
          }
        ]}
        rows={orgs}
        emptyMessage="No organizations found."
      />
    </div>
  );
}
