import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function TopHeader({ title }: { title: string }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <header className="top-header">
      <div className="page-title">{title}</div>
      <div className="user-chip">
        <span>{user?.fullName}</span>
        <span className="role-pill">{user?.role}</span>
        <button className="logout-btn" onClick={handleLogout}>Logout</button>
      </div>
    </header>
  );
}
