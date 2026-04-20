import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency, getCurrentMonth, getMonthLabel } from '../utils/constants';
import AddTransactionModal from '../components/AddTransactionModal';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

export default function Dashboard() {
  const { transactions, categories, settings, getMonthStats, getCategoryBreakdown, getMonthlyTrend } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const currentMonth = getCurrentMonth();
  const stats = getMonthStats(currentMonth);
  const trend = getMonthlyTrend(6);
  const breakdown = getCategoryBreakdown(currentMonth, 'expense');
  const recentTxs = transactions.slice(0, 8);
  const fmt = (n) => formatCurrency(n, settings.currency);

  const COLORS = breakdown.map(b => b.color);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', fontSize: 13 }}>
        <p style={{ fontWeight: 700, marginBottom: 6 }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
        ))}
      </div>
    );
  };

  return (
    <div>
      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.15))',
        border: '1px solid rgba(99,102,241,0.25)',
        borderRadius: 'var(--radius)',
        padding: '24px 28px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {settings.name}! 👋
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Here's your financial snapshot for {getMonthLabel(currentMonth)}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          + Add Transaction
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card balance">
          <div className="stat-label">Net Balance</div>
          <div className="stat-value balance">{fmt(stats.balance)}</div>
          <div className="stat-sub">This month</div>
          <div className="stat-icon balance">💎</div>
        </div>
        <div className="stat-card income">
          <div className="stat-label">Total Income</div>
          <div className="stat-value income">{fmt(stats.income)}</div>
          <div className="stat-sub">{stats.txs.filter(t => t.type === 'income').length} transactions</div>
          <div className="stat-icon income">↑</div>
        </div>
        <div className="stat-card expense">
          <div className="stat-label">Total Expenses</div>
          <div className="stat-value expense">{fmt(stats.expense)}</div>
          <div className="stat-sub">{stats.txs.filter(t => t.type === 'expense').length} transactions</div>
          <div className="stat-icon expense">↓</div>
        </div>
        <div className="stat-card savings">
          <div className="stat-label">Savings Rate</div>
          <div className="stat-value savings">
            {stats.income > 0 ? Math.round((stats.balance / stats.income) * 100) : 0}%
          </div>
          <div className="stat-sub">of income saved</div>
          <div className="stat-icon savings">🎯</div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="card">
          <div className="card-header"><span className="card-title">📊 6-Month Trend</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trend} barSize={18} barGap={4}>
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">🍕 Expenses by Category</span></div>
          <div className="card-body">
            {breakdown.length === 0 ? (
              <div className="empty-state" style={{ padding: 30 }}>
                <div style={{ fontSize: 36 }}>📊</div>
                <p style={{ marginTop: 8, fontSize: 13 }}>No expenses this month</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={breakdown} dataKey="total" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {breakdown.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10 }} />
                  <Legend formatter={(v) => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">🕐 Recent Transactions</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{transactions.length} total</span>
        </div>
        <div className="card-body" style={{ paddingTop: 8 }}>
          {recentTxs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">💸</div>
              <h3>No transactions yet</h3>
              <p>Click "Add Transaction" to get started!</p>
            </div>
          ) : (
            <div className="transaction-list">
              {recentTxs.map(tx => {
                const cat = categories.find(c => c.id === tx.categoryId);
                return (
                  <div key={tx.id} className="transaction-item">
                    <div className="tx-icon" style={{ background: cat?.color ? `${cat.color}22` : 'var(--bg-card)' }}>
                      {cat?.emoji || '💳'}
                    </div>
                    <div className="tx-info">
                      <div className="tx-name">{tx.description}</div>
                      <div className="tx-meta">{cat?.name} · {new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                    </div>
                    {tx.isRecurring && <span className="badge badge-recurring">🔄 Auto</span>}
                    <div className={`tx-amount ${tx.type}`}>
                      {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showAddModal && <AddTransactionModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}
