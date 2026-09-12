Perform a FINAL, comprehensive visual refinement and design-system pass across the entire AuraPDF application.

IMPORTANT:
This is a FINAL POLISH PASS.

DO NOT add new features.
DO NOT remove existing functionality.
DO NOT change the information architecture.
DO NOT redesign the product into a different application.

The goal is to take the existing AuraPDF UI and make it feel like a genuinely polished, premium, production-ready desktop application.

The current UI still feels:
• too boxy
• too sharp
• too rigid
• too left-heavy
• too high-contrast
• too colorful/saturated
• too much like a generic generated SaaS interface

Fix all of these issues together.

The final visual language should be:

SOFT
ROUND
CALM
DEEP
PREMIUM
REFINED
BALANCED
DESKTOP-NATIVE
EASY ON THE EYES

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. ELIMINATE THE BOXINESS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Perform a complete audit of every component.

The interface currently contains too many hard rectangular shapes.

Soften the geometry throughout the application.

Use rounded corners appropriately for:

• Buttons
• Inputs
• Search
• Menus
• Popovers
• Dialogs
• Settings groups
• Document thumbnails
• Navigation items
• Toolbars
• Floating controls
• Command palette
• Panels
• Selection controls
• Toggles
• Context menus

Create ONE coherent radius system.

Use approximately:

Small controls:
8px

Buttons / inputs:
9–10px

Menus / popovers:
10–12px

Panels / grouped surfaces:
12–16px

Large floating surfaces:
16–20px

Do NOT make everything pill-shaped.

Do NOT use huge 24–32px radii everywhere.

The goal is:

soft geometry, not bubbly UI.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. SOFTEN THE VISUAL LANGUAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The UI currently feels visually sharp because of hard borders and strong separation.

Reduce this.

Prefer:

SURFACE CONTRAST
over
HEAVY BORDERS

Use:

• subtle borders
• low-contrast dividers
• soft elevation
• restrained shadows
• gentle hover states
• subtle active states

Do not outline every element.

Do not use thick borders.

Do not use strong black drop shadows.

Do not use neon glows.

Do not use excessive glassmorphism.

The interface should feel layered and tactile without looking decorative.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. PROPER GLOBAL THEME ARCHITECTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create two independent appearance controls:

THEME MODE:
• System
• Light
• Dark

COLOR THEME:
• Navy Mirage
• Emerald Depth
• Moon

These are NOT the same setting.

Theme Mode determines whether the interface is light or dark.

Color Theme determines the application's visual personality.

The user must be able to freely combine them.

Examples:

Dark + Navy Mirage
Dark + Emerald Depth
Dark + Moon

Light + Navy Mirage
Light + Emerald Depth
Light + Moon

System + Navy Mirage
System + Emerald Depth
System + Moon

Persist both settings independently.

Example internal structure:

themeMode = system | light | dark

colorTheme = navy | emerald | moon

Changing either setting should immediately update the entire application.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. NAVY MIRAGE COLOR THEME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Implement Navy Mirage as a complete color system.

DARK PALETTE:

Deepest background:
#0B111A

Background:
#0F1722

Surface:
#141E30

Elevated surface:
#1B293D

Hover:
#22344C

Primary accent:
#35577D

Soft accent:
#294766

Primary text:
#E8EDF3

Secondary text:
#A8B4C2

Muted text:
#718093

Border:
#263548

Navy Mirage should feel:

deep
cool
professional
quiet
technical
premium

Do NOT make it bright blue.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. EMERALD DEPTH COLOR THEME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Implement Emerald Depth as a complete color system.

DARK PALETTE:

Deepest background:
#07120E

Background:
#0A1914

Surface:
#0F2027

Elevated surface:
#142A25

Hover:
#1A352D

Primary accent:
#28623A

Soft accent:
#214F32

Primary text:
#E6EEE9

Secondary text:
#A6B7AD

Muted text:
#71847A

Border:
#223A31

Emerald Depth should feel:

deep
organic
calm
sophisticated
premium

Do NOT make it neon green.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. MOON COLOR THEME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Implement Moon as a complete color system.

DARK PALETTE:

Deepest background:
#140A1F

Background:
#210F35

Surface:
#2A1440

Elevated surface:
#351A4C

Primary accent:
#6667AB

Secondary accent:
#7B337E

Deep accent:
#420D4B

Soft highlight:
#C3B6D9

Primary text:
#F0E8F0

Secondary text:
#BDAFC3

Muted text:
#827287

Border:
#432A50

Moon should feel:

