# Daily Dose Web - React Router v7 Migration

This is the modern React-based web application for Daily Dose landing pages, migrated from static HTML to React Router v7 with TypeScript and Tailwind CSS.

## 📋 Project Overview

The web application provides:
- **Landing Page** (/) - Main product page with features and benefits
- **User Guide Documentation** (/documentation/user-guide) - Complete setup and usage guide
- **Scripts Documentation** (/documentation/scripts) - Admin tools and automation scripts
- **Changelog** (/changelog) - Version history and release notes

## 🛠 Tech Stack

- **Framework**: React 19 with React Router v7
- **Language**: TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS v4
- **Icons**: Font Awesome (Solid & Brands)
- **Syntax Highlighting**: React Syntax Highlighter (planned)

## 📂 Project Structure

```
/web
├── /src
│   ├── /components
│   │   ├── /layout          # Header, Footer, Navigation
│   │   ├── /ui              # Reusable UI components (planned)
│   │   └── /features        # Feature-specific components (planned)
│   ├── /pages
│   │   ├── Home.tsx         # Landing page
│   │   ├── Documentation/
│   │   │   ├── UserGuide.tsx    # User documentation
│   │   │   └── Scripts.tsx      # Scripts documentation
│   │   └── Changelog.tsx    # Version history
│   ├── /data                # JSON content files (planned)
│   ├── /hooks               # Custom React hooks (planned)
│   ├── /utils               # Helper functions (planned)
│   ├── /types               # TypeScript type definitions (planned)
│   ├── App.tsx              # Main app component with routing
│   ├── main.tsx             # Application entry point
│   └── index.css            # Global styles and Tailwind imports
├── /public
│   └── logo.png             # Daily Dose logo
├── /dist                    # Build output (generated)
├── package.json             # Dependencies and scripts
├── vite.config.ts           # Vite configuration
├── tailwind.config.ts       # Tailwind CSS configuration
├── tsconfig.json            # TypeScript configuration
└── README.md                # This file
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20.19+ (or 22.12+) with npm (required for Vite 7.2+)
- Git

### Installation

1. **Navigate to web directory**:
   ```bash
   cd web
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:5173`

### Available Scripts

- `npm run dev` - Start Vite development server with HMR
- `npm run build` - Build for production (TypeScript compile + Vite build)
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint

## 🎨 Design System

### Colors

```typescript
colors: {
  'primary': '#00CFFF',        // Cyan
  'secondary': '#00AFFF',      // Blue
  'slack-purple': '#4A154B',
  'slack-green': '#007A5A',
  'slack-blue': '#1264A3',
}
```

### Typography

- **Primary Font**: Inter (Google Fonts)
- **Code Font**: JetBrains Mono (Google Fonts)

### Responsive Breakpoints

- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

## 📦 Build & Deployment

### Production Build

```bash
npm run build
```

This generates optimized static files in `/dist` directory:
- Minified JavaScript and CSS
- Optimized assets
- Source maps for debugging

### Deployment Options

#### Static Hosting (Vercel, Netlify, etc.)

1. Build the project:
   ```bash
   npm run build
   ```

2. Deploy the `dist` folder to your hosting provider

3. Configure routing:
   - Most static hosts support client-side routing
   - Ensure all routes redirect to `index.html`

#### Example: Vercel

Create `vercel.json` in web directory:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

#### Example: Netlify

Create `_redirects` in `public` directory:
```
/*    /index.html   200
```

### Environment Variables

Currently no environment variables needed. For future API integrations, create `.env` files:

```bash
# .env.local (development)
VITE_API_URL=http://localhost:3000

# .env.production
VITE_API_URL=https://api.dailydose.bot
```

Access in code:
```typescript
const apiUrl = import.meta.env.VITE_API_URL
```

## 🔧 Development Guidelines

### Component Structure

- Use functional components with TypeScript
- Prefer named exports for components
- Keep components focused and single-responsibility
- Use custom hooks for shared logic

### Code Style

- TypeScript strict mode enabled
- ESLint configuration included
- Consistent component patterns
- Proper prop typing with TypeScript interfaces

### Adding New Pages

1. Create component in `/src/pages`:
   ```typescript
   // src/pages/NewPage.tsx
   export function NewPage() {
     return <div>New Page Content</div>
   }
   ```

2. Add route in `App.tsx`:
   ```typescript
   <Route path="/new-page" element={<NewPage />} />
   ```

3. Update navigation in `Header.tsx` if needed

### Styling Guidelines

- Use Tailwind CSS utility classes
- Custom styles in `index.css` for animations and global styles
- Avoid inline styles unless dynamic
- Use semantic HTML elements

## 🎯 Migration Status

### ✅ Completed

- [x] Project setup with Vite + React + TypeScript
- [x] React Router v7 configuration
- [x] Tailwind CSS v4 setup
- [x] Layout components (Header, Footer)
- [x] Home page migration (index.html → Home.tsx)
- [x] User Guide page (docs.html → UserGuide.tsx)
- [x] Scripts Documentation page (scripts-docs.html → Scripts.tsx)
- [x] Changelog page (changelog.html → Changelog.tsx)
- [x] Production build configuration
- [x] Responsive design preservation

### 🚧 Pending/Future Enhancements

- [ ] JSON-based content management system
- [ ] Search functionality with content indexing
- [ ] Syntax highlighting for code blocks (react-syntax-highlighter)
- [ ] Copy-to-clipboard functionality
- [ ] Scroll animations and interactions
- [ ] SEO optimization (react-helmet-async)
- [ ] Static Site Generation (SSG) configuration
- [ ] Performance optimization
- [ ] Accessibility audit and improvements
- [ ] Automated testing setup

## 📝 Content Management

### Future: JSON-Based Content

The plan is to move documentation content to JSON files for easier maintenance:

```
/src/data/
├── docs.json          # User guide content
├── scripts.json       # Scripts documentation
└── changelog.json     # Version history
```

This will enable:
- Non-technical content updates
- Better search indexing
- Version control for content
- Easy localization support

## 🐛 Troubleshooting

### Common Issues

**Build fails with PostCSS errors**:
- Ensure `@tailwindcss/postcss` is installed
- Check `postcss.config.js` configuration

**Module not found errors**:
```bash
npm install
```

**TypeScript errors**:
```bash
npm run build
```

**Port 5173 already in use**:
```bash
# Kill process using the port
npx kill-port 5173
# Or use different port
npm run dev -- --port 3000
```

## 📚 Resources

- [React Router v7 Documentation](https://reactrouter.com/)
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS v4 Documentation](https://tailwindcss.com/)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [Font Awesome React](https://fontawesome.com/docs/web/use-with/react)

## 🤝 Contributing

This is part of the Daily Dose project. For contribution guidelines, see the main project README.

## 📄 License

See main project license.

---

**Built with ❤️ for productive teams**
