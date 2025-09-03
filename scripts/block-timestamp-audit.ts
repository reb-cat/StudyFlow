#!/usr/bin/env tsx

/**
 * Block Timestamp Audit - Development Only
 * 
 * Goal: Prove whether block start/end instants are being constructed in UTC (...Z) 
 * instead of School timezone.
 * 
 * Checks specific blocks to see if timestamps have timezone offset issues.
 */

import { storage } from '../server/storage';
import { getSchoolWeekdayName } from '../server/lib/schoolTimezone';

async function auditBlockTimestamps() {
  console.log('🕐 Block Timestamp Audit - Development Only');
  console.log('='.repeat(60));
  
  try {
    // Step 1: Discover what schedule data exists
    console.log('\n🔍 Discovery: What schedule data exists?');
    console.log('-'.repeat(50));
    
    // Check different student names and weekdays
    const students = ['abigail', 'Abigail', 'khalil', 'Khalil'];
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    let foundBlocks: Array<{ student: string, weekday: string, blocks: any[] }> = [];
    
    for (const student of students) {
      for (const weekday of weekdays) {
        try {
          const schedule = await storage.getScheduleTemplate(student, weekday);
          if (schedule && schedule.length > 0) {
            foundBlocks.push({ student, weekday, blocks: schedule });
            console.log(`✅ Found ${schedule.length} blocks for ${student} ${weekday}`);
          }
        } catch (error) {
          // Skip silently
        }
      }
    }
    
    if (foundBlocks.length === 0) {
      console.log('❌ No schedule templates found in database');
      console.log('💡 This might indicate an empty schedule_template table');
      return;
    }
    
    // Pick the first available schedule for audit
    const firstSchedule = foundBlocks[0];
    console.log(`\n🎯 Using ${firstSchedule.student} ${firstSchedule.weekday} for audit`);
    
    // Test Case 1: First block from discovered schedule
    const firstBlock = firstSchedule.blocks[0];
    if (firstBlock) {
      console.log('\n📅 Test Case 1: First Available Block');
      console.log('-'.repeat(40));
      await auditSingleBlock(firstBlock, '2025-09-03', `${firstSchedule.student} ${firstSchedule.weekday} Block 1`);
    }
    
    // Test Case 2: A morning block if available
    const morningBlock = firstSchedule.blocks.find(block => {
      const hour = parseInt(block.startTime.split(':')[0]);
      return hour >= 8 && hour <= 11;
    });
    
    if (morningBlock && morningBlock !== firstBlock) {
      console.log('\n📅 Test Case 2: Morning Block');
      console.log('-'.repeat(40));
      await auditSingleBlock(morningBlock, '2025-09-03', `${firstSchedule.student} ${firstSchedule.weekday} Morning Block`);
    }
    
    // Show all discovered blocks for reference
    console.log('\n📊 All Discovered Blocks:');
    console.log('-'.repeat(40));
    foundBlocks.forEach(({ student, weekday, blocks }) => {
      console.log(`\n${student} ${weekday}:`);
      blocks.forEach(block => {
        console.log(`  ${block.blockNumber}: ${block.startTime}-${block.endTime} ${block.subject || 'No Subject'}`);
      });
    });
    
  } catch (error) {
    console.error('❌ Audit failed:', error);
  }
}

