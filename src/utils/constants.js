// Default categories with emoji icons
export const DEFAULT_CATEGORIES = [
  // Expense categories
  { id: 'food', name: 'Food & Dining', emoji: '🍔', type: 'expense', color: '#f59e0b' },
  { id: 'transport', name: 'Transport', emoji: '🚗', type: 'expense', color: '#3b82f6' },
  { id: 'shopping', name: 'Shopping', emoji: '🛍️', type: 'expense', color: '#ec4899' },
  { id: 'rent', name: 'Rent', emoji: '🏠', type: 'expense', color: '#ef4444' },
  { id: 'utilities', name: 'Utilities', emoji: '💡', type: 'expense', color: '#f97316' },
  { id: 'health', name: 'Healthcare', emoji: '🏥', type: 'expense', color: '#10b981' },
  { id: 'entertainment', name: 'Entertainment', emoji: '🎬', type: 'expense', color: '#a855f7' },
  { id: 'education', name: 'Education', emoji: '📚', type: 'expense', color: '#6366f1' },
  { id: 'travel', name: 'Travel', emoji: '✈️', type: 'expense', color: '#06b6d4' },
  { id: 'subscriptions', name: 'Subscriptions', emoji: '📱', type: 'expense', color: '#8b5cf6' },
  { id: 'insurance', name: 'Insurance', emoji: '🛡️', type: 'expense', color: '#64748b' },
  { id: 'other_expense', name: 'Other', emoji: '📦', type: 'expense', color: '#94a3b8' },
  // Income categories
  { id: 'salary', name: 'Salary', emoji: '💰', type: 'income', color: '#10b981' },
  { id: 'freelance', name: 'Freelance', emoji: '💻', type: 'income', color: '#06b6d4' },
  { id: 'investment', name: 'Investment', emoji: '📈', type: 'income', color: '#6366f1' },
  { id: 'gift', name: 'Gift', emoji: '🎁', type: 'income', color: '#ec4899' },
  { id: 'rental', name: 'Rental Income', emoji: '🏘️', type: 'income', color: '#f59e0b' },
  { id: 'other_income', name: 'Other Income', emoji: '💵', type: 'income', color: '#94a3b8' },
];

export const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
];

export function formatCurrency(amount, currency = 'INR') {
  const c = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];
  return `${c.symbol}${Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatShortDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function getMonthYear(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-');
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getColorForPercent(percent) {
  if (percent >= 100) return '#ef4444';
  if (percent >= 80) return '#f59e0b';
  return '#10b981';
}
