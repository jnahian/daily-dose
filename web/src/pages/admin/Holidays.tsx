import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { DataTable } from '../../components/admin/DataTable';
import { AdminModal } from '../../components/admin/AdminModal';
import { useAdminAuth } from '../../hooks/useAdminAuth';

interface Holiday {
  id: string;
  name: string;
  date: string;
  description: string | null;
}

const emptyForm = { name: '', date: '', description: '' };

export default function AdminHolidays() {
  const { activeOrgId } = useAdminAuth();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [modal, setModal] = useState<'add' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected] = useState<Holiday | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!activeOrgId) return;
    fetch(`/api/admin/holidays?orgId=${activeOrgId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(setHolidays);
  }, [activeOrgId]);

  const openAdd = () => { setForm(emptyForm); setSelected(null); setModal('add'); };
  const openEdit = (h: Holiday) => {
    setSelected(h);
    setForm({ name: h.name, date: h.date.split('T')[0], description: h.description ?? '' });
    setModal('edit');
  };
  const openDelete = (h: Holiday) => { setSelected(h); setModal('delete'); };

  const save = async () => {
    if (modal === 'add') {
      const res = await fetch('/api/admin/holidays', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, orgId: activeOrgId })
      });
      if (res.ok) {
        const created = await res.json();
        setHolidays(prev => [...prev, created].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      }
    } else if (modal === 'edit' && selected) {
      const res = await fetch(`/api/admin/holidays/${selected.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        const updated = await res.json();
        setHolidays(prev => prev.map(h => h.id === selected.id ? updated : h));
      }
    }
    setModal(null);
  };

  const confirmDelete = async () => {
    if (!selected) return;
    const res = await fetch(`/api/admin/holidays/${selected.id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) setHolidays(prev => prev.filter(h => h.id !== selected.id));
    setModal(null);
  };

  const FormFields = () => (
    <div className="space-y-4">
      {[
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'description', label: 'Description (optional)', type: 'text' }
      ].map(({ key, label, type }) => (
        <div key={key}>
          <label className="block text-xs text-white/50 mb-1">{label}</label>
          <input
            type={type}
            value={form[key as keyof typeof form]}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00CFFF]/50"
          />
        </div>
      ))}
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Cancel</button>
        <button onClick={save} className="px-4 py-2 text-sm bg-[#00CFFF] text-black font-medium rounded-lg hover:bg-[#00CFFF]/90 transition-colors">Save</button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white">Holidays</h1>
        <button onClick={openAdd} className="flex items-center gap-2 px-3 py-2 bg-[#00CFFF] text-black text-sm font-medium rounded-lg hover:bg-[#00CFFF]/90 transition-colors">
          <Plus size={15} /> Add Holiday
        </button>
      </div>

      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'date', label: 'Date', render: (h) => new Date(h.date).toLocaleDateString() },
          { key: 'description', label: 'Description', render: (h) => <span className="text-white/50">{h.description || '—'}</span> },
          {
            key: 'actions', label: '',
            render: (h) => (
              <div className="flex items-center gap-3">
                <button onClick={(e) => { e.stopPropagation(); openEdit(h); }} className="text-white/40 hover:text-[#00CFFF] transition-colors"><Pencil size={14} /></button>
                <button onClick={(e) => { e.stopPropagation(); openDelete(h); }} className="text-white/40 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
              </div>
            )
          }
        ]}
        rows={holidays}
        emptyMessage="No holidays found."
      />

      <AdminModal isOpen={modal === 'add'} onClose={() => setModal(null)} title="Add Holiday"><FormFields /></AdminModal>
      <AdminModal isOpen={modal === 'edit'} onClose={() => setModal(null)} title="Edit Holiday"><FormFields /></AdminModal>
      <AdminModal isOpen={modal === 'delete'} onClose={() => setModal(null)} title="Delete Holiday">
        <p className="text-sm text-white/70 mb-6">
          Delete <span className="text-white font-medium">{selected?.name}</span>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Cancel</button>
          <button onClick={confirmDelete} className="px-4 py-2 text-sm bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors">Delete</button>
        </div>
      </AdminModal>
    </div>
  );
}
