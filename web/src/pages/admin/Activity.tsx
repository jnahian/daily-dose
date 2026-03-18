import { useEffect, useState } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth';

interface ActivityEvent {
  type: string;
  user: string;
  team: string;
  date: string;
  isLate: boolean;
  timestamp: string;
}

export default function AdminActivity() {
  const { activeOrgId } = useAdminAuth();
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    if (!activeOrgId) return;
    fetch(`/api/admin/activity?orgId=${activeOrgId}&limit=50`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(setEvents);
  }, [activeOrgId]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-6">Activity</h1>
      <div className="bg-[#161b22] border border-white/10 rounded-xl divide-y divide-white/5">
        {events.length === 0 ? (
          <p className="text-white/40 text-sm px-4 py-6">No recent activity.</p>
        ) : events.map((e, i) => (
          <div key={i} className="px-4 py-3 flex items-center justify-between">
            <div className="text-sm">
              <span className="text-white font-medium">{e.user}</span>
              <span className="text-white/40"> submitted standup for </span>
              <span className="text-white">{e.team}</span>
              {e.isLate && <span className="ml-2 text-xs text-amber-400 font-medium">late</span>}
            </div>
            <span className="text-xs text-white/30 shrink-0 ml-4">{new Date(e.timestamp).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
