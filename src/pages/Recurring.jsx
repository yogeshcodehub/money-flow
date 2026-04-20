import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/constants';

export default function Recurring() {
  const { recurring, categories, addRecurring, updateRecurring, deleteRecurring, settings } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [type, setType] = useState('expense');
  const [form, setForm] = useState({ description: '', amount: '', categoryId: '', dayOfMonth: 1 });
  const [error, setError] = useState('');
  const fmt = (n) => formatCurrency(n, settings.currency);
  const filteredCats = categories.filter(c => c.type === type);

  const submit = (e) => {
    e.preventDefault();
    if (!form.description.trim()) return setError('Description required');
    if (!form.amount || +form.amount <= 0) return setError('Enter valid amount');
    if (!form.categoryId) return setError('Select a category');
    addRecurring({ ...form, type, amount: +form.amount, dayOfMonth: +form.dayOfMonth });
    setForm({ description: '', amount: '', categoryId: '', dayOfMonth: 1 });
    setError('');
    setShowAdd(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>🔄 Recurring Transactions</div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add Recurring</button>
      </div>

      <div className="alert alert-info" style={{ marginBottom: 16 }}>
        🤖 Recurring transactions are automatically added each month on their scheduled day.
      </div>

      {recurring.length === 0 ? (
        <div className="empty-state card" style={{ padding: 60 }}>
          <div className="empty-state-icon">🔄</div>
          <h3>No recurring transactions</h3>
          <p>Set up automatic entries for bills and salary</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowAdd(true)}>+ Add Recurring</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recurring.map(r => {
            const cat = categories.find(c => c.id === r.categoryId);
            return (
              <div key={r.id} className="card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: `${cat?.color || '#6366f1'}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                    {cat?.emoji || '🔄'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{r.description}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {cat?.name} · Every month on day {r.dayOfMonth}
                      {r.lastProcessed && ` · Last: ${new Date(r.lastProcessed).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 16, color: r.type === 'income' ? 'var(--green)' : 'var(--red)' }}>
                        {r.type === 'income' ? '+' : '-'}{fmt(r.amount)}
                      </div>
                      <span className={`badge ${r.type === 'income' ? 'badge-income' : 'badge-expense'}`}>{r.type}</span>
                    </div>
                    {/* Toggle active */}
                    <button
                      className={`btn btn-sm ${r.active ? 'btn-secondary' : 'btn-ghost'}`}
                      onClick={() => updateRecurring(r.id, { active: !r.active })}
                      title={r.active ? 'Pause' : 'Activate'}
                    >
                      {r.active ? '⏸ Active' : '▶ Paused'}
                    </button>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteRecurring(r.id)}>🗑️</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Add Recurring Transaction</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <form onSubmit={submit}>
              <div className="modal-body">
                <div className="type-toggle">
                  <button type="button" className={`type-btn income ${type === 'income' ? 'active' : ''}`} onClick={() => { setType('income'); setForm(p => ({ ...p, categoryId: '' })); }}>↑ Income</button>
                  <button type="button" className={`type-btn expense ${type === 'expense' ? 'active' : ''}`} onClick={() => { setType('expense'); setForm(p => ({ ...p, categoryId: '' })); }}>↓ Expense</button>
                </div>
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input className="form-input" placeholder="e.g. Netflix, Salary, Rent" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Amount</label>
                    <div className="input-group">
                      <span className="input-prefix">₹</span>
                      <input className="form-input" type="number" min="1" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Day of Month</label>
                    <input className="form-input" type="number" min="1" max="28" value={form.dayOfMonth} onChange={e => setForm(p => ({ ...p, dayOfMonth: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <div className="category-grid" style={{ maxHeight: 180, overflowY: 'auto' }}>
                    {filteredCats.map(cat => (
                      <div key={cat.id} className={`category-item ${form.categoryId === cat.id ? 'selected' : ''}`}
                        onClick={() => setForm(p => ({ ...p, categoryId: cat.id }))}>
                        <span className="category-emoji">{cat.emoji}</span>
                        <span className="category-name">{cat.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