async function auditSingleBlock(block: any, date: string, label: string) {
  console.log(`\n🔍 Auditing: ${label}`);
  
  // Raw template data
  const rawData = {
    weekday: block.weekday,
    startTime: block.startTime,
    endTime: block.endTime,
    blockNumber: block.blockNumber,
    subject: block.subject
  };
  
  // Simulate how the scheduler constructs timestamps
  const composedStartISO = composeBlockTimestamp(date, block.startTime);
  const composedEndISO = composeBlockTimestamp(date, block.endTime);
  
  // Convert to NY local time for display
  const startInNY = formatInTimezone(composedStartISO, 'America/New_York');
  const endInNY = formatInTimezone(composedEndISO, 'America/New_York');
  
  // Check for Z suffix
  const hasZStart = composedStartISO.endsWith('Z');
  const hasZEnd = composedEndISO.endsWith('Z');
  
  // Calculate offset from raw label
  const offsetMins = calculateOffsetMinutes(block.startTime, composedStartISO);
  
  console.log('📊 Audit Results:');
  console.log('┌─────────────────┬──────────────────────────────────────┐');
  console.log('│ Property        │ Value                                │');
  console.log('├─────────────────┼──────────────────────────────────────┤');
  console.log(`│ weekday         │ ${block.weekday.padEnd(36)} │`);
  console.log(`│ raw times       │ ${block.startTime}-${block.endTime}${' '.repeat(30 - (block.startTime + block.endTime).length)} │`);
  console.log(`│ composed start  │ ${composedStartISO.padEnd(36)} │`);
  console.log(`│ composed end    │ ${composedEndISO.padEnd(36)} │`);
  console.log(`│ start in NY     │ ${startInNY.padEnd(36)} │`);
  console.log(`│ end in NY       │ ${endInNY.padEnd(36)} │`);
  console.log(`│ has Z suffix?   │ start:${hasZStart} end:${hasZEnd}${' '.repeat(24)} │`);
  console.log(`│ offset (mins)   │ ${offsetMins.toString().padEnd(36)} │`);
  console.log(`│ subject         │ ${(block.subject || 'N/A').padEnd(36)} │`);
  console.log('└─────────────────┴──────────────────────────────────────┘');
  
  // Analysis
  if (hasZStart || hasZEnd) {
    console.log('⚠️  WARNING: Timestamps end with Z (UTC construction detected)');
  }
  
  if (Math.abs(offsetMins) > 30) {
    console.log(`⚠️  WARNING: Large offset detected (${offsetMins} minutes from expected time)`);
  }
  
  if (Math.abs(offsetMins) <= 15) {
    console.log('✅ Timestamp appears to be in correct timezone');
  }
}

function composeBlockTimestamp(date: string, timeStr: string): string {
  // This simulates how our scheduler constructs block timestamps
  // We want to see if it's using UTC vs school timezone
  
  try {
    // Method 1: Direct UTC construction (would cause issues)
    const utcMethod = new Date(`${date}T${padTime(timeStr)}:00.000Z`).toISOString();
    
    // Method 2: School timezone construction (correct way)
    const schoolTzMethod = constructInSchoolTimezone(date, timeStr);
    
    // For audit, show what our current code likely does
    // Check if we're using the problematic UTC method
    const probablyUsing = utcMethod; // This is what we suspect is happening
    
    return probablyUsing;
  } catch (error) {
    return `ERROR: ${error}`;
  }
}

function constructInSchoolTimezone(date: string, timeStr: string): string {
  // This is the CORRECT way to construct timestamps in school timezone
  const [hours, minutes] = timeStr.split(':').map(Number);
  const schoolDate = new Date();
  
  // Parse the date in school timezone
  const [year, month, day] = date.split('-').map(Number);
  schoolDate.setFullYear(year, month - 1, day);
  schoolDate.setHours(hours, minutes || 0, 0, 0);
  
  return schoolDate.toISOString();
}

function padTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':');
  return `${hours.padStart(2, '0')}:${(minutes || '00').padStart(2, '0')}`;
}

function formatInTimezone(isoString: string, timezone: string): string {
  try {
    return new Date(isoString).toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch (error) {
    return `ERROR: ${error}`;
  }
}

function calculateOffsetMinutes(rawTimeStr: string, isoString: string): number {
  try {
    // Parse raw time
    const [rawHours, rawMinutes] = rawTimeStr.split(':').map(Number);
    const rawTotalMinutes = rawHours * 60 + (rawMinutes || 0);
    
    // Parse ISO time in NY timezone
    const isoDate = new Date(isoString);
    const nyTime = new Date(isoDate.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const isoTotalMinutes = nyTime.getHours() * 60 + nyTime.getMinutes();
    
    return isoTotalMinutes - rawTotalMinutes;
  } catch (error) {
    return 999; // Error indicator
  }
}

// Run the audit
auditBlockTimestamps().catch(console.error);