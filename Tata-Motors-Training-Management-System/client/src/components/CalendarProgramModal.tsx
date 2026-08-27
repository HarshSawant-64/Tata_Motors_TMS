import React, { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import FacultySearchSelect from './FacultySearchSelect';
import { api } from '../api/client';
import { CALENDAR_MAIN_PROGRAMS, CALENDAR_TRAINING_CATALOG } from '../constants';

export default function CalendarProgramModal({
  dateLabel,
  initialMainProgram,
  initialTrainings,
  initialStartDate,
  initialEndDate,
  initialStartTime,
  initialEndTime,
  initialFacultyId,
  initialHall,
  initialStudents,
  facultyList,
  saving,
  onCancel,
  onSave,
}: {
  dateLabel: string;
  initialMainProgram?: string;
  initialTrainings?: string[];
  initialStartDate?: string;
  initialEndDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  initialFacultyId?: string | number;
  initialHall?: string;
  initialStudents?: string | number;
  facultyList?: any[];
  saving?: boolean;
  onCancel: () => void;
  onSave: (data: {
    mainProgram: string;
    trainings: string[];
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    facultyId: string;
    hall: string;
    students: string;
  }) => void;
}) {
  const [mainProgram, setMainProgram] = useState(initialMainProgram || CALENDAR_MAIN_PROGRAMS[0].value);
  const [trainings, setTrainings] = useState<string[]>(initialTrainings || []);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState(initialStartDate || dateLabel);
  const [endDate, setEndDate] = useState(initialEndDate || initialStartDate || dateLabel);
  const [startTime, setStartTime] = useState(initialStartTime || '09:00');
  const [endTime, setEndTime] = useState(initialEndTime || '11:00');
  const [facultyId, setFacultyId] = useState(initialFacultyId != null ? String(initialFacultyId) : '');
  const [hall, setHall] = useState(initialHall || '');
  const [students, setStudents] = useState(initialStudents != null ? String(initialStudents) : '0');

  // Trainings manually added for this main program (persisted server-side —
  // see server/src/routes/trainings.js) on top of the built-in catalog, so
  // a training that isn't in the master list yet can still be scheduled
  // immediately and stays available for next time / after a refresh.
  const [customTrainings, setCustomTrainings] = useState<{ id: number; name: string }[]>([]);
  const [addingTraining, setAddingTraining] = useState(false);
  const [newTrainingName, setNewTrainingName] = useState('');
  const [savingTraining, setSavingTraining] = useState(false);

  // Main programs manually added on top of the built-in four (SHE /
  // Induction / F&T / C&B) — persisted server-side (see
  // server/src/routes/mainPrograms.js) so a newly added one is immediately
  // available in the selector and stays available for future scheduling.
  const [customMainPrograms, setCustomMainPrograms] = useState<{ id: number; value: string; label: string }[]>([]);
  const [addingMainProgram, setAddingMainProgram] = useState(false);
  const [newMainProgramName, setNewMainProgramName] = useState('');
  const [savingMainProgram, setSavingMainProgram] = useState(false);
  const [deletingMainProgram, setDeletingMainProgram] = useState(false);

  useEffect(() => { loadCustomTrainings(mainProgram); }, [mainProgram]);
  useEffect(() => { loadCustomMainPrograms(); }, []);

  async function loadCustomTrainings(program: string) {
    try {
      const res = await api.get('/trainings', { params: { mainProgram: program } });
      setCustomTrainings((res.data || []).map((t: any) => ({ id: t.id, name: t.name })));
    } catch {
      setCustomTrainings([]);
    }
  }

  async function loadCustomMainPrograms() {
    try {
      const res = await api.get('/main-programs');
      setCustomMainPrograms(res.data || []);
    } catch {
      setCustomMainPrograms([]);
    }
  }

  // Combined Main Program list: built-in four, plus any manually added
  // ones, so a manually-added main program shows up in the selector right
  // away and on every future visit.
  const mainProgramOptions = useMemo(() => {
    const merged = [...CALENDAR_MAIN_PROGRAMS];
    for (const p of customMainPrograms) {
      if (!merged.some((m) => m.value === p.value)) merged.push({ value: p.value, label: p.label });
    }
    return merged;
  }, [customMainPrograms]);

  const selectedCustomMainProgram = useMemo(
    () => customMainPrograms.find((p) => p.value === mainProgram),
    [customMainPrograms, mainProgram]
  );

  const customTrainingNames = useMemo(() => customTrainings.map((t) => t.name), [customTrainings]);

  const catalog = useMemo(() => {
    const base = CALENDAR_TRAINING_CATALOG[mainProgram] || [];
    const merged = [...base];
    for (const name of customTrainingNames) if (!merged.includes(name)) merged.push(name);
    return merged;
  }, [mainProgram, customTrainingNames]);
  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((t) => t.toLowerCase().includes(q));
  }, [catalog, search]);

  async function handleAddTraining() {
    const name = newTrainingName.trim();
    if (!name) return;
    setSavingTraining(true);
    try {
      await api.post('/trainings', { mainProgram, name });
      await loadCustomTrainings(mainProgram);
      // Immediately select the newly created training, per spec, so it can
      // be used in this scheduling action right away.
      setTrainings((prev) => (prev.includes(name) ? prev : [...prev, name]));
      setNewTrainingName('');
      setAddingTraining(false);
      setSearch('');
    } finally {
      setSavingTraining(false);
    }
  }

  async function handleDeleteTraining(training: { id: number; name: string }) {
    if (!confirm(`Delete the manually-added training "${training.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/trainings/${training.id}`);
      await loadCustomTrainings(mainProgram);
      // Deselect it if it was currently selected, since it no longer exists.
      setTrainings((prev) => prev.filter((t) => t !== training.name));
    } catch {
      alert('Failed to delete this training. Please try again.');
    }
  }

  async function handleAddMainProgram() {
    const label = newMainProgramName.trim();
    if (!label) return;
    setSavingMainProgram(true);
    try {
      const res = await api.post('/main-programs', { label });
      await loadCustomMainPrograms();
      // Immediately select and use the newly created main program.
      handleMainProgramChange(res.data.value);
      setNewMainProgramName('');
      setAddingMainProgram(false);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to save the new main program.');
    } finally {
      setSavingMainProgram(false);
    }
  }

  async function handleDeleteMainProgram() {
    if (!selectedCustomMainProgram) return;
    if (!confirm(`Delete the manually-added main program "${selectedCustomMainProgram.label}"? Its manually-added trainings will be removed too. This cannot be undone.`)) return;
    setDeletingMainProgram(true);
    try {
      await api.delete(`/main-programs/${selectedCustomMainProgram.id}`);
      await loadCustomMainPrograms();
      // Fall back to the first built-in main program, since the one that
      // was selected no longer exists.
      handleMainProgramChange(CALENDAR_MAIN_PROGRAMS[0].value);
    } catch {
      alert('Failed to delete this main program. Please try again.');
    } finally {
      setDeletingMainProgram(false);
    }
  }

  const allSelected = catalog.length > 0 && catalog.every((t) => trainings.includes(t));

  function handleMainProgramChange(value: string) {
    setMainProgram(value);
    // Trainings belong to a single main program — switching program clears
    // selections that no longer apply, per spec ("training list must
    // dynamically change according to the selected main program").
    setTrainings([]);
    setSearch('');
    setError('');
  }

  function toggleTraining(name: string) {
    setTrainings((prev) => (prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]));
  }

  function toggleSelectAll() {
    if (allSelected) {
      setTrainings((prev) => prev.filter((t) => !catalog.includes(t)));
    } else {
      setTrainings((prev) => Array.from(new Set([...prev, ...catalog])));
    }
  }

  function handleSave() {
    if (!mainProgram) {
      setError('Please select a main program.');
      return;
    }
    if (trainings.length === 0) {
      setError('Please select at least one training.');
      return;
    }
    if (!startDate) {
      setError('Please provide a valid start date.');
      return;
    }
    if (!endDate || endDate < startDate) {
      setError('End date cannot be before start date.');
      return;
    }
    if (!startTime) {
      setError('Please provide a start time.');
      return;
    }
    if (!endTime) {
      setError('Please provide an end time.');
      return;
    }
    if (startDate === endDate && endTime < startTime) {
      setError('End time cannot be earlier than start time.');
      return;
    }
    setError('');
    onSave({ mainProgram, trainings, startDate, endDate, startTime, endTime, facultyId, hall, students });
  }

  return (
    <Modal
      title={initialMainProgram ? 'Edit Program' : 'Create Program'}
      onClose={onCancel}
      width={480}
      footer={
        <>
          <button className="btn" onClick={onCancel} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="field-row">
        <label>Date</label>
        <input value={dateLabel} disabled />
      </div>

      {error && <div className="login-error">{error}</div>}

      <div className="field-row">
        <label>Main Program</label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select style={{ flex: 1 }} value={mainProgram} onChange={(e) => handleMainProgramChange(e.target.value)}>
            {mainProgramOptions.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          {selectedCustomMainProgram && (
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={handleDeleteMainProgram}
              disabled={deletingMainProgram}
              title="Delete this manually-added main program"
            >
              {deletingMainProgram ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>

        {addingMainProgram ? (
          <div className="panel" style={{ marginTop: 8 }}>
            <div className="panel-body" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                className="search-input"
                style={{ flex: 1, minWidth: 0 }}
                placeholder="New main program name"
                value={newMainProgramName}
                onChange={(e) => setNewMainProgramName(e.target.value)}
                autoFocus
              />
              <button type="button" className="btn btn-sm btn-primary" onClick={handleAddMainProgram} disabled={savingMainProgram || !newMainProgramName.trim()}>
                {savingMainProgram ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => { setAddingMainProgram(false); setNewMainProgramName(''); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => setAddingMainProgram(true)}>
            + Add Main Program Manually
          </button>
        )}
      </div>

      <div className="field-row">
        <label>Training(s) {trainings.length > 0 ? `— ${trainings.length} selected` : ''}</label>
        <input
          className="search-input"
          style={{ width: '100%', marginBottom: 6 }}
          placeholder="Search trainings..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="ms-panel">
          <label className="ms-option ms-option-all">
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
            <span>Select All</span>
          </label>
          {filteredCatalog.length === 0 && (
            <div className="empty-state" style={{ padding: '14px 0' }}>No trainings match your search.</div>
          )}
          {filteredCatalog.map((name) => {
            const custom = customTrainings.find((t) => t.name === name);
            return (
              <div key={name} className="ms-option" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, cursor: 'pointer' }}>
                  <input type="checkbox" checked={trainings.includes(name)} onChange={() => toggleTraining(name)} />
                  <span>{name}</span>
                </label>
                {custom && (
                  <button
                    type="button"
                    className="ms-tag-remove"
                    title="Delete this manually-added training"
                    onClick={() => handleDeleteTraining(custom)}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {addingTraining ? (
          <div className="panel" style={{ marginTop: 8 }}>
            <div className="panel-body" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                className="search-input"
                style={{ flex: 1, minWidth: 0 }}
                placeholder="New training name"
                value={newTrainingName}
                onChange={(e) => setNewTrainingName(e.target.value)}
                autoFocus
              />
              <button type="button" className="btn btn-sm btn-primary" onClick={handleAddTraining} disabled={savingTraining || !newTrainingName.trim()}>
                {savingTraining ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => { setAddingTraining(false); setNewTrainingName(''); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => setAddingTraining(true)}>
            + Add New Training Manually
          </button>
        )}

        {trainings.length > 0 && (
          <div className="tag-list" style={{ marginTop: 8 }}>
            {trainings.map((t) => (
              <span key={t} className="tag ms-tag">
                {t}
                <button type="button" className="ms-tag-remove" onClick={() => toggleTraining(t)}>✕</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="form-grid-2">
        <div className="field-row">
          <label>Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="field-row">
          <label>End Date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      <div className="form-grid-2">
        <div className="field-row">
          <label>Start Time</label>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div className="field-row">
          <label>End Time</label>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>

      <div className="form-grid-2">
        <div className="field-row">
          <label>Faculty</label>
          <FacultySearchSelect
            facultyList={facultyList || []}
            value={facultyId}
            onChange={setFacultyId}
            allowUnassigned
          />
        </div>
        <div className="field-row">
          <label>Hall</label>
          <input placeholder="Select/Search Hall" value={hall} onChange={(e) => setHall(e.target.value)} />
        </div>
      </div>

      <div className="field-row">
        <label>Students</label>
        <input type="number" min={0} value={students} onChange={(e) => setStudents(e.target.value)} />
      </div>
    </Modal>
  );
}
