import React from 'react';
import { NavLink } from 'react-router-dom';
import logo from '../assets/tata-motors-logo.png';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '\u25A6' },
  { to: '/programs', label: 'Programs', icon: '\u25A4' },
  { to: '/scheduling', label: 'Scheduling', icon: '\u25A3' },
  { to: '/faculty', label: 'Faculty', icon: '\u25A5' },
  { to: '/employees', label: 'Employees', icon: '\u25A7' },
  { to: '/analytics', label: 'Analytics', icon: '\u25A8' },
  { to: '/uploads', label: 'Uploads', icon: '\u25A9' },
  { to: '/settings', label: 'Settings / Admin', icon: '\u25AA' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src={logo} alt="Tata Motors" className="brand-logo" />
        <div className="brand-text">
          <div className="company">Tata Motors</div>
          <div className="title">Training Management Portal</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
