# AgentSec Design System

This document defines the visual and interaction design standards for AgentSec. All reports, dashboards, and UI components should conform to these specifications.

## Color Palette

### Background Colors
- **Primary Background**: `#0d1117` — Main page background, very dark blue-gray
- **Secondary Background**: `#161b22` — Used for alternative sections
- **Tertiary Background**: `#1c2333` — Card backgrounds, moderate elevation
- **Card Background**: `#1c2333` — Component surfaces
- **Hover State**: `#252d3a` — Interactive element hover state

### Text Colors
- **Primary Text**: `#e6edf3` — Main body text, high contrast
- **Secondary Text**: `#8b949e` — Muted text, subheadings, descriptions
- **Muted Text**: `#6e7681` — Lowest priority text, metadata, timestamps

### Border Colors
- **Primary Border**: `#30363d` — Standard borders, dividers
- **Light Border**: `#3d444d` — Subtle borders, secondary divisions

### Semantic Colors

#### Teal (Primary Brand)
- **Standard**: `#00d2b4` — Primary actions, highlights, key metrics
- **Dim**: `#00a894` — Secondary teal, hover states
- **Background**: `rgba(0, 210, 180, 0.1)` — Light teal backgrounds

#### Success (Green)
- **Standard**: `#3fb950` — Passing checks, low risk, passing policies
- **Background**: `rgba(63, 185, 80, 0.1)` — Success backgrounds

#### Warning (Yellow)
- **Standard**: `#d29922` — Warnings, medium risk, review needed
- **Background**: `rgba(210, 153, 34, 0.1)` — Warning backgrounds

#### Caution (Orange)
- **Standard**: `#db6d28` — High risk, urgent issues, critical paths
- **Background**: `rgba(219, 109, 40, 0.1)` — Caution backgrounds

#### Danger (Red)
- **Standard**: `#f85149` — Critical issues, failures, severe risks
- **Background**: `rgba(248, 81, 73, 0.1)` — Error backgrounds

#### Info (Blue)
- **Standard**: `#58a6ff` — Informational messages, additional context
- **Background**: `rgba(88, 166, 255, 0.1)` — Info backgrounds

#### Accent (Purple)
- **Standard**: `#bc8cff` — Accent elements, special callouts
- **Usage**: Secondary highlights, stats, badges

### Usage Guidelines

| Color | Use Case |
|-------|----------|
| Teal | Primary actions, buttons, links, key findings |
| Green | Passed checks, compliant, low-risk findings |
| Yellow | Warnings, review recommended, medium risk |
| Orange | High-priority issues, elevated risk |
| Red | Critical failures, severe risk, blocked items |
| Blue | Informational content, neutral notices |
| Purple | Accents, special badges, highlights |

## Typography

### Font Stack
```css
--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
--font-mono: 'SF Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace;
```

### Sizes and Weights

#### Headings
- **H1**: 2.0rem (32px), weight 700, letter-spacing -0.02em
- **H2**: 1.5rem (24px), weight 700
- **H3**: 1.25rem (20px), weight 600
- **H4**: 1.1rem (18px), weight 600
- **H5**: 1rem (16px), weight 600

#### Body Text
- **Large**: 1.1rem (18px), weight 400, line-height 1.6
- **Standard**: 1rem (16px), weight 400, line-height 1.6
- **Small**: 0.95rem (15px), weight 400, line-height 1.5
- **Tiny**: 0.85rem (13px), weight 400, line-height 1.4

#### Code/Monospace
- **Code block**: 0.9rem (14px), weight 400, font-family: mono
- **Inline code**: 0.85rem (13px), weight 400, font-family: mono
- **Terminal**: 0.875rem (14px), weight 500, font-family: mono

### Line Heights
- **Headings**: 1.2
- **Body**: 1.6
- **Compact**: 1.4
- **Loose**: 1.8

## Spacing Scale

Consistent spacing unit: 8px base

