// DEBUG_ORDERING toggle for schedule pipeline tracing
export const DEBUG_ORDERING = process.env.DEBUG_ORDERING === '1' || true; // TEMPORARILY ENABLED

export function logOrderTrace(source: string, label: string, blocks: any[]) {
  if (!DEBUG_ORDERING) return;
  
  console.log(`\n🧭 ORDER TRACE / ${source.toUpperCase()}: ${label}`);
  blocks.forEach((block, i) => {
    const startMinute = block.startMinute ?? toMinutes(block.startTime);
    const endMinute = block.endMinute ?? toMinutes(block.endTime);
    console.log(`  [${i}] ${block.id || block.blockId || 'no-id'} | ${startMinute}min (${block.startTime || 'no-time'}) | ${block.type || block.blockType || 'no-type'} | ${block.title || block.label || 'no-title'}`);
  });
}

export function toMinutes(hhmm?: string | null): number {
  if (!hhmm) return Number.POSITIVE_INFINITY;
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function byMinute(a: any, b: any): number {
  const am = a.startMinute ?? toMinutes(a.startTime);
  const bm = b.startMinute ?? toMinutes(b.startTime);
  return am - bm || String(a.id).localeCompare(String(b.id));
}

export function assertStrictOrder(source: string, blocks: any[]): boolean {
  if (!DEBUG_ORDERING) return true;
  
  for (let i = 1; i < blocks.length; i++) {
    const prev = blocks[i - 1];
    const curr = blocks[i];
    const prevMinute = prev.startMinute ?? toMinutes(prev.startTime);
    const currMinute = curr.startMinute ?? toMinutes(curr.startTime);
    
    if (prevMinute > currMinute) {
      console.error(`❌ ORDER VIOLATION in ${source}:`);
      console.error(`  [${i-1}] ${prev.id} | ${prevMinute}min (${prev.startTime}) | ${prev.type || prev.blockType}`);
      console.error(`  [${i}] ${curr.id} | ${currMinute}min (${curr.startTime}) | ${curr.type || curr.blockType}`);
      console.error(`  Source: ${prevMinute > currMinute ? 'numeric' : 'string'} comparison failed`);
      return false;
    }
  }
  
  console.log(`✅ ORDER VALID in ${source}: ${blocks.length} blocks in strict ascending order`);
  return true;
}