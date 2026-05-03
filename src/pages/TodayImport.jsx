import { useState, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/constants';

// PDF extraction with password support
async function extractPdfRows(file, password) {
  const pdfjs = window.pdfjsLib;
  if (!pdfjs) throw new Error('PDF library not loaded. Please refresh.');
  pdfjs.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  const arrayBuffer = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const task = pdfjs.getDocument({ data: arrayBuffer, password: password || '' });
    task.onPassword = (_cb, reason) => reject({ isPwdError: true, isWrong: reason === 2 });
    task.promise.then(async (pdf) => {
      const lines = [];
      for (let p = 1; p <= Math.min(pdf.numPages, 30); p++) {
        const page = await pdf.getPage(p);
        const ct = await page.getTextContent();
        const rows = new Map();
        for (const it of ct.items) {
          if (!it.str.trim()) continue;
          const y = Math.round(it.transform[5]);
          if (!rows.has(y)) rows.set(y, []);
          rows.get(y).push({ t: it.str.trim(), x: it.transform[4] });
        }
        [...rows.keys()].sort((a, b) => b - a).forEach(y => {
          const ln = rows.get(y).sort((a, b) => a.x - b.x).map(i => i.t).join('  ');
          if (ln.trim()) lines.push(ln.trim());
        });
      }
      resolve(lines);
    }).catch(reject);
  });
}

function datePatterns(d) {
  const z = n => String(n).padStart(2, '0');
  const day = z(d.getDate()), day1 = String(d.getDate());
  const mon = z(d.getMonth() + 1), mon1 = String(d.getMonth() + 1);
  const yr = d.getFullYear(), yr2 = String(d.getFullYear()).slice(2);
  const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const ML = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const mn = MN[d.getMonth()], ml = ML[d.getMonth()];
  return [
    `${day}/${mon}/${yr}`, `${day}-${mon}-${yr}`, `${day}.${mon}.${yr}`,
    `${day}/${mon}/${yr2}`, `${day}-${mon}-${yr2}`,
    `${day1}/${mon1}/${yr}`, `${day1}-${mon1}-${yr}`,
    `${day} ${mn} ${yr}`, `${day}-${mn}-${yr}`, `${day1} ${mn} ${yr}`,
    `${day} ${mn} ${yr2}`, `${mn} ${day}, ${yr}`, `${mn} ${day1}, ${yr}`,
    `${yr}-${mon}-${day}`, `${yr}/${mon}/${day}`,
    `${ml} ${day}, ${yr}`, `${ml} ${day1}, ${yr}`,
  ];
}

