import { ChevronDown, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useAdminAuth, adminLogout } from '../../hooks/useAdminAuth';

export function AdminTopBar() {
  const { user, organizations, activeOrgId, setActiveOrgId, isSuperAdmin } = useAdminAuth();
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const activeOrg = organizations.find(o => o.id === activeOrgId);

  return (
    <header className="h-14 border-b border-white/10 px-6 flex items-center justify-between bg-[#0d1117]">
      <div className="relative">
        {organizations.length > 0 && (
          <button
            onClick={() => setOrgMenuOpen(o => !o)}
            className="flex items-center gap-2 text-sm text-white/80 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            {activeOrg?.name || 'Select org'}
            <ChevronDown size={14} />
          </button>
        )}
        {orgMenuOpen && (
          <div className="absolute top-full left-0 mt-1 bg-[#161b22] border border-white/10 rounded-lg shadow-xl z-50 min-w-48">
            {organizations.map(org => (
              <button
                key={org.id}
                onClick={() => { setActiveOrgId(org.id); setOrgMenuOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors ${
                  org.id === activeOrgId ? 'text-[#00CFFF]' : 'text-white/80'
                }`}
              >
                {org.name}
                <span className="text-white/30 text-xs ml-2">{org.role}</span>
              </button>
            ))}
            {isSuperAdmin && <div className="border-t border-white/10 px-4 py-2 text-xs text-white/30">Super Admin</div>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-white/60">{user?.name}</span>
        <button
          onClick={() => adminLogout()}
          className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/80 transition-colors"
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>
    </header>
  );
}
