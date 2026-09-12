Refine the existing AuraPDF UI based on the current design.

This is a VISUAL REFINEMENT PASS ONLY.
Do not add new features.
Do not change the existing information architecture or functionality.

The current UI feels too left-heavy, slightly cramped in places, and the accent colors are far too bright/saturated.

Make the entire application feel more premium, balanced, calm, and professionally designed.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. REBALANCE AND CENTER THE UI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Rework the layout so the content feels properly balanced within the available window.

The current Settings page is visually biased toward the left because the content begins too close to the navigation columns.

Improve the overall composition:

• Keep the application sidebar on the left.
• Keep the Settings category navigation beside it.
• Give the main Settings content significantly more breathing room.
• Center the MAIN CONTENT AREA within its available content region.
• Do not simply center everything relative to the entire browser/window.
• Each section should be visually centered within the space allocated to it.

The main Settings content should have a sensible maximum width.

Do not allow settings controls to stretch unnecessarily across the entire screen.

Aim for a composition similar to a polished native desktop application's preferences window.

The hierarchy should feel:

APP NAVIGATION → SETTINGS NAVIGATION → CENTERED SETTINGS CONTENT

rather than:

APP NAVIGATION → HUGE EMPTY SPACE → LEFT-ALIGNED SETTINGS CONTENT.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. IMPROVE VERTICAL BALANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The current settings sections sit too high and leave an awkward amount of unused space.

Balance the page vertically.

Keep the content comfortably positioned within the viewport rather than pinned to the top.

Use consistent vertical rhythm between:

• Appearance
• Startup
• Safety
• Accessibility

Section headings should have enough breathing room above and below them.

The individual settings rows should feel substantial but not oversized.

Avoid making the page feel sparse.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. AMOLED DARK THEME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Replace the current blue-gray dark background with a sophisticated AMOLED-inspired dark system.

IMPORTANT:

Do NOT simply make every background #000000.

Create a layered near-black palette.

Suggested direction:

Application background:
#050505 / #060606

Primary surfaces:
#0A0A0C

Elevated surfaces:
#0F0F12

Hover surfaces:
#141418

Active surfaces:
#18181D

Borders:
extremely subtle neutral dark-gray

The overall impression should be:

deep black → slightly elevated black → subtle gray-black layers.

The interface should look exceptionally clean on an OLED/AMOLED display.

Avoid blue-tinted backgrounds.

Avoid purple-tinted backgrounds.

Avoid obvious gradients.

Avoid glassmorphism.

Avoid glowing surfaces.

The PDF reader should particularly benefit from this AMOLED treatment so the surrounding UI visually disappears around the document.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. LIGHT THEME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Do not neglect Light mode.

Light mode should be a deliberately designed premium theme rather than simply:

dark background → white background.

Use a sophisticated neutral palette with slightly warm/cool neutral separation.

Keep surfaces restrained and avoid excessive cards.

Both themes should feel like two versions of the SAME design system.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. REPLACE THE CURRENT ACCENT COLORS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The current accent swatches are too bright and saturated.

They look like generic UI color presets.

Replace them with sophisticated, muted accent colors.

Use approximately 5 curated choices:

• Muted Indigo
• Slate Blue
• Deep Teal
• Sage Green
• Muted Amber

The colors should feel:

subtle
premium
slightly desaturated
professional
comfortable for long sessions

Avoid:

• Neon purple
• Electric blue
• Bright cyan
• Highly saturated green
• Bright orange
• Fluorescent colors

The accent should NEVER dominate the UI.

Use it primarily for:

• Selected navigation item
• Focus rings
• Active controls
• Selected text
• Bookmark state
• Current page indicator
• Links
• Important interactive states

Most of the interface should remain neutral.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. ACCENT COLOR PRESENTATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Redesign the accent selector.

The current circles look like colorful dots placed inside the UI.

Make them feel like an intentional design-system control.

Use restrained circular swatches with:

• consistent sizing
• subtle borders
• subtle hover feedback
• elegant selected state

The selected accent should use a thin, refined outline/ring rather than a thick glowing border.

Do NOT create a bright glow around the selected color.

The selected state should be obvious but understated.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. SETTINGS ROW REFINEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Refine the settings controls themselves.

The current settings cards feel slightly too much like generic web cards.

