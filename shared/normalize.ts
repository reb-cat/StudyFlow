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

function cleanTitleNoise(title:string){ return title.replace(/\bhomework\b/ig,'').replace(/\bdue\b[^,;:]*$/i,'').replace(/\s{2,}/g,' ').trim(); }

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