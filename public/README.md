# Public Directory - Daily Dose Landing Pages

This directory contains all the public-facing web pages and assets for the Daily Dose Slack bot website. These pages serve as the marketing site, documentation, and admin tools interface.

## 📁 Directory Structure

```
public/
├── index.html              # Main landing page (homepage)
├── docs.html               # User documentation page
├── scripts-docs.html       # Admin scripts documentation
├── changelog.html          # Version history and release notes
├── logo.png               # Daily Dose logo (used across all pages)
├── css/
│   └── style.css          # Custom styles and animations
└── js/
    ├── main.js            # Landing page JavaScript
    └── docs.js            # Documentation page JavaScript
```

## 📄 File Descriptions

### HTML Pages

#### `index.html` - Main Landing Page
- **Purpose**: Marketing homepage for Daily Dose
- **Features**:
  - Hero section with product introduction
  - Features showcase (6 key features)
  - "How It Works" section with 3-step process
  - Benefits section highlighting team productivity gains
  - Contact/CTA section for getting started
  - Responsive design with mobile menu
- **Technologies**: Tailwind CSS, Font Awesome icons, Google Fonts (Inter)
- **Navigation**: Links to docs, changelog, and home sections

#### `docs.html` - User Documentation
- **Purpose**: Comprehensive guide for using Daily Dose
- **Sections**:
  - Getting Started
  - Slash Commands (Team Management, Standup, Leave Management, Admin Commands)
  - Features & Workflows
  - Configuration & Settings
  - Troubleshooting
- **Technologies**: Tailwind CSS, Prism.js for syntax highlighting
- **Features**:
  - Sidebar navigation
  - Search functionality
  - Code block copy buttons
  - Mobile-responsive layout
  - Scroll-to-top button
- **Size**: Large file (37,000+ tokens) - comprehensive documentation

#### `scripts-docs.html` - Admin Scripts Documentation
- **Purpose**: Technical documentation for administrative scripts
- **Sections**:
  - Overview
  - Prerequisites
  - Database Scripts (seedOrg.js)
  - Team Management (check-team-members.js, promoteTeamMember.js)
  - Standup Automation (triggerStandup.js, sendManualStandup.js)
  - Debugging & Info (debugScheduler.js, viewSlackTeamInfo.js)
  - Slack Configuration (updateSlackManifest.js)
- **Technologies**: Tailwind CSS, JetBrains Mono font for code
- **Features**:
  - Fixed sidebar with admin badge
  - Code block examples with copy functionality
  - Mobile menu with overlay
  - Color-coded sections
  - Admin-only access indicator

#### `changelog.html` - Version History
- **Purpose**: Track all updates, features, and bug fixes
- **Sections**:
  - Version releases (v1.3.0 - current, v1.2.0, v1.1.0, v1.0.2, v1.0.0)
  - Change categories (Added, Changed, Fixed, Security, Deprecated, Removed)
  - Release dates and version badges
- **Technologies**: Tailwind CSS, Font Awesome
- **Features**:
  - Semantic versioning display
  - Badge system for release types
  - GitHub release links
  - Glow effect for latest version
  - Mobile-responsive cards

### Assets

#### `logo.png`
- **Purpose**: Brand identity across all pages
- **Usage**: Navigation bars, favicons, social media meta tags
- **Locations**: All HTML pages reference this logo

### Stylesheets

#### `css/style.css`
- **Purpose**: Custom styles complementing Tailwind CSS
- **Features**:
  - CSS variables for brand colors (primary, secondary, Slack colors)
  - Smooth page loading animations (fadeIn, slideIn, bounce, pulse)
  - Custom button styles (btn-primary, btn-secondary)
  - Feature card hover effects
  - Notification system styles
  - Custom scrollbar styling
  - Accessibility features (focus-visible, high contrast mode)
  - Reduced motion support
  - Mobile-responsive utilities
  - Print styles
- **Size**: 288 lines of well-organized CSS

### JavaScript

#### `js/main.js`
- **Purpose**: Interactivity for landing page (index.html)
- **Features**:
  - Mobile menu toggle with icon animation
  - Smooth scrolling for navigation links
  - Intersection Observer for scroll animations
  - Navbar background blur on scroll
  - Button loading states
  - Feature card hover effects
  - Notification system
  - Copy to clipboard functionality
  - Page loading progress indicator
  - Global scroll functions (scrollToContact, scrollToFeatures)
- **Size**: 283 lines

#### `js/docs.js`
- **Purpose**: Enhanced documentation page functionality
- **Features**:
  - Mobile sidebar toggle
  - Real-time search functionality with highlighting
  - Smooth scrolling navigation
  - Active navigation item tracking based on scroll
  - Copy to clipboard for code blocks
  - Keyboard shortcuts (Ctrl+F for search, Escape to close sidebar)
  - Auto-expand sections based on URL hash
  - Scroll-to-top button
  - Code block hover interactions
  - Notification system
- **Size**: 410 lines

## 🎨 Design System

### Color Palette
- **Primary**: `#00CFFF` (Cyan) - Main brand color
- **Secondary**: `#00AFFF` (Blue) - Accent color
- **Slack Purple**: `#4A154B` - Integration branding
- **Slack Green**: `#007A5A` - Success states
- **Slack Blue**: `#1264A3` - Information states

### Typography
- **Primary Font**: Inter (Google Fonts) - Headings and body text
- **Code Font**: JetBrains Mono - Code blocks and technical content
- **Icon Library**: Font Awesome 6.4.0

### Frameworks & Libraries
- **CSS Framework**: Tailwind CSS (CDN)
- **Syntax Highlighting**: Prism.js (scripts-docs.html)
- **Icons**: Font Awesome 6.4.0
- **Fonts**: Google Fonts (Inter, JetBrains Mono)

