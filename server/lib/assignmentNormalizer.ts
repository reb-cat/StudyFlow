// Lightweight, zero-dependency helpers to make Canvas data human-friendly.

export type AssignmentLike = {
  id: string;
  title: string;
  course?: string | null;
  instructions?: string | null;
  dueAt?: string | null; // ISO string if present
};

export type NormalizedAssignment = {
  displayTitle: string;           // e.g., "Health Reading & Notebook Work"
  effectiveDueAt?: string | null; // ISO; inferred if dueAt missing
  courseLabel?: string | null;    // visible course chip
};

// Parse dates like "Due 8/21", "Due on 8-21", "Due Aug 21", "(8/21)" in title/instructions.
function inferDueDateFromText(text: string, now = new Date(), tz: string = 'America/New_York'): Date | null {
  if (!text) return null;
  const s = text.replace(/\u00A0/g, ' ');
  const md = s.match(/due[^0-9a-zA-Z]{0,5}(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/i)
          || s.match(/(?:due[^a-z0-9]{0,5})?([A-Za-z]{3,9})\s+(\d{1,2})/i);
  let month: number | null = null, day: number | null = null, year: number | null = null;

  if (md) {
    if (md.length >= 4 && /^\d/.test(md[1])) {
      // M/D[/YY]
      month = parseInt(md[1], 10) - 1;
      day = parseInt(md[2], 10);
      if (md[3]) {
        const y = parseInt(md[3], 10);
        year = y < 100 ? 2000 + y : y;
      }
    } else {
      // Mon D
      const mon = md[1].toLowerCase();
      const names = ['january','february','march','april','may','june','july','august','september','october','november','december'];
      month = names.findIndex(n => n.startsWith(mon));
      day = parseInt(md[2], 10);
    }
  }
  if (month == null || day == null) return null;

  const nowYear = now.getFullYear();
  const candidateYear = year ?? nowYear;
  // Create date as Eastern Time end-of-day to match classroom context
  // Add UTC offset to ensure Eastern Time dates display correctly
  const isDST = month >= 2 && month <= 10; // Rough DST check (March-November)
  const utcOffsetHours = isDST ? 4 : 5; // EDT is UTC-4, EST is UTC-5
  const d = new Date(candidateYear, month, day, 23 + utcOffsetHours, 59, 0, 0);

  // If we parsed without a year and it landed far in the past (e.g., last school year),
  // nudge to next year.
  if (!year) {
    const diffDays = (d.getTime() - now.getTime()) / 86_400_000;
    if (diffDays < -120) {
      d.setFullYear(candidateYear + 1);
    }
  }
  return d;
}

function cleanTitleNoise(title: string): string {
  return title
    .replace(/\bhomework\b/ig, '')
    .replace(/\bdue\b[^,;:]*$/i, '') // strip trailing "Due ..." tail
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function titleFromInstructions(instructions: string | null | undefined, fallback: string, course?: string | null): string {
  const txt = (instructions || '').toLowerCase();
  const bits: string[] = [];

  const hasReading = /\bread(ing)?\b/.test(txt) || /\bp\.\s*\d+/.test(txt);
  const hasStudyGuide = /\bstudy\s*guide\b/.test(txt);
  const hasNotebook = /\bstudent\s*notebook\b|\bnotebook\b/.test(txt);
  const hasWorksheet = /\bworksheet\b/.test(txt);
  const hasPractice = /\bpractice\b/.test(txt);
  const hasVideo = /\bvideo\b|\bwatch\b/.test(txt);
  const hasQuiz = /\bquiz\b|\bcheck\b/.test(txt);
  const hasLab = /\blab\b/.test(txt);
  const hasEssay = /\bessay\b|\bparagraph\b|\bwrite\b/.test(txt);

  if (hasReading) bits.push('Reading');
  if (hasStudyGuide) bits.push('Study Guide');
  if (hasNotebook) bits.push('Notebook Work');
  if (hasWorksheet) bits.push('Worksheet');
  if (hasPractice) bits.push('Practice');
  if (hasVideo) bits.push('Video');
  if (hasQuiz) bits.push('Quiz');
  if (hasLab) bits.push('Lab');
  if (hasEssay) bits.push('Writing');

  const unique = Array.from(new Set(bits));
  const combo = unique.join(' & ');

  const base = combo || cleanTitleNoise(fallback || 'Assignment');
  // Prefix course when available and useful
  const coursePrefix = course && !new RegExp(`^${course}\\b`, 'i').test(base) ? `${course} ` : '';
  return `${coursePrefix}${base}`.trim();
}

export function normalizeAssignment(a: AssignmentLike, now = new Date()): NormalizedAssignment {
  const courseLabel = a.course ?? null;

  // 1) Effective due date: prefer DB dueAt; otherwise infer from title or instructions
  const inferred =
    inferDueDateFromText(a.title, now) ||
    inferDueDateFromText(a.instructions || '', now) ||
    null;

  const effectiveDueAt = a.dueAt ?? (inferred ? inferred.toISOString() : null);

  // 2) Display title: if title is generic ("Homework Due ..."), build from instructions
  // BUT preserve specific due dates to avoid identical display titles for different assignments
  const looksGeneric = /\bhomework\b/i.test(a.title) || /\bdue\b/i.test(a.title);
  const hasSpecificDate = /due\s+\d{1,2}[\/\-]\d{1,2}/i.test(a.title);
  
  let displayTitle: string;
  if (looksGeneric && !hasSpecificDate) {
    // Generic homework without specific dates -> build from instructions
    displayTitle = titleFromInstructions(a.instructions, a.title, courseLabel || undefined);
  } else if (looksGeneric && hasSpecificDate) {
    // Homework with specific date -> keep the date but enhance with course info
    const baseName = titleFromInstructions(a.instructions, 'Assignment', courseLabel || undefined);
    const dateMatch = a.title.match(/due\s+(\d{1,2}[\/\-]\d{1,2})/i);
    displayTitle = dateMatch ? `${baseName} (Due ${dateMatch[1]})` : cleanTitleNoise(a.title);
  } else {
    // Not generic -> clean up noise but keep original title
    displayTitle = cleanTitleNoise(a.title);
  }

  return { displayTitle, effectiveDueAt, courseLabel };
}