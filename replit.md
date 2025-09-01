# StudyFlow - Executive Function-Friendly Productivity Platform

## Overview

StudyFlow is a full-stack web application designed to help students manage academic workloads. It transforms generic schedule entries into specific daily tasks, supporting executive function needs. The platform integrates with Canvas and uses PostgreSQL for data persistence. Its core purpose is to provide a compassionate and supportive approach to productivity, offering concrete daily tasks and a sequential 52-week curriculum progression.

## User Preferences

*   **Communication style**: Simple, everyday language
*   **Development approach**: Iterative with frequent working checkpoints
*   **Priority**: Executive function support for ADHD students
*   **Focus**: Concrete, specific daily tasks over abstract planning

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
*   **Due Date Intelligence System**: Extracts due dates from assignment titles during Canvas import, supporting 25+ date formats. Features academic calendar intelligence for smart year inference and retroactive cleanup.
*   **Canvas Integration**: Full assignment import, enhanced filtering (excludes pre-June 2025 assignments), and due date extraction during import.
*   **Bible Curriculum System**: Manages sequential day progression (e.g., Week 1 Day 1 -> Day 2).
*   **Admin Management**: Provides bulk status updates, source filtering, retroactive due date extraction, and assignment deletion.
*   **UI/UX**: Features centered time display, status-driven icons, and an executive function-optimized interface focusing on concrete daily tasks.

## External Dependencies

*   **Canvas API**: For importing student assignments and course data.
*   **PostgreSQL**: Primary database for all application data, including user sessions, assignments, and curriculum.