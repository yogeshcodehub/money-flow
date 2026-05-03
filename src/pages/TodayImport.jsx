import { useState, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/constants';

// ─── PDF Row-Preserving Extraction ───
async function extractPdfRows(file) {
  const pdfjs = window.pdfjsLib;
  if (!pdfjs) throw new Error('PDF library not loaded. Please refresh.');

  pdfjs.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

  const arrayBuffer = await file.arrayBuffer();
  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  } catch {
    pdfjs.GlobalWorkerOptions.workerSrc = '';
    pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  }

  const allLines = [];
  const maxPages = Math.min(pdf.numPages, 20);

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // Group items by Y coordinate to reconstruct table rows
    const rowMap = new Map();
    for (const item of content.items) {
      if (!item.str.trim()) continue;
      const y = Math.round(item.transform[5]); // PDF Y (bottom-up)
      if (!rowMap.has(y)) rowMap.set(y, []);
      rowMap.get(y).push({ text: item.str.trim(), x: item.transform[4] });
    }

    // Sort rows top-to-bottom (descending Y in PDF coords)
    const sortedYs = [...rowMap.keys()].sort((a, b) => b - a);
    for (const y of sortedYs) {
      const items = rowMap.get(y).sort((a, b) => a.x - b.x);
      const lineText = items.map(i => i.text).join('  ');
      if (lineText.trim()) allLines.push(lineText.trim());
    }
  }
  return allLines;
}

// ─── Today's date in all common bank statement formats ───
function getTodayPatterns() {
  const t = new Date();
  const d  = String(t.getDate()).padStart(2, '0');
  const d1 = String(t.getDate());
  const mo = String(t.getMonth() + 1).padStart(2, '0');
  const m1 = String(t.getMonth() + 1);
  const y  = t.getFullYear();
  const yy = String(y).slice(2);
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MLONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const mn  = MONTHS[t.getMonth()];
  const mnL = MLONG[t.getMonth()];

  return [
    `${d}/${mo}/${y}`,  `${d}-${mo}-${y}`,  `${d}.${mo}.${y}`,
    `${d}/${mo}/${yy}`, `${d}-${mo}-${yy}`,
    `${d1}/${m1}/${y}`, `${d1}-${m1}-${y}`,
    `${d} ${mn} ${y}`,  `${d}-${mn}-${y}`,  `${d}/${mn}/${y}`,
    `${d1} ${mn} ${y}`, `${d} ${mn} ${yy}`,
    `${mn} ${d}, ${y}`, `${mn} ${d1}, ${y}`,
    `${y}-${mo}-${d}`,  `${y}/${mo}/${d}`,
    `${d1}-${mn}-${yy}`,`${d}-${mn}-${yy}`,
    `${mnL} ${d}, ${y}`,`${mnL} ${d1}, ${y}`,
  ];
}

// ─── Extract money amounts from a line ───
function extractAmounts(line) {
  // Matches: 1,234.56 | 1,23,456.00 | 1234.56 (must have decimals or comma-thousands)
  const re = /\b(\d{1,3}(?:,\d{2,3})+(?:\.\d{0,2})?|\d+\.\d{2})\b/g;
  const hits = [];
  let m;
  while ((m = re.exec(line)) !== null) {
    const val = parseFloat(m[1].replace(/,/g, ''));
    if (val > 0 && val < 1e8) hits.push({ value: val, idx: m.index });
  }
  return hits;
}

// ─── Pick the most likely transaction amount ───
// Heuristic: last amount is usually running balance; second-to-last is transaction amount
function pickAmount(hits) {
  if (hits.length === 0) return null;
  if (hits.length === 1) return hits[0].value;
  return hits[hits.length - 2].value; // second-to-last
}

// ─── Detect income vs expense ───
function detectType(line) {
  if (/\bDr\.?\b|\bDEBIT\b|\bDebit\b|\bWithdraw|\bPayment\b/i.test(line)) return 'expense';
  if (/\bCr\.?\b|\bCREDIT\b|\bCredit\b|\bDeposit|\bRefund|\bCashback/i.test(line)) return 'income';
  if (/\bSALARY\b|\bSal\b|\bStipend\b/i.test(line)) return 'income';
  return 'expense';
}

