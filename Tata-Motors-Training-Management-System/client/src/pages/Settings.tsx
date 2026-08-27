import React, { useState } from 'react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { PROGRAM_CATEGORIES, CATEGORY_DEFINITIONS } from '../constants';

export default function Settings() {
  const { user, updateSession } = useAuth();

  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSaveAccount(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!currentPassword) {
      setMessage({ type: 'error', text: 'Enter your current password to make changes.' });
      return;
    }
    if (!newUsername || !newUsername.trim()) {
      setMessage({ type: 'error', text: 'Username cannot be empty.' });
      return;
    }
    if ((newPassword || confirmPassword) && newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    setSaving(true);
    try {
      const res = await api.put('/auth/account', {
        currentPassword,
        newUsername: newUsername.trim(),
        newPassword: newPassword || undefined,
        confirmPassword: confirmPassword || undefined,
      });
      updateSession(res.data.user);
      setNewUsername(res.data.user.username);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage({ type: 'success', text: res.data.message || 'Account updated successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.error || 'Failed to update account.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout title="Settings / Admin">
      <div className="panel">
        <div className="panel-header">Account</div>
        <div className="panel-body">
          <p><strong>Username:</strong> {user?.username}</p>
          <p><strong>Full Name:</strong> {user?.fullName}</p>
          <p><strong>Role:</strong> {user?.role}</p>

          <form onSubmit={handleSaveAccount} style={{ marginTop: 16, maxWidth: 420 }}>
            <div className="form-grid-2">
              <div className="field-row">
                <label>Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Username"
                />
              </div>
              <div className="field-row">
                <label>Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Required to save any change"
                />
              </div>
              <div className="field-row">
                <label>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave blank to keep current password"
                />
              </div>
              <div className="field-row">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                />
              </div>
            </div>
            <button className="btn btn-primary" type="submit" style={{ marginTop: 12 }} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            {message && (
              <p style={{ marginTop: 10, fontSize: 12.8, color: message.type === 'success' ? 'var(--color-green)' : 'var(--color-danger)' }}>
                {message.text}
              </p>
            )}
          </form>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">Program Categories</div>
        <div className="panel-body">
          <div className="tag-list">
            {PROGRAM_CATEGORIES.map((c) => (
              <span key={c} className="tag">{c}{CATEGORY_DEFINITIONS[c] ? ` — ${CATEGORY_DEFINITIONS[c]}` : ''}</span>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10 }}>
            New categories can be added by entering a new value in the Category field when creating a program.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">Security &amp; Deployment Notice</div>
        <div className="panel-body" style={{ fontSize: 12.8, lineHeight: 1.6 }}>
          <p>
            Running this application on localhost or an internal company network does <strong>not</strong>{' '}
            automatically make it secure. For production/internal deployment, IT should additionally implement:
          </p>
          <ul>
            <li>Corporate SSO / Active Directory integration for authentication</li>
            <li>HTTPS (TLS) for all traffic, including within the internal network</li>
            <li>Antivirus / malware scanning of all uploaded files</li>
            <li>Centralized audit logging and log retention</li>
            <li>Scheduled SQLite database backups</li>
            <li>IT-approved network segmentation and access controls</li>
          </ul>
        </div>
      </div>
    </AppLayout>
  );
}
