'use client';

import { useState, useCallback, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import {
  parseShiftCsv,
  extractCsvHeaders,
  autoMapHeaders,
  REQUIRED_FIELDS,
  type ColumnMapping,
  type CsvParseResult,
} from '@/lib/csv-import';
import type { CsvShiftRow } from '@/lib/validations';

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'done';

interface ImportResult {
  created: number;
  failed: Array<{ row: number; email: string; error: string }>;
  total: number;
}

export function CsvImport() {
  const [step, setStep] = useState<ImportStep>('upload');
  const [csvContent, setCsvContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bulkCreate = trpc.shift.bulkCreate.useMutation();

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      setImportError('Please upload a CSV file');
      return;
    }

    setFileName(file.name);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvContent(text);

      const headers = extractCsvHeaders(text);
      setCsvHeaders(headers);

      const mapping = autoMapHeaders(headers);
      setColumnMapping(mapping);

      const mappedFields = new Set(Object.values(mapping).filter(Boolean));
      const allMapped = REQUIRED_FIELDS.every((f) => mappedFields.has(f));

      if (allMapped) {
        const result = parseShiftCsv(text, mapping);
        setParseResult(result);
        setStep('preview');
      } else {
        setStep('mapping');
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleMappingChange = (csvHeader: string, field: string) => {
    setColumnMapping((prev) => ({ ...prev, [csvHeader]: field as ColumnMapping[string] }));
  };

  const applyMapping = () => {
    const mappedFields = new Set(Object.values(columnMapping).filter(Boolean));
    const missingFields = REQUIRED_FIELDS.filter((f) => !mappedFields.has(f));

    if (missingFields.length > 0) {
      setImportError(`Please map all required fields. Missing: ${missingFields.join(', ')}`);
      return;
    }

    setImportError(null);
    const result = parseShiftCsv(csvContent, columnMapping);
    setParseResult(result);
    setStep('preview');
  };

  const startImport = async () => {
    if (!parseResult || parseResult.valid.length === 0) return;

    setStep('importing');
    setImportError(null);

    try {
      const shifts = parseResult.valid.map((row: CsvShiftRow) => ({
        email: row.email,
        date: row.date,
        startTime: row.start_time,
        endTime: row.end_time,
        role: row.role,
        department: row.department,
      }));

      const result = await bulkCreate.mutateAsync({ shifts });
      setImportResult(result);
      setStep('done');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
    }
  };

  const reset = () => {
    setStep('upload');
    setCsvContent('');
    setFileName('');
    setCsvHeaders([]);
    setColumnMapping({});
    setParseResult(null);
    setImportResult(null);
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const inputStyles = "w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400";

  return (
    <div className="max-w-4xl mx-auto">
      {importError && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2 animate-fade-in-down">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {importError}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-2xl p-14 text-center transition-all duration-300 ${
            isDragging
              ? 'border-brand-400 bg-brand-50/50 scale-[1.01]'
              : 'border-border hover:border-brand-300 hover:bg-surface-secondary/50'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center mx-auto mb-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-text-primary mb-1.5">
            Drop your CSV file here
          </h3>
          <p className="text-sm text-text-secondary mb-5">or click to browse</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            className="hidden"
            id="csv-file-input"
          />
          <label
            htmlFor="csv-file-input"
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-xl cursor-pointer text-sm font-medium transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Choose File
          </label>
          <div className="mt-7 text-xs text-text-tertiary">
            <p className="font-medium mb-1">Expected columns:</p>
            <p className="font-mono text-[11px]">email, date (YYYY-MM-DD), start_time (HH:MM), end_time (HH:MM), role, department</p>
          </div>
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === 'mapping' && (
        <div className="bg-surface rounded-2xl border border-border p-7 animate-fade-in-up">
          <h3 className="text-base font-semibold text-text-primary mb-1.5">
            Map Columns
          </h3>
          <p className="text-sm text-text-secondary mb-5">
            File: <span className="font-medium text-text-primary">{fileName}</span> — Map your CSV columns to the required fields.
          </p>

          <div className="space-y-3 mb-6">
            {csvHeaders.map((header) => (
              <div key={header} className="flex items-center gap-4">
                <span className="w-48 text-sm font-medium text-text-primary truncate font-mono text-[13px]" title={header}>
                  {header}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary shrink-0">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
                <select
                  value={columnMapping[header] || ''}
                  onChange={(e) => handleMappingChange(header, e.target.value)}
                  className={`flex-1 ${inputStyles}`}
                >
                  <option value="">-- Skip this column --</option>
                  {REQUIRED_FIELDS.map((field) => (
                    <option key={field} value={field}>
                      {field}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={reset}
              className="px-4 py-2.5 bg-surface-secondary hover:bg-border text-text-primary rounded-xl text-sm font-medium border border-border transition-all active:scale-[0.98]"
            >
              Back
            </button>
            <button
              onClick={applyMapping}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              Preview Data
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Validation Preview */}
      {step === 'preview' && parseResult && (
        <div className="space-y-6 animate-fade-in-up">
          <div className="bg-surface rounded-2xl border border-border p-7">
            <h3 className="text-base font-semibold text-text-primary mb-1.5">
              Validation Preview
            </h3>
            <p className="text-sm text-text-secondary mb-5">
              File: <span className="font-medium text-text-primary">{fileName}</span>
            </p>

            <div className="flex gap-4 mb-6">
              <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-emerald-700">
                  {parseResult.valid.length}
                </div>
                <div className="text-xs text-emerald-600 font-medium mt-0.5">Valid rows</div>
              </div>
              <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-red-700">
                  {parseResult.errors.length}
                </div>
                <div className="text-xs text-red-600 font-medium mt-0.5">Errors</div>
              </div>
            </div>

            {/* Valid rows preview */}
            {parseResult.valid.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-text-primary mb-3">
                  Valid Shifts ({parseResult.valid.length})
                </h4>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-secondary border-b border-border">
                        <th className="text-left py-2.5 px-3.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Email</th>
                        <th className="text-left py-2.5 px-3.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Date</th>
                        <th className="text-left py-2.5 px-3.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Start</th>
                        <th className="text-left py-2.5 px-3.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">End</th>
                        <th className="text-left py-2.5 px-3.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Role</th>
                        <th className="text-left py-2.5 px-3.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Department</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light">
                      {parseResult.valid.slice(0, 10).map((row, i) => (
                        <tr key={i} className="hover:bg-surface-secondary/50 transition-colors">
                          <td className="py-2.5 px-3.5 text-text-primary">{row.email}</td>
                          <td className="py-2.5 px-3.5 font-mono text-[13px]">{row.date}</td>
                          <td className="py-2.5 px-3.5 font-mono text-[13px]">{row.start_time}</td>
                          <td className="py-2.5 px-3.5 font-mono text-[13px]">{row.end_time}</td>
                          <td className="py-2.5 px-3.5 capitalize">{row.role}</td>
                          <td className="py-2.5 px-3.5">{row.department}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parseResult.valid.length > 10 && (
                    <div className="px-3.5 py-2.5 text-xs text-text-tertiary bg-surface-secondary border-t border-border">
                      ...and {parseResult.valid.length - 10} more rows
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error rows */}
            {parseResult.errors.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-red-700 mb-3">
                  Errors ({parseResult.errors.length})
                </h4>
                <div className="space-y-2">
                  {parseResult.errors.map((err, i) => (
                    <div key={i} className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm">
                      <span className="font-medium text-red-800">Row {err.row}:</span>{' '}
                      <span className="text-red-700">{err.issues.join('; ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={reset}
              className="px-4 py-2.5 bg-surface-secondary hover:bg-border text-text-primary rounded-xl text-sm font-medium border border-border transition-all active:scale-[0.98]"
            >
              Start Over
            </button>
            <button
              onClick={() => setStep('mapping')}
              className="px-4 py-2.5 bg-surface-secondary hover:bg-border text-text-primary rounded-xl text-sm font-medium border border-border transition-all active:scale-[0.98]"
            >
              Edit Mapping
            </button>
            {parseResult.valid.length > 0 && (
              <button
                onClick={startImport}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
              >
                Import {parseResult.valid.length} Shift{parseResult.valid.length !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 4: Importing */}
      {step === 'importing' && (
        <div className="bg-surface rounded-2xl border border-border p-14 text-center animate-fade-in-up">
          <div className="w-12 h-12 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-5" />
          <h3 className="text-base font-semibold text-text-primary mb-1.5">
            Importing Shifts...
          </h3>
          <p className="text-sm text-text-secondary">
            Creating {parseResult?.valid.length} shift{(parseResult?.valid.length ?? 0) !== 1 ? 's' : ''}. Please wait.
          </p>
        </div>
      )}

      {/* Step 5: Done */}
      {step === 'done' && importResult && (
        <div className="space-y-6 animate-fade-in-up">
          <div className="bg-surface rounded-2xl border border-border p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-text-primary">
                Import Complete
              </h3>
            </div>

            <div className="flex gap-4 mb-6">
              <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-emerald-700">
                  {importResult.created}
                </div>
                <div className="text-xs text-emerald-600 font-medium mt-0.5">Created</div>
              </div>
              <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-red-700">
                  {importResult.failed.length}
                </div>
                <div className="text-xs text-red-600 font-medium mt-0.5">Failed</div>
              </div>
              <div className="flex-1 bg-surface-secondary border border-border rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-text-primary">
                  {importResult.total}
                </div>
                <div className="text-xs text-text-secondary font-medium mt-0.5">Total</div>
              </div>
            </div>

            {importResult.failed.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-red-700 mb-3">
                  Failed Rows
                </h4>
                <div className="space-y-2">
                  {importResult.failed.map((err, i) => (
                    <div key={i} className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm">
                      <span className="font-medium text-red-800">Row {err.row}</span>{' '}
                      <span className="text-red-700">({err.email}): {err.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={reset}
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
          >
            Import Another File
          </button>
        </div>
      )}
    </div>
  );
}
