import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { AdminModal } from '../../components/admin/AdminModal';
import { StatusBadge } from '../../components/admin/StatusBadge';
import { useAdminAuth } from '../../hooks/useAdminAuth';

interface SyncRun {
  status: 'SUCCESS' | 'FAILED';
  recordsSynced: number;
  skippedUnmapped: number;
  skippedNotApproved: number;
  skippedInvalid: number;
  failed: boolean;
  startedAt: string;
  completedAt: string | null;
  warning: string | null;
}

interface Mapping {
  id: string;
  slackUserId: string;
  name: string;
  zohoEmployeeId: string;
}

interface ZohoState {
  credential: { enabled: boolean; dataCenter: string } | null;
  runs: { HOLIDAY: SyncRun | null; LEAVE: SyncRun | null };
  mappings: Mapping[];
}

const SYNC_TYPES = ['HOLIDAY', 'LEAVE'] as const;

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function SyncRunRow({ type, run }: { type: string; run: SyncRun | null }) {
  if (!run) {
    return (
      <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
        <span className="text-sm text-white/70">{type}</span>
        <span className="text-xs text-white/30">Never synced</span>
      </div>
    );
  }

  const skips = [
    run.skippedUnmapped && `${run.skippedUnmapped} unmapped`,
    run.skippedNotApproved && `${run.skippedNotApproved} not approved`,
    run.skippedInvalid && `${run.skippedInvalid} unreadable`,
  ].filter(Boolean) as string[];

  return (
    <div className="py-2 border-b border-white/5 last:border-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/70 w-20">{type}</span>
          <StatusBadge
            variant={run.failed ? 'late' : 'active'}
            label={run.failed ? 'Failed' : `${run.recordsSynced} synced`}
          />
        </div>
        <span className="text-xs text-white/30">{formatWhen(run.startedAt)}</span>
      </div>
      {run.failed && (
        <p className="text-xs text-amber-400/80 mt-1 ml-[5.75rem]">
          Run failed — check the server logs.
        </p>
      )}
      {skips.length > 0 && (
        <p className="text-xs text-white/35 mt-1 ml-[5.75rem]">Skipped: {skips.join(', ')}</p>
      )}
      {run.warning && (
        <p className="flex items-start gap-1.5 text-xs text-amber-400/90 mt-1 ml-[5.75rem]">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {run.warning}
        </p>
      )}
    </div>
  );
}

