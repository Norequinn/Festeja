export function formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Given a recurring annual date "YYYY-MM-DD" (like birthDate or workAnniversary),
 * computes the next occurrence from today, daysUntil, and age/years completed.
 */
export function getNextAnnualOccurrence(dateStr: string, refDate = todayStart()) {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return null;
  }
  const [origYear, month, day] = parts;

  let targetYear = refDate.getFullYear();
  let candidate = new Date(targetYear, month - 1, day);
  // Handle Feb 29 on non-leap years gracefully
  if (candidate.getMonth() !== month - 1) {
    candidate = new Date(targetYear, month - 1, 28);
  }

  if (candidate < refDate) {
    targetYear += 1;
    candidate = new Date(targetYear, month - 1, day);
    if (candidate.getMonth() !== month - 1) {
      candidate = new Date(targetYear, month - 1, 28);
    }
  }

  const diffMs = candidate.getTime() - refDate.getTime();
  const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const yearsCount = Math.max(0, targetYear - origYear);

  return {
    nextDate: formatYMD(candidate),
    daysUntil,
    month,
    day,
    yearsCount,
  };
}

/**
 * Computes days until a fixed event date "YYYY-MM-DD". Negative if past.
 */
export function getDaysUntilDate(dateStr: string, refDate = todayStart()): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return 999;
  const target = new Date(y, m - 1, d);
  return Math.round((target.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
}

export function addDaysYMD(daysOffset: number, refDate = todayStart()): string {
  const d = new Date(refDate);
  d.setDate(d.getDate() + daysOffset);
  return formatYMD(d);
}
