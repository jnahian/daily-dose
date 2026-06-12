interface SlackButtonsProps {
  buttons: { label: string; primary?: boolean }[];
}

export const SlackButtons = ({ buttons }: SlackButtonsProps) => (
  <div className="flex flex-wrap gap-2">
    {buttons.map((b) => (
      <span
        key={b.label}
        className={
          b.primary
            ? "rounded-md bg-[#007a5a] px-3 py-1.5 text-[12px] font-bold text-white"
            : "rounded-md border border-[#4a4d52] px-3 py-1.5 text-[12px] font-bold text-slate-200"
        }
      >
        {b.label}
      </span>
    ))}
  </div>
);
