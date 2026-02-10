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

      // Check if all fields are auto-mapped
      const mappedFields = new Set(Object.values(mapping).filter(Boolean));
      const allMapped = REQUIRED_FIELDS.every((f) => mappedFields.has(f));

      if (allMapped) {
        // Skip mapping step if auto-mapping is complete
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

  return (
    <div className="max-w-4xl mx-auto">
      {importError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {importError}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <div className="text-4xl mb-4">📄</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Drop your CSV file here
          </h3>
          <p className="text-gray-500 mb-4">or click to browse</p>
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
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg cursor-pointer transition-colors"
          >
            Choose File
          </label>
          <div className="mt-6 text-sm text-gray-400">
            <p className="font-medium mb-1">Expected columns:</p>
            <p>email, date (YYYY-MM-DD), start_time (HH:MM), end_time (HH:MM), role, department</p>
          </div>
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === 'mapping' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Map Columns
          </h3>
          <p className="text-gray-500 mb-4">
            File: <span className="font-medium">{fileName}</span> — Map your CSV columns to the required fields.
          </p>

          <div className="space-y-3 mb-6">
            {csvHeaders.map((header) => (
              <div key={header} className="flex items-center gap-4">
                <span className="w-48 text-sm font-medium text-gray-700 truncate" title={header}>
                  {header}
                </span>
                <span className="text-gray-400">→</span>
                <select
                  value={columnMapping[header] || ''}
                  onChange={(e) => handleMappingChange(header, e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              onClick={applyMapping}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Preview Data
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Validation Preview */}
      {step === 'preview' && parseResult && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Validation Preview
            </h3>
            <p className="text-gray-500 mb-4">
              File: <span className="font-medium">{fileName}</span>
            </p>

            <div className="flex gap-4 mb-6">
              <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-700">
                  {parseResult.valid.length}
                </div>
                <div className="text-sm text-green-600">Valid rows</div>
              </div>
              <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-700">
                  {parseResult.errors.length}
                </div>
                <div className="text-sm text-red-600">Errors</div>
              </div>
            </div>

            {/* Valid rows preview */}
            {parseResult.valid.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  Valid Shifts ({parseResult.valid.length})
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 text-gray-600">Email</th>
                        <th className="text-left py-2 px-3 text-gray-600">Date</th>
                        <th className="text-left py-2 px-3 text-gray-600">Start</th>
                        <th className="text-left py-2 px-3 text-gray-600">End</th>
                        <th className="text-left py-2 px-3 text-gray-600">Role</th>
                        <th className="text-left py-2 px-3 text-gray-600">Department</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.valid.slice(0, 10).map((row, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-2 px-3">{row.email}</td>
                          <td className="py-2 px-3">{row.date}</td>
                          <td className="py-2 px-3">{row.start_time}</td>
                          <td className="py-2 px-3">{row.end_time}</td>
                          <td className="py-2 px-3">{row.role}</td>
                          <td className="py-2 px-3">{row.department}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parseResult.valid.length > 10 && (
                    <p className="text-sm text-gray-400 mt-2 px-3">
                      ...and {parseResult.valid.length - 10} more rows
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Error rows */}
            {parseResult.errors.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-red-700 mb-2">
                  Errors ({parseResult.errors.length})
                </h4>
                <div className="space-y-2">
                  {parseResult.errors.map((err, i) => (
                    <div key={i} className="bg-red-50 border border-red-100 rounded p-3 text-sm">
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
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Start Over
            </button>
            <button
              onClick={() => setStep('mapping')}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Edit Mapping
            </button>
            {parseResult.valid.length > 0 && (
              <button
                onClick={startImport}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                Import {parseResult.valid.length} Shift{parseResult.valid.length !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 4: Importing */}
      {step === 'importing' && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Importing Shifts...
          </h3>
          <p className="text-gray-500">
            Creating {parseResult?.valid.length} shift{(parseResult?.valid.length ?? 0) !== 1 ? 's' : ''}. Please wait.
          </p>
        </div>
      )}

      {/* Step 5: Done */}
      {step === 'done' && importResult && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Import Complete
            </h3>

            <div className="flex gap-4 mb-6">
              <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-700">
                  {importResult.created}
                </div>
                <div className="text-sm text-green-600">Created</div>
              </div>
              <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-700">
                  {importResult.failed.length}
                </div>
                <div className="text-sm text-red-600">Failed</div>
              </div>
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-700">
                  {importResult.total}
                </div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
            </div>

            {importResult.failed.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-red-700 mb-2">
                  Failed Rows
                </h4>
                <div className="space-y-2">
                  {importResult.failed.map((err, i) => (
                    <div key={i} className="bg-red-50 border border-red-100 rounded p-3 text-sm">
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
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Import Another File
          </button>
        </div>
      )}
    </div>
  );
}
