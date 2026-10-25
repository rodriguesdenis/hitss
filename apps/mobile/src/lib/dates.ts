const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const shortDate = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
});

const longDate = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function parseCalendarDate(value: string): Date {
  const match = CALENDAR_DATE.exec(value);
  if (!match) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
  return date;
}

export function toCalendarDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatShortDate(value: string): string {
  return shortDate.format(parseCalendarDate(value));
}

export function formatLongDate(value: string): string {
  return longDate.format(parseCalendarDate(value));
}

export function isPastDate(value: string, today: Date = new Date()): boolean {
  return value < toCalendarDate(today);
}
