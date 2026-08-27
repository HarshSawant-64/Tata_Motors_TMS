import React, { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Modal from '../components/Modal';
import StatusPill from '../components/StatusPill';
import CalendarProgramModal from '../components/CalendarProgramModal';
import FacultySearchSelect from '../components/FacultySearchSelect';
import { api } from '../api/client';
import { PROGRAM_STATUSES, CALENDAR_PROGRAM_CODE_PREFIX } from '../constants';
import { useNavigate } from 'react-router-dom';

// A session created via the calendar "Create Program" flow is tied to an
// auto-managed container Program whose code starts with CAL-. Its
// trainingTopic stores a JSON array of the selected training names instead
// of a single free-text topic. These two helpers keep that logic in one
// place so the rest of the component can stay close to the original.
function isCalendarProgramSession(s: any) {
  return !!s.program?.code?.startsWith(CALENDAR_PROGRAM_CODE_PREFIX);
}
function parseTrainings(trainingTopic: string | null | undefined): string[] {
  if (!trainingTopic) return [];
  try {
    const parsed = JSON.parse(trainingTopic);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // legacy plain-text topic — treat it as a single training
  }
  return [trainingTopic];
}
function sessionChipLabel(s: any) {
  if (isCalendarProgramSession(s)) {
    return `${s.program?.category}: ${parseTrainings(s.trainingTopic).join(' + ')}`;
  }
  return `${s.program?.code}: ${s.trainingTopic || 'Session'}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad(n: number) { return String(n).padStart(2, '0'); }
function toDateStr(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}`; }

export default function Scheduling() {
  const navigate = useNavigate();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [sessions, setSessions] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<any | null>(null);
  const [form, setForm] = useState<any>({});
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [editingCalendarSession, setEditingCalendarSession] = useState<any | null>(null);
  const [calendarSaving, setCalendarSaving] = useState(false);

  useEffect(() => { loadMonth(); loadRefs(); }, [viewYear, viewMonth]);

  async function loadMonth() {
    const res = await api.get('/sessions', { params: { year: viewYear, month: viewMonth + 1 } });
    setSessions(res.data);
  }

  async function loadRefs() {
    const [p, f] = await Promise.all([api.get('/programs'), api.get('/faculty')]);
    setPrograms(p.data);
    setFacultyList(f.data);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); } else setViewMonth(viewMonth - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); } else setViewMonth(viewMonth + 1);
  }
  function goToday() { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function sessionsForDay(day: number) {
    const dateStr = toDateStr(viewYear, viewMonth, day);
    return sessions.filter((s) => s.date?.slice(0, 10) === dateStr);
  }

  function openDay(day: number) {
    setSelectedDate(toDateStr(viewYear, viewMonth, day));
    setDayModalOpen(true);
  }

  function openEditSession(s: any) {
    setEditingSession(s);
    setForm({
      programId: s.programId, date: s.date?.slice(0, 10), endDate: s.endDate?.slice(0, 10) || s.date?.slice(0, 10),
      startTime: s.startTime || '', endTime: s.endTime || '', facultyId: s.facultyId || '',
      hall: s.hall || '', trainingTopic: s.trainingTopic || '', studentCount: s.studentCount || 0,
      status: s.status,
    });
    setSessionModalOpen(true);
  }

  async function saveSession(e: React.FormEvent) {
    e.preventDefault();
    if (editingSession) {
      await api.put(`/sessions/${editingSession.id}`, form);
    } else {
      await api.post('/sessions', form);
    }
    setSessionModalOpen(false);
    loadMonth();
  }

  function openCreateCalendarProgram() {
    setEditingCalendarSession(null);
    setCalendarModalOpen(true);
  }

  function openEditCalendarProgram(s: any) {
    setEditingCalendarSession(s);
    setCalendarModalOpen(true);
  }

  async function saveCalendarProgram({
    mainProgram, trainings, startDate, endDate, startTime, endTime, facultyId, hall, students,
  }: {
    mainProgram: string; trainings: string[]; startDate: string; endDate: string;
    startTime: string; endTime: string; facultyId: string; hall: string; students: string;
  }) {
    setCalendarSaving(true);
    try {
      // Find-or-create the single container Program that holds every
      // calendar-created session for this main program, so we never create
      // duplicate Program master records for the same category.
      const containerRes = await api.post('/programs/calendar-container', { category: mainProgram });
      const programId = containerRes.data.id;
      const payload = {
        programId,
        date: startDate,
        endDate,
        startTime,
        endTime,
        facultyId: facultyId || null,
        hall,
        trainingTopic: JSON.stringify(trainings),
        status: editingCalendarSession?.status || 'Planned',
        studentCount: students ? Number(students) : 0,
      };
      if (editingCalendarSession) {
        await api.put(`/sessions/${editingCalendarSession.id}`, payload);
      } else {
        await api.post('/sessions', payload);
      }
      setCalendarModalOpen(false);
      setEditingCalendarSession(null);
      loadMonth();
    } finally {
      setCalendarSaving(false);
    }
  }

  async function deleteSession(id: number) {
    if (!confirm('Cancel/delete this session?')) return;
    await api.delete(`/sessions/${id}`);
    loadMonth();
  }

  const dayList = selectedDate
    ? sessions.filter((s) => s.date?.slice(0, 10) === selectedDate)
    : [];

  return (
    <AppLayout title="Scheduling Calendar">
      <div className="toolbar">
        <button className="btn" onClick={prevMonth}>‹ Previous</button>
        <button className="btn" onClick={goToday}>Today</button>
        <button className="btn" onClick={nextMonth}>Next ›</button>
        <strong style={{ marginLeft: 10, fontSize: 14 }}>
          {new Date(viewYear, viewMonth).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
        </strong>
      </div>

      <div className="panel">
        <div className="panel-body">
          <div className="calendar-grid" style={{ marginBottom: 4 }}>
            {WEEKDAYS.map((d) => <div key={d} className="weekday-header">{d}</div>)}
          </div>
          <div className="calendar-grid">
            {cells.map((day, idx) => {
              if (day === null) return <div key={idx} className="calendar-cell empty" />;
              const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
              const daySessions = sessionsForDay(day);
              return (
                <div key={idx} className={`calendar-cell${isToday ? ' today' : ''}`} onClick={() => openDay(day)}>
                  <div className="calendar-date">{day}</div>
                  {daySessions.slice(0, 3).map((s) => (
                    <div key={s.id} className="calendar-session-chip" title={sessionChipLabel(s)}>{sessionChipLabel(s)}</div>
                  ))}
                  {daySessions.length > 3 && <div className="calendar-session-chip">+{daySessions.length - 3} more</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {dayModalOpen && selectedDate && (
        <Modal
          title={`Sessions on ${selectedDate}`}
          onClose={() => setDayModalOpen(false)}
          footer={
            <button className="btn btn-primary" onClick={openCreateCalendarProgram}>+ Create Program</button>
          }
        >
          {dayList.length === 0 && <div className="empty-state">No training sessions scheduled on this date.</div>}
          {dayList.map((s) => (
            <div key={s.id} className="panel" style={{ marginBottom: 10 }}>
              <div className="panel-body">
                {isCalendarProgramSession(s) ? (
                  <>
                    <strong>{s.program?.category}</strong> <StatusPill status={s.status} />
                    <div className="tag-list" style={{ marginTop: 6 }}>
                      {parseTrainings(s.trainingTopic).map((t) => (
                        <span key={t} className="tag">{t}</span>
                      ))}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <button className="btn btn-sm" onClick={() => navigate(`/sessions/${s.id}`)}>View Details</button>{' '}
                      <button className="btn btn-sm" onClick={() => openEditCalendarProgram(s)}>Edit</button>{' '}
                      <button className="btn btn-sm btn-danger" onClick={() => deleteSession(s.id)}>Delete</button>
                    </div>
                  </>
                ) : (
                  <>
                    <strong>{s.program?.name}</strong> ({s.program?.code}) <StatusPill status={s.status} />
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {s.trainingTopic} · {s.startTime}–{s.endTime} · Hall: {s.hall || '—'} · Faculty: {s.faculty?.name || '—'}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <button className="btn btn-sm" onClick={() => navigate(`/sessions/${s.id}`)}>View Details</button>{' '}
                      <button className="btn btn-sm" onClick={() => openEditSession(s)}>Edit</button>{' '}
                      <button className="btn btn-sm btn-danger" onClick={() => deleteSession(s.id)}>Delete</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </Modal>
      )}

      {calendarModalOpen && selectedDate && (
        <CalendarProgramModal
          dateLabel={selectedDate}
          initialMainProgram={editingCalendarSession?.program?.category}
          initialTrainings={editingCalendarSession ? parseTrainings(editingCalendarSession.trainingTopic) : undefined}
          initialStartDate={editingCalendarSession?.date?.slice(0, 10) || selectedDate}
          initialEndDate={editingCalendarSession?.endDate?.slice(0, 10) || editingCalendarSession?.date?.slice(0, 10) || selectedDate}
          initialStartTime={editingCalendarSession?.startTime}
          initialEndTime={editingCalendarSession?.endTime}
          initialFacultyId={editingCalendarSession?.facultyId}
          initialHall={editingCalendarSession?.hall}
          initialStudents={editingCalendarSession?.studentCount}
          facultyList={facultyList}
          saving={calendarSaving}
          onCancel={() => { setCalendarModalOpen(false); setEditingCalendarSession(null); }}
          onSave={saveCalendarProgram}
        />
      )}

      {sessionModalOpen && (
        <Modal
          title="Edit Session"
          onClose={() => setSessionModalOpen(false)}
          footer={<button className="btn btn-primary" onClick={saveSession as any}>Save Session</button>}
        >
          <form onSubmit={saveSession}>
            <div className="field-row">
              <label>Training Program</label>
              <select value={form.programId} onChange={(e) => setForm({ ...form, programId: e.target.value })}>
                {programs.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            </div>
            <div className="form-grid-2">
              <div className="field-row"><label>Date</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div className="field-row"><label>End Date</label><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            </div>
            <div className="form-grid-2">
              <div className="field-row"><label>Start Time</label><input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
              <div className="field-row"><label>End Time</label><input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
            </div>
            <div className="form-grid-2">
              <div className="field-row">
                <label>Faculty</label>
                <FacultySearchSelect
                  facultyList={facultyList}
                  value={form.facultyId}
                  onChange={(id) => setForm({ ...form, facultyId: id })}
                  allowUnassigned
                />
              </div>
              <div className="field-row"><label>Hall</label><input value={form.hall} onChange={(e) => setForm({ ...form, hall: e.target.value })} /></div>
            </div>
            <div className="field-row"><label>Training Topic</label><input value={form.trainingTopic} onChange={(e) => setForm({ ...form, trainingTopic: e.target.value })} /></div>
            <div className="form-grid-2">
              <div className="field-row"><label>Students</label><input type="number" value={form.studentCount} onChange={(e) => setForm({ ...form, studentCount: e.target.value })} /></div>
              <div className="field-row">
                <label>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {PROGRAM_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
