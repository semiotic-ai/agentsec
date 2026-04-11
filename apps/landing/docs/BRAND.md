# AgentSec Brand Guidelines

## Brand Identity

**AgentSec** is the leading security auditing platform for AI agent skills. Our brand represents trust, precision, and technical excellence. We're the standard for agentic skill security.

### Mission

Empower organizations to deploy agent skills confidently by providing comprehensive security auditing aligned with OWASP Agentic Skills Top 10 standards.

### Brand Personality

- **Technical**: Deep expertise, precise language, no shortcuts
- **Trustworthy**: Transparent findings, reliable methodology, consistent standards
- **Precise**: Exact metrics, clear severity levels, actionable insights
- **Professional**: Not fear-mongering, not oversimplified, evidence-based

## Logo Usage

### Logo Files

- **Primary**: `assets/agentsec-logo.svg` (recommended for digital)
- **Dark Variant**: `assets/agentsec-logo-dark.svg` (for light backgrounds)
- **Icon**: `assets/agentsec-icon.svg` (favicon, small displays)

### Minimum Sizes

- **Large displays**: 200px minimum width
- **Navigation bars**: 40–60px height
- **Favicon**: 32x32px minimum

### Clear Space

The logo requires clear space around it equal to the height of the "A" in the mark:

- **Top**: 1x clear height
- **Bottom**: 1x clear height
- **Left**: 1x clear height
- **Right**: 1x clear height

### Do's

- Use the full lockup (mark + wordmark) on new materials
- Place on solid backgrounds or provided brand backgrounds
- Maintain aspect ratio when scaling
- Use the correct color variant for background contrast

### Don'ts

- Don't rotate, distort, or skew the logo
- Don't add effects, shadows, or gradients
- Don't change colors or replace with custom teal
- Don't use condensed or stretched versions
- Don't place on busy backgrounds without a solid backdrop
- Don't use the icon in place of the full logo on material longer than 5 seconds of attention

## Color Palette

### Primary Colors

#### Teal (Brand Primary)

- **Hex**: `#00d2b4`
- **RGB**: 0, 210, 180
- **HSL**: 167°, 100%, 41%
- **Use**: Primary actions, buttons, headers, key highlights
- **Context**: Conveys security confidence and trust

#### Dark Charcoal (Primary Bg)

- **Hex**: `#0d1117`
- **RGB**: 13, 17, 23
- **HSL**: 219°, 28%, 7%
- **Use**: Page backgrounds, main surface
- **Context**: Professional dark theme base

### Secondary Colors

#### Card Blue-Gray

- **Hex**: `#1c2333`
- **RGB**: 28, 35, 51
- **HSL**: 218°, 29%, 16%
- **Use**: Card backgrounds, component surfaces
- **Context**: Subtle elevation without breaking the dark theme

#### Border Gray

- **Hex**: `#30363d`
- **RGB**: 48, 54, 61
- **HSL**: 213°, 13%, 21%
- **Use**: Borders, dividers, subtle separators
- **Context**: Low-contrast structure lines

### Accent Colors

#### Success Green

- **Hex**: `#3fb950`
- **RGB**: 63, 185, 80
- **Use**: Passing checks, low-risk findings, compliant items
- **Context**: Positive confirmation

#### Warning Yellow

- **Hex**: `#d29922`
- **RGB**: 210, 153, 34
- **Use**: Warnings, items needing review, medium risk
- **Context**: Caution indicator

#### Caution Orange

- **Hex**: `#db6d28`
- **RGB**: 219, 109, 40
- **Use**: High-risk findings, elevated concern
- **Context**: Urgent attention needed

#### Danger Red

- **Hex**: `#f85149`
- **RGB**: 248, 81, 73
- **Use**: Critical issues, failures, severe risks
- **Context**: Maximum alert level

#### Info Blue

- **Hex**: `#58a6ff`
- **RGB**: 88, 166, 255
- **Use**: Informational content, neutral context
- **Context**: Informational highlights

