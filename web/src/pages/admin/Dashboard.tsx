import { useEffect, useState } from 'react';
import { Building2, Users, MessageSquare, TrendingUp } from 'lucide-react';
import { StatCard } from '../../components/admin/StatCard';
import { useAdminAuth } from '../../hooks/useAdminAuth';

export default function AdminDashboard() {
  const { isSuperAdmin, activeOrgId } = useAdminAuth();
  const [stats, setStats] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (!activeOrgId && !isSuperAdmin) return;
    const url = isSuperAdmin && !activeOrgId
      ? '/api/admin/stats'
      : `/api/admin/stats?orgId=${activeOrgId}`;

    fetch(url, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStats(data); });
  }, [isSuperAdmin, activeOrgId]);

  if (!stats) return <div className="text-white/40 text-sm">Loading stats...</div>;

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-6">Dashboard</h1>
      {isSuperAdmin && !activeOrgId ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Organizations" value={stats.orgCount ?? 0} icon={<Building2 size={18} />} />
          <StatCard label="Teams" value={stats.teamCount ?? 0} icon={<Users size={18} />} />
          <StatCard label="Users" value={stats.userCount ?? 0} icon={<Users size={18} />} />
          <StatCard label="Standups Today" value={stats.todayStandups ?? 0} icon={<MessageSquare size={18} />} />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Teams" value={stats.teamCount ?? 0} icon={<Users size={18} />} />
          <StatCard label="Members" value={stats.memberCount ?? 0} icon={<Users size={18} />} />
          <StatCard label="Today's Completion" value={`${stats.todayCompletionRate ?? 0}%`} icon={<TrendingUp size={18} />} />
        </div>
      )}
    </div>
  );
}
