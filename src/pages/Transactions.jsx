import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate, generateId } from '../utils/constants';
import AddTransactionModal from '../components/AddTransactionModal';
import Papa from 'papaparse';

export default function Transactions() {
  const { transactions, categories, deleteTransaction, settings, importTransactions } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCat, setFilterCat] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  const [showDeleteId, setShowDeleteId] = useState(null);
  const fmt = (n) => formatCurrency(n, settings.currency);

  const filtered = useMemo(() => {
    let txs = [...transactions];
    if (filterType !== 'all') txs = txs.filter(t => t.type === filterType);
    if (filterCat !== 'all') txs = txs.filter(t => t.categoryId === filterCat);
    if (search) txs = txs.filter(t => t.description.toLowerCase().includes(search.toLowerCase()) || t.note?.toLowerCase().includes(search.toLowerCase()));
    txs.sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.date) - new Date(a.date);
      if (sortBy === 'date-asc') return new Date(a.date) - new Date(b.date);
      if (sortBy === 'amount-desc') return b.amount - a.amount;
      if (sortBy === 'amount-asc') return a.amount - b.amount;
      return 0;
    });
    return txs;
  }, [transactions, filterType, filterCat, search, sortBy]);

  // CSV Export
  const exportCSV = () => {
    const rows = filtered.map(t => ({
      Date: t.date, Description: t.description, Type: t.type,
      Category: categories.find(c => c.id === t.categoryId)?.name || '',
      Amount: t.amount, Note: t.note || ''
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'finflow-transactions.csv'; a.click();
  };

  // CSV Import
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (results) => {
        const mapped = results.data.map(row => ({
          description: row.Description || row.description || row.Narration || row.narration || row.Details || 'Imported',
          amount: Math.abs(parseFloat(row.Amount || row.amount || row.Debit || row.Credit || 0) || 0),
          type: parseFloat(row.Credit || 0) > 0 ? 'income' : 'expense',
          date: row.Date || row.date || new Date().toISOString().split('T')[0],
          categoryId: 'other_expense',
          note: 'Imported from CSV',
        })).filter(r => r.amount > 0);
        importTransactions(mapped);
        alert(`✅ Imported ${mapped.length} transactions!`);
      },
      error: () => alert('❌ Failed to parse CSV. Please check the file format.')
    });
    e.target.value = '';
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>💳 Transactions</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
            📁 Import CSV
            <input type="file" accept=".csv" onChange={handleImport} style={{ display: 'none' }} />
          </label>
          <button className="btn btn-secondary btn-sm" onClick={exportCSV}>📤 Export</button>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditTx(null); setShowModal(true); }}>
            + Add Transaction
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="form-input" style={{ maxWidth: 220 }} placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)} />
          <div className="filters-bar" style={{ marginBottom: 0, flex: 1 }}>
            {['all', 'income', 'expense'].map(t => (
              <button key={t} className={`filter-chip ${filterType === t ? 'active' : ''}`} onClick={() => setFilterType(t)}>
                {t === 'all' ? 'All' : t === 'income' ? '↑ Income' : '↓ Expense'}
              </button>
            ))}
          </div>
          <select className="form-select" style={{ maxWidth: 170 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
          <select className="form-select" style={{ maxWidth: 160 }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="amount-desc">Amount ↓</option>
            <option value="amount-asc">Amount ↑</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <h3>No transactions found</h3>
              <p>Try adjusting your filters or add a new transaction</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(tx => {
                    const cat = categories.find(c => c.id === tx.categoryId);
                    return (
                      <tr key={tx.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{tx.description}</div>
                          {tx.note && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{tx.note}</div>}
                          {tx.isRecurring && <span className="badge badge-recurring" style={{ marginTop: 2 }}>🔄 Auto</span>}
                        </td>
                        <td>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {cat?.emoji} <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{cat?.name || '—'}</span>
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{formatDate(tx.date)}</td>
                        <td>
                          <span className={`badge ${tx.type === 'income' ? 'badge-income' : 'badge-expense'}`}>
                            {tx.type === 'income' ? '↑' : '↓'} {tx.type}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          <span className={tx.type === 'income' ? 'tx-amount income' : 'tx-amount expense'}>
                            {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                            <button className="btn btn-ghost btn-icon btn-sm" title="Edit" onClick={() => { setEditTx(tx); setShowModal(true); }}>✏️</button>
                            <button className="btn btn-danger btn-icon btn-sm" title="Delete" onClick={() => setShowDeleteId(tx.id)}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {filtered.length > 0 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>{filtered.length} transactions</span>
            <span>
              Total: <strong style={{ color: 'var(--text-primary)' }}>
                {fmt(filtered.reduce((s, t) => t.type === 'income' ? s + t.amount : s - t.amount, 0))}
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* Delete confirm */}
      {showDeleteId && (
        <div className="modal-overlay" onClick={() => setShowDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-body" style={{ textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🗑️</div>
              <h3 style={{ marginBottom: 8 }}>Delete Transaction?</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>This action cannot be undone.</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button className="btn btn-secondary" onClick={() => setShowDeleteId(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={() => { deleteTransaction(showDeleteId); setShowDeleteId(null); }}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && <AddTransactionModal onClose={() => { setShowModal(false); setEditTx(null); }} prefill={editTx} />}
    </div>
  );
}
