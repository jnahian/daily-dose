interface SlackSurfaceProps {
  header?: string;
  children: React.ReactNode;
  className?: string;
}

export const SlackSurface = ({
  header,
  children,
  className = "",
}: SlackSurfaceProps) => (
  <div
    className={`overflow-hidden rounded-xl border border-slate-800 bg-[#1a1d21] text-left shadow-2xl ${className}`}
  >
    {header && (
      <div className="border-b border-[#35373b] px-4 py-2.5 text-[13px] font-bold text-slate-200">
        {header}
      </div>
    )}
    <div className="p-4">{children}</div>
  </div>
);
