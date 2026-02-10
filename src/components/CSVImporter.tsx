'use client';

import { useState, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 'upload' | 'map' | 'preview' | 'importing' | 'done';

interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

/** The shift fields we need to populate from CSV columns. */
const SHIFT_FIELDS = [
  { key: 'date', label: 'Date', required: true },
  { key: 'start_time', label: 'Start Time', required: true },
  { key: 'end_time', label: 'End Time', required: true },
  { key: 'role', label: 'Role', required: true },
  { key: 'department', label: 'Location / Department', required: true },
  { key: 'employee_email', label: 'Employee Email', required: true },
] as const;

type FieldKey = (typeof SHIFT_FIELDS)[number]['key'];

interface ValidationRow {
  rowNum: number;
  data: Record<FieldKey, string>;
  errors: string[];
}

interface ImportResult {
  row: number;
  status: 'created' | 'error';
  error?: string;
}

// ---------------------------------------------------------------------------
// CSV Parsing
// ---------------------------------------------------------------------------

function parseCSV(text: string): ParsedCSV {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);

  return { headers, rows };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function normalizeDate(raw: string): string | null {
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // Try MM/DD/YYYY or M/D/YYYY
  const mdyMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Try MM-DD-YYYY
  const mdyDash = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (mdyDash) {
    const [, m, d, y] = mdyDash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return null;
}

function normalizeTime(raw: string): string | null {
  // HH:MM
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;

  // H:MM
  if (/^\d{1}:\d{2}$/.test(raw)) return `0${raw}`;

  // HH:MM:SS
  const hmsMatch = raw.match(/^(\d{2}):(\d{2}):\d{2}$/);
  if (hmsMatch) return `${hmsMatch[1]}:${hmsMatch[2]}`;

  // 12-hour format: 8:00 AM, 12:30 PM, etc.
  const ampmMatch = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)$/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2];
    const period = ampmMatch[3].toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }

  return null;
}

function validateRows(
  csv: ParsedCSV,
  mapping: Record<FieldKey, number | null>
): ValidationRow[] {
  return csv.rows.map((row, i) => {
    const errors: string[] = [];
    const data = {} as Record<FieldKey, string>;

    for (const field of SHIFT_FIELDS) {
      const colIdx = mapping[field.key];
      const raw = colIdx !== null ? (row[colIdx] ?? '').trim() : '';

      if (!raw && field.required) {
        errors.push(`${field.label} is required`);
        data[field.key] = '';
        continue;
      }

      if (field.key === 'date') {
        const normalized = normalizeDate(raw);
        if (!normalized) {
          errors.push(`Invalid date: "${raw}"`);
          data[field.key] = raw;
        } else {
          data[field.key] = normalized;
        }
      } else if (field.key === 'start_time' || field.key === 'end_time') {
        const normalized = normalizeTime(raw);
        if (!normalized) {
          errors.push(`Invalid ${field.label.toLowerCase()}: "${raw}"`);
          data[field.key] = raw;
        } else {
          data[field.key] = normalized;
        }
      } else if (field.key === 'employee_email') {
        if (raw && !raw.includes('@')) {
          errors.push(`Invalid email: "${raw}"`);
        }
        data[field.key] = raw;
      } else {
        data[field.key] = raw;
      }
    }

    return { rowNum: i + 2, data, errors }; // +2 because 1-indexed + header row
  });
}

// ---------------------------------------------------------------------------
// Auto-mapping heuristic
// ---------------------------------------------------------------------------

