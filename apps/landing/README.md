# AgentSec Landing Page

Marketing landing page for AgentSec — security scanning for AI agent skills.

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS 3
- **Package Manager**: bun
- **Deployment**: Vercel-ready

## Features

- Minimal, responsive single-page design
- Dark macOS-themed palette (teal `#00d2b4` on charcoal `#0d1117`)
- Scroll-triggered animated terminal that streams a real AgentSec audit run
- Floating sticky `npx agentsec` copy CTA that follows the reader
- OWASP AST10 "Ten Commandments" reference section
- Working contact form (mailto → mark@semiotic.ai)
- Sections: Header → Hero → AnimatedTerminal → TenCommandments → ContactForm → Footer

## Getting Started

### Install Dependencies

```bash
bun install
```

### Development Server

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the site.

### Build for Production

```bash
bun run build
```

Output goes to `.next/` directory.

### Start Production Server

```bash
bun run start
```

## Project Structure

```
apps/landing/
├── app/
│   ├── layout.tsx          # Root layout with metadata
│   ├── page.tsx            # Home page
│   └── globals.css         # Global styles and animations
├── components/
│   ├── Header.tsx             # Navigation header with mobile menu
│   ├── Hero.tsx               # Headline and link row
│   ├── AnimatedTerminal.tsx   # Scroll-triggered animated CLI output
│   ├── StickyCopy.tsx         # Floating bottom-right copy CTA
│   ├── TenCommandments.tsx    # OWASP AST10 reference table
│   ├── ContactForm.tsx        # Mailto-backed contact form
│   └── CTA.tsx                # Page footer (wordmark + links)
├── next.config.ts          # Next.js configuration
├── tailwind.config.ts      # Tailwind CSS configuration
├── postcss.config.js       # PostCSS configuration
├── tsconfig.json           # TypeScript configuration
├── vercel.json             # Vercel deployment config
└── package.json            # Project dependencies
```

## Design System

### Color Palette

- **Primary**: Teal (#00d2b4)
- **Dark Background**: #0d1117
- **Secondary Background**: #161b22
- **Card Background**: #1c2333
- **Border**: #30363d
- **Text Primary**: #e6edf3
- **Text Secondary**: #8b949e
- **Accent Red**: #f85149
- **Accent Green**: #3fb950
- **Accent Yellow**: #d29922
- **Accent Blue**: #58a6ff

### Typography

- **Font Family**: System stack (Apple, Segoe, Roboto, etc.)
- **Font Sizes**: Responsive scaling based on viewport
- **Font Weight**: 400 (regular), 600 (semibold), 700 (bold)

### Spacing

- **Section Padding**: 80px (desktop), 60px (mobile)
- **Gap**: 6-8px between grid items
- **Border Radius**: 6-8px for cards

## Animations

- **Fade In**: 0.6s ease-in-out
- **Slide Up**: 0.6s ease-out from translateY(30px)
- **Glow**: 3s infinite pulse effect on teal elements
- **Scroll Animations**: Intersection Observer-based fade + slide on cards

## Responsive Breakpoints

- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

## Deployment to Vercel

The project includes a `vercel.json` configuration for easy deployment:

1. Push the code to GitHub
2. Import repository in Vercel dashboard
3. Vercel will auto-detect Next.js and build settings
4. Site deploys automatically on git push

### Environment Variables

No environment variables required for default deployment. Email signup can be enhanced with Vercel KV or other backend services.

## Performance

- **First Load JS**: ~107 KB (optimized with Next.js)
- **Static Generation**: All pages prerendered at build time
- **Bundle Size**: 5.44 KB main route HTML
- **Lighthouse Ready**: Optimized for Core Web Vitals

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile browsers: iOS Safari 12+, Chrome Android 90+

## Contributing

Contributions welcome! Please ensure:

1. No `any` types or type assertions
2. TypeScript strict mode enabled
3. Tailwind CSS utility classes preferred
4. Components use React hooks, not class components
5. All links point to correct GitHub/Contact URLs

## License

Part of AgentSec. See root LICENSE file.
