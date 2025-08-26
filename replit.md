# Overview

StudyFlow is a student productivity application designed to help students manage their academic workload with a compassionate and supportive approach. The application focuses on task management, study sessions tracking, and gentle accountability features. It's built as a full-stack web application using modern React and Node.js technologies with a PostgreSQL database for data persistence.

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