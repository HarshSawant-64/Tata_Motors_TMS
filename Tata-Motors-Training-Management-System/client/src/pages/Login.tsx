import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/tata-motors-logo.png';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Login failed. Please check your credentials.');
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card-header">
          <img src={logo} alt="Tata Motors" className="brand-logo" />
          <div>
            <div className="company">Tata Motors</div>
            <div className="title">Training Management Portal</div>
          </div>
        </div>
        <div className="login-card-body">
          {error && <div className="login-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="field-row">
              <label>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="field-row">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Signing in...' : 'Login'}
            </button>
          </form>
          <div className="login-hint">Demo credentials: admin / admin123 (Admin) &nbsp;|&nbsp; hr / hr123 (HR)</div>
        </div>
      </div>
    </div>
  );
}
