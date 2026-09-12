Refine the AuraPDF Settings experience.

This is a cleanup pass focused on removing unnecessary settings and making the remaining settings actually useful.

Do NOT add features simply to make Settings look more complete.

AuraPDF should have a small, purposeful settings area rather than a generic SaaS settings dashboard.

==================================================
1. REMOVE UNNECESSARY SETTINGS
==================================================

Completely remove these settings/categories:

- AI settings
- AI preferences
- AI configuration
- Storage
- Storage management
- Privacy
- PDF Settings
- PDF preferences
- Notifications
- Subscription
- Billing
- Integrations
- Developer settings
- Experimental features
- Any other generic SaaS settings that are not currently necessary

Do not replace them with fake or placeholder settings.

There should be no AI-related settings anywhere in Settings.

AI is a product capability, not a Settings category.

==================================================
2. FINAL SETTINGS STRUCTURE
==================================================

Keep Settings extremely simple.

Use only:

GENERAL

- Appearance
- Startup behavior
- Confirm destructive actions
- Reduced motion

KEYBOARD

- Keyboard shortcuts
- Command Palette shortcut

ACCOUNT

Only show Account if AuraPDF actually has an account/authentication system.

OTHER

- About AuraPDF
- Help / Feedback

Do not create unnecessary categories.

==================================================
3. APPEARANCE
==================================================

Fix the current theme synchronization problem.

The Appearance setting MUST control the actual AuraPDF application theme.

Provide:

Appearance

Theme

○ System
○ Light
○ Dark

When the user changes the theme:

THE ENTIRE APPLICATION MUST UPDATE.

This includes:

- Settings
- Home
- Document library
- PDF reader
- Toolbars
- Menus
- Popovers
- Command palette
- Empty states
- Dialogs
- Buttons
- Inputs
- Panels
- Scrollbars where appropriate
- Any other AuraPDF UI

There must be NO situation where Settings changes theme but another part of the application remains in the previous theme.

==================================================
4. SYSTEM THEME
==================================================

System should follow the operating system's current light/dark preference.

If the OS changes theme while AuraPDF is open:

AuraPDF should update automatically when possible.

Example:

System = Light
→ AuraPDF Light

OS switches to Dark
→ AuraPDF Dark

System = Dark
→ AuraPDF Dark

Do not treat System as a third visual theme.

It means:

"Follow my system."

==================================================
5. THEME PERSISTENCE
==================================================

If the user manually selects:

Light

or

Dark

remember that preference.

When AuraPDF is reopened, restore the user's choice.

If the user selects System, follow the system preference instead.

Do not reset the theme on reload.

==================================================
6. THEME TRANSITION
==================================================

When changing between Light and Dark:

Use a subtle, coordinated transition.

Do not animate every individual element separately.

The entire interface should transition smoothly as one visual system.

Keep the transition short.

Avoid flashy effects.

==================================================
7. APPEARANCE UI
==================================================

Do not create large visual theme cards.

Use a clean compact selector.

Example:

Appearance

Theme

[ System ] [ Light ] [ Dark ]

The selected option should have a clear but subtle active state.

Keep this section visually lightweight.

==================================================
8. GENERAL SETTINGS
==================================================

Only include settings that provide genuine everyday value.

Include:

------------------------------------------
Startup
------------------------------------------

"Reopen last session"

Toggle:

[ On ]

When enabled, reopening AuraPDF should restore the user's previously open documents/tabs and their relevant reading state where possible.

If disabled:

Start at the normal Home/document library.

------------------------------------------
Destructive actions
------------------------------------------

"Confirm before deleting"

Toggle:

[ On ]

When enabled, destructive actions such as deleting a document require confirmation.

------------------------------------------
Accessibility
------------------------------------------

"Reduce motion"

Toggle:

[ Off ]

When enabled:

- Reduce non-essential transitions
- Remove decorative animations
- Keep functional state changes clear
- Respect the user's system reduced-motion preference where available

Do not add additional accessibility settings unless genuinely necessary.

==================================================
9. KEYBOARD SHORTCUTS
==================================================

Keep Keyboard Shortcuts as one of the most useful sections.

Show the complete AuraPDF shortcut map.

Organize it clearly:

NAVIGATION

Next page
→ Right Arrow / Page Down

Previous page
→ Left Arrow / Page Up

