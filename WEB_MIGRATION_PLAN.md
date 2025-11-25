# Detailed Migration Prompt: HTML Landing Pages to React Router v7

## Project Overview
Migrate the existing HTML-based landing pages (index.html, docs.html, scripts-docs.html, changelog.html) from the `/public` directory to a modern React Router v7 application with Static Site Generation (SSG).

## Technical Stack Requirements

### Core Framework
- **React Router v7** with Static Site Generation (SSG)
- **TypeScript** for type safety
- **Vite** as the build tool
- **Tailwind CSS** for styling (preserve existing design system)

### Project Structure
- **Location**: Create new `/web` directory as a standalone project
- **Package Management**: Separate `package.json` (not integrated with main app)
- **Build Output**: Static files ready for deployment

## Routing Structure

```
/ (Home - Landing Page)
├── /documentation
│   ├── /user-guide (docs.html content)
│   └── /scripts (scripts-docs.html content)
└── /changelog (changelog.html content)
```

## Content Management

### JSON-Based Content System
- **Documentation Content**: Manage user guide and scripts documentation via JSON files
- **Changelog Content**: Manage version history via JSON file
- **Location**: Store JSON files in `/web/src/data/` or `/web/content/`
- **Structure**: Design JSON schemas that support:
  - Sections, subsections, and content blocks
  - Code examples with syntax highlighting
  - Categorization and metadata
  - Search indexing support
  - Version information for changelog

### Example JSON Structure (to be designed):
```json
// docs.json
{
  "sections": [
    {
      "id": "getting-started",
      "title": "Getting Started",
      "content": [...],
      "subsections": [...]
    }
  ]
}

// changelog.json
{
  "versions": [
    {
      "version": "1.3.0",
      "date": "2025-01-15",
      "type": "latest",
      "changes": {
        "added": [...],
        "changed": [...],
        "fixed": [...]
      }
    }
  ]
}
```

## Design System Preservation

### Colors (from existing CSS)
- Primary: `#00CFFF` (Cyan)
- Secondary: `#00AFFF` (Blue)
- Slack Purple: `#4A154B`
- Slack Green: `#007A5A`
- Slack Blue: `#1264A3`

### Typography
- Primary Font: Inter (Google Fonts)
- Code Font: JetBrains Mono
- Icon Library: Font Awesome 6.4.0

### Custom Styles
- Migrate `/public/css/style.css` custom styles to:
  - Tailwind config for theme extension
  - CSS modules for component-specific styles
  - Global CSS for animations and utilities

## Feature Implementation (React-Specific)

### Must Re-implement Using React Libraries/Hooks:

1. **Navigation & Routing**
   - Mobile menu toggle → React state + React Router navigation
   - Smooth scrolling → React Router scroll restoration + custom hooks
   - Active nav tracking → useLocation hook

2. **Documentation Features**
   - Search functionality → Custom React hook + JSON content indexing
   - Sidebar navigation → Component with useLocation for active states
   - Code syntax highlighting → react-syntax-highlighter or Prism React
   - Copy to clipboard → react-copy-to-clipboard or custom hook

3. **Interactions**
   - Scroll animations → Intersection Observer API via custom hook or framer-motion
   - Mobile sidebar toggle → React state management
   - Scroll-to-top button → Custom hook with scroll event listener
   - Keyboard shortcuts → useEffect with keyboard event listeners

4. **UI Components**
   - Notification system → Toast library (react-hot-toast, sonner) or custom
   - Loading states → React state management
   - Modal/overlay → Headless UI or custom React component

## Asset Migration

### Static Assets
- `/public/logo.png` → `/web/public/logo.png`
- Preserve all image references and paths
- Update meta tags for SEO (favicon, OG images)

### External Dependencies (CDN → npm packages)
- Tailwind CSS → `tailwindcss` (PostCSS setup)
- Font Awesome → `@fortawesome/react-fontawesome` + icon packages
- Google Fonts → `@fontsource/inter`, `@fontsource/jetbrains-mono` or CDN
- Prism.js → `react-syntax-highlighter` or `prismjs` with React wrapper

## Responsive Design Requirements

### Breakpoints (preserve existing)
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

### Features to Maintain
- Mobile-first approach
- Touch-friendly interactions
- Responsive navigation
- Flexible grid systems
- All existing responsive layouts

