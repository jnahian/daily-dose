import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { DataTable } from '../../components/admin/DataTable';
import { StatusBadge } from '../../components/admin/StatusBadge';
import { AdminModal } from '../../components/admin/AdminModal';
import { useAdminAuth } from '../../hooks/useAdminAuth';

interface Member {
  id: string;
  userId: string;
  slackUserId: string;
  name: string;
  role: string;
  teams: { id: string; name: string }[];
  receiveNotifications: boolean;
  lastStandupDate: string | null;
  joinedAt: string;
}

type ModalState =
  | { type: 'add'; orgId: string }
  | { type: 'role'; member: Member }
  | { type: 'delete'; member: Member }
  | null;

const ROLES = ['MEMBER', 'ADMIN', 'OWNER'] as const;

export default function AdminMembers() {
  const { activeOrgId } = useAdminAuth();
  const location = useLocation();
  const [members, setMembers] = useState<Member[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [slackUserId, setSlackUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('MEMBER');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const effectiveOrgId = (location.state as { orgId?: string } | null)?.orgId || activeOrgId;

  useEffect(() => {
    if (!effectiveOrgId) return;
    fetch(`/api/admin/members?orgId=${effectiveOrgId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(setMembers);
  }, [effectiveOrgId]);

  // Auto-open add modal if navigated here with addMember state
  useEffect(() => {
    const state = location.state as { addMember?: boolean; orgId?: string } | null;
    if (state?.addMember && state?.orgId) {
      openAdd(state.orgId);
    }
  }, []);

  const openAdd = (orgId: string) => {
    setSlackUserId('');
    setSelectedRole('MEMBER');
    setError('');
    setModal({ type: 'add', orgId });
  };

  const openRoleEdit = (member: Member) => {
    setSelectedRole(member.role);
    setError('');
    setModal({ type: 'role', member });
  };

  const handleAdd = async () => {
    if (!slackUserId.trim()) { setError('Slack User ID is required.'); return; }
    if (modal?.type !== 'add') return;
    setSaving(true);
    setError('');
    const res = await fetch('/api/admin/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ slackUserId: slackUserId.trim(), orgId: modal.orgId, role: selectedRole }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Failed to add member.');
      return;
    }
    const added: Member = await res.json();
    setMembers(prev => {
      const exists = prev.find(m => m.id === added.id);
      return exists ? prev.map(m => m.id === added.id ? added : m) : [added, ...prev];
    });
    setModal(null);
  };

  const handleRoleChange = async () => {
    if (modal?.type !== 'role') return;
    setSaving(true);
    setError('');
    const res = await fetch(`/api/admin/members/${modal.member.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ role: selectedRole }),
    });
    setSaving(false);
    if (!res.ok) { setError('Failed to update role.'); return; }
    setMembers(prev => prev.map(m => m.id === modal.member.id ? { ...m, role: selectedRole } : m));
    setModal(null);
  };

  const handleDelete = async () => {
    if (modal?.type !== 'delete') return;
    setSaving(true);
    const res = await fetch(`/api/admin/members/${modal.member.id}`, { method: 'DELETE', credentials: 'include' });
    setSaving(false);
    if (!res.ok) { setError('Failed to remove member.'); return; }
    setMembers(prev => prev.filter(m => m.id !== modal.member.id));
    setModal(null);
  };

  const roleVariant = (role: string) =>
    role === 'OWNER' ? 'owner' : role === 'ADMIN' ? 'admin' : 'member';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white">Members</h1>
        {effectiveOrgId && (
          <button
            onClick={() => openAdd(effectiveOrgId)}
            className="flex items-center gap-2 px-3 py-2 bg-[#00CFFF] hover:bg-[#00CFFF]/90 text-black text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus size={15} />
            Add Member
          </button>
        )}
      </div>

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
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); openRoleEdit(m); }}
                  className="text-white/40 hover:text-[#00CFFF] transition-colors"
                  title="Change role"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setError(''); setModal({ type: 'delete', member: m }); }}
                  className="text-white/40 hover:text-red-400 transition-colors"
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          }
        ]}
        rows={members}
        emptyMessage="No members found."
      />

      {/* Add Member Modal */}
      <AdminModal isOpen={modal?.type === 'add'} onClose={() => setModal(null)} title="Add Member">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Slack User ID <span className="text-red-400">*</span></label>
            <input
              className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00CFFF]/50"
              value={slackUserId}
              onChange={e => setSlackUserId(e.target.value)}
              placeholder="U0123456789"
            />
            <p className="text-xs text-white/30 mt-1">The user must have signed in to the bot at least once.</p>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Role</label>
            <select
              className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00CFFF]/50"
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value)}
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Cancel</button>
            <button
              onClick={handleAdd}
              disabled={saving}
              className="px-4 py-2 bg-[#00CFFF] hover:bg-[#00CFFF]/90 text-black text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Adding…' : 'Add Member'}
            </button>
          </div>
        </div>
      </AdminModal>

      {/* Change Role Modal */}
      <AdminModal isOpen={modal?.type === 'role'} onClose={() => setModal(null)} title="Change Role">
        <div className="space-y-4">
          <p className="text-sm text-white/60">
            Change role for <span className="text-white font-medium">{modal?.type === 'role' ? modal.member.name : ''}</span>
          </p>
          <select
            className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00CFFF]/50"
            value={selectedRole}
            onChange={e => setSelectedRole(e.target.value)}
          >
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Cancel</button>
            <button
              onClick={handleRoleChange}
              disabled={saving}
              className="px-4 py-2 bg-[#00CFFF] hover:bg-[#00CFFF]/90 text-black text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </AdminModal>

      {/* Remove Confirmation Modal */}
      <AdminModal isOpen={modal?.type === 'delete'} onClose={() => setModal(null)} title="Remove Member">
        <div className="space-y-4">
          <p className="text-sm text-white/70">
            Remove <span className="text-white font-medium">{modal?.type === 'delete' ? modal.member.name : ''}</span> from this organization?
          </p>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Cancel</button>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
