# Visual Style Guide — Full Reference
# Guía de Estilo Visual — Referencia Completa

## 1. Color System / Sistema de Color

### Brand Palette
```
PRIMARY_BG:       #FFFFFF   (white — default background)
PRIMARY_TEXT:     #000000   (black — headlines, body)
ACCENT_PRIMARY:   #00BEFF   (electric blue — keyword highlights, CTAs, active elements)
ACCENT_SECONDARY: #DFA267   (warm gold — secondary emphasis, decorative, premium feel)
LIGHT_BG:         #F5F5F5   (off-white sections, subtle separation)
GRID_LINES:       #E0E0E0   (decorative grids, subtle structure)
SECONDARY_TEXT:   #999999   (captions, metadata, small details)
```

### Color Usage Rules
- Default background is always white or off-white. Never default to dark backgrounds.
- Use ACCENT_PRIMARY (`#00BEFF`) for the single most important word or phrase per scene.
- Use ACCENT_SECONDARY (`#DFA267`) sparingly for warmth: italic text, decorative lines, secondary highlights.
- Dark backgrounds (`#0A0A0A` to `#1A1A1A`) are acceptable ONLY for cinematic/3D hero sections, not as default.
- Maximum 2 accent colors per scene. Never mix both accents in the same text block.

## 2. Typography / Tipografía

### Hierarchy
| Level | Font | Weight | Use |
|-------|------|--------|-----|
| H1 — Hero | Aktiv Grotesk | Black/Bold | Main statement, 1-3 words max |
| H2 — Headline | Aktiv Grotesk | Bold | Scene titles, key phrases |
| H3 — Subhead | Inter or Montserrat | SemiBold | Supporting text, descriptions |
| Accent — Editorial | Playfair Display | Italic | Single emphasis word, contrast element |
| Body | Aktiv Grotesk | Regular | Subtitles, captions, descriptions |
| Detail | Inter | Regular/Light | Metadata, timestamps, small labels |

### Typography Rules
- Headlines: uppercase or sentence case, never all lowercase for primary text.
- Mix sans-serif + serif in the SAME line for editorial contrast (e.g., "I spent hours *Crafting* this" where "Crafting" is Playfair Italic and the rest is Aktiv Grotesk).
- Keyword highlighting: one word per sentence gets the accent color. Choose the most impactful word.
- Letter-spacing: slightly expanded (+0.02em to +0.05em) for headlines, normal for body.
- Text should feel LARGE and confident. Minimum font size equivalent: 48px for headlines in 1080p.

## 3. Animation & Motion / Animación y Movimiento

### Pacing
- Scene duration: 2-4 seconds per text scene for Reels/Shorts, 3-6 seconds for YouTube.
- Total video length target: 15-30s for Reels, 30-90s for Shorts, variable for YouTube.
- Rhythm: alternate between text-heavy scenes and visual/object scenes.

### Transition Style
- **Primary**: Clean cuts with slight fade (100-200ms opacity transition).
- **Secondary**: Slide-in from edges (elements enter from left/right/bottom).
- **Object reveals**: Scale from 0.8 to 1.0 with ease-out over 500ms.
- **Text entrance**: Fade-up (translateY: 20px → 0, opacity: 0 → 1) with 300-400ms duration.
- **Stagger**: When multiple text lines appear, stagger each by 150-200ms.
- **AVOID**: Flashy transitions, spin effects, bounce, elastic overshoot. Keep it smooth and premium.

### Easing
- Default easing: `cubicBezier(0.25, 0.1, 0.25, 1)` (smooth ease-out).
- For snappy entrances: `cubicBezier(0.16, 1, 0.3, 1)` (fast start, smooth end).
- Never use linear easing for visible UI elements.

### Motion Graphics Style
- Subtle scale breathing on background elements (1.0 → 1.02 → 1.0 over 3-4s).
- Floating/parallax movement on decorative elements (2-5px drift).
- Text shadows or subtle glow on accent-colored text for depth.

## 4. Subtitles — Word-by-Word (Hormozi Style)

### Implementation Rules
- Display one word at a time, centered on screen.
- Each word appears with a quick scale-pop: scale 1.1 → 1.0 over 150ms.
- Current word is in ACCENT_PRIMARY (`#00BEFF`) or bold white depending on background.
- Previous words remain visible but fade to `#999999` or 60% opacity.
- Font: Aktiv Grotesk Bold, large size (60-80px equivalent at 1080p).
- Background: semi-transparent pill/rounded rect behind text if needed for readability.
- Sync timing to audio beats or speech cadence. Each word: 200-400ms display time.

### Emphasis Words
- Words that carry emotional weight get ACCENT_PRIMARY color AND slightly larger scale (1.15x).
- Nouns and verbs get emphasis. Articles, prepositions do not.

## 5. Composition & Layout / Composición

### General Rules
- **White space is premium.** Leave at least 15-20% margin on all sides.
- **Center-weighted compositions** for text-focused scenes.
- **Rule of thirds** for scenes with objects + text.
- Safe zones: keep critical content within 90% of frame (5% margin each side).

### Decorative Elements (Editorial Details)
These small details elevate the premium feel. Use 1-3 per scene, never all at once:

- **Grid/retícula**: Subtle dot grid or line grid in `#E0E0E0`, 15-20% opacity background layer.
- **Barcode**: Small decorative barcode element in corner (top-right or bottom-left). Black, small.
- **Scale marks**: Ruler/measurement marks along edges. Thin lines with tiny numbers.
- **Badges**: Small "HD", "4K", or custom badges in bottom corner. Circular or pill shape.
- **Crosshairs/plus signs**: Small `+` marks in corners at 30-40% opacity.
- **Thin lines**: Horizontal or vertical hairlines as section dividers.

