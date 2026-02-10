import { describe, it, expect } from 'vitest';
import { parseCsvText, validateCsvImport } from '@/lib/csv-import';

describe('CSV Import Integration Tests', () => {
  describe('parseCsvText', () => {
    it('should parse valid CSV text', () => {
      const csv = `email,date,start_time,end_time,role,department
alice@example.com,2025-02-15,07:00,15:00,Nurse,Emergency
bob@example.com,2025-02-15,15:00,23:00,Nurse,Emergency`;

      const rows = parseCsvText(csv);
      expect(rows).toHaveLength(2);
      expect(rows[0].email).toBe('alice@example.com');
      expect(rows[0].date).toBe('2025-02-15');
      expect(rows[1].email).toBe('bob@example.com');
    });

    it('should return empty array for empty CSV', () => {
      expect(parseCsvText('')).toHaveLength(0);
    });

    it('should return empty array for header-only CSV', () => {
      expect(parseCsvText('email,date,start_time,end_time,role,department')).toHaveLength(0);
    });

    it('should handle whitespace in values', () => {
      const csv = `email, date, start_time, end_time, role, department
 alice@example.com , 2025-02-15 , 07:00 , 15:00 , Nurse , Emergency `;

      const rows = parseCsvText(csv);
      expect(rows[0].email).toBe('alice@example.com');
      expect(rows[0].role).toBe('Nurse');
    });
  });

  describe('validateCsvImport', () => {
    it('should validate and accept valid CSV data', () => {
      const csv = `email,date,start_time,end_time,role,department
alice@example.com,2025-02-15,07:00,15:00,Nurse,Emergency
bob@example.com,2025-02-15,15:00,23:00,Doctor,ICU
carol@example.com,2025-02-16,07:00,15:00,Tech,Radiology`;

      const result = validateCsvImport(csv);
      expect(result.success).toBe(true);
      expect(result.totalRows).toBe(3);
      expect(result.validRows).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid email addresses', () => {
      const csv = `email,date,start_time,end_time,role,department
not-an-email,2025-02-15,07:00,15:00,Nurse,Emergency`;

      const result = validateCsvImport(csv);
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('email');
      expect(result.errors[0].message).toContain('email');
    });

    it('should reject invalid date format', () => {
      const csv = `email,date,start_time,end_time,role,department
alice@example.com,15/02/2025,07:00,15:00,Nurse,Emergency`;

      const result = validateCsvImport(csv);
      expect(result.success).toBe(false);
      expect(result.errors[0].field).toBe('date');
      expect(result.errors[0].message).toContain('YYYY-MM-DD');
    });

    it('should reject invalid time format', () => {
      const csv = `email,date,start_time,end_time,role,department
alice@example.com,2025-02-15,7am,3pm,Nurse,Emergency`;

      const result = validateCsvImport(csv);
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.field === 'start_time')).toBe(true);
      expect(result.errors.some((e) => e.field === 'end_time')).toBe(true);
    });

    it('should reject empty required fields', () => {
      const csv = `email,date,start_time,end_time,role,department
alice@example.com,2025-02-15,07:00,15:00,,`;

      const result = validateCsvImport(csv);
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.field === 'role')).toBe(true);
      expect(result.errors.some((e) => e.field === 'department')).toBe(true);
    });

    it('should report errors with correct row numbers', () => {
      const csv = `email,date,start_time,end_time,role,department
alice@example.com,2025-02-15,07:00,15:00,Nurse,Emergency
invalid-email,bad-date,07:00,15:00,Nurse,Emergency
bob@example.com,2025-02-16,07:00,15:00,Doctor,ICU`;

      const result = validateCsvImport(csv);
      expect(result.success).toBe(false);
      expect(result.validRows).toHaveLength(2);
      expect(result.errors.every((e) => e.row === 3)).toBe(true); // row 3 (1-indexed + header)
    });

    it('should handle empty CSV', () => {
      const result = validateCsvImport('');
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('empty');
    });

    it('should detect missing required headers', () => {
      const csv = `email,date
alice@example.com,2025-02-15`;

      const result = validateCsvImport(csv);
      expect(result.success).toBe(false);
      expect(result.errors[0].field).toBe('headers');
      expect(result.errors[0].message).toContain('Missing required headers');
    });

    it('should handle mixed valid and invalid rows', () => {
      const csv = `email,date,start_time,end_time,role,department
alice@example.com,2025-02-15,07:00,15:00,Nurse,Emergency
bad-email,2025-02-15,07:00,15:00,Nurse,Emergency
bob@example.com,2025-02-16,07:00,15:00,Doctor,ICU
carol@example.com,invalid-date,07:00,15:00,Tech,Radiology`;

      const result = validateCsvImport(csv);
      expect(result.success).toBe(false);
      expect(result.totalRows).toBe(4);
      expect(result.validRows).toHaveLength(2);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should accept a large batch of valid rows', () => {
      const header = 'email,date,start_time,end_time,role,department';
      const rows = Array.from({ length: 100 }, (_, i) =>
        `user${i}@example.com,2025-03-${String(1 + (i % 28)).padStart(2, '0')},07:00,15:00,Nurse,Emergency`
      );
      const csv = [header, ...rows].join('\n');

      const result = validateCsvImport(csv);
      expect(result.success).toBe(true);
      expect(result.validRows).toHaveLength(100);
    });
  });
});
