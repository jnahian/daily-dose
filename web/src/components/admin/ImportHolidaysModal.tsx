import { useEffect, useRef, useState } from 'react';
import { UploadCloud, AlertTriangle } from 'lucide-react';
import { AdminModal } from './AdminModal';

interface PreviewItem {
  date: string;
  name: string;
  description: string | null;
  status: 'new' | 'update' | 'unchanged';
}

const STATUS_LABEL: Record<PreviewItem['status'], string> = {
  new: 'New',
  update: 'Update',
  unchanged: 'Unchanged',
};

const STATUS_CLASS: Record<PreviewItem['status'], string> = {
  new: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  update: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  unchanged: 'bg-white/5 text-white/40 border-white/10',
};

interface ImportHolidaysModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  onImported: () => void;
}

export function ImportHolidaysModal({ isOpen, onClose, orgId, onImported }: ImportHolidaysModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'select' | 'review' | 'done'>('select');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<{ created: number; updated: number; skipped: number } | null>(null);

  const allSelected = items.length > 0 && selected.size === items.length;

  // "Unchanged" rows start deselected, so the header box is usually partial.
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selected.size > 0 && !allSelected;
    }
  }, [selected, allSelected]);

  const reset = () => {
    setStep('select');
    setLoading(false);
    setError(null);
    setWarnings([]);
    setItems([]);
    setSelected(new Set());
    setSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('orgId', orgId);
      const res = await fetch('/api/admin/holidays/import/preview', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to parse file');
        return;
      }
      if (data.items.length === 0) {
        setError('No holidays could be read from this file.');
        setWarnings(data.warnings || []);
        return;
      }
      setItems(data.items);
      setWarnings(data.warnings || []);
      setSelected(new Set(data.items.filter((i: PreviewItem) => i.status !== 'unchanged').map((i: PreviewItem) => i.date)));
      setStep('review');
    } catch {
      setError('Failed to upload file');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (date: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.date)));
  };

  const importSelected = async () => {
    if (selected.size === 0 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const payload = items.filter((i) => selected.has(i.date));
      const res = await fetch('/api/admin/holidays/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, items: payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to import holidays');
        return;
      }
      setSummary({ created: data.created, updated: data.updated, skipped: data.skipped ?? 0 });
      setStep('done');
      onImported();
    } catch {
      setError('Failed to import holidays');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminModal isOpen={isOpen} onClose={handleClose} title="Import Holidays">
      {step === 'select' && (
        <div className="space-y-4">
          <p className="text-sm text-white/60">
            Upload a Zoho People holiday export (.xls, .xlsx, or .csv). Multi-day holidays are expanded into one entry per day.
          </p>
          <label className="flex flex-col items-center justify-center gap-2 border border-dashed border-white/15 rounded-lg py-8 cursor-pointer hover:border-[#00CFFF]/50 transition-colors">
            <UploadCloud size={22} className="text-white/40" />
            <span className="text-sm text-white/60">{loading ? 'Reading file…' : 'Click to choose a file'}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx,.csv"
              className="hidden"
              disabled={loading}
              onChange={handleFileChange}
            />
          </label>
          {error && (
            <p className="flex items-start gap-2 text-sm text-red-400">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}
          {warnings.length > 0 && (
            <ul className="text-xs text-amber-400/80 space-y-1">
              {warnings.map((w, i) => <li key={i}>• {w}</li>)}
            </ul>
          )}
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          {warnings.length > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
              <p className="text-xs text-amber-400 font-medium mb-1">{warnings.length} row(s) skipped</p>
              <ul className="text-xs text-amber-400/70 space-y-0.5 max-h-20 overflow-y-auto">
                {warnings.map((w, i) => <li key={i}>• {w}</li>)}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-white/60">
              <input ref={selectAllRef} type="checkbox" checked={allSelected} onChange={toggleAll} />
              Select all
            </label>
            <span className="text-xs text-white/40">{selected.size} of {items.length} selected</span>
          </div>

          <div className="border border-white/10 rounded-lg max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sr-only">
                <tr>
                  <th scope="col">Include</th>
                  <th scope="col">Date</th>
                  <th scope="col">Holiday</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.date} className="border-b border-white/5 last:border-0">
                    <td className="px-3 py-2 w-8">
                      <input
                        type="checkbox"
                        aria-label={`Import ${item.name} on ${item.date}`}
                        checked={selected.has(item.date)}
                        onChange={() => toggle(item.date)}
                      />
                    </td>
                    <td className="px-3 py-2 text-white/70 whitespace-nowrap">{item.date}</td>
                    <td className="px-3 py-2 text-white">
                      {item.name}
                      {item.description && <div className="text-xs text-white/40">{item.description}</div>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border font-medium ${STATUS_CLASS[item.status]}`}>
                        {STATUS_LABEL[item.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && (
            <p className="flex items-start gap-2 text-sm text-red-400">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={reset} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Back</button>
            <button
              onClick={importSelected}
              disabled={loading || selected.size === 0}
              className="px-4 py-2 text-sm bg-[#00CFFF] text-black font-medium rounded-lg hover:bg-[#00CFFF]/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Importing…' : `Import ${selected.size} Holiday${selected.size === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && summary && (
        <div className="space-y-4">
          <p className="text-sm text-white/70">
            Imported successfully — <span className="text-emerald-400 font-medium">{summary.created} created</span>
            {summary.updated > 0 && <>, <span className="text-amber-400 font-medium">{summary.updated} updated</span></>}
            {summary.skipped > 0 && <>, <span className="text-white/50">{summary.skipped} skipped</span></>}.
          </p>
          <div className="flex justify-end">
            <button onClick={handleClose} className="px-4 py-2 text-sm bg-[#00CFFF] text-black font-medium rounded-lg hover:bg-[#00CFFF]/90 transition-colors">
              Done
            </button>
          </div>
        </div>
      )}
    </AdminModal>
  );
}
