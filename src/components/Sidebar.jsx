import { useState } from 'react';
import { useApp } from '../context/AppContext';

const PAGES = ['Dashboard', 'Transactions', 'Analytics', 'Budgets', 'Recurring', 'AI Analysis', 'Settings'];

const NAV_ITEMS = [
  { label: 'Dashboard', icon: '🏠', page: 'Dashboard' },
  { label: 'Transactions', icon: '💳', page: 'Transactions' },
  { label: 'Analytics', icon: '📊', page: 'Analytics' },
  { label: 'Budgets', icon: '🎯', page: 'Budgets' },
  { label: 'Recurring', icon: '🔄', page: 'Recurring' },
  { label: 'AI Analysis', icon: '🤖', page: 'AI Analysis' },
  { label: 'Settings', icon: '⚙️', page: 'Settings' },
];

export default function Sidebar({ currentPage, onNavigate, isOpen, onClose }) {
  const { settings } = useApp();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99, backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        />
      )}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">₹</div>
          <div className="logo-text">Fin<span>Flow</span></div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-label">Navigation</div>
          {NAV_ITEMS.map(item => (
            <button
              key={item.page}
              className={`nav-item ${currentPage === item.page ? 'active' : ''}`}
              onClick={() => { onNavigate(item.page); onClose(); }}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent), var(--purple))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, color: 'white', fontSize: 14
            }}>
              {settings.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{settings.name || 'User'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{settings.currency} Account</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
