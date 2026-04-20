import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DEFAULT_CATEGORIES, generateId, getCurrentMonth, getMonthYear } from '../utils/constants';

const AppContext = createContext(null);

const STORAGE_KEYS = {
  TRANSACTIONS: 'finflow_transactions',
  BUDGETS: 'finflow_budgets',
  CATEGORIES: 'finflow_categories',
  SETTINGS: 'finflow_settings',
  RECURRING: 'finflow_recurring',
};

function load(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch { return fallback; }
}

function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function AppProvider({ children }) {
  const [transactions, setTransactions] = useState(() => load(STORAGE_KEYS.TRANSACTIONS, []));
  const [budgets, setBudgets] = useState(() => load(STORAGE_KEYS.BUDGETS, []));
  const [categories, setCategories] = useState(() => load(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES));
  const [recurring, setRecurring] = useState(() => load(STORAGE_KEYS.RECURRING, []));
  const [settings, setSettings] = useState(() => load(STORAGE_KEYS.SETTINGS, {
    theme: 'dark',
    currency: 'INR',
    geminiApiKey: '',
    name: 'User',
  }));

  // Persist on change
  useEffect(() => { save(STORAGE_KEYS.TRANSACTIONS, transactions); }, [transactions]);
  useEffect(() => { save(STORAGE_KEYS.BUDGETS, budgets); }, [budgets]);
  useEffect(() => { save(STORAGE_KEYS.CATEGORIES, categories); }, [categories]);
  useEffect(() => { save(STORAGE_KEYS.RECURRING, recurring); }, [recurring]);
  useEffect(() => { save(STORAGE_KEYS.SETTINGS, settings); }, [settings]);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  const processRecurring = useCallback(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const currentMonth = getCurrentMonth();

    setRecurring(prev => {
      let updated = [...prev];
      let newTxs = [];

      updated = updated.map(r => {
        if (!r.active) return r;
        const lastProcessed = r.lastProcessed || '';
        const lastMonth = lastProcessed ? getMonthYear(lastProcessed) : '';
        if (lastMonth === currentMonth) return r;

        // Check if due day has passed this month
        const dueDate = new Date(today.getFullYear(), today.getMonth(), r.dayOfMonth);
        if (today >= dueDate) {
          newTxs.push({
            id: generateId(),
            description: r.description,
            amount: r.amount,
            type: r.type,
            categoryId: r.categoryId,
            date: dueDate.toISOString().split('T')[0],
            note: `Auto: ${r.description}`,
            isRecurring: true,
            recurringId: r.id,
          });
          return { ...r, lastProcessed: todayStr };
        }
        return r;
      });

      if (newTxs.length > 0) {
        setTransactions(prev => [...prev, ...newTxs]);
      }
      return updated;
    });
  }, []);

  // Process recurring transactions on mount (runs after processRecurring is defined)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { processRecurring(); }, []);

  // CRUD - Transactions
  const addTransaction = useCallback((tx) => {
    const newTx = { ...tx, id: generateId(), createdAt: new Date().toISOString() };
    setTransactions(prev => [newTx, ...prev]);
    return newTx;
  }, []);

  const updateTransaction = useCallback((id, updates) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const deleteTransaction = useCallback((id) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  }, []);

  const importTransactions = useCallback((txList) => {
    const withIds = txList.map(tx => ({ ...tx, id: generateId(), createdAt: new Date().toISOString(), imported: true }));
    setTransactions(prev => [...withIds, ...prev]);
  }, []);

  // CRUD - Budgets
  const addBudget = useCallback((budget) => {
    setBudgets(prev => [...prev, { ...budget, id: generateId() }]);
  }, []);

  const updateBudget = useCallback((id, updates) => {
    setBudgets(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  }, []);

  const deleteBudget = useCallback((id) => {
    setBudgets(prev => prev.filter(b => b.id !== id));
  }, []);

  // CRUD - Categories
  const addCategory = useCallback((cat) => {
    setCategories(prev => [...prev, { ...cat, id: generateId() }]);
  }, []);

  const deleteCategory = useCallback((id) => {
    setCategories(prev => prev.filter(c => c.id !== id));
  }, []);

  // CRUD - Recurring
  const addRecurring = useCallback((r) => {
    setRecurring(prev => [...prev, { ...r, id: generateId(), active: true, lastProcessed: null }]);
  }, []);

  const updateRecurring = useCallback((id, updates) => {
    setRecurring(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }, []);

  const deleteRecurring = useCallback((id) => {
    setRecurring(prev => prev.filter(r => r.id !== id));
  }, []);

  // Settings
  const updateSettings = useCallback((updates) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  // Analytics helpers
  const getMonthTransactions = useCallback((monthKey) => {
    return transactions.filter(t => getMonthYear(t.date) === monthKey);
  }, [transactions]);

  const getMonthStats = useCallback((monthKey) => {
    const txs = getMonthTransactions(monthKey);
    const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { income, expense, balance: income - expense, txs };
  }, [getMonthTransactions]);

  const getBudgetProgress = useCallback((monthKey) => {
    const txs = getMonthTransactions(monthKey);
    return budgets.map(b => {
      const spent = txs
        .filter(t => t.type === 'expense' && t.categoryId === b.categoryId)
        .reduce((s, t) => s + t.amount, 0);
      const percent = b.limit > 0 ? (spent / b.limit) * 100 : 0;
      return { ...b, spent, percent };
    });
  }, [budgets, getMonthTransactions]);

  const getCategoryBreakdown = useCallback((monthKey, type = 'expense') => {
    const txs = getMonthTransactions(monthKey).filter(t => t.type === type);
    const breakdown = {};
    txs.forEach(t => {
      const cat = categories.find(c => c.id === t.categoryId);
      const key = t.categoryId || 'other';
      if (!breakdown[key]) {
        breakdown[key] = { categoryId: key, name: cat?.name || 'Other', emoji: cat?.emoji || '📦', color: cat?.color || '#94a3b8', total: 0 };
      }
      breakdown[key].total += t.amount;
    });
    return Object.values(breakdown).sort((a, b) => b.total - a.total);
  }, [getMonthTransactions, categories]);

  const getMonthlyTrend = useCallback((months = 6) => {
    const result = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      const stats = getMonthStats(key);
      result.push({ month: label, income: stats.income, expense: stats.expense, balance: stats.balance });
    }
    return result;
  }, [getMonthStats]);

  return (
    <AppContext.Provider value={{
      transactions, budgets, categories, recurring, settings,
      addTransaction, updateTransaction, deleteTransaction, importTransactions,
      addBudget, updateBudget, deleteBudget,
      addCategory, deleteCategory,
      addRecurring, updateRecurring, deleteRecurring,
      updateSettings,
      getMonthTransactions, getMonthStats, getBudgetProgress,
      getCategoryBreakdown, getMonthlyTrend,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
