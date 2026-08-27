import React, { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import { api, downloadReport } from '../api/client';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';

const PALETTE = ['#0b63ce', '#2e7d46', '#b6862c', '#3e7cb1', '#375e97', '#0a2647', '#5aa9e6', '#7fb3d5'];

export default function Analytics() {
  const [period, setPeriod] = useState('6months');
  const [data, setData] = useState<any | null>(null);
  const [downloadingReport, setDownloadingReport] = useState<'monthly' | 'six-month' | null>(null);

  useEffect(() => { load(); }, [period]);

  async function load() {
    const res = await api.get('/analytics/overview', { params: { period } });
    setData(res.data);
  }

  async function handleDownloadReport(reportPath: 'monthly' | 'six-month') {
    setDownloadingReport(reportPath);
    try {
      const dateStamp = new Date().toISOString().slice(0, 10);
      const label = reportPath === 'monthly' ? 'Monthly' : '6-Month';
      await downloadReport(reportPath, `TMTP-${label}-Report-${dateStamp}.pdf`);
    } catch (err) {
      alert('Unable to generate the report. Please try again.');
    } finally {
      setDownloadingReport(null);
    }
  }

  return (
    <AppLayout title="Analytics">
      <div className="toolbar">
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="6months">6 Months</option>
        </select>
        <button
          type="button"
          className="btn"
          style={{ marginLeft: 'auto' }}
          onClick={() => handleDownloadReport('monthly')}
          disabled={downloadingReport !== null}
        >
          {downloadingReport === 'monthly' ? 'Generating...' : 'Download Monthly Report'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => handleDownloadReport('six-month')}
          disabled={downloadingReport !== null}
        >
          {downloadingReport === 'six-month' ? 'Generating...' : 'Download 6-Month Report'}
        </button>
      </div>

      {data && (
        <>
          <div className="chart-box" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Sessions, Participants &amp; Present Attendance Over Time</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d7e3f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="sessions" name="Sessions" fill="#0b63ce" radius={[3, 3, 0, 0]} />
                <Bar dataKey="participants" name="Participants" fill="#2e7d46" radius={[3, 3, 0, 0]} />
                <Bar dataKey="present" name="Present" fill="#b6862c" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="panel-grid-2" style={{ marginBottom: 16 }}>
            <div className="chart-box">
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Programs by Category</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.programsByCategory} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d7e3f0" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="category" width={90} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#375e97" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-box">
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Programs by Status</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.programsByStatus}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d7e3f0" />
                  <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Programs" radius={[3, 3, 0, 0]}>
                    {data.programsByStatus.map((entry: any, idx: number) => (
                      <Cell key={entry.status} fill={PALETTE[idx % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel-grid-2">
            <div className="chart-box">
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Faculty / Session Allocation</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.facultyAllocation}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d7e3f0" />
                  <XAxis dataKey="faculty" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Sessions" fill="#2e7d46" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-box">
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Department Distribution</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.departmentDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d7e3f0" />
                  <XAxis dataKey="department" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Employees" radius={[3, 3, 0, 0]}>
                    {data.departmentDistribution.map((entry: any, idx: number) => (
                      <Cell key={entry.department} fill={PALETTE[idx % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}
