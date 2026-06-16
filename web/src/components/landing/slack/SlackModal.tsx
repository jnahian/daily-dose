import { X } from "lucide-react";

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="mb-1 text-[12px] font-bold text-slate-200">{label}</div>
    <div className="rounded-md border border-[#4a4d52] bg-[#222529] px-3 py-2 text-[12.5px] text-slate-300">
      {value}
    </div>
  </div>
);

export const SlackModal = () => (
  <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#1a1d21] text-left shadow-2xl">
    <div className="flex items-center justify-between border-b border-[#35373b] px-4 py-3">
      <span className="text-[15px] font-bold text-slate-100">
        Daily Standup
      </span>
      <X size={16} className="text-slate-500" />
    </div>
    <div className="space-y-3 p-4">
      <Field
        label="What did you do yesterday?"
        value="Shipped the auth flow, reviewed PR #42"
      />
      <Field
        label="What will you do today?"
        value="Start on the billing webhooks"
      />
      <Field label="Any blockers?" value="Waiting on staging credentials" />
    </div>
    <div className="flex justify-end gap-2 border-t border-[#35373b] px-4 py-3">
      <span className="rounded-md border border-[#4a4d52] px-3 py-1.5 text-[12px] font-bold text-slate-200">
        Cancel
      </span>
      <span className="rounded-md bg-[#007a5a] px-3 py-1.5 text-[12px] font-bold text-white">
        Submit
      </span>
    </div>
  </div>
);
