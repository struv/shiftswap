import { describe, it, expect } from 'vitest';

// Re-implement the parsing functions here for unit testing
// (they live in the client component but are pure functions)

function parseCSV(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return { headers: [] as string[], rows: [] as string[][] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);

  return { headers, rows };
}

function normalizeDate(raw: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const mdyMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const mdyDash = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (mdyDash) {
    const [, m, d, y] = mdyDash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return null;
}

function normalizeTime(raw: string): string | null {
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{1}:\d{2}$/.test(raw)) return `0${raw}`;

  const hmsMatch = raw.match(/^(\d{2}):(\d{2}):\d{2}$/);
  if (hmsMatch) return `${hmsMatch[1]}:${hmsMatch[2]}`;

  const ampmMatch = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)$/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2];
    const period = ampmMatch[3].toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CSV Parser', () => {
  it('parses simple CSV', () => {
    const csv = `date,start_time,end_time,role,location,email
2024-03-15,09:00,17:00,Nurse,Downtown Clinic,test@example.com`;

    const result = parseCSV(csv);
    expect(result.headers).toEqual([
      'date', 'start_time', 'end_time', 'role', 'location', 'email',
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual([
      '2024-03-15', '09:00', '17:00', 'Nurse', 'Downtown Clinic', 'test@example.com',
    ]);
  });

  it('handles quoted fields with commas', () => {
    const csv = `name,location
"Smith, John","Downtown, Main Clinic"`;

    const result = parseCSV(csv);
    expect(result.rows[0]).toEqual(['Smith, John', 'Downtown, Main Clinic']);
  });

  it('handles empty CSV', () => {
    const result = parseCSV('');
    expect(result.headers).toHaveLength(0);
    expect(result.rows).toHaveLength(0);
  });

  it('handles Windows-style line endings', () => {
    const csv = 'a,b\r\n1,2\r\n3,4';
    const result = parseCSV(csv);
    expect(result.headers).toEqual(['a', 'b']);
    expect(result.rows).toHaveLength(2);
  });
});

describe('normalizeDate', () => {
  it('passes through YYYY-MM-DD', () => {
    expect(normalizeDate('2024-03-15')).toBe('2024-03-15');
  });

  it('converts MM/DD/YYYY', () => {
    expect(normalizeDate('3/15/2024')).toBe('2024-03-15');
    expect(normalizeDate('03/15/2024')).toBe('2024-03-15');
  });

  it('converts MM-DD-YYYY', () => {
    expect(normalizeDate('03-15-2024')).toBe('2024-03-15');
  });

  it('rejects invalid formats', () => {
    expect(normalizeDate('March 15, 2024')).toBeNull();
    expect(normalizeDate('15/03/24')).toBeNull();
  });
});

describe('normalizeTime', () => {
  it('passes through HH:MM', () => {
    expect(normalizeTime('09:00')).toBe('09:00');
    expect(normalizeTime('17:30')).toBe('17:30');
  });

  it('pads single-digit hours', () => {
    expect(normalizeTime('9:00')).toBe('09:00');
  });

  it('strips seconds from HH:MM:SS', () => {
    expect(normalizeTime('09:00:00')).toBe('09:00');
  });

  it('converts 12-hour format', () => {
    expect(normalizeTime('8:00 AM')).toBe('08:00');
    expect(normalizeTime('1:30 PM')).toBe('13:30');
    expect(normalizeTime('12:00 PM')).toBe('12:00');
    expect(normalizeTime('12:00 AM')).toBe('00:00');
  });

  it('rejects invalid formats', () => {
    expect(normalizeTime('nine oclock')).toBeNull();
    expect(normalizeTime('')).toBeNull();
  });
});
