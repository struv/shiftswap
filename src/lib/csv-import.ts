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

/** The fields we expect for shift import */
export const REQUIRED_FIELDS = ['email', 'date', 'start_time', 'end_time', 'role', 'department'] as const;
export type ShiftField = (typeof REQUIRED_FIELDS)[number];

/** A mapping from CSV column header to our expected field name */
export type ColumnMapping = Record<string, ShiftField | ''>;

const REQUIRED_HEADERS = ['email', 'date', 'start_time', 'end_time', 'role', 'department'];

/**
 * Extract headers from a CSV string.
 */
export function extractCsvHeaders(csv: string): string[] {
  const trimmed = csv.trim();
  if (!trimmed) return [];
  const lines = trimmed.split('\n');
  return lines[0].trim().split(',').map((h) => h.trim());
}

/**
 * Try to auto-map CSV headers to our expected fields.
 * Returns a mapping of csvHeader -> shiftField (or '' if no match).
 */
export function autoMapHeaders(csvHeaders: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const aliases: Record<string, ShiftField> = {
    email: 'email',
    employee_email: 'email',
    user_email: 'email',
    staff_email: 'email',
    date: 'date',
    shift_date: 'date',
    start_time: 'start_time',
    starttime: 'start_time',
    start: 'start_time',
    time_start: 'start_time',
    end_time: 'end_time',
    endtime: 'end_time',
    end: 'end_time',
    time_end: 'end_time',
    role: 'role',
    position: 'role',
    job_title: 'role',
    department: 'department',
    dept: 'department',
    location: 'department',
  };

  const usedFields = new Set<ShiftField>();

  for (const header of csvHeaders) {
    const normalized = header.toLowerCase().trim().replace(/\s+/g, '_');
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
 * Parse a CSV string with optional column mapping.
 * If columnMapping is provided, applies it to remap headers before validation.
 * Returns valid rows and per-row errors.
 */
export function parseShiftCsv(csv: string, columnMapping?: ColumnMapping): CsvParseResult {
  const lines = csv.trim().split('\n');

  if (lines.length < 2) {
    return {
      valid: [],
      errors: [{ row: 0, data: {}, issues: ['CSV must contain a header row and at least one data row'] }],
    };
  }

  const headerLine = lines[0].trim();
  const rawHeaders = headerLine.split(',').map((h) => h.trim());

  // Determine effective headers (apply mapping or normalize)
  let headers: string[];
  if (columnMapping) {
    headers = rawHeaders.map((h) => columnMapping[h] || h.toLowerCase());
  } else {
    headers = rawHeaders.map((h) => h.toLowerCase());
  }

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
