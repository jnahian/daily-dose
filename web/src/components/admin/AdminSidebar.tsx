import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router';
import { LayoutDashboard, Building2, Users, MessageSquare, CalendarDays, Clock, Activity, Key, BarChart3, ClipboardCheck } from 'lucide-react';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { PENDING_TEAMS_CHANGED_EVENT } from '../../utils/adminEvents';

const navItems = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/organizations', icon: Building2, label: 'Organizations', superAdminOnly: true },
  { to: '/admin/teams', icon: Users, label: 'Teams' },
  { to: '/admin/approvals', icon: ClipboardCheck, label: 'Approvals', badge: 'pendingTeams' },
  { to: '/admin/members', icon: Users, label: 'Members' },
  { to: '/admin/standups', icon: MessageSquare, label: 'Standups' },
  { to: '/admin/holidays', icon: CalendarDays, label: 'Holidays' },
  { to: '/admin/scheduler', icon: Clock, label: 'Scheduler' },
  { to: '/admin/activity', icon: Activity, label: 'Activity' },
  { to: '/admin/mcp-usage', icon: BarChart3, label: 'MCP Usage' },
  { to: '/admin/tokens', icon: Key, label: 'My Tokens' },
];

export function AdminSidebar() {
  const { isSuperAdmin, activeOrgId } = useAdminAuth();
  const [pendingCount, setPendingCount] = useState(0);

  const loadPendingCount = useCallback(async () => {
    if (!activeOrgId) { setPendingCount(0); return; }
    try {
      const res = await fetch(`/api/admin/teams/pending?orgId=${activeOrgId}`, { credentials: 'include' });
      setPendingCount(res.ok ? (await res.json()).length : 0);
    } catch {
      setPendingCount(0);
    }
  }, [activeOrgId]);

  useEffect(() => {
    loadPendingCount();
    // The Approvals page fires this after a decision so the badge stays honest.
    window.addEventListener(PENDING_TEAMS_CHANGED_EVENT, loadPendingCount);
    return () => window.removeEventListener(PENDING_TEAMS_CHANGED_EVENT, loadPendingCount);
  }, [loadPendingCount]);

  return (
    <aside className="w-56 bg-[#0d1117] border-r border-white/10 flex flex-col h-screen sticky top-0">
      <div className="px-4 py-5 border-b border-white/10 flex items-center gap-3">
        <img src="/logo.png" alt="Daily Dose" className="w-8 h-8 rounded-lg shrink-0" />
        <div>
          <span className="text-[#00CFFF] font-bold text-sm tracking-tight">Daily Dose</span>
          <span className="text-white/40 text-xs ml-1">Admin</span>
        </div>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems
          .filter(item => !item.superAdminOnly || isSuperAdmin)
          .map(({ to, icon: Icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-[#00CFFF]/10 text-[#00CFFF]'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              {badge === 'pendingTeams' && pendingCount > 0 && (
                <span
                  className="min-w-[18px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[11px] font-semibold text-center"
                  aria-label={`${pendingCount} pending team approval${pendingCount === 1 ? '' : 's'}`}
                >
                  {pendingCount}
                </span>
              )}
            </NavLink>
          ))}
      </nav>
    </aside>
  );
}