Make them feel more like native application preference rows.

Use:

• subtle surface separation
• very restrained borders
• consistent height
• consistent internal padding
• clear left/right alignment
• subtle hover states

Avoid unnecessary shadows.

Avoid excessive rounded containers.

Where multiple settings belong to the same section, visually group them without making every row look like a standalone floating card.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. ROUNDED CORNERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Introduce a consistent radius system.

Use rounded corners where appropriate, but do NOT make everything pill-shaped.

Recommended hierarchy:

Small controls:
6–8px

Inputs / menus / popovers:
8–10px

Larger panels:
10–12px

Avoid excessive 16–24px rounding throughout the interface.

The UI should feel refined rather than bubbly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. TYPOGRAPHY REFINEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Improve typography hierarchy.

Make section headings slightly more refined and understated.

Use:

• Stronger hierarchy
• Better letter spacing
• More consistent weights
• Slightly muted secondary descriptions

Avoid making labels excessively bright white.

Primary text should be clear.

Secondary text should be visibly quieter.

Section labels such as:

APPEARANCE
STARTUP
SAFETY
ACCESSIBILITY

should feel like subtle organizational markers rather than large headings.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. SIDEBAR BALANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Refine the left application sidebar without redesigning it.

The sidebar should feel integrated with the AMOLED background.

Reduce visual separation between the sidebar and the application background.

Use subtle surface contrast instead of prominent borders.

The active Settings item should use the selected accent color very subtly.

Do not make the active state a bright purple block.

The user/profile area at the bottom should also feel integrated rather than like a separate card.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11. TOP APPLICATION CHROME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Refine the top application bar so it visually belongs to the same AMOLED system.

Reduce unnecessary visual noise.

Use extremely subtle borders/dividers.

Icons should have consistent sizing and stroke weight.

Avoid bright icon colors except for genuinely active states.

The top bar should feel almost invisible rather than competing with the Settings content.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12. ANIMATION REFINEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Make all existing animations smoother and more premium.

Use subtle ease-out / ease-in-out motion.

Hover:
very subtle and immediate.

Menus:
short fade + slight movement.

Panels:
smooth but quick.

Theme switching:
smooth coordinated transition.

Accent switching:
subtle transition across affected UI.

Settings navigation:
quiet transition without excessive movement.

Avoid:

• bouncing
• overshooting
• dramatic scaling
• slow transitions
• excessive blur
• flashy effects

The interface should feel fast and tactile.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
13. GLOBAL CONSISTENCY PASS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Apply these improvements across the ENTIRE AuraPDF application, not just Settings.

Audit:

Home
Documents
Recent
Favorites
Folders
Search
PDF Reader
Pages panel
Outline
Annotation tools
Menus
Popovers
Dialogs
Command Palette
Settings
Fullscreen mode

Everything should share:

• the same AMOLED foundation
• the same neutral palette
• the same accent system
• the same typography
• the same radius system
• the same spacing rhythm
• the same border treatment
• the same animation language
• the same interaction states

Do not allow individual screens to look like separate templates.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
14. PREMIUM VISUAL QUALITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The final result should NOT look like:

• a generic SaaS dashboard
• a Figma template
• an AI-generated interface
• a colorful productivity app
• a glassmorphism concept
• a Dribbble mockup

It should look like a real application that has gone through several rounds of professional product design.

The design language should be:

DARK
QUIET
PRECISE
BALANCED
MINIMAL
PREMIUM
NATIVE
REFINED

Use visual restraint as the primary design principle.

When unsure between adding something and removing something, prefer the simpler solution.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
15. FINAL VISUAL CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After implementing the refinement:

Review the entire UI at normal desktop size.

Specifically check:

• Is the main content properly centered?
• Does the layout feel balanced horizontally?
• Does the vertical spacing feel intentional?
• Does the AMOLED background look genuinely deep and premium?
• Are the accent colors muted enough?
• Are there any overly bright elements?
• Are there unnecessary borders?
• Are there unnecessary cards?
• Are corner radii consistent?
• Are controls aligned?
• Do the themes feel cohesive?
• Do animations feel smooth?
• Does the UI feel like a real desktop application?

Fix anything that still looks visually accidental.

Do NOT add features.

Do NOT add decorative effects.

Focus entirely on making the existing AuraPDF experience look exceptionally polished.