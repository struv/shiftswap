import { csvShiftRowSchema, type CsvShiftRow } from './validations';

export interface CsvParseResult {
  valid: CsvShiftRow[];
  errors: CsvRowError[];
}

export interface CsvRowError {
  row: number;
  data: Record<string, string>;
  issues: string[];
}

/** The fields our system expects for shift import */
export const SHIFT_FIELDS = ['email', 'date', 'start_time', 'end_time', 'role', 'department'] as const;
export type ShiftField = (typeof SHIFT_FIELDS)[number];

/** Maps CSV column headers to our shift fields */
export type ColumnMapping = Record<string, ShiftField | ''>;

const REQUIRED_HEADERS = ['email', 'date', 'start_time', 'end_time', 'role', 'department'];

/**
 * Extract raw headers and preview rows from a CSV string.
 * Used by the column mapping UI to show what's in the file.
 */
export function extractCsvHeaders(csv: string): { headers: string[]; previewRows: Record<string, string>[]; totalRows: number } {
  const lines = csv.trim().split('\n');
  if (lines.length < 1) return { headers: [], previewRows: [], totalRows: 0 };

  const headers = lines[0].trim().split(',').map((h) => h.trim());
  const previewRows: Record<string, string>[] = [];
  let dataRowCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    dataRowCount++;

    if (previewRows.length < 5) {
      const values = line.split(',').map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] ?? '';
      });
      previewRows.push(row);
    }
  }

  return { headers, previewRows, totalRows: dataRowCount };
}

/**
 * Auto-detect column mapping by matching CSV headers to our fields.
 * Uses case-insensitive matching and common aliases.
 */
export function autoDetectMapping(csvHeaders: string[]): ColumnMapping {
  const aliases: Record<string, ShiftField> = {
    email: 'email',
    employee_email: 'email',
    employee: 'email',
    user_email: 'email',
    date: 'date',
    shift_date: 'date',
    start_time: 'start_time',
    start: 'start_time',
    time_start: 'start_time',
    starttime: 'start_time',
    end_time: 'end_time',
    end: 'end_time',
    time_end: 'end_time',
    endtime: 'end_time',
    role: 'role',
    position: 'role',
    job_title: 'role',
    department: 'department',
    dept: 'department',
    location: 'department',
  };

  const mapping: ColumnMapping = {};
  const usedFields = new Set<ShiftField>();

  for (const header of csvHeaders) {
    const normalized = header.toLowerCase().replace(/\s+/g, '_');
    const match = aliases[normalized];
    if (match && !usedFields.has(match)) {
      mapping[header] = match;
      usedFields.add(match);
    } else {
      mapping[header] = '';
    }
  }

  return mapping;
}

/**
 * Parse CSV with a user-provided column mapping.
 * Remaps arbitrary CSV headers to our expected fields before validation.
 */
export function parseShiftCsvWithMapping(csv: string, mapping: ColumnMapping): CsvParseResult {
  const lines = csv.trim().split('\n');

  if (lines.length < 2) {
    return {
      valid: [],
      errors: [{ row: 0, data: {}, issues: ['CSV must contain a header row and at least one data row'] }],
    };
  }

  const csvHeaders = lines[0].trim().split(',').map((h) => h.trim());

  // Check all required fields are mapped
  const mappedFields = new Set<string>(Object.values(mapping).filter(Boolean));
  const missingFields = REQUIRED_HEADERS.filter((f) => !mappedFields.has(f));
  if (missingFields.length > 0) {
    return {
      valid: [],
      errors: [{ row: 0, data: {}, issues: [`Unmapped required fields: ${missingFields.join(', ')}`] }],
    };
  }

  const valid: CsvShiftRow[] = [];
  const errors: CsvRowError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',').map((v) => v.trim());
    const rowData: Record<string, string> = {};

    csvHeaders.forEach((header, idx) => {
      const field = mapping[header];
      if (field) {
        rowData[field] = values[idx] ?? '';
      }
    });

    const result = csvShiftRowSchema.safeParse(rowData);

    if (result.success) {
      valid.push(result.data);
    } else {
      const issues = result.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`
      );
      errors.push({ row: i + 1, data: rowData, issues });
    }
  }

  return { valid, errors };
}

/**
 * Parse a CSV string of shift data into validated rows.
 * Returns valid rows and per-row errors.
 */
export function parseShiftCsv(csv: string): CsvParseResult {
  const lines = csv.trim().split('\n');

  if (lines.length < 2) {
    return {
      valid: [],
      errors: [{ row: 0, data: {}, issues: ['CSV must contain a header row and at least one data row'] }],
    };
  }

  const headerLine = lines[0].trim();
  const headers = headerLine.split(',').map((h) => h.trim().toLowerCase());

  // Validate headers
  const missingHeaders = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missingHeaders.length > 0) {
    return {
      valid: [],
      errors: [{ row: 0, data: {}, issues: [`Missing required headers: ${missingHeaders.join(', ')}`] }],
    };
  }

  const valid: CsvShiftRow[] = [];
  const errors: CsvRowError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',').map((v) => v.trim());
    const rowData: Record<string, string> = {};

    headers.forEach((header, idx) => {
      rowData[header] = values[idx] ?? '';
    });

    const result = csvShiftRowSchema.safeParse(rowData);

    if (result.success) {
      valid.push(result.data);
    } else {
      const issues = result.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`
      );
      errors.push({ row: i + 1, data: rowData, issues });
    }
  }

  return { valid, errors };
}
