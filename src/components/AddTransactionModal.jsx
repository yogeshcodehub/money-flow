import { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function AddTransactionModal({ onClose, prefill }) {
  const { addTransaction, categories } = useApp();
  const [type, setType] = useState(prefill?.type || 'expense');
  const [form, setForm] = useState({
    description: prefill?.description || '',
    amount: prefill?.amount || '',
    categoryId: prefill?.categoryId || '',
    date: prefill?.date || new Date().toISOString().split('T')[0],
    note: prefill?.note || '',
  });
  const [error, setError] = useState('');

  const filteredCats = categories.filter(c => c.type === type);

  const handle = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.description.trim()) return setError('Description is required');
    if (!form.amount || isNaN(form.amount) || +form.amount <= 0) return setError('Enter a valid amount');
    if (!form.categoryId) return setError('Please select a category');
    if (!form.date) return setError('Date is required');
    addTransaction({ ...form, type, amount: +form.amount });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Add Transaction</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="type-toggle">
              <button type="button" className={`type-btn income ${type === 'income' ? 'active' : ''}`} onClick={() => { setType('income'); setForm(p => ({ ...p, categoryId: '' })); }}>
                ↑ Income
              </button>
              <button type="button" className={`type-btn expense ${type === 'expense' ? 'active' : ''}`} onClick={() => { setType('expense'); setForm(p => ({ ...p, categoryId: '' })); }}>
                ↓ Expense
              </button>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" placeholder="e.g. Lunch at Café" value={form.description} onChange={handle('description')} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Amount (₹)</label>
                <div className="input-group">
                  <span className="input-prefix">₹</span>
                  <input className="form-input" type="number" min="0.01" step="0.01" placeholder="0.00" value={form.amount} onChange={handle('amount')} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={form.date} onChange={handle('date')} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Category</label>
              <div className="category-grid" style={{ maxHeight: 200, overflowY: 'auto' }}>
                {filteredCats.map(cat => (
                  <div
                    key={cat.id}
                    className={`category-item ${form.categoryId === cat.id ? 'selected' : ''}`}
                    onClick={() => setForm(p => ({ ...p, categoryId: cat.id }))}
                  >
                    <span className="category-emoji">{cat.emoji}</span>
                    <span className="category-name">{cat.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Note (optional)</label>
              <textarea className="form-textarea" rows={2} placeholder="Add a note..." value={form.note} onChange={handle('note')} style={{ resize: 'none' }} />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">
              Add {type === 'income' ? '↑ Income' : '↓ Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
