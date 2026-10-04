'use client';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { T } from './ui';
export function TrendChart({
  rows,
  t,
  money,
}: {
  rows: { month: string; income: number; expense: number }[];
  t: T;
  money: (n: number) => string;
}) {
  return (
    <>
      <div className="chart" role="img" aria-label={t('a11yChart')}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart data={rows} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="income-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 6" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 14,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
              formatter={(value) => money(Number(value))}
            />
            <Area
              type="monotone"
              dataKey="income"
              name={t('income')}
              stroke="var(--accent)"
              fill="url(#income-fill)"
              strokeWidth={3}
            />
            <Area
              type="monotone"
              dataKey="expense"
              name={t('expense')}
              stroke="#dc9e78"
              fill="transparent"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details className="chart-details">
        <summary>{t('trends')}</summary>
        <table>
          <thead>
            <tr>
              <th>{t('month')}</th>
              <th>{t('income')}</th>
              <th>{t('expense')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month}>
                <td>{r.month}</td>
                <td>{money(r.income)}</td>
                <td>{money(r.expense)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
export function SpendingChart({
  rows,
  money,
  total,
  t,
}: {
  rows: { name: string; value: number; color: string }[];
  money: (n: number) => string;
  total: number;
  t: T;
}) {
  return (
    <div className="spending-content">
      <div className="donut">
        <ResponsiveContainer width="100%" height={184} minWidth={0}>
          <PieChart>
            <Pie
              data={rows}
              dataKey="value"
              innerRadius={65}
              outerRadius={86}
              paddingAngle={4}
              stroke="none"
            >
              {rows.map((r) => (
                <Cell key={r.name} fill={r.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => money(Number(v))}
              contentStyle={{
                background: 'var(--surface)',
                borderRadius: 12,
                color: 'var(--text)',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-label">
          <small>{t('total')}</small>
          <b>{money(total)}</b>
        </div>
      </div>
      <div className="legend">
        {rows.map((r) => (
          <div key={r.name}>
            <i style={{ background: r.color }} />
            <span>{r.name}</span>
            <strong>{money(r.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
