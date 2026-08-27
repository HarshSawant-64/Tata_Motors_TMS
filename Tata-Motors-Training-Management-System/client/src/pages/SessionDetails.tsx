import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import StatusPill from '../components/StatusPill';
import { api, openUploadedFile } from '../api/client';
import { CALENDAR_PROGRAM_CODE_PREFIX } from '../constants';

// Calendar-created sessions store their selected trainings as a JSON array
// in trainingTopic (see Scheduling.tsx). Render that nicely here too instead
// of showing the raw JSON string.
function displayTrainingTopic(session: any): string {
  if (!session.trainingTopic) return '—';
  if (session.program?.code?.startsWith(CALENDAR_PROGRAM_CODE_PREFIX)) {
    try {
      const parsed = JSON.parse(session.trainingTopic);
      if (Array.isArray(parsed)) return parsed.join(', ');
    } catch {
      // fall through to raw text below
    }
  }
  return session.trainingTopic;
}

export default function SessionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [uploads, setUploads] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<any | null>(null);
  const attendanceFileRef = useRef<HTMLInputElement>(null);
  const docFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, [id]);

  async function load() {
    const [s, u] = await Promise.all([
      api.get(`/sessions/${id}`),
      api.get('/uploads', { params: { sessionId: id } }),
    ]);
    setSession(s.data);
    setUploads(u.data);
  }

  async function handleAttendanceUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    const res = await api.post(`/attendance/import/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    setImportResult(res.data);
    if (attendanceFileRef.current) attendanceFileRef.current.value = '';
    load();
  }

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('sessionId', String(id));
    fd.append('programId', String(session.programId));
    fd.append('category', 'document');
    await api.post('/uploads/document', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    if (docFileRef.current) docFileRef.current.value = '';
    load();
  }

  if (!session) return <AppLayout title="Session Details"><div>Loading...</div></AppLayout>;

  return (
    <AppLayout title="Session Details">
      <button className="btn" style={{ marginBottom: 14 }} onClick={() => navigate('/scheduling')}>← Back to Calendar</button>

      <div className="panel">
        <div className="panel-header">
          {displayTrainingTopic(session) !== '—' ? displayTrainingTopic(session) : session.program?.name}
          <StatusPill status={session.status} />
        </div>
        <div className="panel-body">
          <div className="form-grid-2">
            <div><strong>Training Name:</strong> {session.program?.name}</div>
            <div><strong>Training Topic:</strong> {displayTrainingTopic(session)}</div>
            <div><strong>Date:</strong> {session.date?.slice(0, 10)}</div>
            <div><strong>End Date:</strong> {session.endDate?.slice(0, 10) || '—'}</div>
            <div><strong>Start Time:</strong> {session.startTime || '—'}</div>
            <div><strong>End Time:</strong> {session.endTime || '—'}</div>
            <div><strong>Faculty:</strong> {session.faculty?.name || '—'}</div>
            <div><strong>Faculty ID:</strong> {session.faculty?.facultyCode || '—'}</div>
            <div><strong>Hall:</strong> {session.hall || '—'}</div>
            <div><strong>Student Count:</strong> {session.studentCount}</div>
            <div><strong>Present Count:</strong> {session.presentCount}</div>
            <div><strong>Absent Count:</strong> {session.absentCount}</div>
            <div><strong>Online Count:</strong> {session.onlineCount}</div>
          </div>
        </div>
      </div>

      <div className="panel-grid-2">
        <div className="panel">
          <div className="panel-header">Attendance</div>
          <div className="panel-body">
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Upload an attendance Excel/CSV file for this session. Columns are detected automatically —
              no fixed template is required.
            </p>
            <input ref={attendanceFileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleAttendanceUpload} />
            {importResult && (
              <div style={{ marginTop: 10, fontSize: 12 }}>
                <div>Detected columns: {importResult.detectedColumns?.join(', ')}</div>
                <div>Rows processed: {importResult.rowCount} · Imported: {importResult.imported}</div>
              </div>
            )}
            <table className="data-table" style={{ marginTop: 12 }}>
              <thead><tr><th>Name</th><th>Department</th><th>Status</th></tr></thead>
              <tbody>
                {(session.attendanceRecords || []).length === 0 && <tr><td colSpan={3} className="empty-state">No attendance records yet.</td></tr>}
                {(session.attendanceRecords || []).map((r: any) => (
                  <tr key={r.id}><td>{r.name}</td><td>{r.department}</td><td>{r.status}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">Documents &amp; Photos</div>
          <div className="panel-body">
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Supported: PDF, PPT/PPTX, DOC/DOCX, JPG/PNG, MP4, ZIP. Files are never executed.
            </p>
            <input ref={docFileRef} type="file" onChange={handleDocUpload} />
            <table className="data-table" style={{ marginTop: 12 }}>
              <thead><tr><th>File</th><th>Type</th><th>Size</th><th></th></tr></thead>
              <tbody>
                {uploads.length === 0 && <tr><td colSpan={4} className="empty-state">No documents uploaded yet.</td></tr>}
                {uploads.map((u) => (
                  <tr key={u.id}>
                    <td>{u.originalName}</td>
                    <td>{u.fileType}</td>
                    <td>{(u.fileSize / 1024).toFixed(1)} KB</td>
                    <td><a href="#" onClick={(e) => { e.preventDefault(); openUploadedFile(u.storedName, u.originalName); }}>Open</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
