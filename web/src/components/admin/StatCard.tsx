import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
}

export function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-white/50">{label}</span>
        {icon && <span className="text-[#00CFFF]/60">{icon}</span>}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}
