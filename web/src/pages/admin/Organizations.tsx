import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Pencil, Trash2, UserPlus } from 'lucide-react';
import { DataTable } from '../../components/admin/DataTable';
import { StatusBadge } from '../../components/admin/StatusBadge';
import { AdminModal } from '../../components/admin/AdminModal';
import { useAdminAuth } from '../../hooks/useAdminAuth';

interface Org {
  id: string;
  name: string;
  slackWorkspaceId: string;
  slackWorkspaceName: string;
  defaultTimezone: string;
  isActive: boolean;
  teamCount: number;
  memberCount: number;
  createdAt: string;
}

type ModalState =
  | { type: 'create' }
  | { type: 'edit'; org: Org }
  | { type: 'delete'; org: Org }
  | { type: 'addMember'; org: Org }
  | null;

const emptyForm = { name: '', slackWorkspaceId: '', slackWorkspaceName: '', defaultTimezone: 'America/New_York', isActive: true };

export default function AdminOrganizations() {
  const { isSuperAdmin } = useAdminAuth();
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [memberSlackId, setMemberSlackId] = useState('');
  const [memberRole, setMemberRole] = useState('MEMBER');

  useEffect(() => {
    if (!isSuperAdmin) { navigate('/admin/dashboard'); return; }
    fetch('/api/admin/organizations', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(setOrgs);
  }, [isSuperAdmin, navigate]);

  const openCreate = () => {
    setForm(emptyForm);
    setError('');
    setModal({ type: 'create' });
  };

  const openEdit = (org: Org) => {
    setForm({ name: org.name, slackWorkspaceId: org.slackWorkspaceId || '', slackWorkspaceName: org.slackWorkspaceName || '', defaultTimezone: org.defaultTimezone || 'America/New_York', isActive: org.isActive });
    setError('');
    setModal({ type: 'edit', org });
  };

  const openDelete = (org: Org) => {
    setError('');
    setModal({ type: 'delete', org });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError('');
    const isEdit = modal?.type === 'edit';
    const url = isEdit ? `/api/admin/organizations/${(modal as { type: 'edit'; org: Org }).org.id}` : '/api/admin/organizations';
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Failed to save.');
      return;
    }
    const saved: Org = await res.json();
    if (isEdit) {
      setOrgs(prev => prev.map(o => o.id === saved.id ? { ...o, ...saved } : o));
    } else {
      setOrgs(prev => [saved, ...prev]);
    }
    setModal(null);
  };

  const handleDelete = async () => {
    if (modal?.type !== 'delete') return;
    setSaving(true);
    const res = await fetch(`/api/admin/organizations/${modal.org.id}`, { method: 'DELETE', credentials: 'include' });
    setSaving(false);
    if (!res.ok) { setError('Failed to delete.'); return; }
    setOrgs(prev => prev.filter(o => o.id !== modal.org.id));
    setModal(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white">Organizations</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-3 py-2 bg-[#00CFFF] hover:bg-[#00CFFF]/90 text-black text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus size={15} />
          New Organization
        </button>
      </div>

      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'slackWorkspaceId', label: 'Workspace ID' },
          { key: 'defaultTimezone', label: 'Timezone' },
          { key: 'teamCount', label: 'Teams' },
          { key: 'memberCount', label: 'Members' },
          {
            key: 'isActive', label: 'Status',
            render: (o) => <StatusBadge variant={o.isActive ? 'active' : 'inactive'} label={o.isActive ? 'Active' : 'Inactive'} />
          },
          {
            key: 'actions', label: '',
            render: (o) => (
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); setError(''); setModal({ type: 'addMember', org: o }); }}
                  className="text-white/40 hover:text-green-400 transition-colors"
                  title="Add member"
                >
                  <UserPlus size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); openEdit(o); }}
                  className="text-white/40 hover:text-[#00CFFF] transition-colors"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); openDelete(o); }}
                  className="text-white/40 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          }
        ]}
        rows={orgs}
        emptyMessage="No organizations found."
      />

      {/* Create / Edit Modal */}
      <AdminModal
        isOpen={modal?.type === 'create' || modal?.type === 'edit'}
        onClose={() => setModal(null)}
        title={modal?.type === 'edit' ? 'Edit Organization' : 'New Organization'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Name <span className="text-red-400">*</span></label>
            <input
              className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00CFFF]/50"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Acme Inc."
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Slack Workspace ID</label>
            <input
              className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00CFFF]/50"
              value={form.slackWorkspaceId}
              onChange={e => setForm(f => ({ ...f, slackWorkspaceId: e.target.value }))}
              placeholder="T0123456"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Slack Workspace Name</label>
            <input
              className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00CFFF]/50"
              value={form.slackWorkspaceName}
              onChange={e => setForm(f => ({ ...f, slackWorkspaceName: e.target.value }))}
              placeholder="acme"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Default Timezone</label>
            <input
              className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00CFFF]/50"
              value={form.defaultTimezone}
              onChange={e => setForm(f => ({ ...f, defaultTimezone: e.target.value }))}
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
        title="Delete Organization"
      >
        <div className="space-y-4">
          <p className="text-sm text-white/70">
            Are you sure you want to delete <span className="text-white font-medium">{modal?.type === 'delete' ? modal.org.name : ''}</span>? This will permanently delete all teams, members, holidays, and standup data for this organization.
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

      {/* Add Member Modal */}
      <AdminModal
        isOpen={modal?.type === 'addMember'}
        onClose={() => setModal(null)}
        title={modal?.type === 'addMember' ? `Add Member — ${modal.org.name}` : 'Add Member'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Slack User ID <span className="text-red-400">*</span></label>
            <input
              className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00CFFF]/50"
              value={memberSlackId}
              onChange={e => setMemberSlackId(e.target.value)}
              placeholder="U0123456789"
            />
            <p className="text-xs text-white/30 mt-1">The user must have signed in to the bot at least once.</p>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Role</label>
            <select
              className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00CFFF]/50"
              value={memberRole}
              onChange={e => setMemberRole(e.target.value)}
            >
              {['MEMBER', 'ADMIN', 'OWNER'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Cancel</button>
            <button
              onClick={async () => {
                if (!memberSlackId.trim()) { setError('Slack User ID is required.'); return; }
                if (modal?.type !== 'addMember') return;
                setSaving(true); setError('');
                const res = await fetch('/api/admin/members', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ slackUserId: memberSlackId.trim(), orgId: modal.org.id, role: memberRole }),
                });
                setSaving(false);
                if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'Failed to add member.'); return; }
                setOrgs(prev => prev.map(o => o.id === modal.org.id ? { ...o, memberCount: o.memberCount + 1 } : o));
                setMemberSlackId(''); setModal(null);
              }}
              disabled={saving}
              className="px-4 py-2 bg-[#00CFFF] hover:bg-[#00CFFF]/90 text-black text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Adding…' : 'Add Member'}
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
