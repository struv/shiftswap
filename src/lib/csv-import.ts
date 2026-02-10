import { z } from 'zod';

// Schema for a single CSV shift row
export const csvShiftRowSchema = z.object({
  email: z.string().email('Invalid email address'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be HH:MM format'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be HH:MM format'),
  role: z.string().min(1, 'Role is required'),
  department: z.string().min(1, 'Department is required'),
});

export type CsvShiftRow = z.infer<typeof csvShiftRowSchema>;

export interface CsvImportResult {
  success: boolean;
  totalRows: number;
  validRows: CsvShiftRow[];
  errors: CsvImportError[];
}

export interface CsvImportError {
  row: number;
  field: string;
  message: string;
  value: string;
}

/**
 * Parse CSV text into rows of key-value objects.
 * Expects the first row to be headers.
 */
export function parseCsvText(csvText: string): Record<string, string>[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = values[i] || '';
    });
    return row;
  });
}

/**
 * Validate and import CSV shift data.
 * Returns a result object with valid rows and any errors encountered.
 */
export function validateCsvImport(csvText: string): CsvImportResult {
  const rows = parseCsvText(csvText);
  const validRows: CsvShiftRow[] = [];
  const errors: CsvImportError[] = [];

  if (rows.length === 0) {
    return {
      success: false,
      totalRows: 0,
      validRows: [],
      errors: [{ row: 0, field: 'csv', message: 'CSV file is empty or has no data rows', value: '' }],
    };
  }

  // Check required headers
  const requiredHeaders = ['email', 'date', 'start_time', 'end_time', 'role', 'department'];
  const firstRow = rows[0];
  const missingHeaders = requiredHeaders.filter((h) => !(h in firstRow));

  if (missingHeaders.length > 0) {
    return {
      success: false,
      totalRows: rows.length,
      validRows: [],
      errors: [{
        row: 0,
        field: 'headers',
        message: `Missing required headers: ${missingHeaders.join(', ')}`,
        value: '',
      }],
    };
  }

  rows.forEach((row, index) => {
    const result = csvShiftRowSchema.safeParse(row);

    if (result.success) {
      validRows.push(result.data);
    } else {
      result.error.issues.forEach((issue) => {
        errors.push({
          row: index + 2, // +2 for 1-indexed + header row
          field: issue.path.join('.'),
          message: issue.message,
          value: String(row[issue.path[0] as string] || ''),
        });
      });
    }
  });

  return {
    success: errors.length === 0,
    totalRows: rows.length,
    validRows,
    errors,
  };
}
