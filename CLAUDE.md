# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 16.0.3 application using React 19.2.0, TypeScript, and Tailwind CSS 4.x. The project follows Next.js App Router architecture with React Server Components as the default.

### Backend & Database
- **Supabase** - PostgreSQL database and backend services
- MCP server configured for Supabase (project ref: `nqvkezwukmryvlkosonw`)
- MCP tools available for database operations, authentication, and storage

### Authentication
- **Clerk** - User authentication and management
- Clerk provider configured in root layout
- Protected routes via Clerk middleware
- Public routes: `/`, `/sign-in`, `/api/webhooks`
- **Note**: Public sign-up is disabled - user invitations only

## Commands

### Development
- `npm run dev` - Start development server on http://localhost:3000
- `npm run build` - Create production build
- `npm start` - Start production server
- `npm run lint` - Run ESLint

### TypeScript
- TypeScript is configured with strict mode enabled
- Path alias `@/*` maps to `./src/*`
- Target: ES2017 with JSX transform set to `react-jsx`

## Architecture

### Directory Structure
- `src/app/` - Next.js App Router directory containing routes and layouts
  - `layout.tsx` - Root layout with Geist font family (sans and mono variants) and Clerk provider
  - `page.tsx` - Home page component
  - `globals.css` - Global styles with Tailwind CSS imports and CSS variables
- `src/lib/` - Utility functions and shared code
  - `supabase/client.ts` - Browser-side Supabase client
  - `supabase/server.ts` - Server-side Supabase client with cookie handling
  - `supabase/middleware.ts` - Supabase session management for middleware
- `src/middleware.ts` - Combined Clerk authentication and Supabase session middleware
- `public/` - Static assets served from root URL

### Styling System
- **Tailwind CSS 4.x** via PostCSS plugin (`@tailwindcss/postcss`)
- No traditional `tailwind.config.js` - uses CSS-based configuration
- Theme tokens defined in `globals.css` using `@theme inline` directive
- CSS variables for theming: `--background`, `--foreground`, `--font-sans`, `--font-mono`
- Dark mode support via `prefers-color-scheme` media query

### Font System
- Geist Sans and Geist Mono loaded from `next/font/google`
- Fonts configured as CSS variables in root layout
- Applied via className in body element

### Type Safety
- Strict TypeScript configuration with `strict: true`
- Use proper Next.js types: `Metadata`, `NextConfig`, etc.
- Never use generic types - maintain strictest type safety

## Configuration Files

- `next.config.ts` - Next.js configuration (currently minimal)
- `tsconfig.json` - TypeScript compiler options
- `eslint.config.mjs` - ESLint using flat config with Next.js core-web-vitals and TypeScript presets
- `postcss.config.mjs` - PostCSS configuration for Tailwind CSS 4.x

## Key Conventions

- App Router uses React Server Components by default
- Client components must use `"use client"` directive
- Image optimization via `next/image` component
- Metadata exported from page/layout files for SEO

## Environment Variables

Required environment variables (see `.env.example`):

### Clerk
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk publishable key
- `CLERK_SECRET_KEY` - Clerk secret key
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` - Sign in page URL (default: `/sign-in`)
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` - Redirect after sign in (default: `/dashboard`)

### Supabase
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)

## Setup Instructions

1. Copy `.env.example` to `.env.local`
2. Fill in your Clerk keys from [clerk.com](https://clerk.com)
3. Fill in your Supabase keys from [supabase.com](https://supabase.com)
4. Run `npm run dev` to start the development server
