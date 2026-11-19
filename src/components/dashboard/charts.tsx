"use client";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell,
} from "recharts";

const AXIS = { stroke: "#677183", fontSize: 11, tickLine: false, axisLine: false } as const;
const GRID = "#1c222c";
export const SERIES = ["#2f7bff", "#8467ff", "#3ccf91", "#f2b544", "#ff5c6c", "#5c9dff"];
const tooltipStyle = { background: "#11151b", border: "1px solid #2f3846", borderRadius: 10, fontSize: 12, color: "#eef1f6" };

function fmt(kind: "gbp" | "number" | undefined) {
  return (v: number) =>
    kind === "gbp"
      ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(v)
      : new Intl.NumberFormat("en-GB").format(v);
}

export function TrendChart({
  data, series, format, height = 240, stacked = false,
}: { data: Record<string, string | number>[]; series: { key: string; label: string }[]; format?: "gbp" | "number"; height?: number; stacked?: boolean }) {
  const f = fmt(format);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES[i]} stopOpacity={0.35} />
                <stop offset="100%" stopColor={SERIES[i]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" {...AXIS} />
          <YAxis {...AXIS} tickFormatter={f} width={format === "gbp" ? 64 : 36} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => f(Number(v))} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: "#9aa4b4" }} />}
          {series.map((s, i) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={SERIES[i]} strokeWidth={2} fill={`url(#g-${s.key})`} stackId={stacked ? "a" : undefined} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarsChart({
  data, series, format, height = 240, stacked = false,
}: { data: Record<string, string | number>[]; series: { key: string; label: string }[]; format?: "gbp" | "number"; height?: number; stacked?: boolean }) {
  const f = fmt(format);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" {...AXIS} />
          <YAxis {...AXIS} tickFormatter={f} width={format === "gbp" ? 64 : 36} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => f(Number(v))} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: "#9aa4b4" }} />}
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={SERIES[i]} radius={stacked ? 0 : [4, 4, 0, 0]} stackId={stacked ? "a" : undefined} maxBarSize={36} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChart({ data, height = 220 }: { data: { name: string; value: number }[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2} stroke="none">
            {data.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#9aa4b4" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
