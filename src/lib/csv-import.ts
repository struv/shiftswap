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

const REQUIRED_HEADERS = ['email', 'date', 'start_time', 'end_time', 'role', 'department'];

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
