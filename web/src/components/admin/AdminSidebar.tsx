import { NavLink } from 'react-router';
import { LayoutDashboard, Building2, Users, MessageSquare, CalendarDays, Clock, Activity } from 'lucide-react';
import { useAdminAuth } from '../../hooks/useAdminAuth';

const navItems = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/organizations', icon: Building2, label: 'Organizations', superAdminOnly: true },
  { to: '/admin/teams', icon: Users, label: 'Teams' },
  { to: '/admin/members', icon: Users, label: 'Members' },
  { to: '/admin/standups', icon: MessageSquare, label: 'Standups' },
  { to: '/admin/holidays', icon: CalendarDays, label: 'Holidays' },
  { to: '/admin/scheduler', icon: Clock, label: 'Scheduler' },
  { to: '/admin/activity', icon: Activity, label: 'Activity' },
];

export function AdminSidebar() {
  const { isSuperAdmin } = useAdminAuth();

  return (
    <aside className="w-56 bg-[#0d1117] border-r border-white/10 flex flex-col h-screen sticky top-0">
      <div className="px-4 py-5 border-b border-white/10">
        <span className="text-[#00CFFF] font-bold text-lg tracking-tight">Daily Dose</span>
        <span className="text-white/40 text-xs ml-2">Admin</span>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems
          .filter(item => !item.superAdminOnly || isSuperAdmin)
          .map(({ to, icon: Icon, label }) => (
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
              {label}
            </NavLink>
          ))}
      </nav>
    </aside>
  );
}
