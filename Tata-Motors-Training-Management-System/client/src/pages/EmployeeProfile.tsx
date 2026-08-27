import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { api } from '../api/client';

// Headers considered "basic" identity fields when present, shown up top.
// Anything else detected in the Excel row is shown under "Additional
// Information" — nothing is hidden, nothing is invented.
const BASIC_FIELD_PATTERNS = [
  /^(pers|personnel|emp|employee|staff|worker|faculty)?\.?\s*(no\.?|num(ber)?|code|id)$/i,
  /name$/i,
  /^(department|dept|section|division|function)$/i,
  /^(grade|level|designation)$/i,
  /^(category|type)$/i,
  /^plant$/i,
  /^location$/i,
];

function isBasicField(header: string) {
  const h = header.trim();
  return BASIC_FIELD_PATTERNS.some((re) => re.test(h));
}

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { load(); }, [id]);

  async function load() {
    try {
      const res = await api.get(`/employees/${id}`);
      setEmployee(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load this employee.');
    }
  }

  if (error) {
    return (
      <AppLayout title="Employee Profile">
        <div className="panel"><div className="panel-body">{error}</div></div>
        <button className="btn" style={{ marginTop: 10 }} onClick={() => navigate('/employees')}>Back to Employee Registry</button>
      </AppLayout>
    );
  }

  if (!employee) {
    return (
      <AppLayout title="Employee Profile">
        <div className="panel"><div className="panel-body">Loading...</div></div>
      </AppLayout>
    );
  }

  const rawFields: Record<string, any> = employee.rawFields || {};
  const rawEntries = Object.entries(rawFields).filter(([, v]) => v !== '' && v !== null && v !== undefined);
  const basicEntries = rawEntries.filter(([k]) => isBasicField(k));
  const additionalEntries = rawEntries.filter(([k]) => !isBasicField(k));

  // If this employee has no rawData at all (added manually, not via Excel),
  // fall back to the normalized fields so the profile is never blank.
  const fallbackBasic: [string, any][] = basicEntries.length === 0 ? ([
    ['Employee ID', employee.employeeId],
    ['Name', employee.name],
    ['Department', employee.department],
    ['Category', employee.category],
    ['Grade', employee.grade],
  ] as [string, any][]).filter(([, v]) => v) : [];

  const displayBasic = basicEntries.length > 0 ? basicEntries : fallbackBasic;

  return (
    <AppLayout title={`Employee Profile — ${employee.name}`}>
      <button className="btn" style={{ marginBottom: 12 }} onClick={() => navigate('/employees')}>&larr; Back to Employee Registry</button>

      <div className="panel-grid-2">
        <div className="panel">
          <div className="panel-header">Basic Information</div>
          <div className="panel-body">
            <table className="data-table">
              <tbody>
                {displayBasic.length === 0 && <tr><td className="empty-state">No basic information available.</td></tr>}
                {displayBasic.map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap', width: '40%' }}>{k}</td>
                    <td>{String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">Employee Statistics</div>
          <div className="panel-body">
            {employee.attendanceSummary ? (
              <div className="kpi-grid">
                <div className="kpi-card"><div className="kpi-label">Training Sessions</div><div className="kpi-value">{employee.attendanceSummary.totalSessions}</div></div>
                <div className="kpi-card green"><div className="kpi-label">Present</div><div className="kpi-value">{employee.attendanceSummary.present}</div></div>
                <div className="kpi-card"><div className="kpi-label">Absent</div><div className="kpi-value">{employee.attendanceSummary.absent}</div></div>
                <div className="kpi-card amber"><div className="kpi-label">Online</div><div className="kpi-value">{employee.attendanceSummary.online}</div></div>
              </div>
            ) : (
              <div className="empty-state">No training/attendance records are linked to this employee yet.</div>
            )}
          </div>
        </div>
      </div>

      {additionalEntries.length > 0 && (
        <div className="panel">
          <div className="panel-header">Additional Information</div>
          <div className="panel-body">
            <table className="data-table">
              <tbody>
                {additionalEntries.map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap', width: '40%' }}>{k}</td>
                    <td>{String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
