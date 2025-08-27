# StudyFlow v1.0.0

StudyFlow is an executive function-friendly productivity platform designed to help students manage their academic workload with a compassionate and supportive approach. The system transforms generic 'Bible' schedule entries into specific 52-week curriculum content with sequential progression, providing concrete daily tasks that support executive function needs. Built as a full-stack web application using modern React and Node.js technologies with comprehensive Canvas integration and PostgreSQL data persistence.

**Current Version**: 1.0.0 (Released: August 27, 2025)
**Status**: Complete and fully functional with Canvas integration and Bible curriculum system

# Recent Changes (v1.0.0 Release)

## Core System Fixes
- **Bible Curriculum Integration**: Fixed critical UI duplication and implemented clean sequential progression system
- **Data Consistency**: Resolved major inconsistencies by standardizing student names across all 349 assignments
- **Admin Panel**: Restored proper functionality showing active assignments for management
- **Database Cleanup**: Removed unused tables and streamlined schema for production readiness

## Major Technical Achievements  
- **Sequential Bible Curriculum**: Week 1 Day 1 → Day 2 → Day 3 progression (no complex calendar math)
- **Canvas Integration**: Full assignment import and management for both students (349 total assignments)
- **Position Tracking**: Both students now have Bible curriculum position tracking (currently at Genesis 1-2)
- **Executive Function Support**: Concrete task specification with specific readings instead of vague entries

## System Statistics
- Total Assignments: 349 (Abigail: 117, Khalil: 232)  
- Active Assignments: 77 (filtered for daily planning)
- Bible Curriculum: Complete 52-week program with 310 entries
- Schedule Templates: 103 blocks across both students
- Database: Streamlined to 5 core tables for optimal performance

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client is built using React 18 with TypeScript and follows a component-based architecture. Key architectural decisions include:

- **UI Framework**: Uses shadcn/ui components built on Radix UI primitives for consistent, accessible design
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming
- **State Management**: TanStack Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Animations**: Framer Motion for smooth UI transitions and interactions
- **Form Handling**: React Hook Form with Zod validation resolvers

The frontend follows a feature-based folder structure with reusable UI components, custom hooks, and utility functions. The design system uses a "new-york" style configuration with neutral base colors and comprehensive component variants.

## Backend Architecture
The server is built with Express.js and follows a modular architecture:

- **Framework**: Express.js with TypeScript for type safety
- **Database Layer**: Drizzle ORM for type-safe database operations
- **Storage Interface**: Abstract storage interface allowing for multiple implementations (currently supports in-memory storage for development)
- **Development Setup**: Vite integration for hot module replacement and development experience
- **Build System**: ESBuild for production builds with external package handling

The server uses middleware for request logging, error handling, and JSON parsing. API routes are prefixed with `/api` for clear separation from static assets.

## Data Storage Solutions
The application uses PostgreSQL as the primary database with Drizzle ORM for schema management:

- **Database**: PostgreSQL with Neon serverless hosting
- **Schema Management**: Drizzle Kit for migrations and schema evolution
- **Connection**: Neon HTTP driver for serverless compatibility
- **Tables**: Users, tasks, study sessions, and user preferences with proper relationships and constraints

The schema includes comprehensive fields for user management, task tracking with priority levels, study session logging with different session types (Pomodoro, deep work, breaks), and customizable user preferences.

## Authentication and Authorization
The application is prepared for authentication with:

- **Session Storage**: PostgreSQL-based session store using connect-pg-simple
- **User Schema**: Complete user table with email, username, and password fields
- **Security**: Prepared for secure session management and user authentication flows

## External Dependencies

- **Database**: Neon PostgreSQL for serverless database hosting
- **UI Components**: Radix UI primitives for accessible component foundation
- **Icons**: Lucide React for consistent iconography
- **Fonts**: Google Fonts integration (Inter, Geist Mono, Architects Daughter, DM Sans, Fira Code)
- **Development**: Replit-specific plugins for development environment integration
- **Date Handling**: date-fns for date manipulation and formatting
- **Validation**: Zod for runtime type checking and form validation