import React, { useEffect, useRef, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Modal from '../components/Modal';
import { api } from '../api/client';

export default function Faculty() {
  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<any>({ facultyCode: '', name: '', department: '', grade: '', status: 'Active', attendance: 'Present' });
  const [importResult, setImportResult] = useState<any | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Search updates dynamically while typing (debounced) rather than
  // requiring Enter/click, so it stays responsive even with a large
  // faculty list — the actual filtering happens server-side (see
  // GET /faculty?q=... in server/src/routes/faculty.js), so the client
  // never has to hold/filter the entire list in memory. This also covers
  // the initial load (runs once on mount with q === '').
  useEffect(() => {
    const timer = setTimeout(() => { load(); }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function load() {
    const res = await api.get('/faculty', { params: { q: q || undefined } });
    setList(res.data);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await api.post('/faculty', form);
    setModalOpen(false);
    setForm({ facultyCode: '', name: '', department: '', grade: '', status: 'Active', attendance: 'Present' });
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm('Remove this faculty record?')) return;
    await api.delete(`/faculty/${id}`);
    load();
  }

  async function handleDeleteAll() {
    // Deletes every faculty record in the system, not just what's currently
    // visible under an active search filter, so the confirmation is
    // explicit about that regardless of the current search state.
    if (!confirm('Are you sure you want to delete all faculty records? This will remove every faculty member in the system, including any not shown by your current search. This action cannot be undone.')) return;
    setDeletingAll(true);
    try {
      await api.delete('/faculty');
      setQ('');
      await load();
    } finally {
      setDeletingAll(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    const res = await api.post('/faculty/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    setImportResult(res.data);
    if (fileRef.current) fileRef.current.value = '';
    load();
  }

  return (
    <AppLayout title="Faculty Management">
      <div className="toolbar">
        <input
          className="search-input"
          style={{ minWidth: 280 }}
          placeholder="Search by Faculty ID, name, department, grade..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          autoFocus
        />
        <button className="btn" onClick={load}>Search</button>
        <label className="btn" style={{ marginLeft: 'auto' }}>
          Import Excel/CSV
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImport} />
        </label>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ Add Faculty</button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={handleDeleteAll}
          disabled={deletingAll}
          title="Delete every faculty record at once"
        >
          {deletingAll ? 'Deleting All...' : 'Delete All Faculty'}
        </button>
      </div>

      {importResult && (
        <div className="panel">
          <div className="panel-header">Import Result</div>
          <div className="panel-body" style={{ fontSize: 12.5 }}>
            <div>Detected columns: {importResult.detectedColumns?.join(', ') || 'none'}</div>
            <div>Rows read: {importResult.rowCount} · Created: {importResult.created} · Updated: {importResult.updated}</div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-body">
          <table className="data-table">
            <thead><tr><th>Faculty ID</th><th>Name</th><th>Department</th><th>Grade</th><th>Attendance</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={7} className="empty-state">No faculty records found.</td></tr>}
              {list.map((f) => (
                <tr key={f.id}>
                  <td>{f.facultyCode}</td><td>{f.name}</td><td>{f.department}</td><td>{f.grade}</td>
                  <td>{f.attendance}</td><td>{f.status}</td>
                  <td><button className="btn btn-sm btn-danger" onClick={() => handleDelete(f.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <Modal title="Add Faculty" onClose={() => setModalOpen(false)}
          footer={<button className="btn btn-primary" onClick={handleCreate as any}>Save</button>}>
          <form onSubmit={handleCreate}>
            <div className="field-row"><label>Faculty ID</label><input value={form.facultyCode} onChange={(e) => setForm({ ...form, facultyCode: e.target.value })} required /></div>
            <div className="field-row"><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="form-grid-2">
              <div className="field-row"><label>Department</label><input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
              <div className="field-row"><label>Grade</label><input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} /></div>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
