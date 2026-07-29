import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { formatDayMonth } from '../../utils/adminFormat';

/**
 * Palette — validated with the dataviz skill's checker against this panel's own
 * surface (#161b22), not the reference default:
 *   SERIES  #3987e5  categorical slot 1 (dark) — all six checks pass
 *   ON_TIME #0ca30c  status:good     ┐ CVD ΔE 11.3, normal-vision 27.6,
 *   LATE    #fab219  status:warning  ┘ both ≥3:1 on this surface
 * On-time/late is a *status* pair, not a categorical one, so it keeps the
 * reserved status hues — and, per the status rule, never carries meaning by
 * colour alone: every use here is paired with a legend and a written label.
 * The brand cyan #00CFFF was rejected as a series colour: L 0.793 sits outside
 * the dark lightness band (0.48–0.67) and glares against this surface.
 */
const SERIES = '#3987e5';
const ON_TIME = '#0ca30c';
const LATE = '#fab219';

const AXIS = 'rgba(255,255,255,0.35)';
const GRID = 'rgba(255,255,255,0.06)';
const SURFACE = '#161b22';

interface DailyPoint { day: string; submitted: number; late: number }
interface TeamPoint { team: string; submitted: number; late: number; onTime: number }
interface ActivityPoint { member: string; day: string; late: boolean }

interface ChartData {
  days: number;
  activeMembers: number;
  daily: DailyPoint[];
  byTeam: TeamPoint[];
  activity: ActivityPoint[];
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl p-4">
      <div className="mb-3">
        <h2 className="text-sm font-medium text-white">{title}</h2>
        {subtitle && <p className="text-xs text-white/35 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// Recharts 3 doesn't export a usable public type for custom tooltip content,
// so the handful of fields this renders are declared directly.
interface TooltipEntry { name?: string | number; value?: number; color?: string }
interface ChartTooltipProps { active?: boolean; payload?: TooltipEntry[]; label?: string | number }

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d1117] border border-white/15 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-white/50 mb-1">{label}</p>
      {payload.map(entry => (
        <p key={String(entry.name)} className="text-xs text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: entry.color }} />
          {entry.name}: <span className="tabular-nums font-medium">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-white/30 py-8 text-center">{children}</p>;
}

export function DashboardCharts({ orgId }: { orgId: string }) {
  const [data, setData] = useState<ChartData | null>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    fetch(`/api/admin/stats/charts?orgId=${orgId}&days=${days}`, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(`Request failed (${r.status})`); return r.json(); })
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load'); });
    return () => { cancelled = true; };
  }, [orgId, days]);

  const completion = useMemo(() => {
    if (!data) return [];
    const denom = data.activeMembers || 0;
    return data.daily.map(d => ({
      day: formatDayMonth(d.day),
      rate: denom > 0 ? Math.min(100, Math.round((d.submitted / denom) * 100)) : 0,
      submitted: d.submitted,
    }));
  }, [data]);

  const totals = useMemo(() => {
    if (!data) return { submitted: 0, late: 0, onTime: 0, onTimePct: 0 };
    const submitted = data.daily.reduce((n, d) => n + d.submitted, 0);
    const late = data.daily.reduce((n, d) => n + d.late, 0);
    const onTime = submitted - late;
    return { submitted, late, onTime, onTimePct: submitted ? Math.round((onTime / submitted) * 100) : 0 };
  }, [data]);

  // Heatmap grid: members × days, rendered as a real <table> so the numbers are
  // reachable without reading colour — this doubles as the table view.
  const heatmap = useMemo(() => {
    if (!data) return { members: [] as string[], dayKeys: [] as string[], cells: new Map<string, boolean>() };
    const dayKeys = [...new Set(data.daily.map(d => d.day))].sort();
    const members = [...new Set(data.activity.map(a => a.member))].sort();
    const cells = new Map<string, boolean>();
    for (const a of data.activity) cells.set(`${a.member}|${a.day}`, a.late);
    return { members, dayKeys, cells };
  }, [data]);

  if (error) return <p className="text-sm text-red-400 mt-6">Charts unavailable: {error}</p>;
  if (!data) return <p className="text-sm text-white/40 mt-6">Loading charts…</p>;