First page
→ Home

Last page
→ End

Go to page
→ Ctrl/Cmd + G

VIEW

Single page
→ Ctrl/Cmd + 1

Two-page
→ Ctrl/Cmd + 2

Continuous
→ Ctrl/Cmd + 3

Two-page continuous
→ Ctrl/Cmd + 4

Fit page
→ Ctrl/Cmd + 0

Fit width
→ Ctrl/Cmd + Shift + 0

Fullscreen
→ F

DOCUMENT

Search
→ Ctrl/Cmd + F

Bookmark page
→ B

Pages
→ P

Outline
→ O

ANNOTATION

Highlight
→ H

Underline
→ U

Strikethrough
→ S

Pen
→ D

Text
→ T

Note
→ N

EDIT

Undo
→ Ctrl/Cmd + Z

Redo
→ Ctrl/Cmd + Shift + Z

ROTATION

Rotate
→ R

INTERFACE

Hide/show reader UI
→ Tab

Close panel/menu
→ Escape

COMMAND PALETTE

Open Command Palette
→ Ctrl/Cmd + K

Make this list searchable.

Allow users to customize shortcuts if the implementation supports it.

If shortcut customization is not yet implemented, do NOT create fake editable controls.

==================================================
10. COMMAND PALETTE SETTING
==================================================

Do not create a separate "Command Palette" category.

Command Palette belongs under Keyboard Shortcuts.

Show:

Command Palette

Shortcut
Ctrl/Cmd + K

[Change shortcut]

If enabled/disabled functionality exists, provide a simple toggle.

Otherwise, do not invent one.

The Command Palette itself remains hidden until:

Ctrl/Cmd + K

is pressed.

==================================================
11. ABOUT
==================================================

Keep About extremely minimal.

Show:

AuraPDF

Version X.X.X

A short product description if useful.

Links/actions:

- Help
- Send feedback
- Report a problem

Do not create a giant About page.

==================================================
12. ACCOUNT
==================================================

Only show Account if the application actually supports authentication.

If authentication exists, keep it simple:

- Profile
- Email
- Sign out

Do NOT add:

- Subscription dashboards
- Storage quotas
- Billing panels
- Marketing plans
- Usage analytics

unless these are genuinely required by the product.

==================================================
13. SETTINGS VISUAL DESIGN
==================================================

Settings should feel like part of the application, not a generic SaaS administration dashboard.

Use:

- Narrow content width
- Clear section headings
- Compact rows
- Consistent spacing
- Simple controls
- Subtle separators
- Minimal cards

Avoid:

- Huge settings cards
- Decorative illustrations
- Excessive descriptions
- Dashboard statistics
- Giant headers
- Marketing language

Example structure:

Settings

GENERAL
────────────────────────────

Appearance
Theme                 System ▾

Startup
Reopen last session        ●

Safety
Confirm before deleting    ●

Accessibility
Reduce motion              ○


KEYBOARD
────────────────────────────

Keyboard shortcuts
View and customize shortcuts              ›


ABOUT
────────────────────────────

About AuraPDF                              ›

==================================================
14. REMOVE VISUAL CLUTTER
==================================================

Settings should NOT feel empty because we removed features.

Instead, make the remaining settings beautifully spaced and deliberate.

Do not add filler settings.

A small Settings page is intentional.

==================================================
15. IMPORTANT THEME IMPLEMENTATION PRINCIPLE
==================================================

Appearance is a GLOBAL application setting.

Changing it must update the same theme state used by every AuraPDF surface.

Do NOT implement theme independently inside individual pages.

There should be one application-wide theme source.

Therefore:

Settings changes theme
↓
Global theme changes
↓
Entire application updates

No page should maintain its own independent light/dark state.

==================================================
16. FINAL SETTINGS PHILOSOPHY
==================================================

AuraPDF Settings should answer only practical questions:

"What should the app look like?"
→ Appearance

"What should happen when I open it?"
→ Startup

"Do I want confirmation before destructive actions?"
→ General

"How do I control the app with my keyboard?"
→ Keyboard Shortcuts

"Who am I?"
→ Account, only if needed

"What version am I running / where do I get help?"
→ About

Everything else should stay out until there is a real product reason for it.

Do not add gimmicks.

Do not add settings simply because other SaaS products have them.

Make the Settings experience small, clean, and genuinely useful.