function autoMap(headers: string[]): Record<FieldKey, number | null> {
  const mapping: Record<FieldKey, number | null> = {
    date: null,
    start_time: null,
    end_time: null,
    role: null,
    department: null,
    employee_email: null,
  };

  const patterns: Record<FieldKey, RegExp> = {
    date: /^(date|shift[_ ]?date|day)$/i,
    start_time: /^(start[_ ]?time|start|begin|clock[_ ]?in|time[_ ]?in)$/i,
    end_time: /^(end[_ ]?time|end|finish|clock[_ ]?out|time[_ ]?out)$/i,
    role: /^(role|position|title|job[_ ]?title)$/i,
    department: /^(department|dept|location|site|branch|office)$/i,
    employee_email: /^(employee[_ ]?email|email|user[_ ]?email|staff[_ ]?email)$/i,
  };

  headers.forEach((header, idx) => {
    const normalized = header.trim();
    for (const [key, pattern] of Object.entries(patterns)) {
      if (pattern.test(normalized) && mapping[key as FieldKey] === null) {
        mapping[key as FieldKey] = idx;
      }
    }
  });

  return mapping;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CSVImporter() {
  const [step, setStep] = useState<Step>('upload');
  const [csv, setCsv] = useState<ParsedCSV | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [mapping, setMapping] = useState<Record<FieldKey, number | null>>({
    date: null,
    start_time: null,
    end_time: null,
    role: null,
    department: null,
    employee_email: null,
  });
  const [validatedRows, setValidatedRows] = useState<ValidationRow[]>([]);
  const [importResults, setImportResults] = useState<{
    total: number;
    created: number;
    errors: number;
    results: ImportResult[];
  } | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- File handling ---

  const handleFile = useCallback((file: File) => {
    setParseError('');
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseError('Please upload a .csv file');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);

      if (parsed.headers.length === 0) {
        setParseError('CSV file appears to be empty');
        return;
      }
      if (parsed.rows.length === 0) {
        setParseError('CSV file has headers but no data rows');
        return;
      }

      setCsv(parsed);
      setMapping(autoMap(parsed.headers));
      setStep('map');
    };
    reader.onerror = () => setParseError('Failed to read file');
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // --- Mapping ---

  const handleMappingChange = (field: FieldKey, colIdx: string) => {
    setMapping((prev) => ({
      ...prev,
      [field]: colIdx === '' ? null : parseInt(colIdx, 10),
    }));
  };

  const allRequiredMapped = SHIFT_FIELDS.filter((f) => f.required).every(
    (f) => mapping[f.key] !== null
  );

  const handleValidate = () => {
    if (!csv) return;
    const rows = validateRows(csv, mapping);
    setValidatedRows(rows);
    setStep('preview');
  };

  // --- Import ---

  const validRows = validatedRows.filter((r) => r.errors.length === 0);
  const errorRows = validatedRows.filter((r) => r.errors.length > 0);

  const handleImport = async () => {
    if (validRows.length === 0) return;

    setStep('importing');
    setImportProgress(0);

    const shifts = validRows.map((r) => ({
      date: r.data.date,
      start_time: r.data.start_time,
      end_time: r.data.end_time,
      role: r.data.role,
      department: r.data.department,
      employee_email: r.data.employee_email,
    }));

    // Simulate progress while waiting for response
    const progressInterval = setInterval(() => {
      setImportProgress((prev) => Math.min(prev + 5, 90));
    }, 200);

    try {
      const response = await fetch('/api/shifts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shifts }),
      });

      clearInterval(progressInterval);
      setImportProgress(100);

      if (!response.ok) {
        const err = await response.json();
        setImportResults({
          total: shifts.length,
          created: 0,
          errors: shifts.length,
          results: [{ row: 0, status: 'error', error: err.error || 'Import failed' }],
        });
      } else {
        const data = await response.json();
        setImportResults(data);
      }
    } catch (err) {
      clearInterval(progressInterval);
      setImportResults({
        total: shifts.length,
        created: 0,
        errors: shifts.length,
        results: [
          {
            row: 0,
            status: 'error',
            error: err instanceof Error ? err.message : 'Network error',
          },
        ],
      });
    }

    setStep('done');
  };

  const handleReset = () => {
    setStep('upload');
    setCsv(null);
    setFileName('');
    setMapping({
      date: null,
      start_time: null,
      end_time: null,
      role: null,
      department: null,
      employee_email: null,
    });
    setValidatedRows([]);
    setImportResults(null);
    setImportProgress(0);
    setParseError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Render ---

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        {(['upload', 'map', 'preview', 'done'] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <span className="text-gray-300">/</span>}
            <span
              className={
                step === s || (step === 'importing' && s === 'done')
                  ? 'text-blue-600 font-medium'
                  : step === 'done' && s !== 'done'
                    ? 'text-green-600'
                    : ''
              }
            >
              {i + 1}. {s === 'upload' ? 'Upload' : s === 'map' ? 'Map Columns' : s === 'preview' ? 'Preview' : 'Import'}
            </span>
          </div>
        ))}
      </div>

      {/* ---- Step 1: Upload ---- */}
      {step === 'upload' && (
        <div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400 bg-white'
            }`}
          >
            <div className="text-4xl mb-3 text-gray-400">
              <svg className="mx-auto h-12 w-12" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-lg font-medium text-gray-700">
              Drop your CSV file here
            </p>
            <p className="text-sm text-gray-500 mt-1">
              or click to browse
            </p>
            <p className="text-xs text-gray-400 mt-3">
              Expected columns: date, start_time, end_time, role, location, employee_email
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>
          {parseError && (
            <p className="mt-3 text-sm text-red-600">{parseError}</p>
          )}
        </div>
      )}

      {/* ---- Step 2: Column Mapping ---- */}
      {step === 'map' && csv && (
        <div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Map CSV Columns
              </h3>
              <span className="text-sm text-gray-500">
                {fileName} &mdash; {csv.rows.length} rows
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Match each CSV column to the corresponding shift field. We&apos;ve
              auto-detected what we could.
            </p>

            <div className="space-y-3">
              {SHIFT_FIELDS.map((field) => (
                <div
                  key={field.key}
                  className="flex items-center gap-4"
                >
                  <label className="w-48 text-sm font-medium text-gray-700">
                    {field.label}
                    {field.required && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </label>
                  <select
                    value={mapping[field.key] ?? ''}
                    onChange={(e) =>
                      handleMappingChange(field.key, e.target.value)
                    }
                    className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                      mapping[field.key] !== null
                        ? 'border-green-300 bg-green-50'
                        : field.required
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-300'
                    }`}
                  >
                    <option value="">-- Select CSV column --</option>
                    {csv.headers.map((header, idx) => (
                      <option key={idx} value={idx}>
                        {header}
                        {csv.rows[0]?.[idx]
                          ? ` (e.g. "${csv.rows[0][idx]}")`
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Preview first 3 rows */}
            {csv.rows.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  CSV Preview (first 3 rows)
                </h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        {csv.headers.map((h, i) => (
                          <th
                            key={i}
                            className="px-3 py-2 text-left font-medium text-gray-500"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csv.rows.slice(0, 3).map((row, ri) => (
                        <tr key={ri} className="border-t">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-3 py-2 text-gray-700">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={handleValidate}
              disabled={!allRequiredMapped}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Validate &amp; Preview
            </button>
          </div>
        </div>
      )}

      {/* ---- Step 3: Validation Preview ---- */}
      {step === 'preview' && (
        <div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Validation Preview
            </h3>

            {/* Summary */}
            <div className="flex gap-4 mb-6">
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex-1">
                <div className="text-2xl font-bold text-green-700">
                  {validRows.length}
                </div>
                <div className="text-sm text-green-600">Valid rows</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex-1">
                <div className="text-2xl font-bold text-red-700">
                  {errorRows.length}
                </div>
                <div className="text-sm text-red-600">Rows with errors</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 flex-1">
                <div className="text-2xl font-bold text-gray-700">
                  {validatedRows.length}
                </div>
                <div className="text-sm text-gray-600">Total rows</div>
              </div>
            </div>

            {/* Error rows */}
            {errorRows.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-red-700 mb-2">
                  Rows with errors (will be skipped)
                </h4>
                <div className="max-h-60 overflow-y-auto border border-red-200 rounded-lg">
                  <table className="min-w-full text-xs">
                    <thead className="bg-red-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-red-700">
                          Row
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-red-700">
                          Errors
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-red-700">
                          Data
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {errorRows.map((row) => (
                        <tr key={row.rowNum} className="border-t border-red-100">
                          <td className="px-3 py-2 text-gray-700">
                            {row.rowNum}
                          </td>
                          <td className="px-3 py-2 text-red-600">
                            {row.errors.join('; ')}
                          </td>
                          <td className="px-3 py-2 text-gray-500 font-mono">
                            {Object.values(row.data).filter(Boolean).join(', ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Valid rows preview */}
            {validRows.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-green-700 mb-2">
                  Valid rows (first 10 shown)
                </h4>
                <div className="overflow-x-auto border border-green-200 rounded-lg">
                  <table className="min-w-full text-xs">
                    <thead className="bg-green-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-green-700">
                          Row
                        </th>
                        {SHIFT_FIELDS.map((f) => (
                          <th
                            key={f.key}
                            className="px-3 py-2 text-left font-medium text-green-700"
                          >
                            {f.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {validRows.slice(0, 10).map((row) => (
                        <tr key={row.rowNum} className="border-t border-green-100">
                          <td className="px-3 py-2 text-gray-700">
                            {row.rowNum}
                          </td>
                          {SHIFT_FIELDS.map((f) => (
                            <td
                              key={f.key}
                              className="px-3 py-2 text-gray-700"
                            >
                              {row.data[f.key]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {validRows.length > 10 && (
                  <p className="text-xs text-gray-500 mt-1">
                    ...and {validRows.length - 10} more rows
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setStep('map')}
              className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back to Mapping
            </button>
            <button
              onClick={handleImport}
              disabled={validRows.length === 0}
              className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Import {validRows.length} Shift{validRows.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* ---- Step 4: Importing ---- */}
      {step === 'importing' && (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Importing Shifts...
          </h3>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${importProgress}%` }}
            />
          </div>
          <p className="text-sm text-gray-500">
            Please wait while we create your shifts...
          </p>
        </div>
      )}

      {/* ---- Step 5: Done ---- */}
      {step === 'done' && importResults && (
        <div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Import Complete
            </h3>

            <div className="flex gap-4 mb-6">
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex-1">
                <div className="text-2xl font-bold text-green-700">
                  {importResults.created}
                </div>
                <div className="text-sm text-green-600">Shifts created</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex-1">
                <div className="text-2xl font-bold text-red-700">
                  {importResults.errors}
                </div>
                <div className="text-sm text-red-600">Errors</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 flex-1">
                <div className="text-2xl font-bold text-gray-700">
                  {importResults.total}
                </div>
                <div className="text-sm text-gray-600">Total submitted</div>
              </div>
            </div>

            {/* Error details */}
            {importResults.results.filter((r) => r.status === 'error').length >
              0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-red-700 mb-2">
                  Import Errors
                </h4>
                <div className="max-h-40 overflow-y-auto bg-red-50 rounded-lg p-3 text-sm">
                  {importResults.results
                    .filter((r) => r.status === 'error')
                    .map((r, i) => (
                      <div key={i} className="text-red-600">
                        {r.row > 0 ? `Row ${r.row}: ` : ''}
                        {r.error}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {importResults.created > 0 && (
              <p className="text-sm text-green-600">
                Successfully imported {importResults.created} shift
                {importResults.created !== 1 ? 's' : ''}.
              </p>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Import More
            </button>
            <a
              href="/dashboard"
              className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back to Dashboard
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
