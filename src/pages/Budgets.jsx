import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency, getCurrentMonth, getColorForPercent } from '../utils/constants';

export default function Budgets() {
  const { budgets, categories, addBudget, deleteBudget, getBudgetProgress, settings } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ categoryId: '', limit: '' });
  const [error, setError] = useState('');
  const currentMonth = getCurrentMonth();
  const progress = getBudgetProgress(currentMonth);
  const fmt = (n) => formatCurrency(n, settings.currency);
  const expenseCategories = categories.filter(c => c.type === 'expense');

  const submit = (e) => {
    e.preventDefault();
    if (!form.categoryId) return setError('Select a category');
    if (!form.limit || +form.limit <= 0) return setError('Enter a valid limit');
    if (budgets.find(b => b.categoryId === form.categoryId)) return setError('Budget for this category already exists');
    addBudget({ categoryId: form.categoryId, limit: +form.limit });
    setForm({ categoryId: '', limit: '' });
    setError('');
    setShowAdd(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>🎯 Budgets</div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Set Budget</button>
      </div>

      {progress.length === 0 ? (
        <div className="empty-state card" style={{ padding: 60 }}>
          <div className="empty-state-icon">🎯</div>
          <h3>No budgets set</h3>
          <p>Set monthly spending limits to track your goals</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowAdd(true)}>+ Create Budget</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {progress.map(b => {
            const cat = categories.find(c => c.id === b.categoryId);
            const pct = Math.min(b.percent, 100);
            const barColor = getColorForPercent(b.percent);
            const remaining = b.limit - b.spent;
            return (
              <div key={b.id} className="card" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: `${cat?.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                      {cat?.emoji || '📦'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{cat?.name || b.categoryId}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {fmt(b.spent)} spent of {fmt(b.limit)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: barColor }}>{Math.round(b.percent)}%</div>
                      <div style={{ fontSize: 12, color: remaining >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {remaining >= 0 ? `${fmt(remaining)} left` : `${fmt(Math.abs(remaining))} over!`}
                      </div>
                    </div>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteBudget(b.id)}>🗑️</button>
                  </div>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: barColor }} />
                </div>
                {b.percent >= 100 && (
                  <div className="alert alert-error" style={{ marginTop: 10, marginBottom: 0 }}>
                    ⚠️ You've exceeded your budget for {cat?.name}!
                  </div>
                )}
                {b.percent >= 80 && b.percent < 100 && (
                  <div className="alert alert-warning" style={{ marginTop: 10, marginBottom: 0 }}>
                    ⚡ You've used {Math.round(b.percent)}% of your {cat?.name} budget
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Budget Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Set Monthly Budget</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <form onSubmit={submit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <div className="category-grid">
                    {expenseCategories.map(cat => (
                      <div key={cat.id} className={`category-item ${form.categoryId === cat.id ? 'selected' : ''}`}
                        onClick={() => setForm(p => ({ ...p, categoryId: cat.id }))}>
                        <span className="category-emoji">{cat.emoji}</span>
                        <span className="category-name">{cat.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Monthly Limit</label>
                  <div className="input-group">
                    <span className="input-prefix">₹</span>
                    <input className="form-input" type="number" min="1" placeholder="0.00" value={form.limit} onChange={e => setForm(p => ({ ...p, limit: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Budget</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
