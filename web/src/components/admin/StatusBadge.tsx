const variants = {
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  inactive: 'bg-white/5 text-white/40 border-white/10',
  admin: 'bg-[#00CFFF]/10 text-[#00CFFF] border-[#00CFFF]/20',
  owner: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  member: 'bg-white/5 text-white/50 border-white/10',
  late: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
} as const;

type Variant = keyof typeof variants;

export function StatusBadge({ variant, label }: { variant: Variant; label: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border font-medium ${variants[variant]}`}>
      {label}
    </span>
  );
}