export default function AdminZoho() {
  const { activeOrgId } = useAdminAuth();
  const [data, setData] = useState<ZohoState | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [form, setForm] = useState({ slackUserId: '', zohoEmployeeId: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Mapping | null>(null);

  const load = useCallback(() => {
    if (!activeOrgId) return;
    fetch(`/api/admin/zoho?orgId=${activeOrgId}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, [activeOrgId]);

  useEffect(load, [load]);

  const runSync = async () => {
    if (!activeOrgId || syncing) return;
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/zoho/sync', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: activeOrgId, type: 'ALL' }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || 'Sync failed');
        return;
      }
      const total = SYNC_TYPES.reduce((n, t) => n + (body[t]?.recordsSynced ?? 0), 0);
      setNotice(`Synced ${total} record${total === 1 ? '' : 's'}.`);
    } catch {
      setError('Sync request failed');
    } finally {
      setSyncing(false);
      load();
    }
  };

  const saveMapping = async () => {
    if (!activeOrgId || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch('/api/admin/zoho/mappings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: activeOrgId, ...form }),
      });
      const body = await res.json();
      if (!res.ok) {
        setFormError(body.error || 'Failed to save mapping');
        return;
      }
      setMapOpen(false);
      setForm({ slackUserId: '', zohoEmployeeId: '' });
      load();
    } catch {
      setFormError('Failed to save mapping');
    } finally {
      setSaving(false);
    }
  };

  const deleteMapping = async () => {
    if (!confirmDelete || saving) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/zoho/mappings/${confirmDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setConfirmDelete(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  if (!activeOrgId) {
    return <p className="text-white/40 text-sm">Select an organization.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white">Zoho Sync</h1>
        {data?.credential && (
          <button
            onClick={runSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 bg-[#00CFFF] text-black text-sm font-medium rounded-lg hover:bg-[#00CFFF]/90 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        )}
      </div>

      {!data ? (
        <p className="text-white/40 text-sm">Loading…</p>
      ) : !data.credential ? (
        <div className="bg-[#161b22] border border-white/10 rounded-xl p-5">
          <p className="text-sm text-white/70 mb-1">Zoho People is not connected for this organization.</p>
          <p className="text-xs text-white/40">
            Run <code className="text-white/60">npm run zoho:auth-setup</code> on the server to
            exchange a Zoho grant token for a refresh token. Credential setup is deliberately
            not exposed here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {error && (
            <p className="flex items-start gap-2 text-sm text-red-400">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}
          {notice && <p className="text-sm text-emerald-400">{notice}</p>}

          <div className="bg-[#161b22] border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <StatusBadge
                variant={data.credential.enabled ? 'active' : 'inactive'}
                label={data.credential.enabled ? 'Enabled' : 'Disabled'}
              />
              <span className="text-xs text-white/30">
                Data center: <span className="text-white/50">zoho.{data.credential.dataCenter}</span>
              </span>
            </div>
          </div>

          <div className="bg-[#161b22] border border-white/10 rounded-xl p-4">
            <h2 className="text-xs text-white/40 uppercase tracking-wide mb-2">Last run</h2>
            {SYNC_TYPES.map(type => (
              <SyncRunRow key={type} type={type} run={data.runs[type]} />
            ))}
          </div>

          <div className="bg-[#161b22] border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs text-white/40 uppercase tracking-wide">
                Employee mappings ({data.mappings.length})
              </h2>
              <button
                onClick={() => { setForm({ slackUserId: '', zohoEmployeeId: '' }); setFormError(null); setMapOpen(true); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 border border-white/10 text-white text-xs font-medium rounded-lg hover:bg-white/10 transition-colors"
              >
                <Plus size={13} /> Map member
              </button>
            </div>
            {data.mappings.length === 0 ? (
              <p className="text-xs text-white/30 py-2">
                No members mapped. Leave records for unmapped employees are skipped.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sr-only">
                  <tr><th scope="col">Member</th><th scope="col">Zoho employee ID</th><th scope="col">Actions</th></tr>
                </thead>
                <tbody>
                  {data.mappings.map(m => (
                    <tr key={m.id} className="border-b border-white/5 last:border-0">
                      <td className="py-2 text-white">{m.name}</td>
                      <td className="py-2 text-white/50 font-mono text-xs">{m.zohoEmployeeId}</td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => setConfirmDelete(m)}
                          aria-label={`Remove mapping for ${m.name}`}
                          className="text-white/30 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <AdminModal isOpen={mapOpen} onClose={() => setMapOpen(false)} title="Map Member to Zoho">
        <div className="space-y-4">
          <div>
            <label htmlFor="zoho-slack-id" className="block text-xs text-white/40 mb-1">Slack user ID</label>
            <input
              id="zoho-slack-id"
              value={form.slackUserId}
              onChange={e => setForm({ ...form, slackUserId: e.target.value })}
              placeholder="U01234ABCDE"
              className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20"
            />
          </div>
          <div>
            <label htmlFor="zoho-employee-id" className="block text-xs text-white/40 mb-1">Zoho employee ID</label>
            <input
              id="zoho-employee-id"
              value={form.zohoEmployeeId}
              onChange={e => setForm({ ...form, zohoEmployeeId: e.target.value })}
              placeholder="ZP-0012345"
              className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 font-mono"
            />
          </div>
          {formError && (
            <p className="flex items-start gap-2 text-sm text-red-400">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {formError}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-1">
            <button onClick={() => setMapOpen(false)} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Cancel</button>
            <button
              onClick={saveMapping}
              disabled={saving || !form.slackUserId.trim() || !form.zohoEmployeeId.trim()}
              className="px-4 py-2 text-sm bg-[#00CFFF] text-black font-medium rounded-lg hover:bg-[#00CFFF]/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </AdminModal>

      <AdminModal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Remove Mapping">
        <p className="text-sm text-white/70 mb-5">
          Remove the Zoho mapping for <span className="text-white">{confirmDelete?.name}</span>? Their
          leave will stop syncing until they are mapped again.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Cancel</button>
          <button
            onClick={deleteMapping}
            disabled={saving}
            className="px-4 py-2 text-sm bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {saving ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </AdminModal>
    </div>
  );
}
