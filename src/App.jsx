import { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Analytics from './pages/Analytics';
import Budgets from './pages/Budgets';
import Recurring from './pages/Recurring';
import AIAnalysis from './pages/AIAnalysis';
import Settings from './pages/Settings';

const PAGE_TITLES = {
  Dashboard: { title: 'Dashboard', sub: 'Your financial overview' },
  Transactions: { title: 'Transactions', sub: 'Manage your income & expenses' },
  Analytics: { title: 'Analytics', sub: 'Visualize your spending patterns' },
  Budgets: { title: 'Budgets', sub: 'Set and track monthly limits' },
  Recurring: { title: 'Recurring', sub: 'Automatic transactions' },
  'AI Analysis': { title: 'AI Analysis', sub: 'Powered by Google Gemini' },
  Settings: { title: 'Settings', sub: 'Customize your experience' },
};

function AppInner() {
  const [page, setPage] = useState('Dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { settings, updateSettings } = useApp();
  const info = PAGE_TITLES[page];

  const renderPage = () => {
    switch (page) {
      case 'Dashboard': return <Dashboard />;
      case 'Transactions': return <Transactions />;
      case 'Analytics': return <Analytics />;
      case 'Budgets': return <Budgets />;
      case 'Recurring': return <Recurring />;
      case 'AI Analysis': return <AIAnalysis />;
      case 'Settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  const toggleTheme = () => {
    updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
  };

  return (
    <div className="app-layout">
      <Sidebar
        currentPage={page}
        onNavigate={setPage}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="main-content">
        <header className="topbar">
          {/* Mobile hamburger */}
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setSidebarOpen(true)}
            style={{ display: 'none' }}
            id="hamburger-btn"
          >
            ☰
          </button>
          <div className="topbar-title">
            {info.title}
            <span>{info.sub}</span>
          </div>
          <div className="topbar-actions">
            <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
              {settings.theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </header>
        <main className="page-content">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