## Accessibility Requirements

- Semantic HTML structure
- ARIA labels and roles
- Keyboard navigation support
- Focus indicators
- Screen reader compatibility
- Reduced motion preferences support
- High contrast mode support

## SEO & Meta Tags

Each route should include:
- Dynamic page titles
- Meta descriptions
- Open Graph tags
- Twitter Card metadata
- Canonical URLs
- Structured data where applicable

## Development Guidelines

### Component Organization
```
/web
├── /src
│   ├── /components
│   │   ├── /layout (Header, Footer, Navigation)
│   │   ├── /ui (Buttons, Cards, etc.)
│   │   └── /features (SearchBar, CodeBlock, etc.)
│   ├── /pages
│   │   ├── Home.tsx
│   │   ├── Documentation/
│   │   │   ├── UserGuide.tsx
│   │   │   └── Scripts.tsx
│   │   └── Changelog.tsx
│   ├── /data (JSON content files)
│   ├── /hooks (Custom React hooks)
│   ├── /utils (Helper functions)
│   ├── /styles (Global CSS, Tailwind config)
│   └── /types (TypeScript definitions)
├── /public (Static assets)
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

### Code Quality
- TypeScript strict mode enabled
- Consistent component patterns (functional components + hooks)
- Proper prop typing with TypeScript interfaces
- Reusable components for repeated UI patterns
- Custom hooks for shared logic

## Build & Deployment

### SSG Configuration
- Pre-render all routes at build time
- Generate static HTML, CSS, and JS files
- Optimize for fast loading and SEO
- Support for client-side hydration if needed

### Build Output
- Production-ready static files in `/web/dist`
- Minified and optimized assets
- Source maps for debugging

## Migration Phases

### Phase 1: Project Setup
1. Create `/web` directory structure
2. Initialize React Router v7 + Vite + TypeScript project
3. Configure Tailwind CSS
4. Set up ESLint, Prettier, TypeScript config

### Phase 2: Design System & Layout
1. Create Tailwind theme configuration (colors, fonts, breakpoints)
2. Build shared layout components (Header, Footer, Navigation)
3. Implement responsive mobile menu
4. Set up global styles and animations

### Phase 3: JSON Content Schema & Data
1. Design JSON schemas for docs and changelog
2. Convert existing HTML content to JSON format
3. Create TypeScript types for content structure
4. Implement content loading utilities

### Phase 4: Page Implementation
1. Home page (index.html → Home.tsx)
2. User Guide (docs.html → UserGuide.tsx)
3. Scripts Documentation (scripts-docs.html → Scripts.tsx)
4. Changelog (changelog.html → Changelog.tsx)

### Phase 5: Feature Implementation
1. Search functionality with JSON content indexing
2. Syntax highlighting for code blocks
3. Copy to clipboard
4. Scroll animations and interactions
5. Keyboard shortcuts

### Phase 6: Testing & Optimization
1. Cross-browser testing
2. Responsive design validation
3. Accessibility audit
4. Performance optimization
5. SEO validation

### Phase 7: Build & Documentation
1. SSG build configuration
2. Production build testing
3. README for web project
4. Deployment instructions

## Success Criteria

- [ ] All 4 HTML pages successfully migrated to React Router v7
- [ ] Nested routing structure working (`/`, `/documentation/user-guide`, `/documentation/scripts`, `/changelog`)
- [ ] JSON-based content management for docs and changelog
- [ ] All existing features re-implemented with React hooks/libraries
- [ ] Tailwind CSS design system preserved exactly
- [ ] Fully responsive on mobile, tablet, desktop
- [ ] All accessibility features maintained
- [ ] Search, syntax highlighting, copy-to-clipboard working
- [ ] SSG build produces optimized static files
- [ ] TypeScript with no errors
- [ ] SEO meta tags properly implemented
- [ ] Fast page load times (<2s on 3G)

## Additional Notes

- Do NOT modify the existing `/public` directory during migration
- Keep the web project completely separate from the main Node.js app
- Maintain all existing branding, colors, and visual design
- Ensure the JSON content structure is easily editable by non-developers
- Document the JSON schema clearly for future content updates

---

**Ready to proceed with migration when approved.**
