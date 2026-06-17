import { useEffect, useState } from 'react';
import { Plus, Trash2, Copy, Check } from 'lucide-react';
import { DataTable } from '../../components/admin/DataTable';
import { AdminModal } from '../../components/admin/AdminModal';
import { StatusBadge } from '../../components/admin/StatusBadge';

interface McpToken {
  id: string;
  name: string | null;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

interface Connection {
  id: string;
  clientId: string;
  clientName: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

const fmt = (dateStr: string | null) =>
  dateStr ? new Date(dateStr).toLocaleDateString() : '—';

export default function AdminTokens() {
  const [tokens, setTokens] = useState<McpToken[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<'add' | 'reveal' | 'revoke' | 'disconnect' | null>(null);
  const [selectedToken, setSelectedToken] = useState<McpToken | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [tokenName, setTokenName] = useState('');
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadTokens = () => {
    fetch('/api/admin/tokens', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : []))
      .then(setTokens)
      .catch(() => setError('Failed to load tokens'));
  };

  const loadConnections = () => {
    fetch('/api/admin/connections', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : []))
      .then((data: Omit<Connection, 'id'>[]) =>
        setConnections(data.map(c => ({ ...c, id: c.clientId })))
      )
      .catch(() => setError('Failed to load connections'));
  };

  useEffect(() => {
    loadTokens();
    loadConnections();
  }, []);

  const openAdd = () => { setTokenName(''); setNewToken(null); setModal('add'); };
  const openRevoke = (t: McpToken) => { setSelectedToken(t); setModal('revoke'); };
  const openDisconnect = (c: Connection) => { setSelectedConnection(c); setModal('disconnect'); };

  const generate = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/tokens', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tokenName.trim() || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewToken(data.token);
        setCopied(false);
        setModal('reveal');
        loadTokens();
      } else {
        setError('Failed to generate token');
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmRevoke = async () => {
    if (!selectedToken || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/tokens/${selectedToken.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) loadTokens();
      setModal(null);
    } finally {
      setSaving(false);
    }
  };

  const confirmDisconnect = async () => {
    if (!selectedConnection || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/connections/${selectedConnection.clientId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) loadConnections();
      setModal(null);
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    if (!newToken) return;
    navigator.clipboard.writeText(newToken).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-semibold text-white">My Tokens</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-3 py-2 bg-[#00CFFF] text-black text-sm font-medium rounded-lg hover:bg-[#00CFFF]/90 transition-colors"
        >
          <Plus size={15} /> Generate Token
        </button>
      </div>
      <p className="text-sm text-white/50 mb-6">
        Manage your personal MCP access tokens and connected AI clients.
      </p>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {/* MCP access tokens */}
      <h2 className="text-sm font-semibold text-white/80 mb-3">MCP access tokens</h2>
      <DataTable
        columns={[
          { key: 'name', label: 'Name', render: (t: McpToken) => t.name || <span className="text-white/40">Unnamed token</span> },
          {
            key: 'status', label: 'Status',
            render: (t: McpToken) => (
              <StatusBadge variant={t.revoked_at ? 'inactive' : 'active'} label={t.revoked_at ? 'Revoked' : 'Active'} />
            ),
          },
          { key: 'created_at', label: 'Created', render: (t: McpToken) => fmt(t.created_at) },
          { key: 'last_used_at', label: 'Last used', render: (t: McpToken) => fmt(t.last_used_at) },
          { key: 'expires_at', label: 'Expires', render: (t: McpToken) => fmt(t.expires_at) },
          {
            key: 'actions', label: '',
            render: (t: McpToken) =>
              t.revoked_at ? null : (
                <button
                  aria-label={`Revoke ${t.name || 'token'}`}
                  onClick={(e) => { e.stopPropagation(); openRevoke(t); }}
                  className="text-white/40 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              ),
          },
        ]}
        rows={tokens}
        emptyMessage="No tokens yet. Generate one to connect the Daily Dose MCP server."
      />

      {/* Connected AI clients (OAuth) */}
      <h2 className="text-sm font-semibold text-white/80 mt-10 mb-3">Connected AI clients</h2>
      <p className="text-sm text-white/50 mb-3">
        Clients connected via Slack sign-in (OAuth). These are separate from the manual tokens above.
      </p>
      <DataTable
        columns={[
          { key: 'clientName', label: 'Client', render: (c: Connection) => c.clientName || <span className="text-white/40">Unknown client</span> },
          { key: 'createdAt', label: 'Connected', render: (c: Connection) => fmt(c.createdAt) },
          { key: 'lastUsedAt', label: 'Last used', render: (c: Connection) => fmt(c.lastUsedAt) },
          {
            key: 'actions', label: '',
            render: (c: Connection) => (
              <button
                aria-label={`Disconnect ${c.clientName || 'client'}`}
                onClick={(e) => { e.stopPropagation(); openDisconnect(c); }}
                className="text-white/40 hover:text-red-400 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            ),
          },
        ]}
        rows={connections}
        emptyMessage="No connected clients yet."
      />

      {/* Generate modal */}
      <AdminModal isOpen={modal === 'add'} onClose={() => setModal(null)} title="Generate Token">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Token name (optional)</label>
            <input
              type="text"
              value={tokenName}
              onChange={e => setTokenName(e.target.value)}
              placeholder="e.g. Claude Desktop"
              className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00CFFF]/50"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Cancel</button>
            <button onClick={generate} disabled={saving} className="px-4 py-2 text-sm bg-[#00CFFF] text-black font-medium rounded-lg hover:bg-[#00CFFF]/90 transition-colors disabled:opacity-50">{saving ? 'Generating…' : 'Generate'}</button>
          </div>
        </div>
      </AdminModal>

      {/* Reveal modal — shown once */}
      <AdminModal isOpen={modal === 'reveal'} onClose={() => setModal(null)} title="Your New Token">
        <div className="space-y-4">
          <p className="text-sm text-amber-400">
            Copy this token now — it won't be shown again.
          </p>
          <div className="flex gap-2 items-center">
            <code className="flex-1 px-3 py-2 rounded bg-black/40 text-green-300 text-sm font-mono break-all select-all">
              {newToken}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm bg-[#00CFFF] text-black font-medium rounded-lg hover:bg-[#00CFFF]/90 transition-colors">Done</button>
          </div>
        </div>
      </AdminModal>

      {/* Revoke modal */}
      <AdminModal isOpen={modal === 'revoke'} onClose={() => setModal(null)} title="Revoke Token">
        <p className="text-sm text-white/70 mb-6">
          Revoke <span className="text-white font-medium">{selectedToken?.name || 'this token'}</span>? Any client using it will lose access immediately. This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Cancel</button>
          <button onClick={confirmRevoke} disabled={saving} className="px-4 py-2 text-sm bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50">{saving ? 'Revoking…' : 'Revoke'}</button>
        </div>
      </AdminModal>

      {/* Disconnect modal */}
      <AdminModal isOpen={modal === 'disconnect'} onClose={() => setModal(null)} title="Disconnect Client">
        <p className="text-sm text-white/70 mb-6">
          Disconnect <span className="text-white font-medium">{selectedConnection?.clientName || 'this client'}</span>? It will need to sign in again to regain access.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Cancel</button>
          <button onClick={confirmDisconnect} disabled={saving} className="px-4 py-2 text-sm bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50">{saving ? 'Disconnecting…' : 'Disconnect'}</button>
        </div>
      </AdminModal>
    </div>
  );
}
