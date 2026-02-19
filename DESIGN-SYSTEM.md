# ShiftSwap Design System

**Based on:** Vercel Geist Design Principles
**Status:** Active

---

## 1. CORE PHILOSOPHY

**"Iterate to Greatness"** — Prioritize quality over quantity. Ship continuous improvements. Avoid the perfection trap while maintaining high craft standards.

**Design Engineering Principles:**
- Independent ownership of features
- No dropped frames, no cross-browser inconsistencies
- Accessibility-first
- Design-led projects get equal priority 

---

## 2. COLOR SYSTEM

### Primary Palette (Zinc Scale)
| Role | Light Mode | Dark Mode |
|------|-----------|-----------|
| **Background** | `#fafafa` (zinc-50) | `#09090b` (zinc-950) |
| **Surface** | `#ffffff` | `#18181b` (zinc-900) |
| **Elevated** | `#f4f4f5` (zinc-100) | `#27272a` (zinc-800) |
| **Border** | `#e4e4e7` (zinc-200) | `#3f3f46` (zinc-700) |
| **Text Primary** | `#18181b` (zinc-900) | `#fafafa` (zinc-50) |
| **Text Secondary** | `#71717a` (zinc-500) | `#a1a1aa` (zinc-400) |
| **Text Muted** | `#a1a1aa` (zinc-400) | `#71717a` (zinc-500) |

### Critical Rules
- **NEVER use pure black** (`#000000`) — use zinc-950 (#09090b) instead 
- **NEVER use pure white** (`#FFFFFF`) for text — use zinc-50 with opacity or zinc-100 
- **Avoid highly saturated colors** — desaturate by 20-40% for dark mode 
- **Use opacity for hierarchy**: Primary text at 100%, secondary at 70%, muted at 50%

---

## 3. TYPOGRAPHY

### Font Family
- **Primary**: `Geist Sans` (or Inter as fallback)
- **Monospace**: `Geist Mono` for code/technical content 
- **System fallback**: `system-ui, -apple-system, sans-serif`

### Type Scale
| Token | Size | Line Height | Usage |
|-------|------|-------------|-------|
| `text-heading-72` | 72px | 1.0 | Hero headlines |
| `text-heading-48` | 48px | 1.1 | Page titles |
| `text-heading-32` | 32px | 1.2 | Section headers |
| `text-heading-24` | 24px | 1.3 | Card titles |
| `text-copy-18` | 18px | 1.6 | Large body text |
| `text-copy-16` | 16px | 1.6 | Default body |
| `text-label-14` | 14px | 1.5 | Labels, buttons |
| `text-label-13` | 13px | 1.4 | Compact labels |

### Typography Rules
- **Weights**: Use Medium (500) for emphasis, Regular (400) for body, Bold (700) sparingly
- **Anti-aliasing**: `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;`
- **Text transforms**: Avoid animating text nodes directly — animate wrapper instead 

---

## 4. SPACING & GRID

### Grid System
- **Base unit**: 4px
- **Section padding**: 80px-120px vertical (desktop), 40px-60px (mobile)
- **Container max-width**: 1200px (content), 1400px (wide)
- **Component gaps**: 16px, 24px, 32px, 48px (multiples of 8)

### Spacing Scale
```
4px  →  8px  →  12px  →  16px  →  24px  →  32px  →  48px  →  64px  →  96px
xs      sm      md       lg       xl       2xl       3xl       4xl       5xl
```

---

## 5. BORDERS & SHADOWS

### Border Guidelines 
- **Default**: `1px solid` with zinc-700/800 in dark mode
- **Subtle**: `border-opacity: 0.5` or use zinc-800
- **Hover states**: Increase border brightness/contrast
- **Crisp edges**: Combine borders with semi-transparent overlays

### Shadow System 
- **Layered shadows**: Use at least two layers to mimic ambient + direct light
- **Dark mode shadows**: Keep subtle, avoid heavy elevation
- **Example**: 
  ```css
  box-shadow: 0 1px 2px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.4);
  ```

### Border Radius
- **Nested radii**: Child radius ≤ parent radius (concentric curves)
- **Small**: 6px (buttons, inputs)
- **Medium**: 8px (cards, containers)
- **Large**: 12px (modals, large cards)
- **Full**: 9999px (pills, badges)

---

## 6. INTERACTIONS & STATES

### Hover States 
- **Always increase contrast** on hover (never decrease)
- **Background**: Lighten by 5-10% in dark mode
- **Borders**: Brighten or increase opacity
- **Transitions**: `150ms cubic-bezier(0.4, 0, 0.2, 1)`

### Focus States
- **Ring**: `2px solid` with primary color
- **Offset**: `2px` gap from element
- **Visible**: High contrast for accessibility

### Active/Pressed
- **Scale**: `transform: scale(0.98)` for buttons
- **Background**: Darken slightly (opposite of hover)

---

## 7. COMPONENTS

### Buttons
```
Primary: 
  - Background: zinc-100 (dark: zinc-900)
  - Text: zinc-900 (dark: zinc-100)
  - Border: none or 1px zinc-200 (dark: zinc-800)
  - Hover: zinc-200 (dark: zinc-800)
  - Padding: 12px 20px
  - Radius: 6px
  - Font: 14px Medium

Secondary/Ghost:
  - Background: transparent
  - Border: 1px zinc-700
  - Hover: zinc-800/50 background
```

### Cards
```
- Background: zinc-900 (dark mode)
- Border: 1px zinc-800
- Radius: 8px or 12px
- Padding: 24px
- Shadow: subtle layered shadow
- Hover: border brightens, slight lift
```

### Inputs
```
- Background: zinc-900/50 (dark)
- Border: 1px zinc-700
- Radius: 6px
- Padding: 12px 16px
- Focus: border-primary, ring-2
- Placeholder: zinc-500
```

---

## 8. VISUAL EFFECTS

### Aurora/Gradient Backgrounds
- **Colors**: Subtle black-white gradients (low saturation)
- **Opacity**: 20-40% maximum
- **Blur**: Heavy backdrop blur (`blur(100px)`)
- **Position**: Fixed, behind content

### Glassmorphism
- **Background**: `rgba(24, 24, 27, 0.6)` (zinc-900 with opacity)
- **Backdrop-filter**: `blur(12px)`
- **Border**: `1px solid rgba(255,255,255,0.1)`
- **Use sparingly**: Headers, floating cards, modals

---

## 9. CSS VARIABLES

```css
:root {
  --bg-primary: #09090b;
  --bg-secondary: #18181b;
  --bg-tertiary: #27272a;
  --border-default: #27272a;
  --border-hover: #3f3f46;
  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;
  --accent: #3b82f6;
}
```

---

## 10. ANTI-PATTERNS

❌ **Never use**: Pure black (#000) or pure white (#FFF)  
❌ **Never use**: Heavy shadows in dark mode  
❌ **Never use**: Highly saturated neon colors  
❌ **Never use**: Ambiguous button labels ("Continue" → use "Save Changes")  
❌ **Never animate**: Text nodes directly (causes anti-aliasing issues)

---

## 11. AGENT PROMPTS

### For Components
> "Create a [component] using Vercel Geist design system principles: zinc-950 background, zinc-900 surfaces, 1px zinc-800 borders, Geist Sans typography, 6px radius, subtle hover states that increase contrast, 4px grid spacing, dark mode optimized"

### For Layouts
> "Design a [page/section] with Vercel aesthetic: generous whitespace (80px sections), zinc color palette, crisp 1px borders, layered shadows, nested border radius, Geist typography, immersive dark mode with #09090b background"
