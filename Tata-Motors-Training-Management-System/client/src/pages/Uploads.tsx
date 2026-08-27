import React, { useEffect, useRef, useState } from 'react';
import AppLayout from '../components/AppLayout';
import { api, openUploadedFile } from '../api/client';

export default function Uploads() {
  const [uploads, setUploads] = useState<any[]>([]);
  const [category, setCategory] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, [category]);

  async function load() {
    const res = await api.get('/uploads', { params: { category: category || undefined } });
    setUploads(res.data);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('category', 'document');
    await api.post('/uploads/document', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    if (fileRef.current) fileRef.current.value = '';
    load();
  }

  async function handleDelete(id: number, category?: string) {
    const message = category === 'employee'
      ? 'Delete this upload record? Employee records that came from this Excel import will also be removed from the Employee tab.'
      : 'Delete this upload record?';
    if (!confirm(message)) return;
    const res = await api.delete(`/uploads/${id}`);
    if (res.data?.removedEmployees > 0) {
      alert(`Deleted. ${res.data.removedEmployees} linked employee record(s) were also removed.`);
    }
    load();
  }

  return (
    <AppLayout title="Uploads">
      <div className="toolbar">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          <option value="faculty">Faculty Import</option>
          <option value="employee">Employee Import</option>
          <option value="attendance">Attendance Import</option>
          <option value="document">Documents / Photos</option>
        </select>
        <label className="btn btn-primary" style={{ marginLeft: 'auto' }}>
          Upload File
          <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleUpload} />
        </label>
      </div>

      <div className="panel">
        <div className="panel-body">
          <table className="data-table">
            <thead><tr><th>File</th><th>Type</th><th>Category</th><th>Size</th><th>Rows</th><th>Uploaded</th><th>Actions</th></tr></thead>
            <tbody>
              {uploads.length === 0 && <tr><td colSpan={7} className="empty-state">No files uploaded yet.</td></tr>}
              {uploads.map((u) => (
                <tr key={u.id}>
                  <td><a href="#" onClick={(e) => { e.preventDefault(); openUploadedFile(u.storedName, u.originalName); }}>{u.originalName}</a></td>
                  <td>{u.fileType}</td>
                  <td>{u.category}</td>
                  <td>{(u.fileSize / 1024).toFixed(1)} KB</td>
                  <td>{u.rowCount ?? '—'}</td>
                  <td>{new Date(u.uploadedAt).toLocaleString()}</td>
                  <td><button className="btn btn-sm btn-danger" onClick={() => handleDelete(u.id, u.category)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