### Semantic Color Usage

| Situation          | Color          | Example                               |
| ------------------ | -------------- | ------------------------------------- |
| Passed/Safe        | Green #3fb950  | "Check passed", "Low risk"            |
| Review Recommended | Yellow #d29922 | "Medium risk", "See details"          |
| High Risk          | Orange #db6d28 | "Elevated concern", "Review urgently" |
| Critical/Failed    | Red #f85149    | "Critical issue", "Blocked"           |
| New/Info           | Blue #58a6ff   | "New finding", "Additional info"      |
| Primary Action     | Teal #00d2b4   | Buttons, links, headers               |

## Typography

### Typeface

**System Font Stack** (no custom fonts required):

```
-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif
```

This ensures:

- Fast loading (no external font downloads)
- Native rendering on each platform
- Excellent legibility
- Familiar appearance

### Monospace

**Code Font Stack**:

```
'SF Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace
```

Used for:

- Code blocks and snippets
- Technical identifiers
- Terminal output
- Hash digests and IDs

### Font Sizes in Reports

- **Page Title (H1)**: 32px, weight 700
- **Section Header (H2)**: 24px, weight 700
- **Subsection (H3)**: 20px, weight 600
- **Finding Title (H4)**: 18px, weight 600
- **Body Text**: 16px, weight 400
- **Small Text**: 14px, weight 400
- **Metadata**: 13px, weight 400, secondary color

### Line Height

- **Headings**: 1.2 (tight, impactful)
- **Body**: 1.6 (comfortable reading)
- **Code**: 1.4 (dense but readable)

## Badge Guidelines

### Certified Badge

Indicates skills have passed AgentSec's comprehensive security review.

**Visual**:

- **Shape**: Rounded rectangle with teal background
- **Icon**: Shield with checkmark
- **Text**: "Certified by AgentSec" or "Certified"
- **Size**: 120–160px width for display, 60–80px for thumbnail

**Placement**:

- Skill marketplace listings (prominent position)
- Documentation headers
- Security dashboards (status indicator)
- Never on non-certified skills

**Usage Rules**:

- Only use on skills that passed current audit
- Update or remove if skill fails subsequent audit
- Include audit date in tooltip when possible
- Link to full audit report from badge

### Scanned Badge

Indicates a skill has been analyzed but may have findings or gaps.

**Visual**:

- **Shape**: Rounded rectangle with blue background
- **Icon**: Scanning/radar icon
- **Text**: "Scanned" or "Security Scanned"
- **Size**: Same as Certified Badge

**Placement**:

- All scanned skills in marketplaces
- Skill detail pages
- Reports and documentation

**Usage Rules**:

- Use for all scanned skills regardless of findings
- Include scan date in tooltip
- Can coexist with severity indicators
- Link to detailed findings when available

### Severity Badges

Used in reports and findings lists to indicate risk level at a glance.

#### Critical

