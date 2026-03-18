import { useEffect, useState } from 'react';
import { DataTable } from '../../components/admin/DataTable';
import { StatusBadge } from '../../components/admin/StatusBadge';
import { AdminModal } from '../../components/admin/AdminModal';
import { useAdminAuth } from '../../hooks/useAdminAuth';

interface Member {
  id: string;
  slackUserId: string;
  name: string;
  role: string;
  teams: { id: string; name: string }[];
  receiveNotifications: boolean;
  lastStandupDate: string | null;
  joinedAt: string;
}

export default function AdminMembers() {
  const { activeOrgId } = useAdminAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [viewMember, setViewMember] = useState<Member | null>(null);

  useEffect(() => {
    if (!activeOrgId) return;
    fetch(`/api/admin/members?orgId=${activeOrgId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(setMembers);
  }, [activeOrgId]);

  const roleVariant = (role: string) =>
    role === 'OWNER' ? 'owner' : role === 'ADMIN' ? 'admin' : 'member';

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-6">Members</h1>
      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'slackUserId', label: 'Slack ID' },
          {
            key: 'role', label: 'Role',
            render: (m) => <StatusBadge variant={roleVariant(m.role) as 'owner' | 'admin' | 'member'} label={m.role} />
          },
          {
            key: 'teams', label: 'Teams',
            render: (m) => <span className="text-white/50">{m.teams.map(t => t.name).join(', ') || '—'}</span>
          },
          {
            key: 'lastStandupDate', label: 'Last Standup',
            render: (m) => <span className="text-white/50">{m.lastStandupDate ? new Date(m.lastStandupDate).toLocaleDateString() : '—'}</span>
          },
          {
            key: 'actions', label: '',
            render: (m) => (
              <button onClick={(e) => { e.stopPropagation(); setViewMember(m); }}
                className="text-xs text-[#00CFFF] hover:text-[#00CFFF]/80 transition-colors">
                View
              </button>
            )
          }
        ]}
        rows={members}
        emptyMessage="No members found."
      />

      <AdminModal isOpen={!!viewMember} onClose={() => setViewMember(null)} title={viewMember?.name ?? ''}>
        {viewMember && (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-white/40">Slack ID</span>
              <span className="text-white font-mono text-xs">{viewMember.slackUserId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/40">Role</span>
              <StatusBadge variant={roleVariant(viewMember.role) as 'owner' | 'admin' | 'member'} label={viewMember.role} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/40">Notifications</span>
              <span className="text-white">{viewMember.receiveNotifications ? 'On' : 'Off'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/40">Last Standup</span>
              <span className="text-white">{viewMember.lastStandupDate ? new Date(viewMember.lastStandupDate).toLocaleDateString() : '—'}</span>
            </div>
            <div>
              <span className="text-white/40 block mb-2">Teams</span>
              <div className="flex flex-wrap gap-2">
                {viewMember.teams.length > 0
                  ? viewMember.teams.map(t => (
                      <span key={t.id} className="px-2 py-1 bg-white/5 rounded text-xs text-white/70">{t.name}</span>
                    ))
                  : <span className="text-white/30 text-xs">No teams</span>
                }
              </div>
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  );
}
