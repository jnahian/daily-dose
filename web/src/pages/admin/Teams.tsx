import { useEffect, useState } from 'react';
import { DataTable } from '../../components/admin/DataTable';
import { StatusBadge } from '../../components/admin/StatusBadge';
import { AdminModal } from '../../components/admin/AdminModal';
import { useAdminAuth } from '../../hooks/useAdminAuth';

interface Team {
  id: string;
  name: string;
  slackChannelId: string;
  standupTime: string;
  postingTime: string;
  timezone: string;
  isActive: boolean;
  memberCount: number;
}

export default function AdminTeams() {
  const { activeOrgId } = useAdminAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [form, setForm] = useState({ standupTime: '', postingTime: '', timezone: '' });

  useEffect(() => {
    if (!activeOrgId) return;
    fetch(`/api/admin/teams?orgId=${activeOrgId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(setTeams);
  }, [activeOrgId]);

  const openEdit = (team: Team) => {
    setEditTeam(team);
    setForm({ standupTime: team.standupTime, postingTime: team.postingTime, timezone: team.timezone });
  };

  const saveEdit = async () => {
    if (!editTeam) return;
    const res = await fetch(`/api/admin/teams/${editTeam.id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    if (res.ok) {
      setTeams(prev => prev.map(t => t.id === editTeam.id ? { ...t, ...form } : t));
      setEditTeam(null);
    } else {
      console.error('Failed to save team');
    }
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-6">Teams</h1>
      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'slackChannelId', label: 'Channel' },
          { key: 'standupTime', label: 'Standup Time' },
          { key: 'postingTime', label: 'Posting Time' },
          { key: 'timezone', label: 'Timezone' },
          { key: 'memberCount', label: 'Members' },
          {
            key: 'isActive', label: 'Status',
            render: (t) => <StatusBadge variant={t.isActive ? 'active' : 'inactive'} label={t.isActive ? 'Active' : 'Inactive'} />
          },
          {
            key: 'actions', label: '',
            render: (t) => (
              <button onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                className="text-xs text-[#00CFFF] hover:text-[#00CFFF]/80 transition-colors">
                Edit
              </button>
            )
          }
        ]}
        rows={teams}
        emptyMessage="No teams found."
      />

      <AdminModal isOpen={!!editTeam} onClose={() => setEditTeam(null)} title={`Edit — ${editTeam?.name ?? ''}`}>
        <div className="space-y-4">
          {(['standupTime', 'postingTime', 'timezone'] as const).map(field => (
            <div key={field}>
              <label className="block text-xs text-white/50 mb-1 capitalize">
                {field.replace(/([A-Z])/g, ' $1')}
              </label>
              <input
                value={form[field]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00CFFF]/50"
              />
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setEditTeam(null)}
              className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">
              Cancel
            </button>
            <button onClick={saveEdit}
              className="px-4 py-2 text-sm bg-[#00CFFF] text-black font-medium rounded-lg hover:bg-[#00CFFF]/90 transition-colors">
              Save
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
