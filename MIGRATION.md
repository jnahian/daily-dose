# Daily Dose Landing Page Migration Guide

## Overview

This guide provides a step-by-step process for migrating the Daily Dose landing page from static HTML/CSS/JS to a modern Next.js application with Server-Side Rendering (SSR).

**Migration Specifications:**

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (PostCSS)
- **Architecture**: Separate server from Slack bot
- **Location**: `web/` directory

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Setup](#project-setup)
3. [Component Architecture](#component-architecture)
4. [Migration Steps](#migration-steps)
5. [Testing & Validation](#testing--validation)
6. [Deployment](#deployment)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

- Node.js 18.17+ or 20+
- npm 9+ or pnpm 8+ or yarn 4+
- Git

### Knowledge Requirements

- React fundamentals
- TypeScript basics
- Tailwind CSS
- Next.js App Router

---

## Project Setup

### Phase 1: Initialize Next.js Project

#### Step 1.1: Create Next.js App

```bash
# From project root
npx create-next-app@latest web --typescript --tailwind --app --no-src-dir --import-alias "@/*"

# Answer prompts:
# ✔ Would you like to use TypeScript? … Yes
# ✔ Would you like to use ESLint? … Yes
# ✔ Would you like to use Tailwind CSS? … Yes
# ✔ Would you like to use `src/` directory? … No
# ✔ Would you like to use App Router? … Yes
# ✔ Would you like to customize the default import alias (@/*)? … No
```

#### Step 1.2: Navigate to Web Directory

```bash
cd web
```

#### Step 1.3: Install Additional Dependencies

```bash
npm install @heroicons/react clsx tailwind-merge
npm install -D @types/node @types/react @types/react-dom
```

#### Step 1.4: Update package.json Scripts

Add custom scripts to `web/package.json`:

```json
{
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  }
}
```

### Phase 2: Configure Tailwind CSS

#### Step 2.1: Update tailwind.config.ts

Replace content in `web/tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "slack-purple": "#4A154B",
        "slack-green": "#007A5A",
        "slack-blue": "#1264A3",
        primary: "#00CFFF",
        secondary: "#00AFFF",
        glow: "#007BFF",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-in",
        "slide-in": "slideIn 0.6s ease-out",
        "bounce-slow": "bounce 2s infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideIn: {
          "0%": { transform: "translateY(30px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

#### Step 2.2: Create Global Styles

Update `web/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --font-inter: "Inter", sans-serif;
    --font-jetbrains-mono: "JetBrains Mono", monospace;
  }

  html {
    scroll-behavior: smooth;
  }

  body {
    @apply bg-gray-50 text-gray-900;
  }
}

@layer components {
  /* Custom scrollbar */
  ::-webkit-scrollbar {
    width: 10px;
  }

  ::-webkit-scrollbar-track {
    @apply bg-gray-100;
  }

  ::-webkit-scrollbar-thumb {
    @apply bg-gray-400 rounded-full;
  }

  ::-webkit-scrollbar-thumb:hover {
    @apply bg-gray-500;
  }

  /* Accessibility - Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}
```

### Phase 3: Project Structure Setup

#### Step 3.1: Create Directory Structure

```bash
cd web
mkdir -p components/{ui,layout,sections}
mkdir -p lib/{utils,hooks}
mkdir -p types
mkdir -p public/{images,fonts}
```

Final structure:

```
web/
├── app/
│   ├── layout.tsx          # Root layout with fonts
│   ├── page.tsx            # Home page
│   ├── docs/
│   │   └── page.tsx        # Documentation page
│   ├── changelog/
│   │   └── page.tsx        # Changelog page
│   └── globals.css
├── components/
│   ├── ui/                 # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   └── Toast.tsx
│   ├── layout/             # Layout components
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   └── MobileMenu.tsx
│   └── sections/           # Page sections
│       ├── Hero.tsx
│       ├── Features.tsx
│       ├── HowItWorks.tsx
│       └── Benefits.tsx
├── lib/
│   ├── utils/
│   │   ├── cn.ts           # Class name merger
│   │   └── animations.ts   # Animation utilities
│   └── hooks/
│       ├── useScrollSpy.ts
│       └── useIntersectionObserver.ts
├── types/
│   ├── index.ts            # Shared types
│   └── components.ts       # Component prop types
├── public/
│   ├── images/
│   │   └── logo.png
│   └── fonts/              # If self-hosting
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Component Architecture

### Reusable Components Plan

#### 1. UI Components (`components/ui/`)

##### Button Component

**Purpose**: Unified button component with variants
**Props**: `variant`, `size`, `loading`, `disabled`, `children`, `onClick`
**Variants**: primary, secondary, ghost, outline
**File**: `components/ui/Button.tsx`

##### Card Component

**Purpose**: Feature cards with hover effects
**Props**: `title`, `description`, `icon`, `className`
**File**: `components/ui/Card.tsx`

##### Badge Component

**Purpose**: Status badges and tags
**Props**: `children`, `variant`, `size`
**File**: `components/ui/Badge.tsx`

##### Toast Component

**Purpose**: Notification system
**Props**: `message`, `type`, `duration`, `onClose`
**File**: `components/ui/Toast.tsx`

#### 2. Layout Components (`components/layout/`)

##### Navbar Component

**Purpose**: Top navigation with mobile menu
**Features**:

- Sticky positioning
- Blur background on scroll
- Mobile hamburger menu
- Smooth scroll navigation
  **File**: `components/layout/Navbar.tsx`

##### Footer Component

**Purpose**: Site footer with links
**File**: `components/layout/Footer.tsx`

##### MobileMenu Component

**Purpose**: Slide-out mobile navigation
**File**: `components/layout/MobileMenu.tsx`

#### 3. Section Components (`components/sections/`)

##### Hero Section

**Purpose**: Landing page hero
**Features**: Gradient background, CTA buttons
**File**: `components/sections/Hero.tsx`

##### Features Section

**Purpose**: 3-column feature grid
**File**: `components/sections/Features.tsx`

##### HowItWorks Section

**Purpose**: Step-by-step guide
**File**: `components/sections/HowItWorks.tsx`

##### Benefits Section

**Purpose**: 2-column benefits layout
**File**: `components/sections/Benefits.tsx`

#### 4. Utility Functions (`lib/`)

##### Class Name Utility

```typescript
// lib/utils/cn.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

##### Custom Hooks

- `useScrollSpy`: Track active section in viewport
- `useIntersectionObserver`: Trigger animations on scroll
- `useMediaQuery`: Responsive breakpoint detection
- `useMounted`: Prevent hydration mismatches

---

## Migration Steps

### Phase 4: Core Components Development

#### Step 4.1: Create Utility Functions

**File**: `web/lib/utils/cn.ts`

```bash
# Create and implement cn utility (shown above)
```

**File**: `web/lib/hooks/useIntersectionObserver.ts`

```typescript
import { useEffect, useRef, useState } from "react";

interface UseIntersectionObserverProps {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

export function useIntersectionObserver({
  threshold = 0.1,
  rootMargin = "0px",
  triggerOnce = true,
}: UseIntersectionObserverProps = {}) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (triggerOnce && ref.current) {
            observer.unobserve(ref.current);
          }
        }
      },
      { threshold, rootMargin }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [threshold, rootMargin, triggerOnce]);

  return { ref, isVisible };
}
```

**File**: `web/lib/hooks/useScrollSpy.ts`

```typescript
import { useEffect, useState } from "react";

export function useScrollSpy(sectionIds: string[], offset = 100) {
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + offset;

      for (const id of sectionIds) {
        const element = document.getElementById(id);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (
            scrollPosition >= offsetTop &&
            scrollPosition < offsetTop + offsetHeight
          ) {
            setActiveId(id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Initial check

    return () => window.removeEventListener("scroll", handleScroll);
  }, [sectionIds, offset]);

  return activeId;
}
```

#### Step 4.2: Build UI Components

**File**: `web/components/ui/Button.tsx`

```typescript
import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          {
            // Variants
            "bg-primary text-white hover:bg-secondary focus:ring-primary":
              variant === "primary",
            "bg-slack-purple text-white hover:bg-opacity-90 focus:ring-slack-purple":
              variant === "secondary",
            "bg-transparent hover:bg-gray-100 text-gray-700":
              variant === "ghost",
            "border-2 border-primary text-primary hover:bg-primary hover:text-white":
              variant === "outline",

            // Sizes
            "px-4 py-2 text-sm": size === "sm",
            "px-6 py-3 text-base": size === "md",
            "px-8 py-4 text-lg": size === "lg",
          },
          className
        )}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
```

**File**: `web/components/ui/Card.tsx`

```typescript
import { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface CardProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
  hoverable?: boolean;
}

export default function Card({
  title,
  description,
  icon,
  children,
  className,
  hoverable = true,
}: CardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl p-6 shadow-sm border border-gray-200",
        "transition-all duration-300",
        {
          "hover:shadow-xl hover:-translate-y-1 hover:border-primary/20":
            hoverable,
        },
        className
      )}
    >
      {icon && <div className="mb-4 text-primary">{icon}</div>}
      {title && (
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      )}
      {description && (
        <p className="text-gray-600 leading-relaxed">{description}</p>
      )}
      {children}
    </div>
  );
}
```

#### Step 4.3: Create Layout Components

**File**: `web/components/layout/Navbar.tsx`

```typescript
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import MobileMenu from "./MobileMenu";

const navLinks = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/docs", label: "Documentation" },
  { href: "/changelog", label: "Changelog" },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        {
          "bg-white/80 backdrop-blur-md shadow-md": isScrolled,
          "bg-transparent": !isScrolled,
        }
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <Image
              src="/images/logo.png"
              alt="Daily Dose Logo"
              width={40}
              height={40}
              className="w-10 h-10"
            />
            <span className="text-xl font-bold text-gray-900">Daily Dose</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-700 hover:text-primary transition-colors font-medium"
              >
                {link.label}
              </Link>
            ))}
            <a
              href="https://slack.com/oauth/v2/authorize?client_id=YOUR_CLIENT_ID&scope=commands,chat:write&user_scope="
              target="_blank"
              rel="noopener noreferrer"
              className="bg-slack-purple text-white px-6 py-2 rounded-lg hover:bg-opacity-90 transition-all font-medium"
            >
              Add to Slack
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        links={navLinks}
      />
    </nav>
  );
}
```

**File**: `web/components/layout/MobileMenu.tsx`

```typescript
"use client";

import Link from "next/link";
import { cn } from "@/lib/utils/cn";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  links: Array<{ href: string; label: string }>;
}

export default function MobileMenu({
  isOpen,
  onClose,
  links,
}: MobileMenuProps) {
  return (
    <div
      className={cn(
        "md:hidden fixed inset-0 top-16 bg-white z-40 transition-transform duration-300",
        {
          "translate-x-0": isOpen,
          "translate-x-full": !isOpen,
        }
      )}
    >
      <div className="flex flex-col space-y-4 p-6">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={onClose}
            className="text-lg text-gray-700 hover:text-primary transition-colors font-medium py-2"
          >
            {link.label}
          </Link>
        ))}
        <a
          href="https://slack.com/oauth/v2/authorize?client_id=YOUR_CLIENT_ID&scope=commands,chat:write&user_scope="
          target="_blank"
          rel="noopener noreferrer"
          className="bg-slack-purple text-white px-6 py-3 rounded-lg hover:bg-opacity-90 transition-all font-medium text-center"
        >
          Add to Slack
        </a>
      </div>
    </div>
  );
}
```

**File**: `web/components/layout/Footer.tsx`

```typescript
import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Daily Dose</h3>
            <p className="text-gray-400 text-sm">
              Streamline your team's daily standups with automated scheduling
              and seamless Slack integration.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/#features"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  href="/docs"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Documentation
                </Link>
              </li>
              <li>
                <Link
                  href="/changelog"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Changelog
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Support</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://github.com/yourusername/daily-dose-bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="mailto:support@dailydose.app"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Contact Us
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
          <p>&copy; {currentYear} Daily Dose. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
```

#### Step 4.4: Create Section Components

**File**: `web/components/sections/Hero.tsx`

```typescript
"use client";

import Button from "@/components/ui/Button";
import { useIntersectionObserver } from "@/lib/hooks/useIntersectionObserver";
import { cn } from "@/lib/utils/cn";

export default function Hero() {
  const { ref, isVisible } = useIntersectionObserver();

  return (
    <section
      ref={ref}
      className={cn(
        "relative min-h-screen flex items-center justify-center",
        "bg-gradient-to-br from-primary/10 via-secondary/5 to-transparent",
        "transition-opacity duration-1000",
        {
          "opacity-100": isVisible,
          "opacity-0": !isVisible,
        }
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-6 animate-fade-in">
          Streamline Your Team's{" "}
          <span className="text-primary">Daily Standups</span>
        </h1>

        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto animate-slide-in">
          Automate standup meetings, collect updates seamlessly, and keep your
          team synchronized—all within Slack.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-in">
          <Button variant="primary" size="lg">
            Add to Slack
          </Button>
          <Button variant="outline" size="lg">
            View Documentation
          </Button>
        </div>
      </div>
    </section>
  );
}
```

**File**: `web/components/sections/Features.tsx`

```typescript
"use client";

import Card from "@/components/ui/Card";
import { useIntersectionObserver } from "@/lib/hooks/useIntersectionObserver";

const features = [
  {
    title: "Automated Reminders",
    description:
      "Schedule standup reminders at your team's preferred time, automatically sent via DM.",
    icon: (
      <svg
        className="w-12 h-12"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
    ),
  },
  {
    title: "Easy Submission",
    description:
      "Team members submit standups via interactive modals—quick, simple, and intuitive.",
    icon: (
      <svg
        className="w-12 h-12"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    title: "Auto-Posted Summaries",
    description:
      "Standup summaries are automatically posted to your team channel at the configured time.",
    icon: (
      <svg
        className="w-12 h-12"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    title: "Multi-Team Support",
    description:
      "Manage multiple teams with different schedules and configurations in one workspace.",
    icon: (
      <svg
        className="w-12 h-12"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
  },
  {
    title: "Leave Management",
    description:
      "Track team member leave and work days to avoid unnecessary reminders.",
    icon: (
      <svg
        className="w-12 h-12"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
        />
      </svg>
    ),
  },
  {
    title: "Flexible Scheduling",
    description:
      "Configure reminder times, posting times, and work days per team.",
    icon: (
      <svg
        className="w-12 h-12"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
];

export default function Features() {
  const { ref, isVisible } = useIntersectionObserver();

  return (
    <section id="features" ref={ref} className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Powerful Features
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Everything you need to run efficient daily standups
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`transition-all duration-500 delay-${index * 100}`}
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateY(0)" : "translateY(20px)",
              }}
            >
              <Card
                title={feature.title}
                description={feature.description}
                icon={feature.icon}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

**File**: `web/components/sections/HowItWorks.tsx`

```typescript
"use client";

import { useIntersectionObserver } from "@/lib/hooks/useIntersectionObserver";

const steps = [
  {
    number: "01",
    title: "Add to Slack",
    description: "Install Daily Dose to your Slack workspace with one click.",
  },
  {
    number: "02",
    title: "Create Team",
    description: "Set up your team in a channel and configure standup times.",
  },
  {
    number: "03",
    title: "Get Reminders",
    description:
      "Team members receive automated DM reminders at the scheduled time.",
  },
  {
    number: "04",
    title: "Submit Updates",
    description:
      "Fill out the standup form with yesterday's tasks, today's plan, and blockers.",
  },
  {
    number: "05",
    title: "Auto-Post",
    description:
      "Summary is automatically posted to the team channel for everyone to see.",
  },
];

export default function HowItWorks() {
  const { ref, isVisible } = useIntersectionObserver();

  return (
    <section id="how-it-works" ref={ref} className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            How It Works
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Get started in minutes with our simple 5-step process
          </p>
        </div>

        <div className="space-y-12">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className={`flex flex-col md:flex-row items-center gap-8 transition-all duration-500 delay-${
                index * 100
              }`}
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible
                  ? "translateX(0)"
                  : `translateX(${index % 2 === 0 ? "-20px" : "20px"})`,
              }}
            >
              <div className="flex-shrink-0">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  {step.number}
                </div>
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-gray-600 text-lg">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

**File**: `web/components/sections/Benefits.tsx`

```typescript
"use client";

import { useIntersectionObserver } from "@/lib/hooks/useIntersectionObserver";

const benefits = [
  {
    title: "Save Time",
    description:
      "Eliminate manual coordination. Standups happen automatically at your chosen time.",
  },
  {
    title: "Increase Transparency",
    description:
      "Everyone sees what teammates are working on, fostering collaboration and alignment.",
  },
  {
    title: "Stay Organized",
    description:
      "All standup data is tracked and organized by date, making it easy to review progress.",
  },
  {
    title: "Flexible & Configurable",
    description:
      "Customize reminder times, posting schedules, and work days to fit your team's workflow.",
  },
];

export default function Benefits() {
  const { ref, isVisible } = useIntersectionObserver();

  return (
    <section id="benefits" ref={ref} className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Why Teams Love Daily Dose
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Built to make your team more productive and synchronized
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {benefits.map((benefit, index) => (
            <div
              key={benefit.title}
              className={`p-8 border-l-4 border-primary bg-gray-50 transition-all duration-500 delay-${
                index * 100
              }`}
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateY(0)" : "translateY(20px)",
              }}
            >
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                {benefit.title}
              </h3>
              <p className="text-gray-600 text-lg">{benefit.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

#### Step 4.5: Create Root Layout

**File**: `web/app/layout.tsx`

```typescript
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Daily Dose - Streamline Your Team Standups",
  description:
    "Automate standup meetings, collect updates seamlessly, and keep your team synchronized—all within Slack.",
  keywords: [
    "slack",
    "standup",
    "daily standup",
    "team management",
    "productivity",
  ],
  authors: [{ name: "Daily Dose Team" }],
  openGraph: {
    title: "Daily Dose - Streamline Your Team Standups",
    description:
      "Automate standup meetings, collect updates seamlessly, and keep your team synchronized—all within Slack.",
    type: "website",
    locale: "en_US",
    siteName: "Daily Dose",
  },
  twitter: {
    card: "summary_large_image",
    title: "Daily Dose - Streamline Your Team Standups",
    description:
      "Automate standup meetings, collect updates seamlessly, and keep your team synchronized—all within Slack.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

#### Step 4.6: Create Home Page

**File**: `web/app/page.tsx`

```typescript
import Hero from "@/components/sections/Hero";
import Features from "@/components/sections/Features";
import HowItWorks from "@/components/sections/HowItWorks";
import Benefits from "@/components/sections/Benefits";

export default function Home() {
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      <Benefits />
    </>
  );
}
```

#### Step 4.7: Create Documentation Page

**File**: `web/app/docs/page.tsx`

```typescript
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation - Daily Dose",
  description: "Complete documentation for Daily Dose Slack bot",
};

export default function DocsPage() {
  return (
    <div className="min-h-screen pt-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Documentation</h1>
        <div className="bg-white rounded-xl shadow-sm p-8">
          <p className="text-gray-600 mb-4">
            Documentation content will be migrated from the existing docs.html
            file.
          </p>
          <p className="text-gray-500 text-sm">
            This page structure will follow the same design as the current
            documentation page with sidebar navigation, search functionality,
            and syntax highlighting.
          </p>
        </div>
      </div>
    </div>
  );
}
```

#### Step 4.8: Create Changelog Page

**File**: `web/app/changelog/page.tsx`

```typescript
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Changelog - Daily Dose",
  description: "Latest updates and release notes for Daily Dose",
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen pt-20 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Changelog</h1>
        <div className="space-y-8">
          <div className="bg-white rounded-xl shadow-sm p-8">
            <p className="text-gray-600 mb-4">
              Changelog content will be migrated from the existing
              changelog.html file.
            </p>
            <p className="text-gray-500 text-sm">
              Version history with dates, features, improvements, and bug fixes
              will be displayed here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

#### Step 4.9: Copy Assets

```bash
# From project root
cp public/logo.png web/public/images/logo.png
```

---

## Phase 5: Content Migration

### Step 5.1: Extract Content from HTML Files

Create a temporary script to extract content:

**File**: `web/scripts/extract-content.js`

```javascript
const fs = require("fs");
const path = require("path");

// Read HTML files
const indexHtml = fs.readFileSync(
  path.join(__dirname, "../../public/index.html"),
  "utf-8"
);
const docsHtml = fs.readFileSync(
  path.join(__dirname, "../../public/docs.html"),
  "utf-8"
);
const changelogHtml = fs.readFileSync(
  path.join(__dirname, "../../public/changelog.html"),
  "utf-8"
);

// Extract content using regex or manual extraction
// This is a helper script - content should be manually reviewed and migrated

console.log("Content extraction complete. Review and migrate manually.");
```

### Step 5.2: Migrate Documentation Content

1. Parse existing `docs.html`
2. Convert HTML structure to MDX or React components
3. Preserve code examples with syntax highlighting
4. Implement search functionality using Fuse.js or Algolia

### Step 5.3: Migrate Changelog Content

1. Parse existing `changelog.html`
2. Structure version data in JSON or TypeScript
3. Create version card components
4. Maintain chronological ordering

---

## Phase 6: Advanced Features

### Step 6.1: Add Search to Documentation

**Install Dependencies**:

```bash
npm install fuse.js
```

**File**: `web/lib/hooks/useSearch.ts`

```typescript
import { useState, useMemo } from "react";
import Fuse from "fuse.js";

interface SearchItem {
  id: string;
  title: string;
  content: string;
  url: string;
}

export function useSearch(items: SearchItem[]) {
  const [query, setQuery] = useState("");

  const fuse = useMemo(
    () =>
      new Fuse(items, {
        keys: ["title", "content"],
        threshold: 0.3,
        includeScore: true,
      }),
    [items]
  );

  const results = useMemo(() => {
    if (!query) return [];
    return fuse.search(query).map((result) => result.item);
  }, [query, fuse]);

  return { query, setQuery, results };
}
```

### Step 6.2: Add Copy-to-Clipboard for Code Blocks

**File**: `web/components/ui/CodeBlock.tsx`

```typescript
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

interface CodeBlockProps {
  code: string;
  language?: string;
}

export default function CodeBlock({ code, language = "bash" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre
        className={cn(
          "bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto",
          "font-mono text-sm"
        )}
      >
        <code className={`language-${language}`}>{code}</code>
      </pre>
      <button
        onClick={copyToClipboard}
        className={cn(
          "absolute top-2 right-2 px-3 py-1 rounded-md text-sm",
          "opacity-0 group-hover:opacity-100 transition-opacity",
          "bg-gray-700 hover:bg-gray-600 text-white"
        )}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
```

### Step 6.3: Add Analytics (Optional)

**Install Vercel Analytics** (if deploying to Vercel):

```bash
npm install @vercel/analytics
```

**Update** `web/app/layout.tsx`:

```typescript
import { Analytics } from "@vercel/analytics/react";

// Add to body
<Analytics />;
```

---

## Phase 7: Server Configuration

### Step 7.1: Create Next.js Server Script

**File**: `web/server.js`

```javascript
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = process.env.WEB_PORT || 3001;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  })
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Web app ready on http://${hostname}:${port}`);
    });
});
```

### Step 7.2: Update PM2 Configuration

**File**: `ecosystem.config.js` (root level)

```javascript
module.exports = {
  apps: [
    {
      name: "daily-dose-bot",
      script: "src/app.js",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "1G",
      error_file: "./logs/bot-err.log",
      out_file: "./logs/bot-out.log",
      log_file: "./logs/bot-combined.log",
      time: true,
      autorestart: true,
      watch: false,
      ignore_watch: ["node_modules", "logs", "temp"],
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "daily-dose-web",
      script: "web/server.js",
      cwd: "./web",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      error_file: "./logs/web-err.log",
      out_file: "./logs/web-out.log",
      log_file: "./logs/web-combined.log",
      time: true,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        WEB_PORT: 3001,
      },
    },
  ],
};
```

### Step 7.3: Update Environment Variables

**File**: `.env` (add to root)

```bash
# Web App Configuration
WEB_PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Step 7.4: Update Root package.json Scripts

**File**: `package.json` (root level)

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:bot\" \"npm run dev:web\"",
    "dev:bot": "nodemon src/app.js --ignore logs/ --ignore temp/",
    "dev:web": "cd web && npm run dev",
    "build:web": "cd web && npm run build",
    "start": "node src/app.js",
    "start:web": "cd web && npm run start",
    "start:all": "pm2 start ecosystem.config.js",
    "stop:all": "pm2 stop ecosystem.config.js",
    "restart:all": "pm2 restart ecosystem.config.js"
  }
}
```

**Install concurrently**:

```bash
npm install -D concurrently
```

---

## Testing & Validation

### Step 8.1: Development Testing Checklist

- [ ] All pages load without errors
- [ ] Navigation works (desktop & mobile)
- [ ] Mobile menu toggles correctly
- [ ] All animations trigger on scroll
- [ ] Buttons have proper hover/active states
- [ ] Links navigate correctly
- [ ] Images load properly
- [ ] Fonts render correctly
- [ ] Responsive design works on all breakpoints
- [ ] No console errors or warnings

### Step 8.2: Build & Production Testing

```bash
cd web
npm run build
npm run start
```

Verify:

- [ ] Production build completes successfully
- [ ] Static pages render correctly
- [ ] No hydration errors
- [ ] Performance metrics are good (Lighthouse)
- [ ] SEO metadata is present
- [ ] Images are optimized

### Step 8.3: Accessibility Testing

- [ ] Keyboard navigation works
- [ ] Screen reader friendly
- [ ] Proper heading hierarchy
- [ ] Alt text on images
- [ ] ARIA labels where needed
- [ ] Color contrast meets WCAG standards
- [ ] Reduced motion preferences respected

---

## Deployment

### Step 9.1: Build for Production

```bash
cd web
npm run build
```

### Step 9.2: Deploy with PM2

```bash
# From project root
npm run build:web
npm run start:all
```

### Step 9.3: Verify Both Servers Running

```bash
pm2 status
pm2 logs daily-dose-web
```

### Step 9.4: Configure Reverse Proxy (Optional)

If using Nginx to serve both on same domain:

**File**: `/etc/nginx/sites-available/dailydose`

```nginx
server {
    listen 80;
    server_name dailydose.app www.dailydose.app;

    # Web app (Next.js)
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Bot API endpoints
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $http_host;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000/health;
    }
}
```

---

## Troubleshooting

### Common Issues

**Issue**: Hydration errors
**Solution**: Ensure no server/client mismatches, use `'use client'` for interactive components

**Issue**: Fonts not loading
**Solution**: Verify Next.js font imports, check variable CSS is applied

**Issue**: Images not found
**Solution**: Check `public/images/` path, use Next.js Image component

**Issue**: Styles not applying
**Solution**: Verify Tailwind config, check PostCSS setup, rebuild

**Issue**: Build fails
**Solution**: Check TypeScript errors with `npm run type-check`

**Issue**: Port already in use
**Solution**: Change `WEB_PORT` in `.env`, kill existing process on port 3001

---

## Post-Migration Tasks

### Step 10.1: Update Documentation

- [ ] Update README.md with web app instructions
- [ ] Document new development workflow
- [ ] Update deployment guide
- [ ] Add troubleshooting section

### Step 10.2: Cleanup

- [ ] Archive old HTML files (move to `public/legacy/`)
- [ ] Remove unused CSS/JS files
- [ ] Update .gitignore for Next.js
- [ ] Clean up dependencies

### Step 10.3: Performance Optimization

- [ ] Run Lighthouse audit
- [ ] Optimize images with next/image
- [ ] Add meta tags for SEO
- [ ] Configure caching headers
- [ ] Set up CDN (if needed)

---

## Migration Checklist Summary

### Setup Phase

- [ ] Create Next.js app in `web/` directory
- [ ] Configure Tailwind CSS with custom theme
- [ ] Set up TypeScript configuration
- [ ] Install required dependencies

### Component Development

- [ ] Create utility functions (cn, hooks)
- [ ] Build UI components (Button, Card, Toast)
- [ ] Create layout components (Navbar, Footer, MobileMenu)
- [ ] Develop section components (Hero, Features, etc.)

### Page Migration

- [ ] Migrate home page content
- [ ] Migrate documentation page
- [ ] Migrate changelog page
- [ ] Copy and optimize assets

### Server & Deployment

- [ ] Configure separate server setup
- [ ] Update PM2 configuration
- [ ] Set up environment variables
- [ ] Test both servers running together

### Testing & Validation

- [ ] Test all pages and navigation
- [ ] Verify responsive design
- [ ] Check accessibility
- [ ] Build and test production version

### Documentation & Cleanup

- [ ] Update README
- [ ] Archive legacy files
- [ ] Clean up unused code
- [ ] Document new architecture

---

## Next Steps After Migration

1. **Monitor Performance**: Use analytics to track page load times
2. **Gather Feedback**: Test with real users
3. **Iterate**: Add new features based on React capabilities
4. **Optimize**: Continuous performance improvements
5. **Scale**: Prepare for increased traffic with caching strategies

---

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [React Best Practices](https://react.dev/learn)
- [Web Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Migration Estimated Timeline**: 2-3 days for full migration with testing

**Complexity Level**: Intermediate

**Prerequisites Knowledge**: React, TypeScript, Tailwind CSS, Next.js basics

---

_Generated with Claude Code - Last Updated: 2025-11-02_
