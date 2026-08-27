import React, { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Modal from '../components/Modal';
import StatusPill from '../components/StatusPill';
import { api } from '../api/client';
import { PROGRAM_CATEGORIES, PROGRAM_STATUSES, CATEGORY_DEFINITIONS } from '../constants';

const emptyForm = {
  code: '', name: '', category: PROGRAM_CATEGORIES[0], description: '',
  status: 'Planned', startDate: '', endDate: '',
};

export default function Programs() {
  const [programs, setPrograms] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewProgram, setViewProgram] = useState<any | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, [statusFilter, categoryFilter]);

  async function load() {
    const res = await api.get('/programs', {
      params: { q: q || undefined, status: statusFilter || undefined, category: categoryFilter || undefined },
    });
    setPrograms(res.data);
  }

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setError('');
    setModalOpen(true);
  }

  function openEdit(p: any) {
    setForm({
      code: p.code, name: p.name, category: p.category, description: p.description || '',
      status: p.status, startDate: p.startDate?.slice(0, 10), endDate: p.endDate?.slice(0, 10),
    });
    setEditingId(p.id);
    setError('');
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        await api.put(`/programs/${editingId}`, form);
      } else {
        await api.post('/programs', form);
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save program.');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this program? This cannot be undone.')) return;
    await api.delete(`/programs/${id}`);
    load();
  }

  async function handleView(id: number) {
    const res = await api.get(`/programs/${id}`);
    setViewProgram(res.data);
  }

  return (
    <AppLayout title="Programs">
      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Search programs..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {PROGRAM_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {PROGRAM_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="btn" onClick={load}>Filter</button>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={openCreate}>+ New Program</button>
      </div>

      <div className="panel">
        <div className="panel-body">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th><th>Name</th><th>Category</th><th>Status</th><th>Start</th><th>End</th><th>Sessions</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {programs.length === 0 && <tr><td colSpan={8} className="empty-state">No programs found.</td></tr>}
              {programs.map((p) => (
                <tr key={p.id}>
                  <td>{p.code}</td>
                  <td>{p.name}</td>
                  <td>{p.category}</td>
                  <td><StatusPill status={p.status} /></td>
                  <td>{p.startDate?.slice(0, 10)}</td>
                  <td>{p.endDate?.slice(0, 10)}</td>
                  <td>{p._count?.sessions ?? p.sessions?.length ?? 0}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => handleView(p.id)}>View</button>{' '}
                    <button className="btn btn-sm" onClick={() => openEdit(p)}>Edit</button>{' '}
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <Modal
          title={editingId ? 'Edit Program' : 'New Program'}
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <button className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit as any}>Save Program</button>
            </>
          }
        >
          {error && <div className="login-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-grid-2">
              <div className="field-row">
                <label>Program Code</label>
                <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
              </div>
              <div className="field-row">
                <label>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {PROGRAM_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="field-row">
              <label>Program Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field-row">
              <label>Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {PROGRAM_CATEGORIES.map((c) => <option key={c} value={c}>{c}{CATEGORY_DEFINITIONS[c] ? ` — ${CATEGORY_DEFINITIONS[c]}` : ''}</option>)}
              </select>
            </div>
            <div className="field-row">
              <label>Description</label>
              <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-grid-2">
              <div className="field-row">
                <label>Start Date</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
              </div>
              <div className="field-row">
                <label>End Date</label>
                <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
              </div>
            </div>
          </form>
        </Modal>
      )}

      {viewProgram && (
        <Modal title={`Program: ${viewProgram.code}`} onClose={() => setViewProgram(null)}>
          <p><strong>{viewProgram.name}</strong></p>
          <p style={{ color: 'var(--text-secondary)' }}>{viewProgram.description || 'No description provided.'}</p>
          <div className="tag-list">
            <span className="tag">{viewProgram.category}</span>
            <StatusPill status={viewProgram.status} />
          </div>
          <p style={{ marginTop: 10 }}>
            {viewProgram.startDate?.slice(0, 10)} → {viewProgram.endDate?.slice(0, 10)}
          </p>
          <strong style={{ fontSize: 12 }}>Sessions ({viewProgram.sessions?.length || 0})</strong>
          <table className="data-table" style={{ marginTop: 6 }}>
            <thead><tr><th>Date</th><th>Topic</th><th>Faculty</th><th>Status</th></tr></thead>
            <tbody>
              {(viewProgram.sessions || []).map((s: any) => (
                <tr key={s.id}>
                  <td>{s.date?.slice(0, 10)}</td>
                  <td>{s.trainingTopic}</td>
                  <td>{s.faculty?.name || '—'}</td>
                  <td><StatusPill status={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </AppLayout>
  );
}
