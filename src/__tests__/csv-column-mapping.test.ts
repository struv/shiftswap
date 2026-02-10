/**
 * Tests for CSV column mapping and enhanced parsing.
 */
import { describe, it, expect } from 'vitest';
import {
  extractCsvHeaders,
  autoMapHeaders,
  parseShiftCsv,
} from '../lib/csv-import';

describe('extractCsvHeaders', () => {
  it('extracts headers from CSV string', () => {
    const csv = `email,date,start_time,end_time,role,department
alice@example.com,2026-03-15,09:00,17:00,Cashier,Retail`;

    expect(extractCsvHeaders(csv)).toEqual([
      'email', 'date', 'start_time', 'end_time', 'role', 'department',
    ]);
  });

  it('trims whitespace from headers', () => {
    const csv = ` email , date , start_time \ndata`;
    expect(extractCsvHeaders(csv)).toEqual(['email', 'date', 'start_time']);
  });

  it('returns empty array for empty string', () => {
    expect(extractCsvHeaders('')).toEqual([]);
  });
});

describe('autoMapHeaders', () => {
  it('maps standard headers correctly', () => {
    const mapping = autoMapHeaders(['email', 'date', 'start_time', 'end_time', 'role', 'department']);
    expect(mapping).toEqual({
      email: 'email',
      date: 'date',
      start_time: 'start_time',
      end_time: 'end_time',
      role: 'role',
      department: 'department',
    });
  });

  it('maps common aliases', () => {
    const mapping = autoMapHeaders(['employee_email', 'shift_date', 'starttime', 'endtime', 'position', 'dept']);
    expect(mapping['employee_email']).toBe('email');
    expect(mapping['shift_date']).toBe('date');
    expect(mapping['starttime']).toBe('start_time');
    expect(mapping['endtime']).toBe('end_time');
    expect(mapping['position']).toBe('role');
    expect(mapping['dept']).toBe('department');
  });

  it('leaves unmapped headers as empty string', () => {
    const mapping = autoMapHeaders(['email', 'date', 'start_time', 'end_time', 'role', 'department', 'extra_col']);
    expect(mapping['extra_col']).toBe('');
  });

  it('handles case-insensitive matching via normalization', () => {
    const mapping = autoMapHeaders(['Email', 'Date', 'Start_Time', 'End_Time', 'Role', 'Department']);
    expect(mapping['Email']).toBe('email');
    expect(mapping['Date']).toBe('date');
    expect(mapping['Start_Time']).toBe('start_time');
  });
});

describe('parseShiftCsv with column mapping', () => {
  it('applies custom column mapping', () => {
    const csv = `emp_email,work_date,begin,finish,title,dept
alice@example.com,2026-03-15,09:00,17:00,Nurse,Primary Care`;

    const mapping = {
      emp_email: 'email' as const,
      work_date: 'date' as const,
      begin: 'start_time' as const,
      finish: 'end_time' as const,
      title: 'role' as const,
      dept: 'department' as const,
    };

    const result = parseShiftCsv(csv, mapping);
    expect(result.errors).toHaveLength(0);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]).toEqual({
      email: 'alice@example.com',
      date: '2026-03-15',
      start_time: '09:00',
      end_time: '17:00',
      role: 'Nurse',
      department: 'Primary Care',
    });
  });

  it('reports missing mapped fields', () => {
    const csv = `col1,col2
data1,data2`;

    const mapping = {
      col1: 'email' as const,
      col2: 'date' as const,
    };

    const result = parseShiftCsv(csv, mapping);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].issues[0]).toContain('Missing required headers');
  });

  it('still works without column mapping (backwards compat)', () => {
    const csv = `email,date,start_time,end_time,role,department
alice@example.com,2026-03-15,09:00,17:00,Cashier,Retail`;

    const result = parseShiftCsv(csv);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('handles mapping with skipped columns', () => {
    const csv = `emp_email,work_date,begin,finish,title,dept,notes
alice@example.com,2026-03-15,09:00,17:00,Nurse,Primary Care,some note`;

    const mapping = {
      emp_email: 'email' as const,
      work_date: 'date' as const,
      begin: 'start_time' as const,
      finish: 'end_time' as const,
      title: 'role' as const,
      dept: 'department' as const,
      notes: '' as const,
    };

    const result = parseShiftCsv(csv, mapping);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });
});

describe('parseShiftCsv with mapped validation errors', () => {
  it('reports validation errors with correct row numbers', () => {
    const csv = `emp_email,work_date,begin,finish,title,dept
alice@example.com,2026-03-15,09:00,17:00,Nurse,Primary Care
bad-email,invalid-date,9am,5pm,,
bob@example.com,2026-03-16,08:00,16:00,MA,Urgent Care`;

    const mapping = {
      emp_email: 'email' as const,
      work_date: 'date' as const,
      begin: 'start_time' as const,
      finish: 'end_time' as const,
      title: 'role' as const,
      dept: 'department' as const,
    };

    const result = parseShiftCsv(csv, mapping);
    expect(result.valid).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(3);
  });
});
