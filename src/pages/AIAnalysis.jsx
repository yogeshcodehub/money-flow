import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency, getCurrentMonth } from '../utils/constants';
import Papa from 'papaparse';

// Gemini endpoints
const GEMINI_FLASH = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Convert file to base64 string (no heavy libraries needed)
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // result is "data:application/pdf;base64,XXXX" — strip the prefix
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// Truncate long strings so we don't hit token limits
function truncate(str, max = 7000) {
  return str.length > max ? str.slice(0, max) + '\n...[truncated for length]' : str;
}

export default function AIAnalysis() {
  const { settings, transactions, categories, importTransactions, getMonthStats } = useApp();

  // File state
  const [file, setFile] = useState(null);
  const [fileType, setFileType] = useState(''); // 'csv' | 'pdf'
  const [csvData, setCsvData] = useState(null);
  const [pdfBase64, setPdfBase64] = useState('');

  // UI state
  const [activeTab, setActiveTab] = useState('upload');
  const [aiResult, setAiResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [parseLoading, setParseLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [imported, setImported] = useState(false);
  const [importCount, setImportCount] = useState(0);

  // Chat state
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState([]);

  const fileRef = useRef(null);
  const chatEndRef = useRef(null);
  const fmt = (n) => formatCurrency(n, settings.currency);
  const apiKey = settings.geminiApiKey;

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, loading]);

  // ─── Reset ───
  const resetAll = useCallback(() => {
    setFile(null);
    setFileType('');
    setCsvData(null);
    setPdfBase64('');
    setAiResult('');
    setError('');
    setImported(false);
    setImportCount(0);
    // Reset the actual file input
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  // ─── Handle file selection ───
  const handleFile = useCallback(async (f) => {
    if (!f) return;
    resetAll();
    const ext = f.name.split('.').pop().toLowerCase();

    if (ext !== 'csv' && ext !== 'pdf') {
      setError('❌ Unsupported file. Please upload a .csv or .pdf bank statement.');
      return;
    }

    setFile(f);
    setFileType(ext);
    setParseLoading(true);
    setError('');

    try {
      if (ext === 'csv') {
        // Lightweight CSV parsing — no freeze
        Papa.parse(f, {
          header: true,
          skipEmptyLines: true,
          complete: (res) => {
            if (!res.data.length) {
              setError('CSV appears to be empty or could not be parsed.');
            } else {
              setCsvData(res.data);
            }
            setParseLoading(false);
          },
          error: (err) => {
            setError('Failed to read CSV: ' + err.message);
            setParseLoading(false);
          },
        });
      } else {
        // PDF → base64 via FileReader (fast, no external lib, no freeze)
        const b64 = await fileToBase64(f);
        setPdfBase64(b64);
        setParseLoading(false);
      }
    } catch (err) {
      setError('Failed to read file: ' + err.message);
      setParseLoading(false);
    }
  }, [resetAll]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) handleFile(dropped);
  }, [handleFile]);

  // ─── Call Gemini API ───
  const callGemini = useCallback(async (parts) => {
    if (!apiKey) throw new Error('No Gemini API key. Go to Settings → AI Configuration to add your free key.');

    const res = await fetch(`${GEMINI_FLASH}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const msg = errJson?.error?.message || `API Error ${res.status}`;
      throw new Error(msg);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI.';
  }, [apiKey]);

  // ─── Analyze uploaded statement ───
  const analyzeStatement = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setAiResult('');

    const analysisPrompt = `You are a smart personal finance assistant. Analyze this bank statement and provide a structured report:

1. 📊 **Summary** — Total credits (income), total debits (expenses), net balance
2. 🏷️ **Category Breakdown** — Group transactions: Food, Transport, Shopping, Entertainment, Bills/Utilities, Salary/Income, etc. with approximate totals
3. 💡 **Top 3 Spending Insights** — What stands out about the spending patterns?
4. 🎯 **3 Actionable Money-Saving Tips** — Specific advice based on this data
5. ⚠️ **Flagged Items** — Unusual charges, high-value transactions, suspicious recurring fees

Format with clear emoji section headers. Be specific with numbers. Keep it concise but insightful.`;

    try {
      let parts;

      if (fileType === 'pdf') {
        // Send PDF directly to Gemini — it reads PDFs natively! No heavy library needed.
        parts = [
          {
            inline_data: {
              mime_type: 'application/pdf',
              data: pdfBase64,
            },
          },
          { text: analysisPrompt },
        ];
      } else {
        // Build CSV text context
        const cols = Object.keys(csvData[0] || {}).join(', ');
        const rows = csvData
          .slice(0, 80)
          .map((row) => Object.values(row).join(' | '))
          .join('\n');
        const context = `Bank Statement CSV (${csvData.length} rows)\nColumns: ${cols}\n\nData:\n${truncate(rows)}`;

        parts = [{ text: `${analysisPrompt}\n\n${context}` }];
      }

      const result = await callGemini(parts);
      setAiResult(result);
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  }, [file, fileType, pdfBase64, csvData, callGemini]);

  // ─── Import CSV to app ───
  const importCsvToApp = useCallback(() => {
    if (!csvData) return;
    const mapped = csvData
      .map((row) => {
        const credit = parseFloat(row.Credit || row.credit || row['Credit Amount'] || 0) || 0;
        const debit = parseFloat(row.Debit || row.debit || row['Debit Amount'] || 0) || 0;
        const rawAmt = parseFloat(row.Amount || row.amount || 0) || 0;
        const amount = credit || debit || Math.abs(rawAmt);
        const type = credit > 0 && debit === 0 ? 'income' : 'expense';
        return {
          description:
            row.Description || row.Narration || row.Particulars ||
            row.Details || row.description || 'Imported',
          amount,
          type,
          date:
            row.Date || row.date || row['Value Date'] ||
            row['Transaction Date'] || new Date().toISOString().split('T')[0],
          categoryId: type === 'income' ? 'other_income' : 'other_expense',
          note: 'Imported from bank statement',
        };
      })
      .filter((r) => r.amount > 0);

    importTransactions(mapped);
    setImported(true);
    setImportCount(mapped.length);
  }, [csvData, importTransactions]);

  // ─── AI Chat about own finances ───
  const askQuestion = useCallback(async () => {
    const q = question.trim();
    if (!q || loading) return;
    setQuestion('');
    setLoading(true);
    setError('');

    const stats = getMonthStats(getCurrentMonth());
    const recent = transactions.slice(0, 40);
    const context = `User's financial data this month:
- Income: ${fmt(stats.income)}, Expenses: ${fmt(stats.expense)}, Balance: ${fmt(stats.balance)}
- Savings rate: ${stats.income > 0 ? Math.round((stats.balance / stats.income) * 100) : 0}%
Recent ${recent.length} transactions:
${recent.map((t) => {
  const cat = categories.find((c) => c.id === t.categoryId);
  return `• ${t.description} (${cat?.name || 'Other'}): ${t.type === 'income' ? '+' : '-'}${fmt(t.amount)}`;
}).join('\n')}`;

    const prompt = `You are a smart personal finance assistant. Answer the user's question based on their data.

${context}

User question: "${q}"

Answer helpfully, specifically, and concisely. Use emojis and numbers where relevant.`;

    try {
      const answer = await callGemini([{ text: prompt }]);
      setChatHistory((prev) => [...prev, { q, a: answer }]);
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  }, [question, loading, transactions, categories, getMonthStats, fmt, callGemini]);

  const hasContent = fileType === 'csv' ? csvData !== null : pdfBase64 !== '';

  // ─── Render ───
  return (
    <div>
      <div className="section-title">🤖 AI Analysis</div>

      {/* API Key Warning */}
      {!apiKey && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          ⚠️ No Gemini API key configured. Go to{' '}
          <strong style={{ cursor: 'pointer', textDecoration: 'underline' }}>Settings → AI Configuration</strong>
          {' '}to add your free key from{' '}
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--orange)' }}>
            aistudio.google.com
          </a>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[{ id: 'upload', label: '📁 Statement Analysis' }, { id: 'ask', label: '💬 Ask AI' }].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="btn"
            style={{
              background: activeTab === tab.id
                ? 'linear-gradient(135deg, var(--accent), var(--purple))'
                : 'var(--bg-card)',
              color: activeTab === tab.id ? 'white' : 'var(--text-secondary)',
              border: activeTab === tab.id ? 'none' : '1px solid var(--border)',
              boxShadow: activeTab === tab.id ? '0 4px 12px var(--accent-glow)' : 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════ UPLOAD TAB ══════════════ */}
      {activeTab === 'upload' && (
        <div>
          {/* Hidden file input */}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.pdf"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              // Always reset value so same file can be re-selected
              e.target.value = '';
            }}
          />

          {/* Drop Zone */}
          <div
            className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{ marginBottom: 16 }}
          >
            {!file ? (
              <>
                <div className="drop-zone-icon">📂</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
                  Drop your bank statement here
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Supports <strong>.CSV</strong> and <strong>.PDF</strong> · Any bank format
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                >
                  📁 Browse File
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 44 }}>{fileType === 'pdf' ? '📄' : '📊'}</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{file.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {(file.size / 1024).toFixed(1)} KB · {fileType.toUpperCase()}
                </div>

                {parseLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
                    <div className="spinner animate-spin" />
                    {fileType === 'pdf' ? 'Reading PDF...' : 'Parsing CSV...'}
                  </div>
                ) : hasContent ? (
                  <div style={{ color: 'var(--green)', fontWeight: 600, fontSize: 13 }}>
                    ✅ {fileType === 'pdf'
                      ? 'PDF ready — Gemini will read it directly'
                      : `${csvData.length} rows detected`}
                  </div>
                ) : null}

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => { e.stopPropagation(); resetAll(); }}
                >
                  ✕ Remove & upload different file
                </button>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>
          )}

          {/* Action buttons */}
          {hasContent && !parseLoading && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              {fileType === 'csv' && (
                <button
                  className="btn btn-secondary"
                  onClick={importCsvToApp}
                  disabled={imported}
                >
                  {imported ? `✅ ${importCount} transactions imported!` : '↓ Import Transactions to App'}
                </button>
              )}
              <button
                className="btn btn-primary"
                onClick={analyzeStatement}
                disabled={loading || !apiKey}
                style={{ flex: 1, minWidth: 200 }}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <div className="spinner animate-spin" />
                    Gemini is analyzing your statement...
                  </span>
                ) : (
                  '🤖 Analyze with Gemini AI'
                )}
              </button>
            </div>
          )}

          {/* CSV Preview */}
          {fileType === 'csv' && csvData && !parseLoading && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <span className="card-title">📋 CSV Preview</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{csvData.length} rows</span>
              </div>
              <div style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-wrap" style={{ maxHeight: 200 }}>
                  <table>
                    <thead>
                      <tr>
                        {Object.keys(csvData[0] || {}).slice(0, 6).map((k) => (
                          <th key={k}>{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.slice(0, 6).map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).slice(0, 6).map((v, j) => (
                            <td key={j}>{String(v).slice(0, 28)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PDF info box */}
          {fileType === 'pdf' && pdfBase64 && !parseLoading && (
            <div className="alert alert-info" style={{ marginBottom: 16 }}>
              🤖 Your PDF is ready. Gemini AI will read it <strong>directly</strong> — no text extraction needed!
              Click <strong>"Analyze with Gemini AI"</strong> above to get your insights.
            </div>
          )}

          {/* AI Result */}
          {aiResult && (
            <div className="ai-panel">
              <div className="ai-header" style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 22 }}>🤖</span>
                <span style={{ fontWeight: 700, fontSize: 16 }}>AI Insights</span>
                <span className="ai-badge">Gemini Flash</span>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => navigator.clipboard?.writeText(aiResult).catch(() => {})}
                  title="Copy to clipboard"
                >
                  📋 Copy
                </button>
              </div>
              <div className="ai-response" style={{ lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>
                {aiResult}
              </div>
            </div>
          )}

          {/* Help note */}
          <div style={{ marginTop: 20 }}>
            <div className="alert alert-info">
              💡 <strong>Tip:</strong> Download your statement from your bank's website/app as CSV or PDF.
              For PDFs, text-based PDFs work best. Image-scanned PDFs may not work.
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ ASK AI TAB ══════════════ */}
      {activeTab === 'ask' && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
            {chatHistory.length === 0 && !loading && (
              <div className="ai-panel">
                <div className="ai-header" style={{ marginBottom: 14 }}>
                  <span style={{ fontSize: 28 }}>🤖</span>
                  <div>
                    <div style={{ fontWeight: 700 }}>Hi! I'm your FinFlow AI Assistant</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      Ask me anything about your finances
                    </div>
                  </div>
                  <span className="ai-badge" style={{ marginLeft: 'auto' }}>Gemini Flash</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    'How much did I spend this month?',
                    'What are my top expense categories?',
                    'How can I reduce my expenses?',
                    'What is my savings rate?',
                    'Give me a financial health summary',
                  ].map((q) => (
                    <button key={q} className="filter-chip" onClick={() => setQuestion(q)}>{q}</button>
                  ))}
                </div>
              </div>
            )}

            {chatHistory.map((item, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, var(--accent), var(--purple))',
                    color: 'white', padding: '10px 16px',
                    borderRadius: '14px 14px 4px 14px',
                    maxWidth: '80%', fontSize: 14, lineHeight: 1.5,
                  }}>
                    {item.q}
                  </div>
                </div>
                <div className="ai-panel">
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>🤖 Gemini</div>
                  <div className="ai-response" style={{ background: 'transparent', border: 'none', padding: 0, lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>
                    {item.a}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="ai-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)' }}>
                  <div className="spinner animate-spin" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <input
              className="form-input"
              placeholder="Ask anything about your finances... (Enter to send)"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !loading) askQuestion();
              }}
              disabled={loading}
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-primary"
              onClick={askQuestion}
              disabled={loading || !question.trim()}
              style={{ minWidth: 90 }}
            >
              {loading
                ? <div className="spinner animate-spin" style={{ margin: 'auto' }} />
                : 'Send →'}
            </button>
          </div>

          {chatHistory.length > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 10 }}
              onClick={() => setChatHistory([])}
            >
              🗑️ Clear chat
            </button>
          )}
        </div>
      )}
    </div>
  );
}
