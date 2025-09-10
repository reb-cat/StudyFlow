import fs from 'fs';
import pg from 'pg';
const { Client } = pg;

/**
 * PRODUCTION-SAFE Forensics Textbook Migration Script
 * 
 * This script safely adds Apologia Forensics textbook readings to production
 * without overwriting existing data or causing conflicts.
 */

// Read and parse the CSV file
const csvContent = fs.readFileSync('attached_assets/forensics_textbook_chapters_1757513527575.csv', 'utf8');
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
      
      // Parse MM/DD/YY format to proper date
      const [month, day, year] = dueDateStr.split('/');
      const fullYear = parseInt(year) + 2000; // Convert 25 to 2025
      const dueDate = new Date(fullYear, parseInt(month) - 1, parseInt(day));
      
      readings.push({
        moduleNumber,
        readingNumber,
        title,
        link,
        dueDate: dueDate.toISOString().split('T')[0] // YYYY-MM-DD format
      });
    }
  }
}

console.log(`📚 Parsed ${readings.length} readings from CSV`);

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function safeProductionMigration() {
  try {
    await client.connect();
    console.log('🔌 Connected to production database');
    
    // SAFETY CHECK 1: Check if textbook readings already exist
    const existingCheck = await client.query(`
      SELECT COUNT(*) as count 
      FROM assignments 
      WHERE course_name = 'Apologia Forensics Textbook'
    `);
    
    const existingCount = parseInt(existingCheck.rows[0].count);
    if (existingCount > 0) {
      console.log(`⚠️  WARNING: Found ${existingCount} existing 'Apologia Forensics Textbook' assignments`);
      console.log('❌ ABORTING: Textbook readings already exist in production');
      console.log('💡 TIP: Check if migration was already run or manually remove existing textbook assignments first');
      return;
    }
    
    // SAFETY CHECK 2: Verify user exists
    const userCheck = await client.query(`
      SELECT id FROM assignments WHERE user_id LIKE '%abigail%' LIMIT 1
    `);
    
    if (userCheck.rows.length === 0) {
      console.log('❌ ERROR: No user found with "abigail" in user_id');
      console.log('💡 TIP: Update USER_ID variable in script to match production user ID');
      return;
    }
    
    const PRODUCTION_USER_ID = userCheck.rows[0].user_id || 'abigail-user';
    console.log(`👤 Using production user ID: ${PRODUCTION_USER_ID}`);
    
    // SAFETY CHECK 3: Check for conflicting titles
    const titleConflicts = [];
    for (const reading of readings) {
      const conflictCheck = await client.query(`
        SELECT id FROM assignments 
        WHERE user_id = $1 AND title = $2
      `, [PRODUCTION_USER_ID, reading.title]);
      
      if (conflictCheck.rows.length > 0) {
        titleConflicts.push(reading.title);
      }
    }
    
    if (titleConflicts.length > 0) {
      console.log(`⚠️  WARNING: Found ${titleConflicts.length} conflicting assignment titles:`);
      titleConflicts.slice(0, 5).forEach(title => console.log(`   - "${title}"`));
      if (titleConflicts.length > 5) {
        console.log(`   ... and ${titleConflicts.length - 5} more`);
      }
      console.log('❌ ABORTING: Title conflicts detected');
      console.log('💡 TIP: Remove conflicting assignments or modify titles in CSV');
      return;
    }
    
    console.log('✅ All safety checks passed - proceeding with import');
    
    // CRITICAL: Add module_number and reading_number fields to production database first
    console.log('🔧 Adding sequencing fields to production database...');
    try {
      await client.query(`
        ALTER TABLE assignments 
        ADD COLUMN IF NOT EXISTS module_number INTEGER,
        ADD COLUMN IF NOT EXISTS reading_number INTEGER
      `);
      console.log('✅ Sequencing fields added to production database');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('✅ Sequencing fields already exist in production database');
      } else {
        throw err;
      }
    }
    
    // Prepare the insert query with proper sequencing
    const insertQuery = `
      INSERT INTO assignments (
        user_id,
        title,
        course_name,
        subject,
        due_date,
        canvas_url,
        creation_source,
        is_canvas_import,
        completion_status,
        is_portable,
        portability_reason,
        actual_estimated_minutes,
        canvas_course_id,
        canvas_instance,
        academic_year,
        module_number,
        reading_number,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    `;
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const reading of readings) {
      try {
        await client.query(insertQuery, [
          PRODUCTION_USER_ID,                          // user_id
          reading.title,                               // title
          'Apologia Forensics Textbook',              // course_name
          'Forensics',                                 // subject
          reading.dueDate,                            // due_date
          reading.link,                               // canvas_url
          'textbook',                                 // creation_source
          false,                                      // is_canvas_import
          'pending',                                  // completion_status
          true,                                       // is_portable
          'Textbook reading suitable for any location', // portability_reason
          15,                                         // actual_estimated_minutes (15 min per reading)
          '570',                                      // canvas_course_id
          '2',                                        // canvas_instance
          '2024-2025',                               // academic_year
          reading.moduleNumber,                       // module_number - CRITICAL for sequencing
          reading.readingNumber,                      // reading_number - CRITICAL for sequencing
          new Date().toISOString(),                   // created_at
          new Date().toISOString()                    // updated_at
        ]);
        
        successCount++;
        if (successCount % 20 === 0) {
          console.log(`📚 Imported ${successCount} readings...`);
        }
      } catch (err) {
        console.error(`❌ Error importing "${reading.title}":`, err.message);
        errorCount++;
      }
    }
    
    console.log(`\n🎉 PRODUCTION MIGRATION COMPLETED!`);
    console.log(`✅ Successfully imported: ${successCount} textbook readings`);
    console.log(`❌ Errors: ${errorCount} readings`);
    
    if (errorCount === 0) {
      console.log(`\n📊 Production database now has:`);
      console.log(`   - ${successCount} new Apologia Forensics textbook readings`);
      console.log(`   - All existing Canvas assignments preserved`);
      console.log(`   - Assessment-aware scheduling ready`);
    }
    
  } catch (err) {
    console.error('💥 CRITICAL ERROR:', err);
    console.log('❌ Migration aborted for safety');
  } finally {
    await client.end();
  }
}

console.log('🚀 Starting PRODUCTION-SAFE Forensics Migration...');
console.log('⚠️  This script includes safety checks to prevent data loss');
safeProductionMigration();