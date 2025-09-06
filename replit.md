# StudyFlow - Executive Function-Friendly Productivity Platform

## Overview

StudyFlow is a full-stack web application designed to help students manage academic workloads. It transforms generic schedule entries into specific daily tasks, supporting executive function needs. The platform integrates with Canvas and uses PostgreSQL for data persistence. Its core purpose is to provide a compassionate and supportive approach to productivity, offering concrete daily tasks and a sequential 52-week curriculum progression.

## User Preferences

*   **Communication style**: Simple, everyday language
*   **Development approach**: Iterative with frequent working checkpoints
*   **Priority**: Executive function support for ADHD students
*   **Focus**: Concrete, specific daily tasks over abstract planning
*   **UI/UX Philosophy**: No harsh contrasts (avoid white-on-black or black-on-white), clean interface without instruction clutter

## System Architecture

**Frontend**:
*   React 18 with TypeScript
*   shadcn/ui and Radix UI for components
*   Tailwind CSS for styling
*   TanStack Query for server state management
*   Wouter for routing
*   Framer Motion for animations

**Backend**:
*   Express.js with TypeScript
*   RESTful API design
*   Drizzle ORM for type-safe database operations
*   Canvas API integration with rate limiting
*   Session management with PostgreSQL storage
*   Intelligent assignment scheduling system

**Database**:
*   PostgreSQL
*   Core tables include `assignments`, `users`, `bible_curriculum`, `schedule_template`, `bible_curriculum_position`, `daily_schedule_status`, `student_profiles`, `student_status`, and `sessions`.

**Key Features & Implementations**:
*   **Intelligent Assignment Scheduling**: Prioritizes overdue assignments, then by due date. Includes subject distribution algorithm to ensure diverse daily workloads and advanced deduplication to prevent redundant tasks. Filters out non-completable assignments (e.g., "Class Participation").
*   **Smart Time Estimation**: Automatically assigns appropriate time estimates - Recipe reviews (10 min), Forensics labs (60 min), Quizzes (15 min), Discussion posts (20 min), Default (30 min).
*   **Due Date Intelligence System**: Extracts due dates from assignment titles during Canvas import, supporting 25+ date formats. Features academic calendar intelligence for smart year inference and retroactive cleanup.
*   **Canvas Integration**: Full assignment import, enhanced filtering (excludes pre-June 2025 assignments), and due date extraction during import.
*   **Bible Curriculum System**: Manages sequential day progression (e.g., Week 1 Day 1 -> Day 2).
*   **Admin Management**: Provides bulk status updates, source filtering, retroactive due date extraction, and assignment deletion.
*   **Dark Mode Theme System**: Comprehensive theme switching with proper 4.5:1 contrast ratios, comfortable eye-strain-reducing color palettes, and device theme preference support.
*   **Instruction-Free Interface**: Clean, focused UI that displays only essential information (titles, subjects, due dates, completion status) without instructional clutter.
*   **UI/UX**: Features centered time display, status-driven icons, and an executive function-optimized interface focusing on concrete daily tasks.

## External Dependencies

*   **Canvas API**: For importing student assignments and course data.
*   **PostgreSQL**: Primary database for all application data, including user sessions, assignments, and curriculum.

## Recent Updates (September 2025)

### **🌍 Timezone & Navigation Fixes (September 6, 2025):**
*   **Print Queue Timezone Resolution**: Fixed critical issue where Monday assignments displayed as "Due Sunday" - now correctly shows classroom days in Eastern Time
*   **Comprehensive Timezone Fixes**: Applied Eastern Time context across 5+ frontend display locations to match co-op classroom schedule
*   **Canvas Import Preservation**: Timezone fixes only apply to title-inferred dates; Canvas assignments with proper due_at times remain unchanged  
*   **Print Queue Button Functionality**: Resolved hardcoded status bug - API now correctly returns actual print status instead of always 'needs_printing'
*   **Admin Navigation**: Added consistent "Back to Admin" buttons across all admin pages for seamless navigation workflow
*   **Print Queue Completed Items**: Fixed filter logic to include completed items (printed/skipped) in "Completed" section display

