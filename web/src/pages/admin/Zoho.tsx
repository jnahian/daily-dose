import { useCallback, useEffect, useRef, useState } from 'react';
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

interface OrgMember {
  userId: string;
  slackUserId: string;
  name: string;
}

const SYNC_TYPES = ['HOLIDAY', 'LEAVE'] as const;

function formatWhen(iso: string) {
  const date = new Date(iso);
  // Include the year once a run is old enough that "Jul 28" would be ambiguous.
  const showYear = date.getFullYear() !== new Date().getFullYear();
  return date.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    ...(showYear ? { year: 'numeric' } : {}),
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
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Mapping | null>(null);

  // Guards against a slow response for org A landing after the operator has
  // switched to org B and overwriting B's state. That matters here beyond
  // cosmetics: the delete buttons are keyed on mapping IDs, and the backend
  // authorizes each delete against the mapping's *own* org — so acting on a
  // stale row would successfully remove a mapping from the org no longer on
  // screen. Every response is stamped with the request it belongs to and
  // dropped if it isn't the latest. One counter per endpoint — a shared one
  // would let the members fetch invalidate an in-flight Zoho response.
  const zohoRequestId = useRef(0);
  const membersRequestId = useRef(0);

  const load = useCallback(() => {
    if (!activeOrgId) return;
    const id = ++zohoRequestId.current;
    fetch(`/api/admin/zoho?orgId=${activeOrgId}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(payload => { if (id === zohoRequestId.current) setData(payload); })
      .catch(() => { if (id === zohoRequestId.current) setData(null); });
  }, [activeOrgId]);

  // Clear immediately on an org switch so the previous org's mappings are
  // never on screen — and never clickable — while the new ones load.
  useEffect(() => {
    setData(null);
    setError(null);
    setNotice(null);
    setConfirmDelete(null);
    load();
  }, [load]);

  // Org members back the mapping picker. Choosing from this list instead of
  // typing a Slack ID is what keeps a typo from reaching the server at all.
  useEffect(() => {
    if (!activeOrgId) { setMembers([]); return; }
    const id = ++membersRequestId.current;
    fetch(`/api/admin/members?orgId=${activeOrgId}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : []))
      .then(list => { if (id === membersRequestId.current) setMembers(list); })
      .catch(() => { if (id === membersRequestId.current) setMembers([]); });
  }, [activeOrgId]);

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
      // A partial run comes back 200 with both what synced and what failed —
      // report each, rather than letting one failure hide the other's counts.
      const total = SYNC_TYPES.reduce((n, t) => n + (body[t]?.recordsSynced ?? 0), 0);
      const failures = Object.entries(body.errors ?? {});
      setNotice(`Synced ${total} record${total === 1 ? '' : 's'}.`);
      if (failures.length > 0) {
        setError(failures.map(([type, message]) => `${type}: ${message}`).join(' · '));
      }
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
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/zoho/mappings/${confirmDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        // Keep the dialog open — closing it on a 403/404/500 would imply the
        // mapping was removed while the row is still there after the refetch.
        const body = await res.json().catch(() => ({}));
        setDeleteError(body.error || 'Failed to remove mapping');
        return;
      }
      setConfirmDelete(null);
      load();
    } catch {
      setDeleteError('Failed to remove mapping');
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
            // A disabled credential makes the sync fail with "integration is
            // disabled" — don't offer a round trip to learn that.
            disabled={syncing || !data.credential.enabled}
            title={data.credential.enabled ? undefined : 'Zoho integration is disabled for this organization'}
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
            <label htmlFor="zoho-slack-id" className="block text-xs text-white/40 mb-1">Organization member</label>
            <select
              id="zoho-slack-id"
              value={form.slackUserId}
              onChange={e => setForm({ ...form, slackUserId: e.target.value })}
              className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">Select a member…</option>
              {members.map(m => (
                <option key={m.userId} value={m.slackUserId}>
                  {m.name} ({m.slackUserId})
                </option>
              ))}
            </select>
            {members.length === 0 && (
              <p className="text-xs text-white/30 mt-1">No members loaded for this organization.</p>
            )}
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

      <AdminModal isOpen={!!confirmDelete} onClose={() => { setConfirmDelete(null); setDeleteError(null); }} title="Remove Mapping">
        <p className="text-sm text-white/70 mb-5">
          Remove the Zoho mapping for <span className="text-white">{confirmDelete?.name}</span>? Their
          leave will stop syncing until they are mapped again.
        </p>
        {deleteError && (
          <p className="flex items-start gap-2 text-sm text-red-400 mb-4">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {deleteError}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button onClick={() => { setConfirmDelete(null); setDeleteError(null); }} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Cancel</button>
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
