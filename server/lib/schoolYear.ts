/**
 * School Year Configuration - Environment-driven dates for year rollover
 * Eliminates hardcoded school year dates throughout the codebase
 */

/**
 * Get school year start date from environment
 * Default: 2025-08-14 (current school year)
 */
export function getSchoolYearStartDate(): Date {
  const startDateStr = process.env.SCHOOL_YEAR_START_DATE || '2025-08-14';
  return new Date(startDateStr);
}

/**
 * Get school year end date (start + 1 year - 1 day)
 * Example: 2025-08-14 → 2026-08-13
 */
export function getSchoolYearEndDate(): Date {
  const startDate = getSchoolYearStartDate();
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1);
  endDate.setDate(endDate.getDate() - 1);
  return endDate;
}

/**
 * Get next school year end date (for validation purposes)
 * Example: 2025-08-14 → 2027-08-13
 */
export function getNextSchoolYearEndDate(): Date {
  const startDate = getSchoolYearStartDate();
  const nextEndDate = new Date(startDate);
  nextEndDate.setFullYear(nextEndDate.getFullYear() + 2);
  nextEndDate.setDate(nextEndDate.getDate() - 1);
  return nextEndDate;
}

/**
 * Get filter date for pre-school-year assignments
 * Uses June 15 of the year BEFORE school starts
 * Example: School year 2025-08-14 → Filter date 2025-06-15
 */
export function getAssignmentFilterDate(): Date {
  const startDate = getSchoolYearStartDate();
  const filterYear = startDate.getFullYear();
  return new Date(`${filterYear}-06-15`);
}

/**
 * Get previous year cutoff for template assignment filtering
 * Uses January 1 of the school year start year
 * Example: School year 2025-08-14 → Previous year cutoff 2025-01-01
 */
export function getPreviousYearCutoff(): Date {
  const startDate = getSchoolYearStartDate();
  const cutoffYear = startDate.getFullYear();
  return new Date(`${cutoffYear}-01-01`);
}

/**
 * Get very old assignment cutoff (for deep cleanup)
 * Uses January 1 of year before school year start
 * Example: School year 2025-08-14 → Very old cutoff 2024-01-01  
 */
export function getVeryOldAssignmentCutoff(): Date {
  const startDate = getSchoolYearStartDate();
  const cutoffYear = startDate.getFullYear() - 1;
  return new Date(`${cutoffYear}-01-01`);
}

/**
 * Get formatted school year range for display/logging
 * Example: "2025-08-14 → 2026-08-13"
 */
export function getSchoolYearRange(): string {
  const startDate = getSchoolYearStartDate();
  const endDate = getSchoolYearEndDate();
  
  return `${startDate.toISOString().split('T')[0]} → ${endDate.toISOString().split('T')[0]}`;
}

/**
 * Check if a date falls within the current school year
 */
export function isDateInCurrentSchoolYear(date: Date): boolean {
  const startDate = getSchoolYearStartDate();
  const endDate = getSchoolYearEndDate();
  
  return date >= startDate && date <= endDate;
}