- **Color**: Red background (#f85149) with white text
- **Text**: "CRITICAL"
- **Context**: Blocks deployment, immediate attention required

#### High

- **Color**: Orange background (#db6d28) with white text
- **Text**: "HIGH"
- **Context**: Elevated risk, must address before production

#### Medium

- **Color**: Yellow background (#d29922) with dark text
- **Text**: "MEDIUM"
- **Context**: Should review and address

#### Low

- **Color**: Green background (#3fb950) with white text
- **Text**: "LOW"
- **Context**: Minimal risk, monitor for updates

## Voice and Tone

### Principles

1. **Technical but accessible**: Use precise terminology, but explain concepts
2. **Confident, not alarmist**: Facts speak; avoid sensationalism or fear tactics
3. **Action-oriented**: Always provide next steps and solutions
4. **Transparent**: Show methodology; explain scoring

### Writing Style

#### Do's

- "This skill requests database write access, which exceeds its described capabilities."
- "3 of 5 dependencies have known vulnerabilities. See remediation guide."
- "Permission score: 42/100. Recommend limiting to read-only access."
- "Update drift detected: 8 months since last security review."

#### Don'ts

- "Your skill is INFECTED with malware!" (sensational)
- "This skill is DANGEROUS and will DESTROY your system." (fear-mongering)
- "Obvious security problem" (vague)
- "Trust us, this is bad." (no explanation)

### Common Phrases

- "Finding", "Issue", "Alert" (not "bug", "problem", or "attack")
- "Review recommended", "Action required", "Address before deployment"
- "Compliant", "Certified", "Passed" (positive outcomes)
- "Scanned", "Analyzed", "Assessed" (our actions)

### Report Language

Reports should be:

- **Structured**: Clear sections, hierarchies, navigation
- **Data-driven**: Metrics, scores, evidence
- **Actionable**: What to do, how to fix, links to resources
- **Consistent**: Same terminology across all reports

## Tagline

**Primary Tagline**: "Audit skills. Trust agents."

**Context**: Used in marketing, hero sections, brand statements

**Extended Tagline**: "Security auditing for AI agent skills, aligned with OWASP standards."

**Usage**: Full description for formal materials, job postings, whitepapers

## Badge Placement in Markdown

### In Documentation

```markdown
![AgentSec Certified](https://agentsec.sh/badges/certified.svg)

This skill has been audited and certified by AgentSec.
```

### In Skill Metadata

```yaml
badges:
  - type: certified
    url: https://agentsec.sh/verify/skill-id
    date: 2026-04-02
```

### On Websites

```html
<a href="https://agentsec.sh/verify/skill-id">
  <img src="/badges/certified.svg" alt="Certified by AgentSec" />
</a>
```

## Colors in Context

### Security Reports

- **Header**: Teal text on dark background
- **Critical finding**: Red left border + badge
- **High finding**: Orange left border + badge
- **Medium finding**: Yellow left border + badge
- **Low finding**: Green left border + badge

### Dashboards

- **Overall score (80+)**: Green gradient background
- **Overall score (50–79)**: Yellow gradient background
- **Overall score (below 50)**: Red gradient background
- **Passed metrics**: Green checkmarks
- **Failed metrics**: Red X marks

### Marketing Materials

- **Headlines**: Teal text
- **Buttons**: Teal background with white text
- **Accents**: Teal dividers, borders, highlights
- **Background**: Dark charcoal (#0d1117)
- **Cards**: Card blue-gray (#1c2333) with borders

## Brand Assets

### Repository Location

All brand assets are in `/assets/`:

- `agentsec-logo.svg` — Full logo + wordmark
- `agentsec-icon.svg` — Icon only (favicon)
- `agentsec-badge-certified.svg` — Certification badge
- `agentsec-badge-scanned.svg` — Scanning badge
- `architecture.svg` — Architecture diagram
- `owasp-coverage.svg` — OWASP coverage chart

### Asset Licenses

All brand assets are licensed under CC-BY-4.0 for use in compliance with AgentSec certification and auditing contexts. Commercial licensing available on request.

## Quick Reference

| Element         | Value                         | Use                     |
| --------------- | ----------------------------- | ----------------------- |
| Primary Color   | #00d2b4                       | Headers, buttons, links |
| Dark Background | #0d1117                       | Page background         |
| Card Background | #1c2333                       | Component surfaces      |
| Success         | #3fb950                       | Passed checks           |
| Warning         | #d29922                       | Medium risk             |
| Caution         | #db6d28                       | High risk               |
| Danger          | #f85149                       | Critical issues         |
| Info            | #58a6ff                       | Information             |
| Font            | System font stack             | All text                |
| Tagline         | "Audit skills. Trust agents." | Marketing               |

## Version History

| Version | Date       | Changes                  |
| ------- | ---------- | ------------------------ |
| 1.0     | 2026-04-02 | Initial brand guidelines |
