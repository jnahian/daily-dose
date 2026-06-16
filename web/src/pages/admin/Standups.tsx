import { useEffect, useState } from 'react';
import { DataTable } from '../../components/admin/DataTable';
import { AdminModal } from '../../components/admin/AdminModal';
import { useAdminAuth } from '../../hooks/useAdminAuth';

interface StandupRow {
  id: string;
  teamId: string;
  teamName: string;
  standupDate: string;
  submittedCount: number;
  totalMembers: number;
  postedAt: string;
}

interface Response {
  id: string;
  user: { slackUserId: string; name: string };
  yesterdayTasks: string;
  todayTasks: string;
  blockers: string;
  hasBlockers: boolean;
  isLate: boolean;
  submittedAt: string;
}

export default function AdminStandups() {
  const { activeOrgId } = useAdminAuth();
  const [rows, setRows] = useState<StandupRow[]>([]);
  const [selected, setSelected] = useState<StandupRow | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);

  useEffect(() => {
    if (!activeOrgId) return;
    fetch(`/api/admin/standups?orgId=${activeOrgId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(setRows);
  }, [activeOrgId]);

  const openResponses = async (row: StandupRow) => {
    setSelected(row);
    setLoadingResponses(true);
    setResponses([]);
    const date = new Date(row.standupDate).toISOString().split('T')[0];
    const data = await fetch(`/api/admin/standups/${row.teamId}/${date}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : []);
    setResponses(data);
    setLoadingResponses(false);
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-6">Standups</h1>
      <p className="text-white/40 text-sm mb-4">Click a row to view individual responses.</p>
      <DataTable
        columns={[
          { key: 'teamName', label: 'Team' },
          { key: 'standupDate', label: 'Date', render: (r) => new Date(r.standupDate).toLocaleDateString() },
          { key: 'submittedCount', label: 'Submitted' },
          { key: 'totalMembers', label: 'Members' },
          {
            key: 'rate', label: 'Rate',
            render: (r) => `${r.totalMembers > 0 ? Math.round((r.submittedCount / r.totalMembers) * 100) : 0}%`
          }
        ]}
        rows={rows}
        onRowClick={openResponses}
        emptyMessage="No standups found."
      />

      <AdminModal
        isOpen={!!selected}
        onClose={() => { setSelected(null); setResponses([]); }}
        title={selected ? `${selected.teamName} — ${new Date(selected.standupDate).toLocaleDateString()}` : ''}
      >
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {loadingResponses && <p className="text-white/40 text-sm">Loading...</p>}
          {!loadingResponses && responses.length === 0 && <p className="text-white/40 text-sm">No responses.</p>}
          {responses.map(r => (
            <div key={r.id} className="border border-white/10 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{r.user.name}</span>
                <div className="flex gap-2">
                  {r.isLate && <span className="text-xs text-amber-400">Late</span>}
                  {r.hasBlockers && <span className="text-xs text-red-400">Blocked</span>}
                </div>
              </div>
              <div className="text-xs text-white/60 space-y-1">
                <p><span className="text-white/30">Yesterday: </span>{r.yesterdayTasks}</p>
                <p><span className="text-white/30">Today: </span>{r.todayTasks}</p>
                {r.hasBlockers && <p><span className="text-white/30">Blockers: </span>{r.blockers}</p>}
              </div>
            </div>
          ))}
        </div>
      </AdminModal>
    </div>
  );
}
