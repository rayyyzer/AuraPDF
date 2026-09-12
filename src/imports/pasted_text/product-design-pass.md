Perform a complete visual refinement and product-design polish pass across the entire AuraPDF application.

IMPORTANT:
Do NOT add major new features.
Do NOT restructure the existing information architecture.
Do NOT remove any of the existing functionality.

The goal is to make AuraPDF look and feel like a professionally designed, production-quality desktop application rather than a generic AI-generated website, template, SaaS dashboard, or knockoff of another PDF reader.

Treat this as a final high-end product design pass.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. OVERALL DESIGN DIRECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AuraPDF should feel:

• Premium
• Calm
• Refined
• Modern
• Highly intentional
• Desktop-native
• Minimal without feeling empty
• Sophisticated without being flashy
• Extremely polished
• Consistent across every screen

The design should communicate the quality level of products such as Arc, Linear, Raycast, Craft, Things, Bear, and high-end native desktop applications — WITHOUT copying any of their visual identities.

Do not make AuraPDF look like:
• A generic SaaS dashboard
• A template from a UI library
• A futuristic AI landing page
• A glassmorphism showcase
• A collection of floating cards
• A Dribbble concept that would be difficult to actually use

Every element should look like it belongs to the same carefully designed application.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. ESTABLISH A REAL DESIGN SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create one coherent global design system.

Define and consistently use:

• Primary background
• Secondary background
• Elevated surface
• Hover surface
• Active surface
• Border
• Subtle border
• Primary text
• Secondary text
• Muted text
• Disabled text
• Accent
• Accent-hover
• Destructive
• Success
• Warning

Do not use arbitrary colors on individual screens.

The entire application must derive its colors from the same semantic token system.

Avoid excessive contrast.

Use subtle tonal differences between surfaces rather than drawing borders around everything.

Borders should generally be:
• subtle
• low contrast
• purposeful

Avoid the "every element has a border" appearance.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. PROPER THEME OPTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Improve the existing Appearance settings into a genuinely polished theme system.

Provide:

• System
• Light
• Dark

Make these real global themes.

Changing the theme must update the ENTIRE application:

• Home
• Library
• Document views
• PDF reader
• Toolbars
• Menus
• Popovers
• Dialogs
• Search
• Pages panel
• Outline
• Annotation tools
• Command palette
• Settings
• Empty states
• Loading states
• Error states

There must be ONE global theme source.

Do not allow individual pages to have their own disconnected theme logic.

System mode should follow the operating system appearance.

Light mode should feel intentionally designed, NOT simply "dark mode with white backgrounds."

Dark mode should feel rich and comfortable for long reading sessions.

Do not use pure #000000 backgrounds everywhere.

Likewise, avoid excessive pure-white surfaces in light mode.

Create a refined neutral palette with carefully controlled contrast.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. ACCENT COLOR SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Introduce a tasteful accent-color system.

Provide a small number of professionally selected accent options rather than a giant color picker.

For example:

• Blue
• Violet
• Teal
• Green
• Orange

Keep the choices restrained and sophisticated.

The accent should be used primarily for:

• Active states
• Selection
• Focus
• Important actions
• Progress
• Links
• Current page indicators
• Interactive highlights

Do NOT flood the UI with the accent color.

The interface should remain predominantly neutral.

Accent color must remain accessible against both light and dark themes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. TYPOGRAPHY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Perform a complete typography refinement.

Use a modern, highly legible system-style font stack.

Establish a proper type scale for:

• Page titles
• Section titles
• Navigation
• Body
• Secondary text
• Metadata
• Labels
• Tooltips
• Buttons
• Inputs

Do not make headings unnecessarily huge.

Avoid excessive font weights.

Use typography hierarchy primarily through:

• Size
• Weight
• Opacity
• Spacing

instead of adding decorative elements.

PDF reading typography should prioritize readability over branding.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. SPACING SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Normalize spacing throughout the application.

Create a consistent spacing rhythm.

Remove:
• Random padding
• Inconsistent gaps
• Elements that are too tightly packed
• Elements floating too far apart
• Visually accidental whitespace

Use deliberate spacing between:

• Navigation groups
• Toolbar controls
• Panels
• Cards where cards actually exist
• Settings sections
• Form controls
• PDF controls

The interface should feel balanced at a glance.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. ROUNDED CORNERS — USE THEM INTENTIONALLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Introduce rounded corners where they improve the interface.

Do NOT round everything.

Use moderate corner radii for:

• Buttons
• Inputs
• Search fields
• Menus
• Popovers
• Dialogs
• Selection controls
• Thumbnails
• Small panels

Larger surfaces can use slightly larger radii when appropriate.

Avoid:
• Extremely rounded pill-shaped everything
• Excessive 20–30px radius
• Cards that look like floating bubbles

The radius system should feel coherent.

Use fewer, consistent radius values instead of random values.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. DEPTH AND SURFACES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Replace excessive shadows with subtle depth.

Use a combination of:

• Surface contrast
• Very subtle borders
• Soft shadows only where necessary
• Background separation
• Layering

Menus and popovers should feel like they sit above the interface.

Dialogs should feel appropriately elevated.

The PDF canvas should remain the visual center.

Do NOT turn the application into a glassmorphism interface.

Avoid:
• Huge blurred backgrounds
• Heavy drop shadows
• Excessive transparency
• Neon glows
• Decorative gradients everywhere

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. GLOBAL ANIMATION SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Make animations significantly smoother and more intentional.

Every animation should feel like part of a coherent motion system.

Use short, refined transitions for:

• Hover
• Press
• Focus
• Menu opening
• Menu closing
• Popover opening
• Panel opening
• Panel closing
• Search results
• Page transitions
• Theme changes
• Dialogs
• Toolbars appearing
• Reader controls appearing/disappearing

