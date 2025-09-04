export type AssignmentLike = { id:string; title:string; course?:string|null; instructions?:string|null; dueAt?:string|null; };
export type NormalizedAssignment = { displayTitle:string; effectiveDueAt?:string|null; courseLabel?:string|null; };

function inferDueDateFromText(text:string, now=new Date()): Date | null {
  if (!text) return null;
  const s = text.replace(/\u00A0/g,' ');
  const md = s.match(/due[^0-9a-zA-Z]{0,5}(\d{1,2})[\//\-](\d{1,2})(?:[\//\-](\d{2,4}))?/i)
        || s.match(/(?:due[^a-z0-9]{0,5})?([A-Za-z]{3,9})\s+(\d{1,2})/i);
  let M:null|number=null, D:null|number=null, Y:null|number=null;
  if (md) {
    if (md.length>=4 && /^\d/.test(md[1])) { M=+md[1]-1; D=+md[2]; Y=md[3]? (+md[3]<100? 2000+(+md[3]) : +md[3]) : null; }
    else { const names=['january','february','march','april','may','june','july','august','september','october','november','december'];
           M=names.findIndex(n=>n.startsWith(md[1].toLowerCase())); D=+md[2]; }
  }
  if (M==null||D==null) return null;
  const y = Y ?? now.getFullYear(); const d = new Date(y,M,D,23,59,0,0);
  if (!Y && ((d.getTime()-now.getTime())/86400000 < -120)) d.setFullYear(y+1);
  return d;
}

function cleanTitleNoise(title:string){ 
  return title
    // Remove basic noise
    .replace(/\bhomework\b/ig,'')
    .replace(/\bdue\b[^,;:]*$/i,'')
    
    // Remove academic year patterns (executive function friendly)
    .replace(/\b\d{2}\/\d{2}\b/g,'')  // "25/26", "24/25"
    .replace(/\b\d{4}[-\/]\d{4}\b/g,'')  // "2025-2026", "2024/2025"
    .replace(/\b\d{4}[-\/]\d{2}\b/g,'')  // "2025-26", "2024/25"
    .replace(/\b\d{2}[-\/]\d{4}\b/g,'')  // "25-2026", "24/2025"
    
    // Remove term/semester patterns
    .replace(/\bT[1-4]\b/g,'')  // "T1", "T2", "T3", "T4"
    .replace(/\b(?:Term|Quarter|Semester)\s*[1-4]\b/gi,'')  // "Term 1", "Quarter 2", "Semester 1"
    .replace(/\b(?:Fall|Spring|Summer|Winter)\s*\d{4}\b/gi,'')  // "Fall 2025", "Spring 2026"
    
    // Remove grade level patterns
    .replace(/\b\d+(?:st|nd|rd|th)[-\s]*(?:\d+(?:st|nd|rd|th))?\s*Gr(?:ade)?s?\b/gi,'')  // "7th-12th Gr", "7th Grade"
    .replace(/\bGrades?\s*\d+[-\s]*\d*\b/gi,'')  // "Grades 7-12", "Grade 7"
    .replace(/\b\d+[-\s]*\d+\s*Gr(?:ade)?s?\b/gi,'')  // "7-12 Grades", "K-12 Grade"
    
    // Remove institutional codes and extra whitespace
    .replace(/\s{2,}/g,' ')
    .trim(); 
}

function titleFromInstructions(instr:string|null|undefined, fallback:string, course?:string|null): string {
  const t=(instr||'').toLowerCase(); const bits:string[]=[];
  if (/\bread(ing)?\b/.test(t)||/\bp\.\s*\d+/.test(t)) bits.push('Reading');
  if (/\bstudy\s*guide\b/.test(t)) bits.push('Study Guide');
  if (/\bstudent\s*notebook\b|\bnotebook\b/.test(t)) bits.push('Notebook Work');
  if (/\bworksheet\b/.test(t)) bits.push('Worksheet');
  if (/\bpractice\b/.test(t)) bits.push('Practice');
  if (/\bvideo\b|\bwatch\b/.test(t)) bits.push('Video');
  if (/\bquiz\b|\bcheck\b/.test(t)) bits.push('Quiz');
  if (/\blab\b/.test(t)) bits.push('Lab');
  if (/\bessay\b|\bparagraph\b|\bwrite\b/.test(t)) bits.push('Writing');
  const combo=Array.from(new Set(bits)).join(' & ') || cleanTitleNoise(fallback||'Assignment');
  const prefix=course && !new RegExp(`^${course}\\b`,'i').test(combo) ? `${course} ` : '';
  return `${prefix}${combo}`.trim();
}

export function normalizeAssignment(a:AssignmentLike, now=new Date()): NormalizedAssignment {
  const courseLabel=a.course??null;
  const inferred = inferDueDateFromText(a.title,now) || inferDueDateFromText(a.instructions||'',now) || null;
  const effectiveDueAt = a.dueAt ?? (inferred ? inferred.toISOString() : null);
  const looksGeneric = /\bhomework\b/i.test(a.title) || /\bdue\b/i.test(a.title);
  const displayTitle = looksGeneric ? titleFromInstructions(a.instructions, a.title, courseLabel) : cleanTitleNoise(a.title);
  return { displayTitle, effectiveDueAt, courseLabel };
}

// Re-export assignmentNormalizer for backward compatibility
export * from './assignmentNormalizer';