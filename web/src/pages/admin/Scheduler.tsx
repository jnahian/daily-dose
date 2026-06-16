import { useEffect, useState } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { StatusBadge } from '../../components/admin/StatusBadge';

interface SchedulerJob {
  teamId: string;
  teamName: string;
  standupTime: string;
  postingTime: string;
  timezone: string;
  reminderJobActive: boolean;
  postJobActive: boolean;
}

export default function AdminScheduler() {
  const { activeOrgId } = useAdminAuth();
  const [jobs, setJobs] = useState<SchedulerJob[]>([]);

  useEffect(() => {
    if (!activeOrgId) return;
    fetch(`/api/admin/scheduler?orgId=${activeOrgId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(setJobs);
  }, [activeOrgId]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-6">Scheduler</h1>
      {jobs.length === 0 ? (
        <p className="text-white/40 text-sm">No active teams.</p>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => (
            <div key={job.teamId} className="bg-[#161b22] border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-white">{job.teamName}</span>
                <span className="text-xs text-white/30">{job.timezone}</span>
              </div>
              <div className="flex gap-8">
                <div>
                  <p className="text-xs text-white/40 mb-1">Reminder at</p>
                  <p className="text-sm text-white mb-2">{job.standupTime}</p>
                  <StatusBadge variant={job.reminderJobActive ? 'active' : 'inactive'} label={job.reminderJobActive ? 'Running' : 'Inactive'} />
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">Post at</p>
                  <p className="text-sm text-white mb-2">{job.postingTime}</p>
                  <StatusBadge variant={job.postJobActive ? 'active' : 'inactive'} label={job.postJobActive ? 'Running' : 'Inactive'} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
