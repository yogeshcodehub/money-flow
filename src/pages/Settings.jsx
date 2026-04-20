import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DEFAULT_CATEGORIES, CURRENCIES } from '../utils/constants';

export default function Settings() {
  const { settings, updateSettings, categories, addCategory, deleteCategory, transactions } = useApp();
  const [form, setForm] = useState({ ...settings });
  const [saved, setSaved] = useState(false);
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', emoji: '📦', type: 'expense', color: '#6366f1' });
  const [showKey, setShowKey] = useState(false);

  const handle = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const save = () => {
    updateSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addCat = (e) => {
    e.preventDefault();
    if (!newCat.name.trim()) return;
    addCategory(newCat);
    setNewCat({ name: '', emoji: '📦', type: 'expense', color: '#6366f1' });
    setShowAddCat(false);
  };

  const exportAllData = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      transactions: JSON.parse(localStorage.getItem('finflow_transactions') || '[]'),
      budgets: JSON.parse(localStorage.getItem('finflow_budgets') || '[]'),
      recurring: JSON.parse(localStorage.getItem('finflow_recurring') || '[]'),
      categories: JSON.parse(localStorage.getItem('finflow_categories') || '[]'),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'finflow-backup.json'; a.click();
  };

  const clearAllData = () => {
    if (confirm('⚠️ This will permanently delete ALL your data. Are you sure?')) {
      ['finflow_transactions', 'finflow_budgets', 'finflow_categories', 'finflow_recurring'].forEach(k => localStorage.removeItem(k));
      window.location.reload();
    }
  };

  return (
    <div>
      <div className="section-title">⚙️ Settings</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Profile */}
        <div className="card">
          <div className="card-header"><span className="card-title">👤 Profile</span></div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Your Name</label>
                <input className="form-input" value={form.name} onChange={handle('name')} placeholder="Your name" />
              </div>
              <div className="form-group">
                <label className="form-label">Currency</label>
                <select className="form-select" value={form.currency} onChange={handle('currency')}>
                  {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Theme</label>
              <div className="type-toggle" style={{ maxWidth: 260 }}>
                <button type="button" className={`type-btn ${form.theme === 'dark' ? 'active income' : ''}`} style={{ background: form.theme === 'dark' ? 'rgba(99,102,241,0.2)' : '', color: form.theme === 'dark' ? 'var(--accent-light)' : '' }} onClick={() => setForm(p => ({ ...p, theme: 'dark' }))}>
                  🌙 Dark
                </button>
                <button type="button" className={`type-btn ${form.theme === 'light' ? 'active income' : ''}`} style={{ background: form.theme === 'light' ? 'rgba(99,102,241,0.2)' : '', color: form.theme === 'light' ? 'var(--accent-light)' : '' }} onClick={() => setForm(p => ({ ...p, theme: 'light' }))}>
                  ☀️ Light
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* AI Config */}
        <div className="card">
          <div className="card-header"><span className="card-title">🤖 AI Configuration</span></div>
          <div className="card-body">
            <div className="alert alert-info" style={{ marginBottom: 16 }}>
              💡 Get a free Gemini API key at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-light)' }}>aistudio.google.com</a>. Your key is stored locally and never sent to any server other than Google.
            </div>
            <div className="form-group">
              <label className="form-label">Gemini API Key</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  type={showKey ? 'text' : 'password'}
                  value={form.geminiApiKey}
                  onChange={handle('geminiApiKey')}
                  placeholder="AIza..."
                />
                <button className="btn btn-secondary btn-icon" onClick={() => setShowKey(p => !p)}>
                  {showKey ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">🏷️ Categories</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAddCat(true)}>+ Add Category</button>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Expense Categories</label>
              <div className="category-grid">
                {categories.filter(c => c.type === 'expense').map(cat => (
                  <div key={cat.id} className="category-item" style={{ position: 'relative' }}>
                    <span className="category-emoji">{cat.emoji}</span>
                    <span className="category-name">{cat.name}</span>
                    {!DEFAULT_CATEGORIES.find(d => d.id === cat.id) && (
                      <button onClick={() => deleteCategory(cat.id)} style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--red)' }}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="divider" />
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Income Categories</label>
              <div className="category-grid">
                {categories.filter(c => c.type === 'income').map(cat => (
                  <div key={cat.id} className="category-item" style={{ position: 'relative' }}>
                    <span className="category-emoji">{cat.emoji}</span>
                    <span className="category-name">{cat.name}</span>
                    {!DEFAULT_CATEGORIES.find(d => d.id === cat.id) && (
                      <button onClick={() => deleteCategory(cat.id)} style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--red)' }}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="card">
          <div className="card-header"><span className="card-title">💾 Data Management</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={exportAllData}>📤 Export All Data (JSON)</button>
              <button className="btn btn-danger" onClick={clearAllData}>🗑️ Clear All Data</button>
            </div>
            <div className="divider" />
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              📦 {transactions.length} transactions stored locally · All data stays on your device
            </div>
          </div>
        </div>

        {/* Save */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          {saved && <div className="alert alert-success" style={{ marginBottom: 0 }}>✅ Settings saved!</div>}
          <button className="btn btn-primary" onClick={save}>💾 Save Settings</button>
        </div>
      </div>

      {/* Add Category Modal */}
      {showAddCat && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowAddCat(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 className="modal-title">Add Custom Category</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAddCat(false)}>✕</button>
            </div>
            <form onSubmit={addCat}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Emoji Icon</label>
                    <input className="form-input" value={newCat.emoji} onChange={e => setNewCat(p => ({ ...p, emoji: e.target.value }))} placeholder="📦" style={{ fontSize: 20, textAlign: 'center' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Color</label>
                    <input type="color" className="form-input" value={newCat.color} onChange={e => setNewCat(p => ({ ...p, color: e.target.value }))} style={{ height: 44, padding: 4 }} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Category Name</label>
                  <input className="form-input" value={newCat.name} onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Gym, Hobbies" />
                </div>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <div className="type-toggle">
                    <button type="button" className={`type-btn expense ${newCat.type === 'expense' ? 'active' : ''}`} onClick={() => setNewCat(p => ({ ...p, type: 'expense' }))}>Expense</button>
                    <button type="button" className={`type-btn income ${newCat.type === 'income' ? 'active' : ''}`} onClick={() => setNewCat(p => ({ ...p, type: 'income' }))}>Income</button>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddCat(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Category</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
