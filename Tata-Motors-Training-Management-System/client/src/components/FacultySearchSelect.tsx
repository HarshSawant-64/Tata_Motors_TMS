import React, { useEffect, useMemo, useRef, useState } from 'react';

// Searchable faculty picker used everywhere a faculty member is selected
// (program/session scheduling, the calendar "Create/Edit Program" flow).
// Replaces a single long <select> — which becomes unusable once the
// imported Faculty Excel has hundreds/thousands of rows — with a text
// search box that filters as you type and a compact results list to pick
// from, instead of rendering every faculty member as a dropdown option.
//
// Matches on Employee ID / Employee Number (facultyCode), name, or any
// other identifying field carried over from the Excel import (department,
// grade, and any raw/unmapped columns preserved on import).
export default function FacultySearchSelect({
  facultyList,
  value,
  onChange,
  placeholder,
  allowUnassigned,
}: {
  facultyList: any[];
  value: string | number | null | undefined;
  onChange: (id: string) => void;
  placeholder?: string;
  allowUnassigned?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => (value ? facultyList.find((f) => String(f.id) === String(value)) : null),
    [value, facultyList]
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function rawFieldsOf(f: any): string {
    if (!f.rawData) return '';
    try {
      const raw = typeof f.rawData === 'string' ? JSON.parse(f.rawData) : f.rawData;
      return Object.values(raw).join(' ');
    } catch {
      return '';
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return facultyList.slice(0, 50);
    return facultyList
      .filter((f) => {
        const haystack = [f.facultyCode, f.name, f.department, f.grade, rawFieldsOf(f)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 50);
  }, [facultyList, query]);

  function select(f: any) {
    onChange(String(f.id));
    setQuery('');
    setOpen(false);
  }

  function selectUnassigned() {
    onChange('');
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="faculty-search-select" ref={containerRef}>
      <input
        className="search-input"
        style={{ width: '100%' }}
        placeholder={placeholder || 'Search Faculty by Employee ID or Name'}
        value={open ? query : (selected ? `${selected.facultyCode} — ${selected.name}` : '')}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
      />
      {open && (
        <div className="ms-panel faculty-search-panel">
          {allowUnassigned && (
            <div className="ms-option" onClick={selectUnassigned}>
              <span>Unassigned</span>
            </div>
          )}
          {filtered.length === 0 && (
            <div className="empty-state" style={{ padding: '14px 0' }}>No faculty match your search.</div>
          )}
          {filtered.map((f) => (
            <div key={f.id} className="ms-option" onClick={() => select(f)}>
              <span>{f.facultyCode} — {f.name}{f.department ? ` (${f.department})` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
