import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency, getCurrentMonth, getMonthLabel } from '../utils/constants';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid, AreaChart, Area
} from 'recharts';

export default function Analytics() {
  const { settings, getCategoryBreakdown, getMonthlyTrend, getMonthStats, getMonthTransactions } = useApp();
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const fmt = (n) => formatCurrency(n, settings.currency);
  const trend = getMonthlyTrend(6);
  const expBreakdown = getCategoryBreakdown(selectedMonth, 'expense');
  const incBreakdown = getCategoryBreakdown(selectedMonth, 'income');
  const stats = getMonthStats(selectedMonth);

  // Month picker options (last 12 months)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { key, label: getMonthLabel(key) };
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', fontSize: 13 }}>
        <p style={{ fontWeight: 700, marginBottom: 6 }}>{label}</p>
        {payload.map((p, i) => <p key={i} style={{ color: p.color || p.stroke }}>{p.name}: {fmt(p.value)}</p>)}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>📊 Analytics</div>
        <select className="form-select" style={{ maxWidth: 200 }} value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
          {monthOptions.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
      </div>

      {/* Quick Stats */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card income">
          <div className="stat-label">Income</div>
          <div className="stat-value income">{fmt(stats.income)}</div>
          <div className="stat-icon income">↑</div>
        </div>
        <div className="stat-card expense">
          <div className="stat-label">Expenses</div>
          <div className="stat-value expense">{fmt(stats.expense)}</div>
          <div className="stat-icon expense">↓</div>
        </div>
        <div className="stat-card balance">
          <div className="stat-label">Net Balance</div>
          <div className="stat-value balance">{fmt(stats.balance)}</div>
          <div className="stat-icon balance">💎</div>
        </div>
        <div className="stat-card savings">
          <div className="stat-label">Savings Rate</div>
          <div className="stat-value savings">{stats.income > 0 ? Math.round((stats.balance / stats.income) * 100) : 0}%</div>
          <div className="stat-icon savings">🎯</div>
        </div>
      </div>

      {/* Area Chart - Net balance trend */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title">📈 Income vs Expense Trend</span></div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="income-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expense-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="income" name="Income" stroke="#10b981" fill="url(#income-grad)" strokeWidth={2} />
              <Area type="monotone" dataKey="expense" name="Expense" stroke="#ef4444" fill="url(#expense-grad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Donut charts */}
      <div className="charts-grid">
        <div className="card">
          <div className="card-header"><span className="card-title">🔴 Expenses by Category</span></div>
          <div className="card-body">
            {expBreakdown.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <div>📊</div><p style={{ marginTop: 8 }}>No expense data</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={expBreakdown} dataKey="total" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                      {expBreakdown.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {expBreakdown.map((e, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: e.color, display: 'inline-block' }} />
                        {e.emoji} {e.name}
                      </span>
                      <strong>{fmt(e.total)}</strong>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">🟢 Income by Category</span></div>
          <div className="card-body">
            {incBreakdown.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <div>📊</div><p style={{ marginTop: 8 }}>No income data</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={incBreakdown} dataKey="total" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                      {incBreakdown.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {incBreakdown.map((e, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: e.color, display: 'inline-block' }} />
                        {e.emoji} {e.name}
                      </span>
                      <strong>{fmt(e.total)}</strong>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