soft
moody
elegant
slightly atmospheric
premium

Do NOT make it neon purple.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. DO NOT TURN THE PALETTES INTO GRADIENT UI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The provided references are inspiration for their COLOR DEPTH and ATMOSPHERE.

Do NOT put gradients everywhere.

Most surfaces should remain solid.

Use gradients only when extremely subtle and genuinely useful.

Avoid:

• neon gradients
• glowing backgrounds
• purple glow
• blue glow
• green glow
• excessive blur
• glassmorphism

The application should feel sophisticated because of its color relationships, not effects.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. LIGHT MODE VARIANTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create genuinely designed light variants for all three color themes.

Do NOT simply invert the dark palettes.

Do NOT use the dark backgrounds in Light mode.

Each Light theme should use:

• comfortable neutral background
• lightly tinted surfaces
• restrained borders
• appropriate dark text
• the theme's accent identity

Navy Mirage Light:
subtle cool/navy influence

Emerald Depth Light:
subtle green influence

Moon Light:
subtle lavender/plum influence

The three themes should remain recognizable while being comfortable for long sessions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. THEME SELECTOR DESIGN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

In Settings → General → Appearance, show:

THEME
[ System ] [ Light ] [ Dark ]

COLOR THEME

[ Navy Mirage ]
[ Emerald Depth ]
[ Moon ]

Do NOT represent the three themes as tiny colored circles.

Create proper visual theme previews.

Each preview should show a miniature representation of:

• background
• surface
• accent

The user should immediately understand what each theme looks like.

The selected theme should have a refined outline using the selected theme's accent.

Do NOT use a bright glowing selection ring.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. CENTER THE SETTINGS CONTENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fix the current left-heavy composition.

Keep the existing structure:

APPLICATION SIDEBAR
→ SETTINGS NAVIGATION
→ MAIN SETTINGS CONTENT

But properly center the MAIN SETTINGS CONTENT within the remaining workspace.

Do not center it relative to the entire window.

Give it a sensible maximum width.

Do not let settings rows stretch unnecessarily across the entire screen.

The main content should have balanced space on both sides.

The Settings content should also be vertically balanced rather than pinned awkwardly to the top.

The overall composition should feel like a premium desktop application's Preferences window.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11. IMPROVE SETTINGS SPACING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create a consistent spacing rhythm.

Refine spacing between:

• section labels
• settings rows
• descriptions
• controls
• navigation groups

Avoid both:

• cramped controls
• excessive empty space

Settings should feel dense enough to be useful but relaxed enough to be comfortable.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12. REDUCE THE "CARD" FEEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The Settings page currently feels like a collection of web cards.

Move toward native desktop preferences.

Related settings should feel like a cohesive group.

Use:

• subtle surface separation
• soft grouping
• restrained separators
• rounded containers where useful

Do not put every individual setting inside a heavy card.

Do not add shadows to every row.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
13. SIDEBAR REFINEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Refine the application sidebar.

It should blend into the global background.

Reduce harsh borders.

Use subtle tonal separation.

Navigation items should have softly rounded active/hover surfaces.

The selected Settings state should use the current theme's accent very subtly.

Do NOT use bright purple blocks or saturated selection backgrounds.

Keep icons consistent in:

• size
• stroke weight
• alignment
• visual weight

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
14. TYPOGRAPHY REFINEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Perform a complete typography polish.

Use a clean system-style typeface.

Establish consistent hierarchy for:

• titles
• section headings
• navigation
• body text
• metadata
• descriptions
• labels
• tooltips

Do not make everything pure white.

Use:

Primary text:
bright but slightly softened

Secondary text:
muted

Metadata:
quiet

Section labels:
small and understated

Avoid excessive boldness.

Avoid oversized headings.

Typography should feel calm and sophisticated.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
15. GLOBAL SPACING SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Normalize spacing across the entire application.

Fix:

• inconsistent padding
• inconsistent gaps
• uneven alignment
• cramped controls
• excessive whitespace
• inconsistent toolbar spacing

Use a consistent spacing scale throughout the product.

Everything should appear intentionally placed.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
16. PDF READER POLISH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Apply the same visual system to the PDF reader.

The PDF remains the CENTER OF THE EXPERIENCE.

Reader controls should be:

• soft
• rounded
• subtle
• compact
• unobtrusive

The surrounding interface should visually disappear around the document.

Maintain the existing immersive behavior:

When idle:
controls completely disappear.

When the cursor approaches the top:
top controls smoothly appear.

When the cursor approaches the bottom:
bottom controls smoothly appear.

