'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  extractCsvHeaders,
  autoDetectMapping,
  parseShiftCsvWithMapping,
  SHIFT_FIELDS,
  type ColumnMapping,
  type CsvParseResult,
} from '@/lib/csv-import';
import type { CsvShiftRow } from '@/lib/validations';

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'done';

interface ImportResult {
  created: number;
  errors: { row: number; email: string; reason: string }[];
  total: number;
}

export default function CsvImportPage() {
  const [step, setStep] = useState<Step>('upload');
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setError('');
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);

      const { headers, previewRows: preview, totalRows: total } = extractCsvHeaders(text);
      if (headers.length === 0) {
        setError('Could not parse CSV headers. Please check the file format.');
        return;
      }

      setCsvHeaders(headers);
      setPreviewRows(preview);
      setTotalRows(total);

      const autoMapping = autoDetectMapping(headers);
      setMapping(autoMapping);
      setStep('mapping');
    };
    reader.onerror = () => setError('Failed to read file');
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

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleMappingChange = (csvHeader: string, field: string) => {
    setMapping((prev) => ({ ...prev, [csvHeader]: field as ColumnMapping[string] }));
  };

  const handleValidate = () => {
    const result = parseShiftCsvWithMapping(csvText, mapping);
    setParseResult(result);

    if (result.errors.length > 0 && result.errors[0].row === 0) {
      setError(result.errors[0].issues[0]);
      return;
    }
    setError('');
    setStep('preview');
  };

  const handleImport = async () => {
    if (!parseResult || parseResult.valid.length === 0) return;

    setStep('importing');
    setImportProgress(0);

    const shifts = parseResult.valid.map((row: CsvShiftRow) => ({
      email: row.email,
      date: row.date,
      startTime: row.start_time,
      endTime: row.end_time,
      role: row.role,
      department: row.department,
    }));

    // Simulate progress while waiting for response
    const progressInterval = setInterval(() => {
      setImportProgress((prev) => Math.min(prev + 5, 90));
    }, 200);

    try {
      const res = await fetch('/api/shifts/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shifts }),
      });

      clearInterval(progressInterval);
      setImportProgress(100);

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || 'Import failed');
        setStep('preview');
        return;
      }

      const result: ImportResult = await res.json();
      setImportResult(result);
      setStep('done');
    } catch {
      clearInterval(progressInterval);
      setError('Network error during import');
      setStep('preview');
    }
  };

  const handleReset = () => {
    setStep('upload');
    setCsvText('');
    setFileName('');
    setCsvHeaders([]);
    setPreviewRows([]);
    setTotalRows(0);
    setMapping({});
    setParseResult(null);
    setImportResult(null);
    setImportProgress(0);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const unmappedRequired = SHIFT_FIELDS.filter(
    (f) => !Object.values(mapping).includes(f)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
              &larr; Back
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Import Shifts from CSV</h1>
          </div>
          <StepIndicator current={step} />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div
            className={`border-2 border-dashed rounded-xl p-16 text-center transition-colors ${
              dragOver
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 bg-white hover:border-gray-400'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <div className="text-5xl mb-4 text-gray-400">
              <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-lg text-gray-600 mb-2">
              Drag and drop your CSV file here
            </p>
            <p className="text-sm text-gray-400 mb-6">or</p>
            <label className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium cursor-pointer transition-colors">
              Choose File
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
            <p className="text-sm text-gray-400 mt-6">
              Expected columns: email, date (YYYY-MM-DD), start_time (HH:MM), end_time (HH:MM), role, department
            </p>
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === 'mapping' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                Map CSV Columns
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                File: {fileName} ({totalRows} rows detected)
              </p>

              <div className="space-y-3">
                {csvHeaders.map((header) => (
                  <div key={header} className="flex items-center gap-4">
                    <div className="w-48 text-sm font-medium text-gray-700 truncate" title={header}>
                      {header}
                    </div>
                    <svg className="h-5 w-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    <select
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                      value={mapping[header] || ''}
                      onChange={(e) => handleMappingChange(header, e.target.value)}
                    >
                      <option value="">-- Skip this column --</option>
                      {SHIFT_FIELDS.map((field) => (
                        <option key={field} value={field}>
                          {field}
                        </option>
                      ))}
                    </select>
                    {mapping[header] && (
                      <span className="text-xs text-green-600 font-medium">Mapped</span>
                    )}
                  </div>
                ))}
              </div>

              {unmappedRequired.length > 0 && (
                <div className="mt-4 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg text-sm">
                  Required fields not yet mapped: {unmappedRequired.join(', ')}
                </div>
              )}
            </div>

            {/* Preview of raw data */}
            {previewRows.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Data Preview (first {previewRows.length} rows)</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {csvHeaders.map((h) => (
                          <th key={h} className="text-left py-2 px-3 font-medium text-gray-600">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          {csvHeaders.map((h) => (
                            <td key={h} className="py-2 px-3 text-gray-800">
                              {row[h] || ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleValidate}
                disabled={unmappedRequired.length > 0}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                Validate & Preview
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Validation Preview */}
        {step === 'preview' && parseResult && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-3xl font-bold text-gray-900">{totalRows}</div>
                <div className="text-sm text-gray-500">Total Rows</div>
              </div>
              <div className="bg-green-50 rounded-lg shadow p-6 text-center border border-green-200">
                <div className="text-3xl font-bold text-green-700">{parseResult.valid.length}</div>
                <div className="text-sm text-green-600">Valid Rows</div>
              </div>
              <div className={`rounded-lg shadow p-6 text-center border ${
                parseResult.errors.length > 0
                  ? 'bg-red-50 border-red-200'
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <div className={`text-3xl font-bold ${parseResult.errors.length > 0 ? 'text-red-700' : 'text-gray-400'}`}>
                  {parseResult.errors.length}
                </div>
                <div className={`text-sm ${parseResult.errors.length > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                  Errors
                </div>
              </div>
            </div>

            {/* Errors Table */}
            {parseResult.errors.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-red-700 mb-3">
                  Validation Errors ({parseResult.errors.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Row</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Data</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.errors.map((err, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-2 px-3 text-gray-800 font-mono">{err.row}</td>
                          <td className="py-2 px-3 text-gray-600 font-mono text-xs max-w-xs truncate">
                            {Object.entries(err.data)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(', ')}
                          </td>
                          <td className="py-2 px-3">
                            {err.issues.map((issue, j) => (
                              <div key={j} className="text-red-600 text-xs">{issue}</div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Valid Rows Preview */}
            {parseResult.valid.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-green-700 mb-3">
                  Valid Rows (showing first {Math.min(parseResult.valid.length, 10)})
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Email</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Date</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Start</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">End</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Role</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Department</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.valid.slice(0, 10).map((row, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-2 px-3 text-gray-800">{row.email}</td>
                          <td className="py-2 px-3 text-gray-800">{row.date}</td>
                          <td className="py-2 px-3 text-gray-800">{row.start_time}</td>
                          <td className="py-2 px-3 text-gray-800">{row.end_time}</td>
                          <td className="py-2 px-3 text-gray-800">{row.role}</td>
                          <td className="py-2 px-3 text-gray-800">{row.department}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parseResult.valid.length > 10 && (
                  <p className="text-sm text-gray-400 mt-2">
                    ...and {parseResult.valid.length - 10} more rows
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('mapping')}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Back to Mapping
              </button>
              <button
                onClick={handleImport}
                disabled={parseResult.valid.length === 0}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                Import {parseResult.valid.length} Shift{parseResult.valid.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Importing */}
        {step === 'importing' && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="mb-6">
              <svg className="animate-spin mx-auto h-12 w-12 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Importing shifts...</h2>
            <div className="max-w-md mx-auto">
              <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">{importProgress}%</p>
            </div>
          </div>
        )}

        {/* Step 5: Done */}
        {step === 'done' && importResult && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-5xl mb-4">
                {importResult.errors.length === 0 ? (
                  <svg className="mx-auto h-16 w-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="mx-auto h-16 w-16 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                )}
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Import Complete</h2>
              <p className="text-gray-600">
                Successfully created {importResult.created} of {importResult.total} shifts.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-50 rounded-lg shadow p-6 text-center border border-green-200">
                <div className="text-3xl font-bold text-green-700">{importResult.created}</div>
                <div className="text-sm text-green-600">Successfully Created</div>
              </div>
              <div className={`rounded-lg shadow p-6 text-center border ${
                importResult.errors.length > 0
                  ? 'bg-red-50 border-red-200'
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <div className={`text-3xl font-bold ${importResult.errors.length > 0 ? 'text-red-700' : 'text-gray-400'}`}>
                  {importResult.errors.length}
                </div>
                <div className={`text-sm ${importResult.errors.length > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                  Failed
                </div>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-red-700 mb-3">Import Errors</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Row</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Email</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.errors.map((err, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-2 px-3 text-gray-800 font-mono">{err.row}</td>
                          <td className="py-2 px-3 text-gray-800">{err.email}</td>
                          <td className="py-2 px-3 text-red-600">{err.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Import Another File
              </button>
              <Link
                href="/dashboard"
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
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

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step | Step[]; label: string }[] = [
    { key: 'upload', label: 'Upload' },
    { key: 'mapping', label: 'Map Columns' },
    { key: 'preview', label: 'Preview' },
    { key: ['importing', 'done'], label: 'Import' },
  ];

  const currentIdx = steps.findIndex((s) =>
    Array.isArray(s.key) ? s.key.includes(current) : s.key === current
  );

  return (
    <div className="hidden md:flex items-center gap-2 text-sm">
      {steps.map((s, i) => {
        const isActive = i === currentIdx;
        const isDone = i < currentIdx;
        return (
          <div key={i} className="flex items-center gap-2">
            {i > 0 && <div className={`w-8 h-0.5 ${isDone ? 'bg-blue-500' : 'bg-gray-300'}`} />}
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${
                isActive
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : isDone
                    ? 'text-blue-600'
                    : 'text-gray-400'
              }`}
            >
              <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs ${
                isDone
                  ? 'bg-blue-500 text-white'
                  : isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-300 text-white'
              }`}>
                {isDone ? '\u2713' : i + 1}
              </span>
              {s.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
