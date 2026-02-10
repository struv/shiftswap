/**
 * Tests for CSV column mapping and enhanced parsing.
 */
import { describe, it, expect } from 'vitest';
import {
  extractCsvHeaders,
  autoDetectMapping,
  parseShiftCsvWithMapping,
} from '../lib/csv-import';

describe('extractCsvHeaders', () => {
  it('extracts headers and preview rows from CSV', () => {
    const csv = `Name,Email,Date,Start,End,Role,Dept
Alice,alice@example.com,2026-03-15,09:00,17:00,Cashier,Retail
Bob,bob@example.com,2026-03-16,08:00,16:00,Stocker,Warehouse`;

    const result = extractCsvHeaders(csv);

    expect(result.headers).toEqual(['Name', 'Email', 'Date', 'Start', 'End', 'Role', 'Dept']);
    expect(result.previewRows).toHaveLength(2);
    expect(result.totalRows).toBe(2);
    expect(result.previewRows[0]['Email']).toBe('alice@example.com');
  });

  it('limits preview to 5 rows', () => {
    const lines = ['h1,h2'];
    for (let i = 0; i < 10; i++) {
      lines.push(`a${i},b${i}`);
    }
    const csv = lines.join('\n');

    const result = extractCsvHeaders(csv);

    expect(result.previewRows).toHaveLength(5);
    expect(result.totalRows).toBe(10);
  });

  it('handles empty CSV', () => {
    const result = extractCsvHeaders('');
    expect(result.headers).toEqual(['']);
    expect(result.previewRows).toHaveLength(0);
  });

  it('skips blank lines when counting rows', () => {
    const csv = `a,b
1,2

3,4
`;
    const result = extractCsvHeaders(csv);
    expect(result.totalRows).toBe(2);
  });
});

describe('autoDetectMapping', () => {
  it('maps standard headers correctly', () => {
    const headers = ['email', 'date', 'start_time', 'end_time', 'role', 'department'];
    const mapping = autoDetectMapping(headers);

    expect(mapping['email']).toBe('email');
    expect(mapping['date']).toBe('date');
    expect(mapping['start_time']).toBe('start_time');
    expect(mapping['end_time']).toBe('end_time');
    expect(mapping['role']).toBe('role');
    expect(mapping['department']).toBe('department');
  });

  it('maps common aliases', () => {
    const headers = ['Employee Email', 'Shift Date', 'Start', 'End', 'Position', 'Dept'];
    const mapping = autoDetectMapping(headers);

    expect(mapping['Employee Email']).toBe('email');
    expect(mapping['Start']).toBe('start_time');
    expect(mapping['End']).toBe('end_time');
    expect(mapping['Position']).toBe('role');
    expect(mapping['Dept']).toBe('department');
  });

  it('sets unmapped columns to empty string', () => {
    const headers = ['email', 'date', 'start_time', 'end_time', 'role', 'department', 'extra_column'];
    const mapping = autoDetectMapping(headers);

    expect(mapping['extra_column']).toBe('');
  });

  it('does not map the same field twice', () => {
    const headers = ['email', 'employee_email', 'date', 'start_time', 'end_time', 'role', 'department'];
    const mapping = autoDetectMapping(headers);

    expect(mapping['email']).toBe('email');
    expect(mapping['employee_email']).toBe(''); // already mapped
  });
});

describe('parseShiftCsvWithMapping', () => {
  it('parses CSV with custom mapping', () => {
    const csv = `Name,Worker Email,Shift Date,From,To,Job,Site
Alice,alice@example.com,2026-03-15,09:00,17:00,Cashier,Retail`;

    const mapping = {
      'Name': '' as const,
      'Worker Email': 'email' as const,
      'Shift Date': 'date' as const,
      'From': 'start_time' as const,
      'To': 'end_time' as const,
      'Job': 'role' as const,
      'Site': 'department' as const,
    };

    const result = parseShiftCsvWithMapping(csv, mapping);

    expect(result.errors).toHaveLength(0);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].email).toBe('alice@example.com');
    expect(result.valid[0].role).toBe('Cashier');
  });

  it('reports errors for unmapped required fields', () => {
    const csv = `email,date
alice@example.com,2026-03-15`;

    const mapping = { email: 'email' as const, date: 'date' as const };
    const result = parseShiftCsvWithMapping(csv, mapping);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].issues[0]).toContain('Unmapped required fields');
  });

  it('validates row data after mapping', () => {
    const csv = `e,d,s,en,r,dep
not-an-email,invalid,9am,5pm,,`;

    const mapping = {
      e: 'email' as const,
      d: 'date' as const,
      s: 'start_time' as const,
      en: 'end_time' as const,
      r: 'role' as const,
      dep: 'department' as const,
    };

    const result = parseShiftCsvWithMapping(csv, mapping);

    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].issues.length).toBeGreaterThan(0);
  });

  it('handles mixed valid/invalid rows with mapping', () => {
    const csv = `mail,dt,start,end,pos,loc
alice@example.com,2026-03-15,09:00,17:00,Nurse,ICU
bad,bad,bad,bad,,
bob@example.com,2026-03-16,08:00,16:00,Doctor,ER`;

    const mapping = {
      mail: 'email' as const,
      dt: 'date' as const,
      start: 'start_time' as const,
      end: 'end_time' as const,
      pos: 'role' as const,
      loc: 'department' as const,
    };

    const result = parseShiftCsvWithMapping(csv, mapping);

    expect(result.valid).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
  });

  it('rejects CSV with too few lines', () => {
    const result = parseShiftCsvWithMapping('header_only', {});

    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].issues[0]).toContain('header row');
  });
});