## 🚀 Features by Page

### Landing Page (index.html)
- Responsive hero section with gradient backgrounds
- 6 feature cards with icons and descriptions
- 3-step "How It Works" process
- Benefits section with statistics
- Team use cases showcase
- Email and demo request CTAs
- Footer with navigation links

### Documentation (docs.html)
- Searchable content with result highlighting
- Categorized command reference
- Code examples with syntax highlighting
- Copy-to-clipboard functionality
- Mobile-friendly sidebar
- Command usage patterns
- Troubleshooting guides
- Best practices section

### Scripts Documentation (scripts-docs.html)
- Admin-only badge and warnings
- Script categories (Database, Team, Automation, Config)
- Usage examples with npm scripts
- Parameter tables
- Prerequisites checklist
- Security warnings
- Detailed output descriptions

### Changelog (changelog.html)
- Semantic versioning timeline
- Categorized changes with badges
- Latest release highlighting
- GitHub integration links
- Release date tracking
- Change type legend

## 📱 Responsive Design

All pages are fully responsive with:
- Mobile menu implementations
- Tablet and desktop layouts
- Touch-friendly interactions
- Optimized font sizes per breakpoint
- Flexible grid systems
- Mobile-first approach

### Breakpoints
- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

## ♿ Accessibility Features

- Semantic HTML structure
- ARIA labels and roles
- Keyboard navigation support
- Focus indicators
- High contrast mode support
- Reduced motion preferences
- Screen reader friendly
- Alt text for images

## 🔧 Development Guidelines

### Adding a New Page

1. Create HTML file in `/public/` directory
2. Include common meta tags (SEO, Open Graph, Twitter)
3. Link to shared assets (logo.png, css/style.css)
4. Add navigation links in other pages
5. Follow existing color scheme and typography
6. Test responsive design on all breakpoints
7. Validate accessibility with tools

### Updating Documentation

1. Edit `docs.html` for user-facing documentation
2. Edit `scripts-docs.html` for admin/developer docs
3. Update version in `changelog.html` when releasing
4. Maintain consistent formatting and structure
5. Test search functionality after adding content
6. Update navigation sidebar if adding new sections

### Modifying Styles

1. Edit `css/style.css` for custom styles
2. Use Tailwind utility classes where possible
3. Follow existing naming conventions
4. Test dark mode compatibility (future enhancement)
5. Ensure mobile responsiveness
6. Validate CSS with linters

### Adding JavaScript Features

1. Edit `js/main.js` for landing page features
2. Edit `js/docs.js` for documentation features
3. Follow existing code organization
4. Add comments for complex logic
5. Test cross-browser compatibility
6. Optimize for performance

## 📊 SEO & Meta Tags

All pages include:
- Descriptive title tags
- Meta descriptions (150-160 characters)
- Open Graph tags for social sharing
- Twitter Card metadata
- Canonical URLs
- Favicon references
- Structured keywords

## 🔗 External Dependencies

### CDN Resources
- **Tailwind CSS**: https://cdn.tailwindcss.com
- **Font Awesome**: https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/
- **Google Fonts**: https://fonts.googleapis.com/css2
- **Prism.js**: https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/

### Font Families
- Inter (weights: 300, 400, 500, 600, 700, 800)
- JetBrains Mono (weights: 300, 400, 500, 600)

## 🎯 Performance Considerations

- Lazy loading for images (where applicable)
- Minified CSS animations
- Optimized JavaScript execution
- CDN usage for common libraries
- Smooth scroll behavior
- Efficient DOM manipulation
- Debounced scroll events

## 🔐 Security Notes

- No inline JavaScript in HTML (separated in .js files)
- Sanitized user input in search functionality
- No sensitive data in client-side code
- HTTPS recommended for production
- Content Security Policy ready

## 📝 Content Management

### Updating Commands Documentation
When adding new slash commands:
1. Update `docs.html` with command syntax and examples
2. Update `changelog.html` with version entry
3. Add to appropriate section (Team, Standup, Leave, Admin)
4. Include usage examples and screenshots
5. Update search keywords

### Updating Scripts Documentation
When adding new admin scripts:
1. Update `scripts-docs.html` with script details
2. Add to appropriate category section
3. Include usage examples, parameters, and output
4. Add prerequisites and warnings
5. Update navigation sidebar

### Version Releases
When releasing a new version:
1. Update `changelog.html` with new version entry
2. Move "Latest Release" badge to new version
3. Change previous latest to "Previous Release"
4. Add all changes with appropriate badges
5. Include release date and GitHub link

## 🌐 Browser Support

- **Chrome**: Latest 2 versions
- **Firefox**: Latest 2 versions
- **Safari**: Latest 2 versions
- **Edge**: Latest 2 versions
- **Mobile Safari**: iOS 12+
- **Chrome Mobile**: Latest version

## 📞 Contact & Support

For issues or questions about the landing pages:
- Email: support@dailydose.bot
- GitHub: https://github.com/jnahian/daily-dose
- Documentation: /docs
- Service Status: /health

## 🏗️ Future Enhancements

Planned improvements:
- [ ] Dark mode toggle
- [ ] Interactive demo/playground
- [ ] Video tutorials section
- [ ] Customer testimonials
- [ ] Blog/articles section
- [ ] Multi-language support
- [ ] Analytics integration
- [ ] A/B testing framework
- [ ] Progressive Web App (PWA) features
- [ ] Offline documentation access

## 📜 License

Copyright © 2025 Daily Dose. All rights reserved.

---

**Last Updated**: January 2025
**Maintained By**: Daily Dose Team
**Generated With**: Claude Code