| Token | Value | Use |
|-------|-------|-----|
| `--space-xs` | 4px | Minimal spacing, tight layouts |
| `--space-sm` | 8px | Small gaps, icon spacing |
| `--space-md` | 16px | Standard element spacing |
| `--space-lg` | 24px | Card padding, section margins |
| `--space-xl` | 32px | Large sections, major spacing |
| `--space-2xl` | 48px | Page-level spacing, headers |

### Padding and Margin
- **Card padding**: 24px (space-lg)
- **Section margin**: 32px (space-xl)
- **Element gap**: 16px (space-md)
- **Border radius**: 8px (standard), 4px (small)

## Border Radius

- **Standard**: 8px — Cards, modals, major containers
- **Small**: 4px — Buttons, inputs, smaller components
- **None**: 0px — Tables, strict layouts

## Shadows

### Shadow System
```css
--shadow: 0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.4);
--shadow-lg: 0 10px 25px rgba(0,0,0,0.4);
```

### Usage
- **Standard shadow**: Cards, moderate elevation
- **Large shadow**: Modals, overlays, maximum elevation
- **No shadow**: Flat components, tables, background sections

## Component Patterns

### Cards
- **Background**: `--bg-card` (#1c2333)
- **Border**: 1px solid `--border` (#30363d)
- **Padding**: 24px (space-lg)
- **Border Radius**: 8px (standard)
- **Shadow**: `--shadow`

### Stat Card
Used for key metrics and summary statistics.

```html
<div class="stat-card">
  <div class="stat-value">42</div>
  <div class="stat-label">Skills Scanned</div>
  <div class="stat-change">+3 this month</div>
</div>
```

**Styling**:
- Value: H1-sized, primary text color
- Label: Small, secondary text color
- Change: Tiny, muted text color with semantic color

### Badges

#### Severity Badges
Used to indicate risk level:
- **Critical**: Red (#f85149) background with text
- **High**: Orange (#db6d28) background with text
- **Medium**: Yellow (#d29922) background with text
- **Low**: Green (#3fb950) background with text
- **Info**: Blue (#58a6ff) background with text

#### Status Badges
- **Certified**: Teal (#00d2b4) background, checkmark icon
- **Scanned**: Blue (#58a6ff) background, scan icon
- **In Review**: Yellow (#d29922) background, clock icon
- **Blocked**: Red (#f85149) background, block icon

#### Implementation
```html
<span class="badge badge-critical">CRITICAL</span>
<span class="badge badge-certified">Certified</span>
```

### Score Bars & Gauges

#### Score Bar
Horizontal progress-like indicator for security scores (0–100).

```html
<div class="score-bar">
  <div class="score-fill" style="width: 78%"></div>
  <div class="score-label">78 / 100</div>
</div>
```

**Color mapping**:
- 0–40: Red (#f85149)
- 41–70: Orange (#db6d28)
- 71–85: Yellow (#d29922)
- 86–100: Green (#3fb950)

#### Gauge (Circular)
Circular progress indicator for comprehensive scores.

**SVG Implementation**:
- Background circle: `--border` color
- Progress arc: Semantic color based on score
- Center display: Score number and percentage

### Severity Indicators

#### Triangle Icon Badges
Three-level indicator for skill risk assessment:

**Critical (Red)**: Full red triangle, maximum attention
**High (Orange)**: Red triangle outline, elevated concern
**Medium (Yellow)**: Orange triangle, review needed
**Low (Green)**: Green checkmark, minimal concern

### Tables

- **Header**: `--bg-secondary` (#161b22) background, primary text
- **Rows**: Alternating `--bg-primary` / `--bg-tertiary`
- **Borders**: 1px solid `--border`
- **Padding**: 16px row padding
- **Striped rows**: Apply `--bg-tertiary` to even rows

### Buttons

#### Primary Button (Teal)
- **Background**: `--teal` (#00d2b4)
- **Text**: Dark text for contrast (#0d1117)
- **Padding**: 12px 24px
- **Border Radius**: 4px
- **Hover**: `--teal-dim` (#00a894)

#### Secondary Button (Outline)
- **Background**: Transparent
- **Border**: 1px solid `--teal`
- **Text**: `--teal`
- **Padding**: 12px 24px
- **Hover**: `--teal-bg` background

#### Tertiary Button (Ghost)
- **Background**: Transparent
- **Border**: None
- **Text**: `--teal`
- **Hover**: `--teal-bg` background

### Lists & Hierarchies

#### Finding Lists
```html
<ul class="finding-list">
  <li class="finding" data-severity="critical">
    <span class="severity-badge">CRITICAL</span>
    <span class="finding-title">Finding Title</span>
    <span class="finding-description">Description</span>
  </li>
</ul>
```

**Styling**:
- **Left border**: 4px colored bar matching severity
- **Background**: `--bg-tertiary`
- **Padding**: 16px
- **Margin**: 8px between items

### Form Elements

#### Text Input
- **Background**: `--bg-secondary`
- **Border**: 1px solid `--border`
- **Text color**: `--text-primary`
- **Padding**: 12px
- **Focus border**: `--teal` color

#### Select Dropdown
- **Same as text input**
- **Arrow**: Teal color, right-aligned

#### Checkboxes & Radio Buttons
- **Default**: `--border` outline
- **Checked**: `--teal` filled
- **Focus**: `--teal` ring (2px)

## Dark Theme Specifications

### Principles
1. **High Contrast**: All text meets WCAG AA standards (4.5:1 minimum)
2. **Reduced Eye Strain**: Soft blacks (#0d1117) instead of pure black
3. **Color Depth**: Layered backgrounds for visual hierarchy
4. **Brand Consistency**: Teal accents throughout

### Implementation
All colors defined in CSS custom properties at `:root`:
```css
:root {
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-tertiary: #1c2333;
  /* ... all other variables ... */
}
```

### Background Elevation Layers
1. **Primary (Base)**: #0d1117 — Page background
2. **Secondary**: #161b22 — Alternative sections, headers
3. **Tertiary (Cards)**: #1c2333 — Component surfaces
4. **Hover**: #252d3a — Interactive states

## Accessibility

### Contrast Ratios
- **Primary text on primary bg**: 13.3:1 ✓ WCAG AAA
- **Secondary text on primary bg**: 6.2:1 ✓ WCAG AA
- **Teal on dark**: 6.8:1 ✓ WCAG AA
- **All semantic colors**: Meet WCAG AA minimum

### Focus States
- **Keyboard focus**: 2px teal outline on card bg
- **Button focus**: Teal ring + darker background
- **Link focus**: Underline + teal color

### Readability
- **Line length**: Max 100 characters for readability
- **Line height**: 1.6 for body, 1.2 for headings
- **Font sizes**: Never smaller than 12px for body content
- **Color alone**: Never rely on color to convey information; use icons, text, patterns

## Best Practices

### Do's
- Use teal as primary brand color and call-to-action
- Apply semantic colors consistently (red=danger, green=safe)
- Use sufficient white space around components
- Maintain 16px minimum font size for accessibility
- Test contrast ratios for all text colors
- Use icons alongside text for clarity

### Don'ts
- Don't use pure white (#fff) text on dark bg — use #e6edf3
- Don't forget hover states on interactive elements
- Don't exceed 100px line width for code blocks
- Don't layer colors without proper contrast
- Don't use color alone to convey status or severity
- Don't override system fonts unless necessary

## File References

**CSS Variables Location**: `report.html` inline `<style>` block
**Color Reference**: Lines 8–39 in report.html
**Component Examples**: Throughout report.html structure

## Versioning

**Design System Version**: 1.0.0
**Last Updated**: 2026-04-02
**Compatibility**: All AgentSec reports v2.0+
