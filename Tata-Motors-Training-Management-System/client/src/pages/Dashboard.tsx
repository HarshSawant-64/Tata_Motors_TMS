import React, { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import { api, downloadReport } from '../api/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import StatusPill from '../components/StatusPill';

interface Kpis {
  totalPrograms: number;
  plannedPrograms: number;
  completedPrograms: number;
  cancelledPrograms: number;
  postponedPrograms: number;
  scheduledSessions: number;
  facultyAssigned: number;
  employees: number;
  totalParticipants: number;
  totalPresent: number;
  totalFaculty: number;
}

export default function Dashboard() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [completedPrograms, setCompletedPrograms] = useState<any[]>([]);
  const [facultyPanel, setFacultyPanel] = useState<any>(null);
  const [statusGraph, setStatusGraph] = useState<any[]>([]);
  const [employeeStats, setEmployeeStats] = useState<any | null>(null);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any | null>(null);
  const [downloadingWeekly, setDownloadingWeekly] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [k, cp, fp, sg, es] = await Promise.all([
      api.get('/dashboard/kpis'),
      api.get('/dashboard/completed-programs'),
      api.get('/dashboard/faculty-panel'),
      api.get('/dashboard/program-status-graph'),
      api.get('/employees/stats'),
    ]);
    setKpis(k.data);
    setCompletedPrograms(cp.data);
    setFacultyPanel(fp.data);
    setStatusGraph(sg.data);
    setEmployeeStats(es.data);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) { setSearchResults(null); return; }
    const res = await api.get('/dashboard/search', { params: { q: query } });
    setSearchResults(res.data);
  }

  async function handleDownloadWeeklyReport() {
    setDownloadingWeekly(true);
    try {
      const dateStamp = new Date().toISOString().slice(0, 10);
      await downloadReport('weekly', `TMTP-Weekly-Report-${dateStamp}.pdf`);
    } catch (err) {
      alert('Unable to generate the weekly report. Please try again.');
    } finally {
      setDownloadingWeekly(false);
    }
  }

  const kpiCards = kpis ? [
    { label: 'Total Programs', value: kpis.totalPrograms, color: '' },
    { label: 'Planned Programs', value: kpis.plannedPrograms, color: 'purple' },
    { label: 'Completed Programs', value: kpis.completedPrograms, color: 'green' },
    { label: 'Cancelled Programs', value: kpis.cancelledPrograms, color: '' },
    { label: 'Postponed Programs', value: kpis.postponedPrograms, color: 'amber' },
    { label: 'Scheduled Sessions', value: kpis.scheduledSessions, color: 'brown' },
    { label: 'Faculty Assigned', value: kpis.facultyAssigned, color: 'purple' },
    { label: 'Employees', value: kpis.employees, color: 'brown' },
    { label: 'Total Participants', value: kpis.totalParticipants, color: 'green' },
    { label: 'Total Present', value: kpis.totalPresent, color: 'amber' },
  ] : [];

  return (
    <AppLayout title="Dashboard">
      <form className="toolbar" onSubmit={handleSearch}>
        <input
          className="search-input"
          placeholder="Search by Employee ID, Faculty ID, Name, Program Code, Department, Category..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ minWidth: 420 }}
        />
        <button className="btn btn-primary" type="submit">Search</button>
        {searchResults && (
          <button type="button" className="btn" onClick={() => { setQuery(''); setSearchResults(null); }}>Clear</button>
        )}
        <button
          type="button"
          className="btn"
          style={{ marginLeft: 'auto' }}
          onClick={handleDownloadWeeklyReport}
          disabled={downloadingWeekly}
        >
          {downloadingWeekly ? 'Generating...' : 'Download Weekly Report'}
        </button>
      </form>

      {searchResults && (
        <div className="panel">
          <div className="panel-header">Search Results</div>
          <div className="panel-body">
            <strong>Programs</strong>
            <table className="data-table" style={{ marginBottom: 14 }}>
              <thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Status</th></tr></thead>
              <tbody>
                {searchResults.programs.length === 0 && <tr><td colSpan={4}>No matches.</td></tr>}
                {searchResults.programs.map((p: any) => (
                  <tr key={p.id}><td>{p.code}</td><td>{p.name}</td><td>{p.category}</td><td><StatusPill status={p.status} /></td></tr>
                ))}
              </tbody>
            </table>
            <strong>Faculty</strong>
            <table className="data-table" style={{ marginBottom: 14 }}>
              <thead><tr><th>Faculty Code</th><th>Name</th><th>Department</th></tr></thead>
              <tbody>
                {searchResults.faculty.length === 0 && <tr><td colSpan={3}>No matches.</td></tr>}
                {searchResults.faculty.map((f: any) => (
                  <tr key={f.id}><td>{f.facultyCode}</td><td>{f.name}</td><td>{f.department}</td></tr>
                ))}
              </tbody>
            </table>
            <strong>Employees</strong>
            <table className="data-table">
              <thead><tr><th>Employee ID</th><th>Name</th><th>Department</th><th>Category</th><th>Grade</th><th></th></tr></thead>
              <tbody>
                {searchResults.employees.length === 0 && <tr><td colSpan={6}>No matches.</td></tr>}
                {searchResults.employees.map((e: any) => (
                  <tr key={e.id}>
                    <td>{e.employeeId}</td><td>{e.name}</td><td>{e.department}</td><td>{e.category}</td><td>{e.grade}</td>
                    <td><a href={`/employees/${e.id}`}>View Profile</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="kpi-grid">
        {kpiCards.map((c) => (
          <div key={c.label} className={`kpi-card ${c.color}`}>
            <div className="kpi-label">{c.label}</div>
            <div className="kpi-value">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="panel-grid-2">
        <div className="panel">
          <div className="panel-header">Completed Programs</div>
          <div className="panel-body">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th><th>Name</th><th>Category</th><th>Sessions</th><th>Participants</th><th>Attendance</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {completedPrograms.length === 0 && (
                  <tr><td colSpan={7} className="empty-state">No completed programs yet.</td></tr>
                )}
                {completedPrograms.map((p) => (
                  <tr key={p.id}>
                    <td>{p.code}</td>
                    <td>{p.name}</td>
                    <td>{p.category}</td>
                    <td>{p.sessions}</td>
                    <td>{p.participants}</td>
                    <td>{p.attendancePct}%</td>
                    <td><StatusPill status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">Faculty Assigned</div>
          <div className="panel-body">
            {facultyPanel && (
              <>
                <div className="kpi-grid" style={{ marginBottom: 10 }}>
                  <div className="kpi-card purple"><div className="kpi-label">Total Faculty</div><div className="kpi-value">{facultyPanel.totalFaculty}</div></div>
                  <div className="kpi-card green"><div className="kpi-label">Assigned</div><div className="kpi-value">{facultyPanel.assignedFaculty}</div></div>
                  <div className="kpi-card amber"><div className="kpi-label">Imported</div><div className="kpi-value">{facultyPanel.facultyImported}</div></div>
                  <div className="kpi-card brown"><div className="kpi-label">Present</div><div className="kpi-value">{facultyPanel.presentFaculty}</div></div>
                </div>
                <strong style={{ fontSize: 12 }}>By Department</strong>
                <table className="data-table" style={{ marginTop: 6 }}>
                  <thead><tr><th>Department</th><th>Count</th></tr></thead>
                  <tbody>
                    {facultyPanel.byDepartment.map((d: any) => (
                      <tr key={d.department}><td>{d.department}</td><td>{d.count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="chart-box">
        <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13.5 }}>Program Status</div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={statusGraph}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d7e3f0" />
            <XAxis dataKey="status" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" name="Programs" fill="#0b63ce" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Fully dynamic — driven by whatever fields the last Excel import actually
          contained. If the sheet has no Department column, no Department card
          appears; if it has a Plant column, a Plant card appears automatically. */}
      {employeeStats && employeeStats.stats.length > 0 && (
        <div className="panel-grid-2" style={{ marginTop: 18 }}>
          {employeeStats.stats.map((stat: any) => (
            <div className="chart-box" key={stat.field}>
              <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13.5 }}>Employees by {stat.field}</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stat.breakdown} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d7e3f0" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="value" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="count" name={stat.field} fill="#3aa0ff" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
