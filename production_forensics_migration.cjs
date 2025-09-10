// ---- HARD GUARDRAILS ----
const assert = (cond, msg) => { if (!cond) { console.error("❌ " + msg); process.exit(1); } };

const rawEnv = process.env.PRODUCTION_USER_ID;
const targetUserId = rawEnv && rawEnv.trim();
assert(!!targetUserId, "PRODUCTION_USER_ID is missing. Example: PRODUCTION_USER_ID=\"abigail-user\" node production_forensics_migration.js");

// Log exactly what we'll use, then hard-fail if it's not one of your known IDs (optional but safer)
const allowed = new Set(["abigail-user", "khalil-user"]);
assert(allowed.has(targetUserId), `Unexpected PRODUCTION_USER_ID: ${targetUserId}`); 
console.log("🔐 Using PRODUCTION_USER_ID =", JSON.stringify(targetUserId));

// If your CSV has a user column, DO NOT trust it:
function withForcedUserId(row) {
  const { user_id, userId, ...rest } = row;   // strip any incoming user field
  return { ...rest, user_id: targetUserId };   // force to target
}

// Before doing anything, prove we're on the right DB
const { Client } = require("pg");
const dbUrl = process.env.DATABASE_URL;
assert(!!dbUrl, "DATABASE_URL missing. Pass inline to be safe.");
const pg = new Client({ connectionString: dbUrl });

(async () => {
  await pg.connect();
  const loc = await pg.query(`SELECT current_database() AS db, inet_server_addr() AS host, inet_server_port() AS port`);
  console.log("🛰️ Connected to:", loc.rows[0]);

  // ---- SAFETY CHECK (only block if textbook rows already exist FOR THIS USER) ----
  const check = await pg.query(
    `SELECT COUNT(*)::int AS n
     FROM assignments
     WHERE course_name = 'Apologia Forensics Textbook'
       AND user_id = $1`,
    [targetUserId]
  );
  if (check.rows[0].n > 0) {
    console.error("❌ ABORTING: Textbook readings already exist for this user.");
    process.exit(1);
  }

  // ---- CSV PARSING ----
  const fs = require('fs');
  const csvContent = fs.readFileSync('attached_assets/forensics_textbook_chapters_1757527953988.csv', 'utf8');
  const lines = csvContent.split('\n');

  // Parse CSV data
  const readings = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      // Handle quoted CSV values properly
      const row = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < lines[i].length; j++) {
        const char = lines[i][j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      row.push(current.trim()); // Push the last field
      
      if (row.length >= 5) {
        const moduleNumber = parseInt(row[0]);
        const readingNumber = parseInt(row[1]);
        const title = row[2].replace(/^"|"$/g, ''); // Remove quotes
        const link = row[3];
        const dueDateStr = row[4];
        
        // Parse MM/DD/YY format to Eastern Time end-of-day date (matches StudyFlow's timezone handling)
        const [month, day, year] = dueDateStr.split('/');
        const fullYear = parseInt(year) + 2000; // Convert 25 to 2025
        
        // Create date as Eastern Time end-of-day to match classroom context
        // Add UTC offset to ensure Eastern Time dates display correctly
        const parsedMonth = parseInt(month) - 1; // JavaScript months are 0-based
        const parsedDay = parseInt(day);
        const isDST = parsedMonth >= 2 && parsedMonth <= 10; // Rough DST check (March-November)
        const utcOffsetHours = isDST ? 4 : 5; // EDT is UTC-4, EST is UTC-5
        const dueDate = new Date(fullYear, parsedMonth, parsedDay, 23 + utcOffsetHours, 59, 0, 0);
        
        readings.push({
          title,
          module_number: moduleNumber,
          reading_number: readingNumber,
          due_date: dueDate.toISOString().split('T')[0], // YYYY-MM-DD format
          canvas_url: link
        });
      }
    }
  }

  console.log(`📚 Parsed ${readings.length} readings from CSV`);

  // ---- ADD SCHEMA COLUMNS IF NEEDED ----
  try {
    await pg.query(`
      ALTER TABLE assignments 
      ADD COLUMN IF NOT EXISTS module_number INTEGER,
      ADD COLUMN IF NOT EXISTS reading_number INTEGER
    `);
    console.log("✅ Ensured sequencing columns exist");
  } catch (err) {
    console.log("⚠️ Schema columns might already exist:", err.message);
  }

  // ---- TRANSACTIONAL IMPORT ----
  await pg.query("BEGIN");
  try {
    for (const row of readings) {
      const r = withForcedUserId(row);
      await pg.query(
        `INSERT INTO assignments
           (user_id, course_name, title, module_number, reading_number, creation_source, academic_year, 
            subject, due_date, canvas_url, is_canvas_import, completion_status, is_portable, 
            portability_reason, actual_estimated_minutes, canvas_course_id, canvas_instance,
            created_at, updated_at)
         VALUES ($1,'Apologia Forensics Textbook',$2,$3,$4,'textbook','2024-2025',
                 'Forensics',$5,$6,false,'pending',true,
                 'Textbook reading suitable for any location',15,'570','2',
                 NOW(),NOW())`,
        [r.user_id, r.title, r.module_number, r.reading_number, r.due_date, r.canvas_url]
      );
    }
    await pg.query("COMMIT");
    console.log(`✅ Imported ${readings.length} textbook readings for ${targetUserId}`);
  } catch (e) {
    await pg.query("ROLLBACK");
    console.error("❌ Import failed; rolled back.", e);
    process.exit(1);
  } finally {
    await pg.end();
  }
})();