### Object Integration (3D/Rendered Elements)
- Objects should be high-quality, photorealistic or stylized 3D renders.
- Objects interact with text: text wraps around, overlaps, or sits behind objects.
- Drop shadows on objects: subtle, diffused, matching the light direction.
- Objects can extend beyond frame edges for dynamic composition.

## 6. Script-to-Animation / Del Guion a la Animación

Every script or voiceover text must be transformed into a visually rich animation — never just
text on screen. Each sentence or idea in the script should map to a **visual concept** with
creative elements that reinforce the message.

### Creative Visual Elements
For each script line, select and animate one or more of these elements to illustrate the idea:

- **Characters/Personas**: Illustrated or 3D rendered characters (flat illustration style or
  photorealistic). Use them to represent the viewer, a customer, a professional, etc.
- **Icons & Symbols**: Meaningful icons that represent concepts (lightbulb = idea, rocket = growth,
  target = goal, clock = time, brain = thinking). Animate their entrance and subtle movement.
- **Metaphorical Objects**: Real-world 3D objects that serve as visual metaphors (hourglass = time
  running out, magnifying glass = attention to detail, chess piece = strategy).
- **Diagrams & Infographics**: Animated charts, flowcharts, or process diagrams that build
  step-by-step as the narration progresses.
- **Scene Illustrations**: Mini-scenes or vignettes (a desk setup, a phone screen, a storefront)
  that contextualize the message.
- **Emoji & Expressive Elements**: Stylized emoji or reaction graphics for emotional beats
  (used sparingly, matching the premium aesthetic).

### Transformation Rules
- **Never leave a script line as plain text only.** Every line gets at least one visual element.
- **Match the visual to the emotion**: positive messages get warm/bright elements, urgency gets
  bold/contrasting elements, technical content gets clean diagrams.
- **Animate the visual in sync with the text**: the visual element should enter/transform as the
  corresponding word or phrase appears.
- **Maintain visual continuity**: recurring concepts should use the same character/icon throughout
  the video. Establish a visual vocabulary per project.
- **Layer text + visual**: text and creative elements should coexist in the frame, not alternate
  in separate scenes. The visual enriches the text, it doesn't replace it.

### Example Script Transformation
```
Script line: "Stop wasting time on manual tasks"
BAD:  White screen with text "Stop wasting time on manual tasks"
GOOD: Animated hourglass (3D, sand flowing) on the left, text enters from right
      with "time" highlighted in #00BEFF. Hourglass cracks/shatters on "Stop".
      Small clock icons float and fade in background.
```

```
Script line: "Our platform helps you grow"
BAD:  Text centered on white background
GOOD: Small plant/seedling illustration grows from bottom of frame as text
      appears. "grow" in #00BEFF scales up slightly. Subtle upward particle
      movement. Character silhouette in background tending the plant.
```

### Visual Element Style
- **Illustration style**: Clean, modern, flat or semi-flat with subtle shadows. NOT cartoonish.
- **3D objects**: Photorealistic or stylized glass/metallic finish matching the editorial aesthetic.
- **Icons**: Line icons (1.5-2px stroke) or filled icons with rounded corners. Monochrome (black)
  or brand accent colors. Prefer Lucide, Phosphor, or similar clean icon sets.
- **Characters**: If illustrated, use a consistent style throughout (geometric/minimal or detailed).
  If photographic, use cutout style with drop shadow on white background.

## 7. Scene Structure Templates / Plantillas de Escena

### Template A: Text-Only (Clean)
```
[White background]
[Decorative grid at 15% opacity]
[Main text — Aktiv Grotesk Bold, centered]
[One keyword in #00BEFF]
[Small barcode or badge in corner]
```

### Template B: Object + Text (Editorial)
```
[White/off-white background]
[3D object — center or rule-of-thirds position]
[Text overlapping or adjacent to object]
[Scale marks or crosshairs as decoration]
[Staggered text entrance animation]
```

### Template C: Full-Bleed Statement (Impact)
```
[White background]
[Oversized text filling 70%+ of frame]
[Single accent word in #00BEFF or #DFA267]
[Minimal decoration — let the typography speak]
```

### Template D: Dark Hero (Cinematic, use sparingly)
```
[Dark background #0A0A0A to #1A1A1A]
[Glowing 3D element with volumetric feel]
[White text — Aktiv Grotesk Bold]
[Subtle gradient or light leak accents in brand colors]
```

## 8. Format-Specific Notes

### Vertical (1080×1920, 9:16)
- Stack text vertically. Max 4-5 words per line.
- Objects can be large, filling 40-60% of vertical space.
- Subtitle area: center-third of screen.
- Leave bottom 10% clear for platform UI (like/comment buttons).

### Horizontal (1920×1080, 16:9)
- Text can spread wider. Max 6-8 words per line.
- Split compositions work well: object on one side, text on the other.
- Subtitle area: lower third or center.
- Consider safe zones for YouTube player controls at bottom.

## 9. What to AVOID / Qué Evitar

- Generic stock motion graphics (swooshes, lens flares, particle effects).
- Neon/glow effects on dark backgrounds as default style.
- More than 2 fonts in the same scene.
- Centered-everything layouts without intentional asymmetry.
- Low-contrast text (always ensure WCAG AA readability minimum).
- Overly complex animations. If it feels busy, simplify.
- Rainbow or multi-color gradients. Stick to brand palette.
- Generic "corporate" feel. This is editorial, not PowerPoint.