When the cursor approaches the left:
Pages / Outline controls can appear.

There must be NO:

• ghost toolbar
• faint background
• persistent border
• shadow remnants
• transparent toolbar remnants

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
17. FLOATING UI REFINEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Refine:

• annotation popovers
• View menu
• search interface
• bookmark controls
• page navigation
• bottom HUD
• command palette
• context menus
• dialogs

Use the new rounded geometry and surface system.

They should feel like native floating controls rather than generic web cards.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
18. ANIMATION SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Perform a complete animation refinement.

All existing animations should feel:

FAST
SMOOTH
SUBTLE
INTENTIONAL

Use refined ease-in-out / ease-out motion.

Hover:
immediate subtle transition.

Press:
subtle tactile feedback.

Menus:
short fade + tiny movement.

Panels:
smooth slide/fade.

Theme switching:
coordinated smooth transition.

Reader controls:
smooth appearance/disappearance.

Fullscreen:
seamless transition.

Do NOT use:

• bounce
• elastic animation
• exaggerated scaling
• slow transitions
• dramatic movement

The goal is for the interface to feel polished without the user consciously noticing the animation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
19. INTERACTION STATES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Audit every interactive component.

Every component should have polished:

• Default
• Hover
• Active
• Pressed
• Focus
• Selected
• Disabled
• Loading
• Error
• Success

states where applicable.

Focus states should be visible but elegant.

Use the active theme's accent carefully.

Do not rely on overly bright colors.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
20. ICONOGRAPHY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Standardize all icons.

Use one coherent icon style.

Ensure:

• consistent stroke width
• consistent size
• consistent alignment
• consistent optical weight

Do not mix icon families.

Icons should generally use neutral text colors and only adopt the theme accent when actively selected.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
21. HOME / LIBRARY REFINEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Apply the same visual polish to:

• Home
• Documents
• Recent
• Favorites
• Folders
• Search

Avoid generic dashboard aesthetics.

Do NOT add:

• statistics cards
• giant hero sections
• marketing banners
• excessive gradients
• fake analytics
• unnecessary cards

Documents should remain the focus.

Use softer document thumbnails and subtle hover states.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
22. REMOVE VISUAL NOISE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Perform a ruthless cleanup.

Reduce or remove:

• unnecessary borders
• unnecessary separators
• excessive shadows
• excessive accent colors
• overly bright icons
• redundant containers
• excessive pills
• excessive gradients
• decorative effects
• visual clutter

When spacing and hierarchy can communicate something without another box, remove the box.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
23. GLOBAL THEME CONSISTENCY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The selected theme must apply consistently to:

• Home
• Documents
• Recent
• Favorites
• Folders
• Search
• PDF Reader
• Pages
• Outline
• Annotation tools
• Toolbars
• Menus
• Popovers
• Dialogs
• Command Palette
• Settings
• Fullscreen

There must be ONE global design-token system.

Do not hardcode unrelated colors on individual screens.

Do not let old purple/blue accent values remain anywhere after the redesign.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
24. ACCESSIBILITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Maintain accessibility while making the UI softer.

Ensure:

• readable text
• adequate contrast
• sufficiently large hit targets
• visible keyboard focus
• reduced-motion support
• accessible labels for icon-only controls

Soft does NOT mean low-contrast to the point of becoming difficult to use.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
25. FINAL PROFESSIONAL DESIGN AUDIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After implementing everything above, inspect the entire application as if AuraPDF were about to ship publicly.

Look for anything that still feels:

• boxy
• sharp
• rigid
• cramped
• left-heavy
• generic
• template-like
• AI-generated
• overly colorful
• overly bright
• visually inconsistent

Fix those issues.

The final AuraPDF should feel like a carefully designed premium desktop application.

DESIGN PRINCIPLES:

Deep rather than flat black.
Muted rather than saturated.
Rounded rather than rectangular.
Soft rather than sharp.
Balanced rather than left-heavy.
Refined rather than decorative.
Premium rather than flashy.
Calm rather than futuristic.

Use the supplied visual references as aesthetic inspiration, especially for:

• deep color relationships
• rounded forms
• soft contrast
• subtle depth
• muted colors
• elegant spacing

Do NOT copy the references literally.

Do NOT introduce new features.

Do NOT reintroduce Aura AI branding.

Do NOT reintroduce Insights.

Do NOT add AI settings.

Do NOT add Storage settings.

Do NOT add Privacy settings.

Do NOT add unnecessary PDF settings.

This is the FINAL visual polish pass.

Make the existing product feel finished.