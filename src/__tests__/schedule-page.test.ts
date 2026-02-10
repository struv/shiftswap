/**
 * Tests for the schedule page utilities and data logic.
 * Tests date formatting, week calculations, and role color mapping.
 */
import { describe, it, expect } from 'vitest';

// Inline the utility functions since they're defined within the component
function getWeekDates(baseDate: Date): Date[] {
  const dates: Date[] = [];
  const day = baseDate.getDay();
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - ((day + 6) % 7));

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

const ROLE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  cashier: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800' },
  server: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800' },
  cook: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800' },
  manager: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800' },
  host: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-800' },
  bartender: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800' },
  default: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800' },
};

function getRoleColor(role: string) {
  return ROLE_COLORS[role.toLowerCase()] ?? ROLE_COLORS.default;
}

describe('getWeekDates', () => {
  it('returns 7 dates starting from Monday', () => {
    // Wednesday 2025-01-15
    const wed = new Date(2025, 0, 15);
    const dates = getWeekDates(wed);

    expect(dates).toHaveLength(7);
    // Monday Jan 13
    expect(dates[0].getDay()).toBe(1);
    expect(dates[0].getDate()).toBe(13);
    // Sunday Jan 19
    expect(dates[6].getDay()).toBe(0);
    expect(dates[6].getDate()).toBe(19);
  });

  it('handles Monday input correctly', () => {
    // Monday 2025-01-13
    const mon = new Date(2025, 0, 13);
    const dates = getWeekDates(mon);

    expect(dates[0].getDate()).toBe(13);
    expect(dates[6].getDate()).toBe(19);
  });

  it('handles Sunday input correctly', () => {
    // Sunday 2025-01-19
    const sun = new Date(2025, 0, 19);
    const dates = getWeekDates(sun);

    expect(dates[0].getDate()).toBe(13);
    expect(dates[6].getDate()).toBe(19);
  });

  it('handles month boundaries', () => {
    // Friday Jan 31 2025
    const fri = new Date(2025, 0, 31);
    const dates = getWeekDates(fri);

    // Monday Jan 27
    expect(dates[0].getMonth()).toBe(0);
    expect(dates[0].getDate()).toBe(27);
    // Sunday Feb 2
    expect(dates[6].getMonth()).toBe(1);
    expect(dates[6].getDate()).toBe(2);
  });
});

describe('formatDate', () => {
  it('formats date as YYYY-MM-DD', () => {
    const d = new Date(2025, 0, 15);
    expect(formatDate(d)).toBe('2025-01-15');
  });

  it('pads single-digit months and days', () => {
    const d = new Date(2025, 2, 5);
    expect(formatDate(d)).toBe('2025-03-05');
  });
});

describe('formatTime', () => {
  it('formats morning time correctly', () => {
    expect(formatTime('09:00')).toBe('9:00 AM');
  });

  it('formats noon correctly', () => {
    expect(formatTime('12:00')).toBe('12:00 PM');
  });

  it('formats afternoon time correctly', () => {
    expect(formatTime('14:30')).toBe('2:30 PM');
  });

  it('formats midnight correctly', () => {
    expect(formatTime('00:00')).toBe('12:00 AM');
  });

  it('formats 11 PM correctly', () => {
    expect(formatTime('23:45')).toBe('11:45 PM');
  });
});

describe('getRoleColor', () => {
  it('returns correct colors for known roles', () => {
    expect(getRoleColor('cashier').bg).toBe('bg-blue-50');
    expect(getRoleColor('server').bg).toBe('bg-green-50');
    expect(getRoleColor('cook').bg).toBe('bg-orange-50');
  });

  it('returns default colors for unknown roles', () => {
    expect(getRoleColor('unknown-role').bg).toBe('bg-gray-50');
  });

  it('is case-insensitive', () => {
    expect(getRoleColor('Cashier').bg).toBe('bg-blue-50');
    expect(getRoleColor('SERVER').bg).toBe('bg-green-50');
  });
});

describe('shift grouping by date', () => {
  it('groups shifts correctly into date buckets', () => {
    const weekDates = getWeekDates(new Date(2025, 0, 15));
    const shifts = [
      { id: '1', date: '2025-01-13', start_time: '09:00', end_time: '17:00', role: 'cashier', department: 'Front', user_id: 'u1' },
      { id: '2', date: '2025-01-13', start_time: '10:00', end_time: '18:00', role: 'server', department: 'Front', user_id: 'u2' },
      { id: '3', date: '2025-01-15', start_time: '08:00', end_time: '16:00', role: 'cook', department: 'Kitchen', user_id: 'u3' },
    ];

    const shiftsByDate: Record<string, typeof shifts> = {};
    for (const date of weekDates) {
      shiftsByDate[formatDate(date)] = [];
    }
    for (const shift of shifts) {
      if (shiftsByDate[shift.date]) {
        shiftsByDate[shift.date].push(shift);
      }
    }

    expect(shiftsByDate['2025-01-13']).toHaveLength(2);
    expect(shiftsByDate['2025-01-14']).toHaveLength(0);
    expect(shiftsByDate['2025-01-15']).toHaveLength(1);
  });
});