// ─── Keyword-based auto-category ───
function autoCategory(desc, type) {
  const d = desc.toUpperCase();
  if (type === 'income') {
    if (/SALARY|SAL\b|STIPEND/.test(d)) return 'salary';
    if (/FREELANCE|CONSULT/.test(d))    return 'freelance';
    if (/INTEREST|DIVIDEND/.test(d))    return 'investment';
    if (/REFUND|CASHBACK/.test(d))      return 'other_income';
    return 'other_income';
  }
  if (/ZOMATO|SWIGGY|HOTEL|RESTAURANT|FOOD|CAFE|COFFEE/.test(d)) return 'food';
  if (/UBER|OLA|METRO|BUS|RAILWAY|IRCTC|KSRTC|RAPIDO/.test(d))   return 'transport';
  if (/AMAZON|FLIPKART|MYNTRA|NYKAA|MEESHO|SHOP|STORE/.test(d))  return 'shopping';
  if (/RENT|LEASE/.test(d))                                         return 'rent';
  if (/ELECTRICITY|WATER|GAS|BSNL|AIRTEL|JIO|VODAFONE/.test(d))  return 'utilities';
  if (/HOSPITAL|CLINIC|PHARMACY|MEDIC|DOCTOR/.test(d))            return 'health';
  if (/NETFLIX|SPOTIFY|PRIME|HOTSTAR|ZEE5|YOUTUBE/.test(d))       return 'subscriptions';
  if (/CINEMA|MOVIE|PVR|INOX|GAME/.test(d))                       return 'entertainment';
  if (/INSURANCE|LIC|SBI LIFE/.test(d))                           return 'insurance';
  if (/COLLEGE|SCHOOL|TUITION|COURSE|UDEMY/.test(d))              return 'education';
  return 'other_expense';
}

