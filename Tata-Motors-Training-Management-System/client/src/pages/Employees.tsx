import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import Modal from '../components/Modal';
import { api } from '../api/client';

const PAGE_SIZE = 50;

function parseRawData(raw: any): Record<string, any> {
  if (!raw) return {};
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return {};
  }
}

export default function Employees() {
  const navigate = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  // Dynamic, Excel-driven table columns (the actual headers from the most
  // recent import), plus a visibility toggle so very wide files stay usable.
  const [columns, setColumns] = useState<string[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<any>({ employeeId: '', name: '', department: '', category: '', grade: '' });

  // Two-step import: select file -> preview (no DB writes) -> confirm -> import.
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadColumns(); }, []);
  useEffect(() => { load(); }, [page]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/employees', { params: { q: q || undefined, page, pageSize: PAGE_SIZE } });
      setList(res.data.items);
      setTotal(res.data.total);
    } finally {
      setLoading(false);
    }
  }

  async function loadColumns() {
    const res = await api.get('/employees/columns');
    setColumns(res.data.columns || []);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await api.post('/employees', form);
    setModalOpen(false);
    setForm({ employeeId: '', name: '', department: '', category: '', grade: '' });
    setPage(1);
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm('Remove this employee record?')) return;
    await api.delete(`/employees/${id}`);
    load();
  }

  async function handleDeleteAll() {
    if (total === 0) return;
    if (!confirm(`Delete ALL ${total} employee record(s)? This cannot be undone.`)) return;
    if (!confirm('Please confirm again: this will permanently remove every employee record.')) return;
    setDeletingAll(true);
    try {
      await api.delete('/employees');
      setPage(1);
      await load();
    } finally {
      setDeletingAll(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setImportResult(null);
    void runPreview(file);
  }

  async function runPreview(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const res = await api.post('/employees/import/preview', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPreviewData(res.data);
    } catch (err: any) {
      setPreviewData({ error: err?.response?.data?.error || 'Failed to preview this file.' });
    } finally {
      setPreviewLoading(false);
    }
  }

  async function confirmImport() {
    if (!selectedFile) return;
    const fd = new FormData();
    fd.append('file', selectedFile);
    setImporting(true);
    try {
      const res = await api.post('/employees/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setImportResult(res.data);
      setPreviewData(null);
      setSelectedFile(null);
      loadColumns();
      setPage(1);
      load();
    } catch (err: any) {
      setImportResult({ error: err?.response?.data?.error || 'Import failed.' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function cancelPreview() {
    setPreviewData(null);
    setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function toggleColumn(col: string) {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col); else next.add(col);
      return next;
    });
  }

  const visibleColumns = useMemo(() => columns.filter((c) => !hiddenColumns.has(c)), [columns, hiddenColumns]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function cellValue(employee: any, column: string) {
    const raw = parseRawData(employee.rawData);
    if (column in raw) return raw[column];
    // Fall back to normalized fields for records with no rawData (added manually).
    const key = column.trim().toLowerCase();
    if (key === 'employee id' && !raw['Employee ID']) return employee.employeeId;
    if (key === 'name' && !raw['Name']) return employee.name;
    if (key === 'department' && !raw['Department']) return employee.department;
    if (key === 'category' && !raw['Category']) return employee.category;
    if (key === 'grade' && !raw['Grade']) return employee.grade;
    return '';
  }

  return (
    <AppLayout title="Employee Registry">
      <form className="toolbar" onSubmit={handleSearchSubmit}>
        <input className="search-input" placeholder="Search by any employee field..." value={q}
          onChange={(e) => setQ(e.target.value)} />
        <button className="btn" type="submit">Search</button>
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <button type="button" className="btn" onClick={() => setColumnMenuOpen((v) => !v)} disabled={columns.length === 0}>
            Columns ({visibleColumns.length}/{columns.length})
          </button>
          {columnMenuOpen && (
            <div className="panel" style={{ position: 'absolute', right: 0, top: '110%', zIndex: 20, width: 260, maxHeight: 320, overflowY: 'auto', boxShadow: 'var(--shadow-md)' }}>
              <div className="panel-body" style={{ fontSize: 12.5 }}>
                {columns.map((c) => (
                  <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!hiddenColumns.has(c)} onChange={() => toggleColumn(c)} />
                    {c}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <label className="btn">
          {previewLoading ? 'Reading file...' : 'Import Excel/CSV'}
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFileSelect} disabled={previewLoading || importing} />
        </label>
        <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>+ Add Employee</button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={handleDeleteAll}
          disabled={deletingAll || total === 0}
          title="Delete every employee record at once"
        >
          {deletingAll ? 'Deleting All...' : 'Delete All Employees'}
        </button>
      </form>

      {previewData && (
        <div className="panel">
          <div className="panel-header">Excel Preview — Confirm Before Import</div>
          <div className="panel-body" style={{ fontSize: 12.5 }}>
            {previewData.error ? (
              <>
                <div style={{ color: '#c0392b' }}>{previewData.error}</div>
                <button className="btn" style={{ marginTop: 8 }} onClick={cancelPreview}>Close</button>
              </>
            ) : (
              <>
                <div>File: <strong>{previewData.fileName}</strong> · Sheet: <strong>{previewData.sheetName}</strong></div>
                <div style={{ marginTop: 4 }}>
                  Rows detected: <strong>{previewData.rowCount}</strong> · Columns detected: <strong>{previewData.columnCount}</strong>
                </div>
                <div style={{ marginTop: 4 }}>Detected columns: {previewData.columns.join(', ')}</div>
                <div style={{ marginTop: 4 }}>
                  Employee identifier column: {previewData.detectedIdentifierColumn
                    ? <strong>{previewData.detectedIdentifierColumn}</strong>
                    : <span style={{ color: '#b6862c' }}>Not confidently detected — rows without one will get an auto-assigned ID.</span>}
                </div>

                <div style={{ marginTop: 10, fontWeight: 600 }}>First {previewData.preview.length} rows:</div>
                <div style={{ overflowX: 'auto', marginTop: 6 }}>
                  <table className="data-table">
                    <thead>
                      <tr>{previewData.columns.map((c: string) => <th key={c}>{c}</th>)}</tr>
                    </thead>
                    <tbody>
                      {previewData.preview.map((row: any, idx: number) => (
                        <tr key={idx}>
                          {previewData.columns.map((c: string) => <td key={c}>{String(row[c] ?? '')}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={confirmImport} disabled={importing}>
                    {importing ? 'Importing...' : `Import Data (${previewData.rowCount} rows)`}
                  </button>
                  <button className="btn" onClick={cancelPreview} disabled={importing}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {importResult && (
        <div className="panel">
          <div className="panel-header">Excel Import Completed</div>
          <div className="panel-body" style={{ fontSize: 12.5 }}>
            {importResult.error ? (
              <div style={{ color: '#c0392b' }}>{importResult.error}</div>
            ) : (
              <>
                <div>File: {importResult.fileName} · Sheet: {importResult.sheetName}</div>
                <div style={{ marginTop: 4 }}>
                  Rows detected: {importResult.rowCount} · New employees: {importResult.created} · Updated employees: {importResult.updated} · Skipped: {importResult.skipped} · Columns detected: {importResult.columnsDetected}
                </div>
                <div style={{ marginTop: 4 }}>Detected columns: {importResult.detectedColumns?.join(', ')}</div>
                {importResult.autoIdAssigned > 0 && (
                  <div style={{ marginTop: 4, color: '#8a6d00' }}>
                    {importResult.autoIdAssigned} row(s) had no recognizable employee-ID column and were imported using an auto-assigned identifier.
                  </div>
                )}
                {importResult.rowIssues?.length > 0 && (
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ cursor: 'pointer' }}>Row-level notes ({importResult.rowIssues.length})</summary>
                    <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                      {importResult.rowIssues.slice(0, 25).map((issue: any, idx: number) => (
                        <li key={idx}>Row {issue.row}: {issue.reason}</li>
                      ))}
                      {importResult.rowIssues.length > 25 && <li>...and {importResult.rowIssues.length - 25} more.</li>}
                    </ul>
                  </details>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-body">
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  {visibleColumns.length > 0
                    ? visibleColumns.map((c) => <th key={c} style={{ whiteSpace: 'nowrap' }}>{c}</th>)
                    : <><th>Employee ID</th><th>Name</th><th>Department</th><th>Category</th><th>Grade</th></>}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!loading && list.length === 0 && (
                  <tr><td colSpan={visibleColumns.length + 1 || 6} className="empty-state">No employee records found.</td></tr>
                )}
                {list.map((e) => (
                  <tr key={e.id}>
                    {visibleColumns.length > 0
                      ? visibleColumns.map((c) => <td key={c}>{String(cellValue(e, c) ?? '')}</td>)
                      : <><td>{e.employeeId}</td><td>{e.name}</td><td>{e.department}</td><td>{e.category}</td><td>{e.grade}</td></>}
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-sm" onClick={() => navigate(`/employees/${e.id}`)}>Profile</button>{' '}
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(e.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 12.5 }}>
            <span>{total} employee{total === 1 ? '' : 's'} total</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <span>Page {page} of {totalPages}</span>
              <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        </div>
      </div>

      {modalOpen && (
        <Modal title="Add Employee" onClose={() => setModalOpen(false)}
          footer={<button className="btn btn-primary" onClick={handleCreate as any}>Save</button>}>
          <form onSubmit={handleCreate}>
            <div className="field-row"><label>Employee ID</label><input value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} required /></div>
            <div className="field-row"><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="form-grid-2">
              <div className="field-row"><label>Department</label><input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
              <div className="field-row"><label>Category</label><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            </div>
            <div className="field-row"><label>Grade</label><input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} /></div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