  const noData = totals.submitted === 0;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-white/70">Activity</h2>
        <label className="flex items-center gap-2 text-xs text-white/40">
          <span className="sr-only">Time range</span>
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="bg-[#0d1117] border border-white/10 rounded-lg px-2 py-1 text-xs text-white/70 focus:outline-none"
          >
            {[7, 14, 30, 60, 90].map(n => <option key={n} value={n}>Last {n} days</option>)}
          </select>
        </label>
      </div>

      {noData ? (
        <div className="bg-[#161b22] border border-white/10 rounded-xl p-8">
          <Empty>No standup submissions in the last {data.days} days.</Empty>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card
            title="Standup completion"
            subtitle={`Share of ${data.activeMembers} active members submitting each day — approximate, since membership history isn't tracked`}
          >
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={completion} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="day" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={24} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.2)' }} />
                <Line
                  type="monotone" dataKey="rate" name="Completion %"
                  stroke={SERIES} strokeWidth={2}
                  dot={{ r: 0 }} activeDot={{ r: 4, strokeWidth: 2, stroke: SURFACE }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Submissions by team" subtitle={`On time vs late, last ${data.days} days`}>
            {data.byTeam.length === 0 ? <Empty>No team activity.</Empty> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.byTeam} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis type="number" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} allowDecimals={false} />
                  <YAxis type="category" dataKey="team" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={92} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: AXIS }} iconType="square" iconSize={8} />
                  {/* 2px surface-coloured gap between the stacked segments */}
                  <Bar dataKey="onTime" name="On time" stackId="s" fill={ON_TIME} stroke={SURFACE} strokeWidth={2} />
                  <Bar dataKey="late" name="Late" stackId="s" fill={LATE} stroke={SURFACE} strokeWidth={2} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card title="On time vs late" subtitle={`All ${totals.submitted} submissions, last ${data.days} days`}>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-3xl font-semibold text-white tabular-nums">{totals.onTimePct}%</span>
              <span className="text-xs text-white/40">submitted on time</span>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden gap-[2px]" role="img"
              aria-label={`${totals.onTime} on time, ${totals.late} late, of ${totals.submitted} submissions`}>
              <div style={{ background: ON_TIME, width: `${totals.onTimePct}%` }} />
              <div style={{ background: LATE, width: `${100 - totals.onTimePct}%` }} />
            </div>
            <div className="flex gap-5 mt-3 text-xs">
              <span className="flex items-center gap-2 text-white/60">
                <span className="w-2 h-2 rounded-sm" style={{ background: ON_TIME }} />
                On time <span className="text-white tabular-nums font-medium">{totals.onTime}</span>
              </span>
              <span className="flex items-center gap-2 text-white/60">
                <span className="w-2 h-2 rounded-sm" style={{ background: LATE }} />
                Late <span className="text-white tabular-nums font-medium">{totals.late}</span>
              </span>
            </div>
          </Card>

          <Card title="Member activity" subtitle="One cell per member per day — hover for detail">
            {heatmap.members.length === 0 ? <Empty>No member activity.</Empty> : (
              <div className="overflow-x-auto">
                <table className="border-separate border-spacing-[2px]">
                  <caption className="sr-only">Standup submissions by member and day</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="sr-only">Member</th>
                      {heatmap.dayKeys.map(d => (
                        <th key={d} scope="col" className="sr-only">{formatDayMonth(d)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmap.members.map(member => (
                      <tr key={member}>
                        <th scope="row" className="text-left text-xs text-white/50 font-normal pr-3 whitespace-nowrap sticky left-0 bg-[#161b22]">
                          {member}
                        </th>
                        {heatmap.dayKeys.map(day => {
                          const late = heatmap.cells.get(`${member}|${day}`);
                          const submitted = late !== undefined;
                          const state = !submitted ? 'No submission' : late ? 'Late' : 'On time';
                          return (
                            <td key={day} className="p-0">
                              {/* role="img" is what makes the aria-label announce:
                                  on a bare <div> with no role it's ignored by most
                                  screen readers, and the cell has no text of its own. */}
                              <div
                                role="img"
                                title={`${member} · ${formatDayMonth(day)} · ${state}`}
                                aria-label={`${formatDayMonth(day)}: ${state}`}
                                className="w-3 h-3 rounded-[2px]"
                                style={{ background: !submitted ? 'rgba(255,255,255,0.05)' : late ? LATE : ON_TIME }}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex gap-4 mt-3 text-xs text-white/50">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[2px]" style={{ background: ON_TIME }} /> On time</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[2px]" style={{ background: LATE }} /> Late</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[2px] bg-white/5" /> None</span>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