// ─── Strip date & amounts from line to get description ───
function extractDescription(line, patterns) {
  let desc = line;
  // Remove date
  for (const p of patterns) {
    desc = desc.replace(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  }
  // Remove money amounts
  desc = desc.replace(/\b\d{1,3}(?:,\d{2,3})+(?:\.\d{0,2})?\b/g, ' ');
  desc = desc.replace(/\b\d+\.\d{2}\b/g, ' ');
  // Remove Dr/Cr markers
  desc = desc.replace(/\b(Dr|Cr|DR|CR)\b\.?/g, ' ');
  // Collapse whitespace & clean up
  desc = desc.replace(/\s{2,}/g, ' ').trim();
  // Remove leading/trailing punctuation
  desc = desc.replace(/^[\s\-|/\\]+|[\s\-|/\\]+$/g, '').trim();
  return desc || 'Bank Transaction';
}

// ─── Main parser ───
function parseTodayTransactions(lines, patterns) {
  const results = [];
  for (const line of lines) {
    const hasToday = patterns.some(p =>
      line.toLowerCase().includes(p.toLowerCase())
    );
    if (!hasToday) continue;

    const amounts = extractAmounts(line);
    const amount  = pickAmount(amounts);
    if (!amount) continue;

    const type   = detectType(line);
    const desc   = extractDescription(line, patterns);

    results.push({
      id:         Date.now() + Math.random(),
      description: desc,
      amount,
      type,
      categoryId:  autoCategory(desc, type),
      rawLine:     line,
      selected:    true,
    });
  }
  return results;
}

// ═══════════════════════════════════════════════════
export default function TodayImport() {
  const { settings, categories, importTransactions } = useApp();
  const fmt = (n) => formatCurrency(n, settings.currency);
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  const [step, setStep]           = useState('upload'); // upload | review | done
  const [file, setFile]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [items, setItems]         = useState([]);
  const [dragOver, setDragOver]   = useState(false);
  const fileRef = useRef(null);

  // ─── Process PDF ───
  const processPdf = useCallback(async (f) => {
    setFile(f);
    setLoading(true);
    setError('');
    setItems([]);

    try {
      const lines    = await extractPdfRows(f);
      const patterns = getTodayPatterns();
      const found    = parseTodayTransactions(lines, patterns);

      if (found.length === 0) {
        setError(
          `❌ No transactions found for today (${new Date().toLocaleDateString('en-IN')}).\n\n` +
          `Possible reasons:\n` +
          `• Your bank statement doesn't include today's date yet\n` +
          `• The PDF is a scanned image (not text-based)\n` +
          `• The date format in the PDF is unusual\n\n` +
          `Try downloading the statement again later in the day, or use CSV import.`
        );
        setStep('upload');
      } else {
        setItems(found);
        setStep('review');
      }
    } catch (err) {
      setError('Failed to read PDF: ' + err.message);
    }
    setLoading(false);
  }, []);

  const handleFilePick = useCallback((f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (ext !== 'pdf') { setError('❌ Please upload a PDF file.'); return; }
    processPdf(f);
  }, [processPdf]);

  // ─── Update a review item ───
  const updateItem = (id, field, value) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));
  };
  const toggleSelect = (id) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, selected: !it.selected } : it));
  };
  const toggleAll = () => {
    const allSelected = items.every(it => it.selected);
    setItems(prev => prev.map(it => ({ ...it, selected: !allSelected })));
  };

  // ─── Import selected ───
  const handleImport = useCallback(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const selected = items
      .filter(it => it.selected && it.amount > 0)
      .map(({ description, amount, type, categoryId }) => ({
        description, amount: parseFloat(amount), type, categoryId,
        date: todayStr,
        note: 'Imported from bank statement PDF',
      }));

    if (selected.length === 0) { setError('Select at least one transaction to import.'); return; }
    importTransactions(selected);
    setStep('done');
  }, [items, importTransactions]);

  const reset = () => { setStep('upload'); setFile(null); setItems([]); setError(''); };

  const selectedCount = items.filter(i => i.selected).length;
  const expenseCats   = categories.filter(c => c.type === 'expense');
  const incomeCats    = categories.filter(c => c.type === 'income');

  // ══════════════════ RENDER ══════════════════
  return (
    <div>
      <div className="section-title">📅 Today's Import</div>

      {/* Date banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(168,85,247,0.12))',
        border: '1px solid rgba(99,102,241,0.3)',
        borderRadius: 'var(--radius)', padding: '14px 20px',
        marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 26 }}>🗓️</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Importing for: {today}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Upload your bank statement PDF — transactions dated today will be extracted automatically
          </div>
        </div>
      </div>

      {/* ── STEP 1: Upload ── */}
      {step === 'upload' && (
        <div>
          <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFilePick(f); e.target.value = ''; }} />

          <div
            className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFilePick(f); }}
            style={{ marginBottom: 16 }}
          >
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div className="spinner animate-spin" style={{ width: 36, height: 36 }} />
                <div style={{ fontWeight: 600 }}>Extracting transactions from PDF…</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Reading rows & matching today's date</div>
              </div>
            ) : (
              <>
                <div className="drop-zone-icon">📄</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Drop your bank statement PDF</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  No AI needed · Processed entirely in your browser · Data never leaves your device
                </div>
                <button type="button" className="btn btn-primary"
                  onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>
                  📁 Browse PDF
                </button>
              </>
            )}
          </div>

          {error && (
            <div className="alert alert-error" style={{ whiteSpace: 'pre-wrap', marginBottom: 12 }}>{error}</div>
          )}

          {/* How it works */}
          <div className="card">
            <div className="card-header"><span className="card-title">ℹ️ How It Works</span></div>
            <div className="card-body" style={{ paddingTop: 8 }}>
              {[
                ['📄', 'Upload PDF', 'Your bank statement from any Indian bank (SBI, HDFC, ICICI, Axis, etc.)'],
                ['🔍', 'Auto-Detect', 'Finds all transaction rows matching today\'s date in any format'],
                ['✏️', 'Review & Edit', 'Preview extracted transactions, fix descriptions, amounts or categories'],
                ['✅', 'Import', 'Selected transactions are added to your Dashboard instantly'],
              ].map(([icon, title, desc]) => (
                <div key={title} style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 20, marginTop: 1 }}>{icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{desc}</div>
                  </div>
                </div>
              ))}
              <div className="alert alert-info" style={{ marginTop: 4 }}>
                💡 <strong>Tip:</strong> Works best with <strong>text-based PDFs</strong> (downloaded from bank website).
                Scanned/image PDFs won't work — download as CSV instead.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: Review ── */}
      {step === 'review' && (
        <div>
          {/* Summary bar */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '14px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 10, marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>📋</span>
              <div>
                <div style={{ fontWeight: 700 }}>
                  Found {items.length} transaction{items.length !== 1 ? 's' : ''} for today
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {file?.name} · Review & select before importing
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={reset}>↩ Re-upload</button>
              <button className="btn btn-primary" onClick={handleImport}
                disabled={selectedCount === 0}>
                ✅ Import {selectedCount > 0 ? `${selectedCount} Selected` : ''}
              </button>
            </div>
          </div>

          {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

          {/* Table */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header" style={{ padding: '12px 16px' }}>
              <span className="card-title">Transaction Preview</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={items.every(i => i.selected)}
                  onChange={toggleAll} style={{ accentColor: 'var(--accent)' }} />
                Select All
              </label>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['', 'Description', 'Amount', 'Type', 'Category'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const cats = item.type === 'income' ? incomeCats : expenseCats;
                    return (
                      <tr key={item.id} style={{
                        borderBottom: '1px solid var(--border)',
                        background: item.selected ? 'transparent' : 'rgba(0,0,0,0.15)',
                        opacity: item.selected ? 1 : 0.5,
                        transition: 'all 0.2s',
                      }}>
                        {/* Checkbox */}
                        <td style={{ padding: '10px 12px' }}>
                          <input type="checkbox" checked={item.selected}
                            onChange={() => toggleSelect(item.id)}
                            style={{ accentColor: 'var(--accent)', width: 16, height: 16, cursor: 'pointer' }} />
                        </td>

                        {/* Description */}
                        <td style={{ padding: '10px 12px', minWidth: 180 }}>
                          <input
                            className="form-input"
                            style={{ fontSize: 13, padding: '6px 10px', minWidth: 160 }}
                            value={item.description}
                            onChange={e => updateItem(item.id, 'description', e.target.value)}
                          />
                        </td>

                        {/* Amount */}
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          <input
                            type="number" min="0" step="0.01"
                            className="form-input"
                            style={{ fontSize: 13, padding: '6px 10px', width: 110 }}
                            value={item.amount}
                            onChange={e => updateItem(item.id, 'amount', e.target.value)}
                          />
                        </td>

                        {/* Type toggle */}
                        <td style={{ padding: '10px 12px' }}>
                          <div className="type-toggle" style={{ minWidth: 140 }}>
                            <button type="button"
                              className={`type-btn expense ${item.type === 'expense' ? 'active' : ''}`}
                              onClick={() => {
                                updateItem(item.id, 'type', 'expense');
                                updateItem(item.id, 'categoryId', autoCategory(item.description, 'expense'));
                              }}>
                              Expense
                            </button>
                            <button type="button"
                              className={`type-btn income ${item.type === 'income' ? 'active' : ''}`}
                              onClick={() => {
                                updateItem(item.id, 'type', 'income');
                                updateItem(item.id, 'categoryId', autoCategory(item.description, 'income'));
                              }}>
                              Income
                            </button>
                          </div>
                        </td>

                        {/* Category */}
                        <td style={{ padding: '10px 12px' }}>
                          <select
                            className="form-select"
                            style={{ fontSize: 13, padding: '6px 10px', minWidth: 150 }}
                            value={item.categoryId}
                            onChange={e => updateItem(item.id, 'categoryId', e.target.value)}
                          >
                            {cats.map(c => (
                              <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Raw lines info */}
          <div className="alert alert-info" style={{ fontSize: 12 }}>
            💡 The descriptions are auto-extracted from the PDF. Edit any field above before importing.
            Categories are auto-detected from keywords (UPI, Swiggy, Salary, etc.)
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={reset}>↩ Re-upload</button>
            <button className="btn btn-primary" onClick={handleImport}
              disabled={selectedCount === 0} style={{ minWidth: 180 }}>
              ✅ Import {selectedCount} Transaction{selectedCount !== 1 ? 's' : ''} to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Done ── */}
      {step === 'done' && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
            Import Successful!
          </div>
          <div style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: 15 }}>
            {selectedCount} transaction{selectedCount !== 1 ? 's' : ''} from today have been added to your dashboard.
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={reset}>📄 Import Another PDF</button>
            <button className="btn btn-primary" onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'Dashboard' }))}>
              📊 View Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

