import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
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

type ModalState =
  | { type: 'create' }
  | { type: 'edit'; team: Team }
  | { type: 'delete'; team: Team }
  | null;

const emptyForm = {
  name: '',
  channelName: '',
  standupTime: '09:00',
  postingTime: '10:00',
  timezone: 'America/New_York',
  isActive: true,
};

export default function AdminTeams() {
  const { activeOrgId } = useAdminAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeOrgId) return;
    fetch(`/api/admin/teams?orgId=${activeOrgId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(setTeams);
  }, [activeOrgId]);

  const openCreate = () => {
    setForm(emptyForm);
    setError('');
    setModal({ type: 'create' });
  };

  const openEdit = (team: Team) => {
    setForm({
      name: team.name,
      channelName: team.slackChannelId,
      standupTime: team.standupTime,
      postingTime: team.postingTime,
      timezone: team.timezone,
      isActive: team.isActive,
    });
    setError('');
    setModal({ type: 'edit', team });
  };

  const openDelete = (team: Team) => {
    setError('');
    setModal({ type: 'delete', team });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (modal?.type === 'create' && !form.channelName.trim()) { setError('Channel name is required.'); return; }
    if (!form.standupTime || !form.postingTime || !form.timezone) { setError('Standup time, posting time, and timezone are required.'); return; }

    setSaving(true);
    setError('');

    const isEdit = modal?.type === 'edit';
    const url = isEdit ? `/api/admin/teams/${(modal as { type: 'edit'; team: Team }).team.id}` : '/api/admin/teams';
    const body = isEdit
      ? { name: form.name, standupTime: form.standupTime, postingTime: form.postingTime, timezone: form.timezone, isActive: form.isActive }
      : { orgId: activeOrgId, name: form.name, channelName: form.channelName, standupTime: form.standupTime, postingTime: form.postingTime, timezone: form.timezone };

    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Failed to save.');
      return;
    }

    const saved: Team = await res.json();
    if (isEdit) {
      setTeams(prev => prev.map(t => t.id === saved.id ? { ...t, ...saved } : t));
    } else {
      setTeams(prev => [saved, ...prev]);
    }
    setModal(null);
  };

  const handleDelete = async () => {
    if (modal?.type !== 'delete') return;
    setSaving(true);
    const res = await fetch(`/api/admin/teams/${modal.team.id}`, { method: 'DELETE', credentials: 'include' });
    setSaving(false);
    if (!res.ok) { setError('Failed to delete.'); return; }
    setTeams(prev => prev.filter(t => t.id !== modal.team.id));
    setModal(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white">Teams</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-3 py-2 bg-[#00CFFF] hover:bg-[#00CFFF]/90 text-black text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus size={15} />
          New Team
        </button>
      </div>

      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'slackChannelId', label: 'Channel ID' },
          { key: 'standupTime', label: 'Standup' },
          { key: 'postingTime', label: 'Posting' },
          { key: 'timezone', label: 'Timezone' },
          { key: 'memberCount', label: 'Members' },
          {
            key: 'isActive', label: 'Status',
            render: (t) => <StatusBadge variant={t.isActive ? 'active' : 'inactive'} label={t.isActive ? 'Active' : 'Inactive'} />
          },
          {
            key: 'actions', label: '',
            render: (t) => (
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                  className="text-white/40 hover:text-[#00CFFF] transition-colors"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); openDelete(t); }}
                  className="text-white/40 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          }
        ]}
        rows={teams}
        emptyMessage="No teams found."
      />

      {/* Create / Edit Modal */}
      <AdminModal
        isOpen={modal?.type === 'create' || modal?.type === 'edit'}
        onClose={() => setModal(null)}
        title={modal?.type === 'edit' ? `Edit — ${(modal as { type: 'edit'; team: Team }).team.name}` : 'New Team'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Name <span className="text-red-400">*</span></label>
            <input
              className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00CFFF]/50"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Engineering"
            />
          </div>
          {modal?.type === 'create' && (
            <div>
              <label className="block text-xs text-white/50 mb-1">Channel Name <span className="text-red-400">*</span></label>
              <input
                className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00CFFF]/50"
                value={form.channelName}
                onChange={e => setForm(f => ({ ...f, channelName: e.target.value }))}
                placeholder="#engineering"
              />
              <p className="text-xs text-white/30 mt-1">Channel name will be resolved to a Slack channel ID.</p>
            </div>
          )}
          <div>
            <label className="block text-xs text-white/50 mb-1">Standup Time <span className="text-red-400">*</span></label>
            <input
              className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00CFFF]/50"
              value={form.standupTime}
              onChange={e => setForm(f => ({ ...f, standupTime: e.target.value }))}
              placeholder="09:00"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Posting Time <span className="text-red-400">*</span></label>
            <input
              className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00CFFF]/50"
              value={form.postingTime}
              onChange={e => setForm(f => ({ ...f, postingTime: e.target.value }))}
              placeholder="10:00"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Timezone <span className="text-red-400">*</span></label>
            <input
              className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00CFFF]/50"
              value={form.timezone}
              onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
              placeholder="America/New_York"
            />
          </div>
          {modal?.type === 'edit' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                className="w-4 h-4 accent-[#00CFFF]"
              />
              <span className="text-sm text-white/70">Active</span>
            </label>
          )}
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-[#00CFFF] hover:bg-[#00CFFF]/90 text-black text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : modal?.type === 'edit' ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </div>
      </AdminModal>

      {/* Delete Confirmation Modal */}
      <AdminModal
        isOpen={modal?.type === 'delete'}
        onClose={() => setModal(null)}
        title="Delete Team"
      >
        <div className="space-y-4">
          <p className="text-sm text-white/70">
            Are you sure you want to delete <span className="text-white font-medium">{modal?.type === 'delete' ? modal.team.name : ''}</span>? The team will be soft-deleted and hidden from the admin panel.
          </p>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Cancel</button>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
