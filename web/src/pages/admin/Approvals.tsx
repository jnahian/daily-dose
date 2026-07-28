import { useCallback, useEffect, useState } from 'react';
import { Check, X, RefreshCw } from 'lucide-react';
import { DataTable } from '../../components/admin/DataTable';
import { AdminModal } from '../../components/admin/AdminModal';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { PENDING_TEAMS_CHANGED_EVENT } from '../../utils/adminEvents';

interface PendingTeam {
  id: string;
  name: string;
  slackChannelId: string;
  standupTime: string;
  postingTime: string;
  timezone: string;
  createdAt: string;
  proposedBy: {
    name: string | null;
    username: string | null;
    slackUserId: string;
  } | null;
}

type ModalState =
  | { type: 'approve'; team: PendingTeam }
  | { type: 'reject'; team: PendingTeam }
  | null;

function proposerLabel(team: PendingTeam) {
  if (!team.proposedBy) return 'Unknown';
  return (
    team.proposedBy.name ||
    team.proposedBy.username ||
    team.proposedBy.slackUserId
  );
}

function formatRequested(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

export default function AdminApprovals() {
  const { activeOrgId } = useAdminAuth();
  const [teams, setTeams] = useState<PendingTeam[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    // Super admins land here with no org selected; don't leave the table
    // stuck on "Loading…" with the Refresh button disabled.
    if (!activeOrgId) {
      setTeams([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/teams/pending?orgId=${activeOrgId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setTeams(await res.json());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load pending teams.'
      );
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, [activeOrgId]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (action: 'approve' | 'reject') => {
    if (!modal) return;
    setSaving(true);
    setModalError('');

    try {
      const res = await fetch(`/api/admin/teams/${modal.team.id}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setModalError(data.error || `Failed to ${action} the team.`);
        // A 409 means someone else already decided — refresh so the stale row goes away.
        if (res.status === 409) load();
        return;
      }

      setTeams((prev) => prev.filter((t) => t.id !== modal.team.id));
      setModal(null);
      // Let the sidebar badge drop without a full reload.
      window.dispatchEvent(new Event(PENDING_TEAMS_CHANGED_EVENT));
    } catch {
      setModalError(`Failed to ${action} the team.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">
            Pending Approvals
          </h1>
          <p className="text-sm text-white/40 mt-1">
            Teams proposed with{' '}
            <code className="text-white/60">/dd-team-create</code> by members
            who aren&apos;t org admins. They stay unscheduled until approved.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-white/50 hover:text-white text-sm transition-colors disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <DataTable
        columns={[
          { key: 'name', label: 'Team' },
          {
            key: 'proposedBy',
            label: 'Proposed By',
            render: (t) => proposerLabel(t),
          },
          { key: 'slackChannelId', label: 'Channel ID' },
          { key: 'standupTime', label: 'Standup' },
          { key: 'postingTime', label: 'Posting' },
          { key: 'timezone', label: 'Timezone' },
          {
            key: 'createdAt',
            label: 'Requested',
            render: (t) => formatRequested(t.createdAt),
          },
          {
            key: 'actions',
            label: '',
            render: (t) => (
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalError('');
                    setModal({ type: 'approve', team: t });
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium transition-colors"
                >
                  <Check size={13} />
                  Approve
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalError('');
                    setModal({ type: 'reject', team: t });
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-colors"
                >
                  <X size={13} />
                  Reject
                </button>
              </div>
            ),
          },
        ]}
        rows={teams}
        emptyMessage={
          loading ? 'Loading…' : 'No teams are waiting for approval.'
        }
      />

      {/* Approve Confirmation */}
      <AdminModal
        isOpen={modal?.type === 'approve'}
        onClose={() => setModal(null)}
        title="Approve Team"
      >
        <div className="space-y-4">
          <p className="text-sm text-white/70">
            Approve{' '}
            <span className="text-white font-medium">
              {modal?.type === 'approve' ? modal.team.name : ''}
            </span>
            ? Standup reminders and posting will be scheduled immediately, and
            the member who proposed it will be notified in Slack.
          </p>
          {modalError && <p className="text-red-400 text-xs">{modalError}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setModal(null)}
              className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => decide('approve')}
              disabled={saving}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Approving…' : 'Approve'}
            </button>
          </div>
        </div>
      </AdminModal>

      {/* Reject Confirmation */}
      <AdminModal
        isOpen={modal?.type === 'reject'}
        onClose={() => setModal(null)}
        title="Reject Team"
      >
        <div className="space-y-4">
          <p className="text-sm text-white/70">
            Reject{' '}
            <span className="text-white font-medium">
              {modal?.type === 'reject' ? modal.team.name : ''}
            </span>
            ? The proposed team is deleted so the channel is free for a new
            request, and the member who proposed it will be notified in Slack.
          </p>
          {modalError && <p className="text-red-400 text-xs">{modalError}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setModal(null)}
              className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => decide('reject')}
              disabled={saving}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
