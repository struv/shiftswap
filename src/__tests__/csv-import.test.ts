/**
 * Integration test: CSV import
 * Valid data succeeds, invalid data shows errors.
 */
import { describe, it, expect } from 'vitest';
import { parseShiftCsv } from '../lib/csv-import';

describe('CSV import: valid data', () => {
  it('parses a well-formed CSV with all required columns', () => {
    const csv = `email,date,start_time,end_time,role,department
alice@example.com,2026-03-15,09:00,17:00,Cashier,Retail
bob@example.com,2026-03-16,08:00,16:00,Stocker,Warehouse`;

    const result = parseShiftCsv(csv);

    expect(result.errors).toHaveLength(0);
    expect(result.valid).toHaveLength(2);
    expect(result.valid[0]).toEqual({
      email: 'alice@example.com',
      date: '2026-03-15',
      start_time: '09:00',
      end_time: '17:00',
      role: 'Cashier',
      department: 'Retail',
    });
    expect(result.valid[1].email).toBe('bob@example.com');
  });

  it('handles extra whitespace in values', () => {
    const csv = `email,date,start_time,end_time,role,department
  alice@example.com , 2026-03-15 , 09:00 , 17:00 , Cashier , Retail `;

    const result = parseShiftCsv(csv);

    expect(result.errors).toHaveLength(0);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].email).toBe('alice@example.com');
  });

  it('handles headers in any case', () => {
    const csv = `EMAIL,DATE,START_TIME,END_TIME,ROLE,DEPARTMENT
alice@example.com,2026-03-15,09:00,17:00,Cashier,Retail`;

    const result = parseShiftCsv(csv);

    expect(result.errors).toHaveLength(0);
    expect(result.valid).toHaveLength(1);
  });

  it('skips empty lines', () => {
    const csv = `email,date,start_time,end_time,role,department
alice@example.com,2026-03-15,09:00,17:00,Cashier,Retail

bob@example.com,2026-03-16,08:00,16:00,Stocker,Warehouse
`;

    const result = parseShiftCsv(csv);

    expect(result.errors).toHaveLength(0);
    expect(result.valid).toHaveLength(2);
  });
});

describe('CSV import: invalid data', () => {
  it('rejects CSV with only one line (no data rows)', () => {
    const csv = 'alice@example.com,2026-03-15,09:00,17:00,Cashier,Retail';

    const result = parseShiftCsv(csv);

    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].issues[0]).toContain('header row and at least one data row');
  });

  it('rejects CSV with missing required columns', () => {
    const csv = `email,date,start_time
alice@example.com,2026-03-15,09:00`;

    const result = parseShiftCsv(csv);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].issues[0]).toContain('Missing required headers');
    expect(result.errors[0].issues[0]).toContain('end_time');
    expect(result.errors[0].issues[0]).toContain('role');
    expect(result.errors[0].issues[0]).toContain('department');
  });

  it('rejects empty CSV', () => {
    const result = parseShiftCsv('');

    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].issues[0]).toContain('header row');
  });

  it('reports invalid email', () => {
    const csv = `email,date,start_time,end_time,role,department
not-an-email,2026-03-15,09:00,17:00,Cashier,Retail`;

    const result = parseShiftCsv(csv);

    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(2);
    expect(result.errors[0].issues.some((i) => i.includes('email'))).toBe(true);
  });

  it('reports invalid date format', () => {
    const csv = `email,date,start_time,end_time,role,department
alice@example.com,03/15/2026,09:00,17:00,Cashier,Retail`;

    const result = parseShiftCsv(csv);

    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].issues.some((i) => i.includes('YYYY-MM-DD'))).toBe(true);
  });

  it('reports invalid time format', () => {
    const csv = `email,date,start_time,end_time,role,department
alice@example.com,2026-03-15,9am,5pm,Cashier,Retail`;

    const result = parseShiftCsv(csv);

    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].issues.some((i) => i.includes('HH:MM'))).toBe(true);
  });

  it('reports missing role/department', () => {
    const csv = `email,date,start_time,end_time,role,department
alice@example.com,2026-03-15,09:00,17:00,,`;

    const result = parseShiftCsv(csv);

    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].issues.some((i) => i.includes('role') || i.includes('Role'))).toBe(true);
  });

  it('returns mix of valid and invalid rows', () => {
    const csv = `email,date,start_time,end_time,role,department
alice@example.com,2026-03-15,09:00,17:00,Cashier,Retail
bad-email,invalid-date,9am,5pm,,
bob@example.com,2026-03-16,08:00,16:00,Stocker,Warehouse`;

    const result = parseShiftCsv(csv);

    expect(result.valid).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(3); // line 3 in CSV (1-indexed)
  });
});

describe('CSV import: edge cases', () => {
  it('handles single valid row', () => {
    const csv = `email,date,start_time,end_time,role,department
alice@example.com,2026-03-15,09:00,17:00,Cashier,Retail`;

    const result = parseShiftCsv(csv);

    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('header-only CSV returns no rows', () => {
    const csv = 'email,date,start_time,end_time,role,department';

    const result = parseShiftCsv(csv);

    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].issues[0]).toContain('header row and at least one data row');
  });
});
