interface SlackMessageProps {
  name?: string;
  time: string;
  isApp?: boolean;
  /** Render a colored-initials avatar (human) instead of the bot logo */
  initials?: string;
  children: React.ReactNode;
}

export const SlackMessage = ({
  name = "Daily Dose",
  time,
  isApp = true,
  initials,
  children,
}: SlackMessageProps) => (
  <div className="flex gap-2.5">
    {initials ? (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-600 text-[12px] font-bold text-white">
        {initials}
      </div>
    ) : (
      <img src="/logo.png" alt="" className="h-9 w-9 shrink-0 rounded-md" />
    )}
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-baseline gap-1.5">
        <span className="text-[13.5px] font-bold text-slate-100">{name}</span>
        {isApp && (
          <span className="rounded-sm bg-[#35373b] px-1 py-px text-[9px] font-semibold tracking-wide text-slate-400 uppercase">
            App
          </span>
        )}
        <span className="text-[11px] text-slate-500">{time}</span>
      </div>
      <div className="mt-1 space-y-2 text-[13px] leading-relaxed text-slate-300">
        {children}
      </div>
    </div>
  </div>
);
