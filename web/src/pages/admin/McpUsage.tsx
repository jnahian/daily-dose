import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAdminAuth } from '../../hooks/useAdminAuth';

interface UsageRow {
  user: string;
  day: string;
  count: number;
}

// Validated against the admin surface (#161b22) with the dataviz palette
// validator: lightness band, chroma floor, CVD separation, contrast all pass.
// Assigned in fixed order and never cycled — a 7th user folds into "Other".
const SERIES_COLORS = ['#3987e5', '#199e70', '#c98500', '#9085e9', '#e66767', '#d55181'];
const OTHER_COLOR = '#8b949e';
const MAX_SERIES = 6;

const RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

export default function AdminMcpUsage() {
  const { isSuperAdmin, activeOrgId } = useAdminAuth();
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Color follows the user, not their rank: changing the day range reorders
  // the series, and a survivor must not repaint. Slots are claimed on first
  // sight and held for the life of the page.
  const slots = useRef(new Map<string, number>());

  useEffect(() => {
    if (!activeOrgId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/admin/mcp-usage?orgId=${activeOrgId}&days=${days}`, { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return r.json();
      })
      .then(data => { if (!cancelled) setRows(data); })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load usage');
          setRows([]);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [activeOrgId, days]);

  // Rank users by total calls; keep the top six as their own series and fold
  // the tail into "Other" so hues are never recycled across identities.
  const { chartData, series } = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of rows) totals.set(r.user, (totals.get(r.user) ?? 0) + r.count);

    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([u]) => u);
    const top = ranked.slice(0, MAX_SERIES);
    const hasOther = ranked.length > MAX_SERIES;
    const names = hasOther ? [...top, 'Other'] : top;

    // Claim a stable hue for any charted user we haven't seen before. "Taken"
    // counts only the users on screen right now, so a slot held by someone who
    // dropped out of the top can be reused rather than exhausting the palette.
    const taken = new Set(
      top.map(u => slots.current.get(u)).filter((s): s is number => s !== undefined)
    );
    for (const user of top) {
      const existing = slots.current.get(user);
      if (existing !== undefined && taken.has(existing)) continue;
      const free = SERIES_COLORS.findIndex((_, i) => !taken.has(i));
      const slot = free === -1 ? 0 : free;
      slots.current.set(user, slot);
      taken.add(slot);
    }

    const byDay = new Map<string, Record<string, string | number>>();
    for (const r of rows) {
      const key = top.includes(r.user) ? r.user : 'Other';
      const row = byDay.get(r.day) ?? { day: r.day };
      row[key] = ((row[key] as number) ?? 0) + r.count;
      byDay.set(r.day, row);
    }

    // Recharts draws a gap, not a zero, for missing keys — backfill each day.
    const data = [...byDay.values()].sort((a, b) => String(a.day).localeCompare(String(b.day)));
    for (const row of data) for (const n of names) if (row[n] == null) row[n] = 0;

    return { chartData: data, series: names };
  }, [rows]);

  const colorFor = (name: string) =>
    name === 'Other' ? OTHER_COLOR : SERIES_COLORS[slots.current.get(name) ?? 0];

  if (isSuperAdmin && !activeOrgId) {
    return <div className="text-white/40 text-sm">Select an organization to view MCP usage.</div>;
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-6">MCP Usage</h1>

      <div className="flex gap-2 mb-6">
        {RANGES.map(r => (
          <button
            key={r.days}
            onClick={() => setDays(r.days)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              days === r.days
                ? 'bg-[#00CFFF]/10 border-[#00CFFF]/40 text-[#00CFFF]'
                : 'bg-[#161b22] border-white/10 text-white/50 hover:text-white/80'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-white/40 text-sm">Loading usage...</div>}
      {error && <div className="text-red-400 text-sm">Failed to load usage: {error}</div>}

      {!loading && !error && chartData.length === 0 && (
        <div className="text-white/40 text-sm">No MCP tool calls in the last {days} days.</div>
      )}

      {!loading && !error && chartData.length > 0 && (
        <div className="bg-[#161b22] border border-white/10 rounded-xl p-5">
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="#ffffff14" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fill: '#ffffff66', fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#ffffff14' }}
                tickFormatter={(d: string) => d.slice(5)}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: '#ffffff66', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: '#0d1117',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  color: '#fff',
                }}
                labelStyle={{ color: '#ffffff99' }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#ffffff99' }} />
              {series.map(name => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={colorFor(name)}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: '#161b22' }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
