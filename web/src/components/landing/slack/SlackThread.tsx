interface SlackThreadProps {
  replyCount: number;
  children: React.ReactNode;
}

export const SlackThread = ({ replyCount, children }: SlackThreadProps) => (
  <div className="mt-2 border-l-2 border-[#35373b] pl-3">
    <div className="mb-2 text-[11px] font-semibold text-[#1d9bd1]">
      {replyCount} {replyCount === 1 ? "reply" : "replies"}
    </div>
    {children}
  </div>
);
