'use client';

import { useState, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

// The fields we need to create shifts
const SHIFT_FIELDS = [
  { key: 'date', label: 'Date', required: true, description: 'YYYY-MM-DD' },
  { key: 'start_time', label: 'Start Time', required: true, description: 'HH:MM (24h)' },
  { key: 'end_time', label: 'End Time', required: true, description: 'HH:MM (24h)' },
  { key: 'role', label: 'Role / Position', required: true, description: 'Job title' },
  { key: 'department', label: 'Location / Department', required: true, description: 'Location name' },
  { key: 'employee_email', label: 'Employee Email', required: true, description: 'Must match existing user' },
] as const;

type ShiftFieldKey = (typeof SHIFT_FIELDS)[number]['key'];

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ParsedRow {
  [key: string]: string;
}

interface MappedShift {
  date: string;
  start_time: string;
  end_time: string;
  role: string;
  department: string;
  employee_email: string;
}

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'done';

export default function ImportPage() {
  const [step, setStep] = useState<Step>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<ParsedRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<ShiftFieldKey, string>>({
    date: '',
    start_time: '',
    end_time: '',
    role: '',
    department: '',
    employee_email: '',
  });
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [mappedData, setMappedData] = useState<MappedShift[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 1: Parse uploaded CSV
  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('Please upload a CSV file.');
      return;
    }
    setFileName(file.name);

    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        if (results.errors.length > 0) {
          alert(`CSV parse errors: ${results.errors.map(e => e.message).join(', ')}`);
          return;
        }
        const headers = results.meta.fields || [];
        setCsvHeaders(headers);
        setCsvData(results.data);

        // Auto-map columns by best guess
        const autoMapping: Record<ShiftFieldKey, string> = {
          date: '',
          start_time: '',
          end_time: '',
          role: '',
          department: '',
          employee_email: '',
        };

        for (const field of SHIFT_FIELDS) {
          const match = headers.find(h => {
            const lower = h.toLowerCase().replace(/[_\s-]/g, '');
            const fieldLower = field.key.toLowerCase().replace(/[_\s-]/g, '');
            if (lower === fieldLower) return true;
            // Fuzzy matches
            if (field.key === 'date' && (lower === 'date' || lower === 'shiftdate')) return true;
            if (field.key === 'start_time' && (lower.includes('start') || lower === 'from')) return true;
            if (field.key === 'end_time' && (lower.includes('end') || lower === 'to' || lower === 'finish')) return true;
            if (field.key === 'role' && (lower.includes('role') || lower.includes('position') || lower.includes('title'))) return true;
            if (field.key === 'department' && (lower.includes('department') || lower.includes('location') || lower.includes('site') || lower.includes('clinic'))) return true;
            if (field.key === 'employee_email' && (lower.includes('email') || lower.includes('employee'))) return true;
            return false;
          });
          if (match) autoMapping[field.key] = match;
        }

        setColumnMapping(autoMapping);
        setStep('mapping');
      },
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // Step 2: Validate mapped data
  const validateAndPreview = useCallback(() => {
    const unmapped = SHIFT_FIELDS.filter(f => f.required && !columnMapping[f.key]);
    if (unmapped.length > 0) {
      alert(`Please map all required fields: ${unmapped.map(f => f.label).join(', ')}`);
      return;
    }

    const validationErrors: ValidationError[] = [];
    const mapped: MappedShift[] = [];

    csvData.forEach((row, i) => {
      const rowNum = i + 2; // 1-indexed + header row
      const shift: MappedShift = {
        date: (row[columnMapping.date] || '').trim(),
        start_time: (row[columnMapping.start_time] || '').trim(),
        end_time: (row[columnMapping.end_time] || '').trim(),
        role: (row[columnMapping.role] || '').trim(),
        department: (row[columnMapping.department] || '').trim(),
        employee_email: (row[columnMapping.employee_email] || '').trim().toLowerCase(),
      };

      // Validate date (YYYY-MM-DD)
      if (!shift.date) {
        validationErrors.push({ row: rowNum, field: 'date', message: 'Date is required' });
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(shift.date)) {
        // Try to parse common date formats
        const parsed = tryParseDate(shift.date);
        if (parsed) {
          shift.date = parsed;
        } else {
          validationErrors.push({ row: rowNum, field: 'date', message: `Invalid date format: "${shift.date}" (expected YYYY-MM-DD)` });
        }
      }

      // Validate times (HH:MM)
      if (!shift.start_time) {
        validationErrors.push({ row: rowNum, field: 'start_time', message: 'Start time is required' });
      } else {
        const parsed = tryParseTime(shift.start_time);
        if (parsed) {
          shift.start_time = parsed;
        } else if (!/^\d{2}:\d{2}(:\d{2})?$/.test(shift.start_time)) {
          validationErrors.push({ row: rowNum, field: 'start_time', message: `Invalid time: "${shift.start_time}" (expected HH:MM)` });
        }
      }

      if (!shift.end_time) {
        validationErrors.push({ row: rowNum, field: 'end_time', message: 'End time is required' });
      } else {
        const parsed = tryParseTime(shift.end_time);
        if (parsed) {
          shift.end_time = parsed;
        } else if (!/^\d{2}:\d{2}(:\d{2})?$/.test(shift.end_time)) {
          validationErrors.push({ row: rowNum, field: 'end_time', message: `Invalid time: "${shift.end_time}" (expected HH:MM)` });
        }
      }

      // Validate required text fields
      if (!shift.role) {
        validationErrors.push({ row: rowNum, field: 'role', message: 'Role is required' });
      }
      if (!shift.department) {
        validationErrors.push({ row: rowNum, field: 'department', message: 'Department/location is required' });
      }

      // Validate email format
      if (!shift.employee_email) {
        validationErrors.push({ row: rowNum, field: 'employee_email', message: 'Employee email is required' });
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shift.employee_email)) {
        validationErrors.push({ row: rowNum, field: 'employee_email', message: `Invalid email: "${shift.employee_email}"` });
      }

      mapped.push(shift);
    });

    setErrors(validationErrors);
    setMappedData(mapped);
    setStep('preview');
  }, [csvData, columnMapping]);

  // Step 3: Import shifts
  const handleImport = useCallback(async () => {
    setStep('importing');
    setImportProgress(0);

    const supabase = createClient();

    // Look up user IDs by email
    const emails = [...new Set(mappedData.map(s => s.employee_email))];
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email') as { data: Array<{ id: string; email: string }> | null; error: { message: string } | null };

    if (userError) {
      setImportResult({
        success: 0,
        failed: mappedData.length,
        errors: [`Failed to look up users: ${userError.message}`],
      });
      setStep('done');
      return;
    }

    const emailToId = new Map(
      (users || [])
        .filter(u => emails.includes(u.email.toLowerCase()))
        .map(u => [u.email.toLowerCase(), u.id])
    );

    // Find rows with unknown emails
    const importErrors: string[] = [];
    const validShifts: Array<{
      user_id: string;
      date: string;
      start_time: string;
      end_time: string;
      role: string;
      department: string;
    }> = [];

    // Only import rows that had no validation errors
    const errorRows = new Set(errors.map(e => e.row));

    mappedData.forEach((shift, i) => {
      const rowNum = i + 2;
      if (errorRows.has(rowNum)) return;

      const userId = emailToId.get(shift.employee_email);
      if (!userId) {
        importErrors.push(`Row ${rowNum}: Unknown email "${shift.employee_email}"`);
        return;
      }

      validShifts.push({
        user_id: userId,
        date: shift.date,
        start_time: shift.start_time.substring(0, 5), // Ensure HH:MM
        end_time: shift.end_time.substring(0, 5),
        role: shift.role,
        department: shift.department,
      });
    });

    // Batch insert in chunks of 50
    const BATCH_SIZE = 50;
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < validShifts.length; i += BATCH_SIZE) {
      const batch = validShifts.slice(i, i + BATCH_SIZE);

      // @ts-expect-error -- hand-written Database types don't fully satisfy Supabase generics
      const { error } = await supabase.from('shifts').insert(batch);

      if (error) {
        failedCount += batch.length;
        importErrors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      } else {
        successCount += batch.length;
      }

      setImportProgress(Math.round(((i + batch.length) / validShifts.length) * 100));
    }

    failedCount += errors.length; // Validation errors count as failed

    setImportResult({
      success: successCount,
      failed: failedCount + importErrors.length - (failedCount > 0 ? 0 : 0),
      errors: importErrors,
    });
    setImportProgress(100);
    setStep('done');
  }, [mappedData, errors]);

  const reset = () => {
    setStep('upload');
    setFileName('');
    setCsvHeaders([]);
    setCsvData([]);
    setColumnMapping({
      date: '',
      start_time: '',
      end_time: '',
      role: '',
      department: '',
      employee_email: '',
    });
    setErrors([]);
    setMappedData([]);
    setImportProgress(0);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
              &larr; Back
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Import Shifts</h1>
          </div>
          <StepIndicator current={step} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="bg-white rounded-lg shadow p-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Upload CSV File</h2>
            <p className="text-gray-600 mb-6">
              Upload a CSV file with shift data. Expected columns: date, start time, end time,
              role, location/department, and employee email.
            </p>

            {/* Drag-drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="text-4xl mb-4">📁</div>
              <p className="text-lg font-medium text-gray-700 mb-1">
                Drag & drop your CSV file here
              </p>
              <p className="text-sm text-gray-500">or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>

            {/* Sample format */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Expected CSV format:</h3>
              <code className="text-xs text-gray-600 block overflow-x-auto whitespace-pre">
{`date,start_time,end_time,role,location,employee_email
2025-01-15,07:00,15:00,Medical Assistant,Downtown Clinic,jane@example.com
2025-01-15,15:00,23:00,Front Desk,Eastside Office,john@example.com`}
              </code>
            </div>
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === 'mapping' && (
          <div className="bg-white rounded-lg shadow p-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Map Columns</h2>
            <p className="text-gray-600 mb-1">
              File: <span className="font-medium">{fileName}</span> ({csvData.length} rows)
            </p>
            <p className="text-gray-500 text-sm mb-6">
              Match your CSV columns to the required shift fields. We auto-detected some mappings.
            </p>

            <div className="space-y-4">
              {SHIFT_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center gap-4">
                  <div className="w-48 shrink-0">
                    <label className="text-sm font-medium text-gray-700">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <p className="text-xs text-gray-500">{field.description}</p>
                  </div>
                  <div className="text-gray-400">&rarr;</div>
                  <select
                    value={columnMapping[field.key]}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className={`flex-1 border rounded-lg px-3 py-2 text-sm ${
                      columnMapping[field.key]
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-300'
                    }`}
                  >
                    <option value="">-- Select column --</option>
                    {csvHeaders.map((header) => (
                      <option key={header} value={header}>
                        {header}
                        {csvData[0] ? ` (e.g., "${csvData[0][header]}")` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="mt-8 flex gap-4">
              <button
                onClick={reset}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Start Over
              </button>
              <button
                onClick={validateAndPreview}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Validate & Preview
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Validation Preview */}
        {step === 'preview' && (
          <div className="bg-white rounded-lg shadow p-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Preview & Validate</h2>

            {/* Summary */}
            <div className="flex gap-4 mb-6">
              <div className="flex-1 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-2xl font-bold text-green-700">
                  {mappedData.length - new Set(errors.map(e => e.row)).size}
                </div>
                <div className="text-sm text-green-600">Valid rows</div>
              </div>
              <div className="flex-1 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-2xl font-bold text-red-700">
                  {new Set(errors.map(e => e.row)).size}
                </div>
                <div className="text-sm text-red-600">Rows with errors</div>
              </div>
              <div className="flex-1 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="text-2xl font-bold text-gray-700">{mappedData.length}</div>
                <div className="text-sm text-gray-600">Total rows</div>
              </div>
            </div>

            {/* Errors */}
            {errors.length > 0 && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="text-sm font-medium text-red-800 mb-2">
                  Validation Errors ({errors.length})
                </h3>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {errors.map((err, i) => (
                    <p key={i} className="text-sm text-red-700">
                      Row {err.row}: {err.message}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Data preview table */}
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-3 py-2 text-gray-600">Row</th>
                    {SHIFT_FIELDS.map((f) => (
                      <th key={f.key} className="text-left px-3 py-2 text-gray-600">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mappedData.slice(0, 20).map((row, i) => {
                    const rowNum = i + 2;
                    const rowErrors = errors.filter(e => e.row === rowNum);
                    const hasError = rowErrors.length > 0;
                    const errorFields = new Set(rowErrors.map(e => e.field));

                    return (
                      <tr
                        key={i}
                        className={`border-b ${hasError ? 'bg-red-50' : ''}`}
                      >
                        <td className="px-3 py-2 text-gray-500">{rowNum}</td>
                        <td className={`px-3 py-2 ${errorFields.has('date') ? 'text-red-600 font-medium' : ''}`}>
                          {row.date || <span className="text-gray-400">-</span>}
                        </td>
                        <td className={`px-3 py-2 ${errorFields.has('start_time') ? 'text-red-600 font-medium' : ''}`}>
                          {row.start_time || <span className="text-gray-400">-</span>}
                        </td>
                        <td className={`px-3 py-2 ${errorFields.has('end_time') ? 'text-red-600 font-medium' : ''}`}>
                          {row.end_time || <span className="text-gray-400">-</span>}
                        </td>
                        <td className={`px-3 py-2 ${errorFields.has('role') ? 'text-red-600 font-medium' : ''}`}>
                          {row.role || <span className="text-gray-400">-</span>}
                        </td>
                        <td className={`px-3 py-2 ${errorFields.has('department') ? 'text-red-600 font-medium' : ''}`}>
                          {row.department || <span className="text-gray-400">-</span>}
                        </td>
                        <td className={`px-3 py-2 ${errorFields.has('employee_email') ? 'text-red-600 font-medium' : ''}`}>
                          {row.employee_email || <span className="text-gray-400">-</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {mappedData.length > 20 && (
                <p className="text-sm text-gray-500 mt-2 px-3">
                  Showing first 20 of {mappedData.length} rows...
                </p>
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep('mapping')}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Back to Mapping
              </button>
              <button
                onClick={handleImport}
                disabled={mappedData.length - new Set(errors.map(e => e.row)).size === 0}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import {mappedData.length - new Set(errors.map(e => e.row)).size} Shifts
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Importing (progress) */}
        {step === 'importing' && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Importing Shifts...</h2>
            <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
              <div
                className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                style={{ width: `${importProgress}%` }}
              />
            </div>
            <p className="text-gray-600">{importProgress}% complete</p>
          </div>
        )}

        {/* Step 5: Done */}
        {step === 'done' && importResult && (
          <div className="bg-white rounded-lg shadow p-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Import Complete</h2>

            <div className="flex gap-4 mb-6">
              <div className="flex-1 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                <div className="text-3xl font-bold text-green-700">{importResult.success}</div>
                <div className="text-sm text-green-600">Shifts created</div>
              </div>
              {importResult.failed > 0 && (
                <div className="flex-1 p-4 bg-red-50 border border-red-200 rounded-lg text-center">
                  <div className="text-3xl font-bold text-red-700">{importResult.failed}</div>
                  <div className="text-sm text-red-600">Failed</div>
                </div>
              )}
            </div>

            {importResult.errors.length > 0 && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="text-sm font-medium text-red-800 mb-2">Errors:</h3>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {importResult.errors.map((err, i) => (
                    <p key={i} className="text-sm text-red-700">{err}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={reset}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Import Another File
              </button>
              <Link
                href="/dashboard"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-block"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Step indicator component
function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'upload', label: 'Upload' },
    { key: 'mapping', label: 'Map Columns' },
    { key: 'preview', label: 'Preview' },
    { key: 'importing', label: 'Import' },
    { key: 'done', label: 'Done' },
  ];

  const currentIdx = steps.findIndex(s => s.key === current);

  return (
    <div className="hidden md:flex items-center gap-2 text-sm">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <span
            className={`px-2 py-1 rounded ${
              i === currentIdx
                ? 'bg-blue-100 text-blue-800 font-medium'
                : i < currentIdx
                  ? 'text-green-600'
                  : 'text-gray-400'
            }`}
          >
            {i < currentIdx ? '\u2713' : i + 1}. {s.label}
          </span>
          {i < steps.length - 1 && <span className="text-gray-300">&gt;</span>}
        </div>
      ))}
    </div>
  );
}

// Helpers to parse common date/time formats
function tryParseDate(value: string): string | null {
  // Try MM/DD/YYYY
  const mdyMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Try MM-DD-YYYY
  const mdyDash = value.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (mdyDash) {
    const [, m, d, y] = mdyDash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Try to use Date.parse as fallback
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return null;
}

function tryParseTime(value: string): string | null {
  // Already HH:MM or HH:MM:SS
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(value)) return value.substring(0, 5);

  // Try 12h format: "7:00 AM", "3:30 PM"
  const match12 = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)$/);
  if (match12) {
    const [, hStr, min, period] = match12;
    let h = parseInt(hStr, 10);
    if (period.toUpperCase() === 'PM' && h !== 12) h += 12;
    if (period.toUpperCase() === 'AM' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${min}`;
  }

  // Try H:MM (single digit hour)
  const matchShort = value.match(/^(\d{1}):(\d{2})$/);
  if (matchShort) {
    const [, h, min] = matchShort;
    return `${h.padStart(2, '0')}:${min}`;
  }

  return null;
}