### **📚 Previous Updates:**
*   **Instructions Removal**: Completely eliminated instruction displays from assignment cards and guided views for cleaner, less overwhelming interface
*   **Smart Time Estimation**: Added intelligent time allocation based on assignment type - significantly improved scheduling accuracy
*   **Recipe Time Fix**: Updated all recipe review assignments from 60 minutes to realistic 10-minute estimates
*   **Forensics Lab Time**: Properly allocated 60 minutes for hands-on forensics lab assignments
*   **Database Optimization**: Updated existing assignments with correct time estimates via direct database updates
*   **Theme System Stability**: Verified comprehensive dark mode implementation with proper contrast ratios
*   **Smart Continuation Filter**: Added intelligent filter to prevent re-importing "(Continued)" assignments when original is already completed locally via "Need More Time" feature
*   **Assignments Page Usability**: Changed default view to show only pending assignments instead of completed ones, making the system manageable as the school year progresses
*   **Co-op Prep Checklist**: Added intelligent preparation checklist in Guided mode during Prep/Load blocks that analyzes the day's schedule and assignments to generate personalized co-op preparation recommendations (books, materials, homework, general items) with executive function-friendly categorization and interactive checkboxes

## Latest Stable Version (September 6, 2025) - v2.1 Timezone & Navigation Edition

### 🎨 **Dark Mode Transformation Complete:**

*   **Lovable-Style Design**: Completely redesigned dark mode to match modern aesthetic with true black cards (#141316), very dark backgrounds (#0a0a0b), and high contrast white text (#fafafa)
*   **Bright Accent Colors**: Updated all color variables to use saturated, vibrant colors - violet (#6d28d8), emerald (#00a348), blue (#3b82f6), and gold (#f1c40f) that really pop against the dark backgrounds
*   **Theme Consistency**: Applied new color system across all components including AssignmentCard, OverviewBlock, GuidedDayView, and all status indicators
*   **Theme Toggle Positioning**: Standardized theme toggle placement to far right on all pages for consistent navigation experience
*   **No More Washed Colors**: Eliminated all old hardcoded blue colors and replaced with bright theme variables for consistent branding

### ✅ **Production-Ready Features Confirmed Working:**

*   **Schedule Templates Management**: Complete CRUD system for managing daily schedule structures via `/schedule-templates` page
*   **CSV Upload System**: Robust bulk upload with intelligent field mapping, deduplication, and constraint handling
*   **Time Display Fix**: HTML time inputs properly display zero-padded format (08:15) converted from database format (8:15)
*   **Block Type Logic**: Proper handling of block number assignment - only Bible, Assignment, Co-op, Study Hall get sequential numbers; Travel, Movement, Lunch, Prep/Load remain unnumbered
*   **Assignment Population**: Study Hall and Assignment blocks correctly receive homework assignments from Canvas integration
*   **Constraint Resolution**: Unique constraint `(student_name, weekday, block_number)` properly handled with deduplication
*   **Dark Mode Theme**: Complete theme system with 4.5:1 contrast ratios and comfortable color palettes

### 🔧 **Critical Architecture Fixes Applied:**

1. **Study Hall Block Types**: Fixed Abigail's Study Hall from incorrect "Co-op" type to "Assignment" type, enabling homework population
2. **CSV Field Mapping**: Added comprehensive header mapping to handle various CSV formats (`studentName`→`student_name`, `blockType`→`block_type`, etc.)
3. **Auto Block Numbering**: Intelligent sequential numbering only for appropriate block types, preventing constraint violations
4. **Duplicate Prevention**: Added deduplication logic to handle duplicate entries in CSV uploads
5. **Time Format Compatibility**: Proper conversion between database storage format and HTML input requirements

### 📋 **System Status (v2.1):**
*   **Database**: PostgreSQL with proper migrations and constraints
*   **CSV Upload**: Fully functional with error handling and logging
*   **Schedule Display**: Time inputs show correct formatted times
*   **Assignment Allocation**: Both students receiving appropriate homework in Study Hall/Assignment blocks
*   **Theme System**: Complete dark/light mode support with proper accessibility
*   **Data Integrity**: Protected schedule template as source of truth with proper block type enforcement
*   **Timezone Accuracy**: All displays correctly show Eastern Time to match co-op classroom context
*   **Print Queue**: Fully functional with correct status tracking and timezone-aware date grouping
*   **Admin Navigation**: Seamless navigation between admin pages with consistent "Back to Admin" buttons
*   **Code Quality**: LSP errors resolved, TypeScript compatibility maintained
*   **Canvas Integration**: Sticky Canvas metadata preserved, timezone fixes scoped to title-inferred dates only