function datesInRange(from, to) {
  const list = [], cur = new Date(from), end = new Date(to);
  while (cur <= end) { list.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
  return list;
}

function matchLineDate(line, dates) {
  for (const d of dates) {
    if (datePatterns(d).some(p => line.toLowerCase().includes(p.toLowerCase())))
      return d.toISOString().split('T')[0];
  }
  return null;
}

function pickAmt(line) {
  const re = /\b(\d{1,3}(?:,\d{2,3})+(?:\.\d{0,2})?|\d+\.\d{2})\b/g;
  const hits = []; let m;
  while ((m = re.exec(line)) !== null) {
    const v = parseFloat(m[1].replace(/,/g, ''));
    if (v > 0 && v < 1e8) hits.push(v);
  }
  if (!hits.length) return null;
  return hits.length >= 2 ? hits[hits.length - 2] : hits[0];
}

function detectType(line) {
  if (/\bDr\.?\b|\bDEBIT\b|\bDebit\b|\bWithdraw/i.test(line)) return 'expense';
  if (/\bCr\.?\b|\bCREDIT\b|\bCredit\b|\bDeposit|\bRefund/i.test(line)) return 'income';
  if (/\bSALARY\b|\bSal\b|\bStipend\b/i.test(line)) return 'income';
  return 'expense';
}

function autoCategory(desc, type) {
  const d = desc.toUpperCase();
  if (type === 'income') {
    if (/SALARY|SAL\b|STIPEND/.test(d)) return 'salary';
    if (/FREELANCE|CONSULT/.test(d)) return 'freelance';
    if (/INTEREST|DIVIDEND/.test(d)) return 'investment';
    return 'other_income';
  }
  if (/ZOMATO|SWIGGY|RESTAURANT|FOOD|CAFE|COFFEE/.test(d)) return 'food';
  if (/UBER|OLA|METRO|RAILWAY|IRCTC|RAPIDO/.test(d)) return 'transport';
  if (/AMAZON|FLIPKART|MYNTRA|NYKAA|MEESHO|SHOP/.test(d)) return 'shopping';
  if (/RENT|LEASE/.test(d)) return 'rent';
  if (/ELECTRICITY|WATER|GAS|AIRTEL|JIO|VODAFONE/.test(d)) return 'utilities';
  if (/HOSPITAL|CLINIC|PHARMACY|MEDIC|DOCTOR/.test(d)) return 'health';
  if (/NETFLIX|SPOTIFY|PRIME|HOTSTAR|YOUTUBE/.test(d)) return 'subscriptions';
  if (/CINEMA|MOVIE|PVR|INOX/.test(d)) return 'entertainment';
  if (/INSURANCE|LIC/.test(d)) return 'insurance';
  if (/COLLEGE|SCHOOL|TUITION|COURSE|UDEMY/.test(d)) return 'education';
  return 'other_expense';
}

function cleanDesc(line, dates) {
  let s = line;
  dates.forEach(d => datePatterns(d).forEach(p => {
    try { s = s.replace(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' '); } catch {}
  }));
  s = s.replace(/\b\d{1,3}(?:,\d{2,3})+(?:\.\d{0,2})?\b/g, ' ')
       .replace(/\b\d+\.\d{2}\b/g, ' ')
       .replace(/\b(Dr|Cr|DR|CR)\.?\b/g, ' ')
       .replace(/\s{2,}/g, ' ').trim()
       .replace(/^[\s\-|/\\]+|[\s\-|/\\]+$/g, '').trim();
  return s || 'Bank Transaction';
}

function parseLines(lines, from, to) {
  const dates = datesInRange(from, to);
  const results = [];
  for (const line of lines) {
    const dateStr = matchLineDate(line, dates);
    if (!dateStr) continue;
    const amount = pickAmt(line);
    if (!amount) continue;
    const type = detectType(line);
    const desc = cleanDesc(line, dates);
    results.push({ id: Date.now() + Math.random(), description: desc, amount, type, categoryId: autoCategory(desc, type), date: dateStr, selected: true });
  }
  return results;
}

const toISO = d => d.toISOString().split('T')[0];

export default function StatementImport() {
  const { settings, categories, importTransactions } = useApp();
  const fmt = n => formatCurrency(n, settings.currency);
  const TODAY = new Date();
  const MONTH_START = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);

  const [step, setStep] = useState('configure');
  const [file, setFile] = useState(null);
  const [fromDate, setFromDate] = useState(toISO(MONTH_START));
  const [toDate, setToDate] = useState(toISO(TODAY));
  const [preset, setPreset] = useState('month');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  // Password modal state
  const [showPwd, setShowPwd] = useState(false);
  const [pwd, setPwd] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  const fileRef = useRef(null);
  const savedFile = useRef(null);

  const applyPreset = p => {
    const t = new Date();
    setPreset(p);
    if (p === 'today') { setFromDate(toISO(t)); setToDate(toISO(t)); }
    else if (p === '7d') { const s = new Date(t); s.setDate(t.getDate() - 6); setFromDate(toISO(s)); setToDate(toISO(t)); }
    else if (p === 'month') { setFromDate(toISO(new Date(t.getFullYear(), t.getMonth(), 1))); setToDate(toISO(t)); }
    else if (p === 'last') {
      const s = new Date(t.getFullYear(), t.getMonth() - 1, 1);
      const e = new Date(t.getFullYear(), t.getMonth(), 0);
      setFromDate(toISO(s)); setToDate(toISO(e));
    }
  };

  const doExtract = useCallback(async (f, password) => {
    const lines = await extractPdfRows(f, password);
    const found = parseLines(lines, fromDate, toDate);
    if (!found.length) {
      setError('No transactions found in the selected date range.\n\n• Ensure the PDF covers your selected dates\n• Text-based PDFs only (not scanned images)\n• Try a wider date range');
      return false;
    }
    setItems(found);
    setStep('review');
    return true;
  }, [fromDate, toDate]);

  const handleFile = useCallback(async f => {
    if (!f || f.name.split('.').pop().toLowerCase() !== 'pdf') { setError('Please upload a PDF file.'); return; }
    savedFile.current = f;
    setFile(f);
    setError('');
    setLoading(true);
    try {
      await doExtract(f, '');
    } catch (e) {
      if (e && e.isPwdError) { setPwdErr(e.isWrong ? 'Incorrect password.' : ''); setShowPwd(true); }
      else setError('Failed to read PDF: ' + (e?.message || String(e)));
    }
    setLoading(false);
  }, [doExtract]);

  const submitPwd = async () => {
    setPwdLoading(true); setPwdErr('');
    try {
      await doExtract(savedFile.current, pwd);
      setShowPwd(false); setPwd('');
    } catch (e) {
      if (e && e.isPwdError) setPwdErr('Incorrect password. Please try again.');
      else setError('Error: ' + (e?.message || String(e)));
    }
    setPwdLoading(false);
  };

  const update = (id, f, v) => setItems(p => p.map(it => it.id === id ? { ...it, [f]: v } : it));
  const toggleOne = id => setItems(p => p.map(it => it.id === id ? { ...it, selected: !it.selected } : it));
  const toggleAll = () => { const all = items.every(i => i.selected); setItems(p => p.map(i => ({ ...i, selected: !all }))); };

  const handleImport = () => {
    const sel = items.filter(i => i.selected && i.amount > 0)
      .map(({ description, amount, type, categoryId, date }) => ({ description, amount: parseFloat(amount), type, categoryId, date, note: 'Imported from bank PDF' }));
    if (!sel.length) { setError('Select at least one transaction.'); return; }
    importTransactions(sel);
    setStep('done');
  };

  const reset = () => { setStep('configure'); setFile(null); setItems([]); setError(''); setPwd(''); setShowPwd(false); savedFile.current = null; };

  const selCount = items.filter(i => i.selected).length;
  const expCats = categories.filter(c => c.type === 'expense');
  const incCats = categories.filter(c => c.type === 'income');
  const fmtD = d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div>
      <div className="section-title">📥 Statement Import</div>

      {/* ── Password Modal ── */}
      {showPwd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !pwdLoading && setShowPwd(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 className="modal-title">🔐 Password Protected PDF</h2>
            </div>
            <div className="modal-body">
              <div className="alert alert-info" style={{ marginBottom: 14 }}>
                This bank statement is password protected. Enter your PDF password to unlock it.
              </div>
              {pwdErr && <div className="alert alert-error" style={{ marginBottom: 12 }}>{pwdErr}</div>}
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label className="form-label">PDF Password</label>
                <input className="form-input" type="password" placeholder="Enter PDF password"
                  value={pwd} autoFocus
                  onChange={e => setPwd(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !pwdLoading && pwd && submitPwd()} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                💡 Usually your date of birth (DDMMYYYY) or registered mobile number — check your bank's instructions.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowPwd(false); setFile(null); savedFile.current = null; }}>Cancel</button>
              <button className="btn btn-primary" onClick={submitPwd} disabled={!pwd || pwdLoading}>
                {pwdLoading
                  ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="spinner animate-spin" /> Unlocking…</span>
                  : '🔓 Unlock & Extract'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Configure Step ── */}
      {step === 'configure' && (
        <div>
          {/* Date range card */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span className="card-title">📅 Select Date Range</span></div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {[['today','Today'],['7d','Last 7 Days'],['month','This Month'],['last','Last Month'],['custom','Custom']].map(([id, label]) => (
                  <button key={id} className="filter-chip" onClick={() => applyPreset(id)}
                    style={preset === id ? { background: 'linear-gradient(135deg,var(--accent),var(--purple))', color: 'white', border: 'none' } : {}}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">From Date</label>
                  <input className="form-input" type="date" value={fromDate} max={toDate}
                    onChange={e => { setFromDate(e.target.value); setPreset('custom'); }} />
                </div>
                <div className="form-group">
                  <label className="form-label">To Date</label>
                  <input className="form-input" type="date" value={toDate} min={fromDate} max={toISO(TODAY)}
                    onChange={e => { setToDate(e.target.value); setPreset('custom'); }} />
                </div>
              </div>
              <div className="alert alert-info" style={{ marginTop: 4, fontSize: 13 }}>
                📊 Extracting: <strong>{fmtD(fromDate)}</strong> → <strong>{fmtD(toDate)}</strong>
                &nbsp;({datesInRange(fromDate, toDate).length} day{datesInRange(fromDate, toDate).length !== 1 ? 's' : ''})
              </div>
            </div>
          </div>

          {/* Drop zone */}
          <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          <div className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
            style={{ marginBottom: 16 }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div className="spinner animate-spin" style={{ width: 36, height: 36 }} />
                <div style={{ fontWeight: 600 }}>Reading PDF & extracting transactions…</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Matching dates in your selected range</div>
              </div>
            ) : (
              <>
                <div className="drop-zone-icon">{file ? '📄' : '🏦'}</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
                  {file ? file.name : 'Drop your bank statement PDF'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  {file ? `${(file.size / 1024).toFixed(1)} KB · Password-protected PDFs supported 🔐`
                        : 'Supports password-protected PDFs · All processing done in your browser'}
                </div>
                <button type="button" className="btn btn-primary"
                  onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>
                  {file ? '🔄 Upload Different PDF' : '📁 Browse PDF'}
                </button>
              </>
            )}
          </div>

          {error && <div className="alert alert-error" style={{ whiteSpace: 'pre-wrap', marginBottom: 12 }}>{error}</div>}

          {/* How it works */}
          <div className="card">
            <div className="card-header"><span className="card-title">ℹ️ How It Works</span></div>
            <div className="card-body" style={{ paddingTop: 8 }}>
              {[
                ['📅', 'Set Date Range', 'Pick Today, Last 7 Days, This Month, Last Month, or any custom range'],
                ['📄', 'Upload PDF', 'Your bank statement from SBI, HDFC, ICICI, Axis, Kotak, etc.'],
                ['🔐', 'Auto Password Prompt', 'If your PDF is locked, a popup asks for your password securely'],
                ['✏️', 'Review & Edit', 'Verify extracted transactions and fix details before importing'],
                ['✅', 'Import', 'Selected transactions are added to your Dashboard with correct dates'],
              ].map(([icon, title, desc]) => (
                <div key={title} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 20 }}>{icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Review Step ── */}
      {step === 'review' && (
        <div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>📋</span>
              <div>
                <div style={{ fontWeight: 700 }}>{items.length} transaction{items.length !== 1 ? 's' : ''} found · {selCount} selected</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{file?.name} · {fmtD(fromDate)} – {fmtD(toDate)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={reset}>↩ Re-upload</button>
              <button className="btn btn-primary" onClick={handleImport} disabled={!selCount}>✅ Import {selCount > 0 ? `${selCount} Selected` : ''}</button>
            </div>
          </div>

          {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header" style={{ padding: '12px 16px' }}>
              <span className="card-title">Transaction Preview</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={items.every(i => i.selected)} onChange={toggleAll} style={{ accentColor: 'var(--accent)' }} />
                Select All
              </label>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['', 'Date', 'Description', 'Amount', 'Type', 'Category'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const cats = item.type === 'income' ? incCats : expCats;
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', opacity: item.selected ? 1 : 0.45, transition: 'opacity 0.2s' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <input type="checkbox" checked={item.selected} onChange={() => toggleOne(item.id)} style={{ accentColor: 'var(--accent)', width: 16, height: 16, cursor: 'pointer' }} />
                        </td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-muted)' }}>
                          {new Date(item.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </td>
                        <td style={{ padding: '10px 12px', minWidth: 180 }}>
                          <input className="form-input" style={{ fontSize: 13, padding: '6px 10px', minWidth: 160 }}
                            value={item.description} onChange={e => update(item.id, 'description', e.target.value)} />
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <input type="number" min="0" step="0.01" className="form-input"
                            style={{ fontSize: 13, padding: '6px 10px', width: 110 }}
                            value={item.amount} onChange={e => update(item.id, 'amount', e.target.value)} />
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div className="type-toggle" style={{ minWidth: 140 }}>
                            <button type="button" className={`type-btn expense ${item.type === 'expense' ? 'active' : ''}`}
                              onClick={() => { update(item.id, 'type', 'expense'); update(item.id, 'categoryId', autoCategory(item.description, 'expense')); }}>
                              Expense
                            </button>
                            <button type="button" className={`type-btn income ${item.type === 'income' ? 'active' : ''}`}
                              onClick={() => { update(item.id, 'type', 'income'); update(item.id, 'categoryId', autoCategory(item.description, 'income')); }}>
                              Income
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <select className="form-select" style={{ fontSize: 13, padding: '6px 10px', minWidth: 150 }}
                            value={item.categoryId} onChange={e => update(item.id, 'categoryId', e.target.value)}>
                            {cats.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="alert alert-info" style={{ fontSize: 12 }}>
            💡 Each transaction is saved with its actual date from the PDF. Edit any field before importing.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={reset}>↩ Re-upload</button>
            <button className="btn btn-primary" onClick={handleImport} disabled={!selCount} style={{ minWidth: 200 }}>
              ✅ Import {selCount} Transaction{selCount !== 1 ? 's' : ''} to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* ── Done Step ── */}
      {step === 'done' && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Import Successful!</div>
          <div style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: 15 }}>
            {selCount} transaction{selCount !== 1 ? 's' : ''} imported from {fmtD(fromDate)} to {fmtD(toDate)}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={reset}>📄 Import Another</button>
            <button className="btn btn-primary"
              onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'Dashboard' }))}>
              📊 View Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