Animations should generally feel:

• Fast
• Smooth
• Subtle
• Responsive

Avoid:
• Bouncy UI
• Excessive spring animations
• Slow transitions
• Dramatic zooms
• Unnecessary movement

Nothing should feel like it is "sliding around for the sake of animation."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. IMMERSIVE PDF READER POLISH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The PDF reader is the most important part of AuraPDF.

Give it the highest level of visual refinement.

The document should remain the dominant visual element.

When reader UI is hidden:

THE UI MUST ACTUALLY DISAPPEAR.

No:
• ghost backgrounds
• faint borders
• persistent shadows
• transparent toolbar remnants
• floating controls permanently visible

When the cursor approaches the relevant edge, controls should smoothly fade/slide into view.

Top:
minimal reader toolbar.

Left:
Pages / Outline panel trigger.

Bottom:
page navigation + Undo / Redo / Rotate.

Controls should feel attached to the reading environment rather than floating like random web widgets.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11. TOOLBAR POLISH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Refine all toolbar controls.

Icons should:

• Have consistent stroke weight
• Have consistent visual size
• Align perfectly
• Use consistent hit areas
• Have subtle hover states
• Have clear active states

Do not mix icon styles.

Buttons should have comfortable clickable areas without appearing oversized.

Hover states should be subtle.

Pressed states should provide immediate tactile feedback.

Tooltips should be elegant and unobtrusive.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12. SETTINGS POLISH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Make Settings feel like a real desktop application's settings screen.

Keep it intentionally minimal.

Do not add filler categories.

Keep useful settings such as:

General
Appearance
Keyboard Shortcuts
Account (only if functional)
About / Help (only if functional)

Do NOT introduce:

• AI settings
• Storage settings
• Privacy settings
• PDF preference clutter
• Fake settings
• Decorative settings cards

Settings should feel functional rather than promotional.

Use clean rows, subtle separators, clear hierarchy, and excellent spacing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
13. HOME / LIBRARY POLISH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Refine Home and Library so they feel like part of the same application.

Avoid generic SaaS dashboard patterns.

Do not create:
• Giant hero sections
• Marketing copy
• Statistics cards
• Fake analytics
• Excessive card grids
• Gradient banners

Prioritize:

• Documents
• Recent files
• Folders
• Search
• Useful actions

Make document thumbnails clean and consistent.

Hovering a document should provide subtle feedback.

Context menus should feel native and polished.

Empty states should be simple and useful.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
14. INTERACTION STATES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every interactive component must have carefully designed states:

• Default
• Hover
• Active
• Pressed
• Focused
• Disabled
• Selected
• Loading
• Error
• Success where appropriate

Do not rely solely on color changes.

Use subtle:
• opacity
• background shifts
• borders
• elevation
• scale changes where appropriate

Keyboard focus must remain clearly visible.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
15. MICRO-INTERACTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add small interactions that make the product feel finished.

Examples:

• Bookmark icon smoothly transitions when activated
• Page number control responds naturally to interaction
• Annotation tool selection has a refined active state
• Search result selection feels immediate
• Panels animate smoothly
• Buttons provide subtle press feedback
• Menus appear naturally
• Theme switching feels coordinated
• Fullscreen transition feels seamless
• Toolbar reveal/hide feels effortless

Keep these details subtle.

The goal is:

"Why does this feel so polished?"

Not:

"Look at all the animations."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
16. VISUAL CONSISTENCY AUDIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Audit the ENTIRE application for inconsistencies.

Fix:

• Different corner radii
• Different icon sizes
• Different button heights
• Different shadows
• Different border treatments
• Different spacing systems
• Different typography
• Inconsistent hover behavior
• Inconsistent animation timing
• Inconsistent surface colors
• Misaligned controls
• Uneven padding
• Visually awkward empty space

Everything should feel like it was designed by ONE experienced product designer.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
17. RESPONSIVENESS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ensure the interface remains polished at different desktop window sizes.

Do not simply shrink everything.

Prioritize the document canvas.

Toolbars and panels should adapt gracefully.

Avoid:
• Clipped controls
• Overlapping menus
• Broken spacing
• Tiny unreadable controls
• Unnecessary horizontal scrolling

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
18. ACCESSIBILITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Maintain strong accessibility while polishing the visual design.

Ensure:

• Text remains readable
• Interactive elements have sufficient hit areas
• Keyboard focus is visible
• Contrast remains accessible
• Reduced-motion preference is respected
• Animations can be reduced
• Tooltips do not replace necessary accessibility labels

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
19. FINAL PRODUCT QUALITY BAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After making these changes, review the entire application as if you were preparing AuraPDF for a public launch.

Ask:

"Does this look like a real, professionally designed desktop application?"

"Would someone mistake this for a template or AI-generated UI?"

"Are there any components that look generic?"

"Are there any places where the UI feels too busy?"

"Are there inconsistent radii, spacing, shadows, colors, or typography?"

"Do the animations feel natural?"

"Does the PDF remain the visual center?"

"Does the light theme look genuinely designed?"

"Does the dark theme feel premium and comfortable?"

"Do all screens feel like they belong to the same product?"

Fix every issue you identify.

Do NOT add unnecessary features during this pass.

Do NOT introduce AI branding.

Do NOT reintroduce Insights.

Do NOT add marketing-style UI.

Do NOT add decorative gradients just to make the interface look impressive.

Do NOT overuse glassmorphism.

The final result should be:

PREMIUM
REFINED
QUIET
FAST
COHESIVE
DESKTOP-NATIVE
PROFESSIONAL

The quality should come from exceptional spacing, typography, color, hierarchy, interaction design, motion, and consistency — not visual gimmicks.