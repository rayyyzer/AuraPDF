Refine the current AuraPDF immersive PDF reader.

This iteration focuses ONLY on:
1. Moving Command Palette settings into Settings
2. Mapping/documenting all reader commands and shortcuts
3. Making idle UI completely disappear
4. Making fullscreen dramatically more immersive

Do not redesign unrelated parts of the application.

==================================================
1. COMMAND PALETTE → SETTINGS
==================================================

Remove the Command Palette as a permanently visible or discoverable UI element.

Do NOT add a visible Command Palette button to the PDF reader.

Instead, make Command Palette a configurable feature inside:

Settings → Keyboard Shortcuts / Commands

Create a clean settings section called:

Keyboard Shortcuts

Inside it, include a toggle:

Command Palette
[ On ]

Description:

"Quickly access AuraPDF commands with a keyboard shortcut."

Show the assigned shortcut:

Ctrl + K
or
Cmd + K

depending on platform.

Allow the user to change the shortcut if the application architecture supports customizable shortcuts.

==================================================
2. MAP ALL COMMANDS
==================================================

Create a complete keyboard-shortcut system for the PDF reader.

Every important reader action should have a clearly defined command.

Organize them in Settings under categories.

------------------------------------------
NAVIGATION
------------------------------------------

Next page
→ Right Arrow
→ Page Down

Previous page
→ Left Arrow
→ Page Up

Go to first page
→ Home

Go to last page
→ End

Go to page
→ Ctrl/Cmd + G

------------------------------------------
VIEW
------------------------------------------

Single-page view
→ Ctrl/Cmd + 1

Two-page view
→ Ctrl/Cmd + 2

Continuous view
→ Ctrl/Cmd + 3

Two-page continuous
→ Ctrl/Cmd + 4

Fit page
→ Ctrl/Cmd + 0

Fit width
→ Ctrl/Cmd + Shift + 0

Zoom in
→ Ctrl/Cmd + +

Zoom out
→ Ctrl/Cmd + -

Reset zoom / Actual size
→ Ctrl/Cmd + Shift + 0

Fullscreen
→ F

------------------------------------------
DOCUMENT
------------------------------------------

Search document
→ Ctrl/Cmd + F

Bookmark current page
→ B

Open Pages panel
→ P

Open Outline
→ O

------------------------------------------
ANNOTATION
------------------------------------------

Open annotation tools
→ A

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

Shape
→ Shift + D

------------------------------------------
EDITING
------------------------------------------

Undo
→ Ctrl/Cmd + Z

Redo
→ Ctrl/Cmd + Shift + Z

------------------------------------------
ROTATION
------------------------------------------

Rotate clockwise
→ R

------------------------------------------
PANELS / UI
------------------------------------------

Toggle Pages/Outline panel
→ P

Close active panel
→ Escape

Hide/show reader UI
→ Tab

------------------------------------------
COMMAND PALETTE
------------------------------------------

Open Command Palette
→ Ctrl/Cmd + K

==================================================
3. DO NOT FORCE SHORTCUTS THAT CONFLICT
==================================================

Use sensible keyboard shortcuts.

If a shortcut conflicts with browser/OS behavior or text-entry behavior, choose the most appropriate alternative.

Do not blindly implement a shortcut if it would interfere with:

- Text input
- PDF text selection
- Browser shortcuts
- Accessibility
- Native OS behavior

The command system should intelligently detect when the user is typing into an input field.

For example:

If the user is typing in Search:

R should type "r"

It should NOT rotate the PDF.

If the user is typing a note:

T should type text

It should NOT activate the Text tool.

==================================================
4. SETTINGS → KEYBOARD SHORTCUTS UI
==================================================

Design a polished Keyboard Shortcuts settings page.

Structure it like:

Keyboard Shortcuts

Search shortcuts...

NAVIGATION
────────────────────────────
Next page                    →
Previous page                ←
Go to page                   ⌘G
First page                   Home
Last page                    End

VIEW
────────────────────────────
Single page                  ⌘1
Two pages                    ⌘2
Continuous                   ⌘3
Two-page continuous          ⌘4
Fit page                     ⌘0
Fit width                    ⇧⌘0
Fullscreen                   F

DOCUMENT
────────────────────────────
Search                       ⌘F
Bookmark page                B
Pages panel                  P
Outline                      O

ANNOTATION
────────────────────────────
Highlight                    H
Underline                    U
Strike                       S
Pen                          D
Text                         T
Note                         N

EDIT
────────────────────────────
Undo                         ⌘Z
Redo                         ⇧⌘Z

ROTATION
────────────────────────────
Rotate clockwise             R

COMMAND PALETTE
────────────────────────────
Open Command Palette         ⌘K

Keep the settings page extremely clean.

Allow users to see what every shortcut does.

==================================================
5. COMMAND PALETTE BEHAVIOR
==================================================

The Command Palette still exists as a feature.

It is simply accessed by:

Ctrl/Cmd + K

Do NOT expose it as a permanent button.

The palette should contain ALL mapped commands.

Example:

┌──────────────────────────────────────┐
│ Search commands...                   │
├──────────────────────────────────────┤
│ Navigation                           │
│   Go to page                    ⌘G   │
│   Next page                      →   │
│   Previous page                  ←   │
│                                      │
│ View                                 │
│   Two-page view                 ⌘2   │
│   Fit width                     ⇧⌘0   │
│   Fullscreen                     F   │
│                                      │
│ Document                             │
│   Search                         ⌘F  │
│   Bookmark page                  B   │
└──────────────────────────────────────┘

It should be searchable.

Typing "rotate" → Rotate clockwise

Typing "bookmark" → Bookmark current page

Typing "two" → Two-page view

Typing "page 37" → Go to page 37

Typing "full" → Fullscreen

Typing "undo" → Undo

Typing "highlight" → Highlight

The command palette should be a command launcher, not a second navigation system.

==================================================
6. IDLE UI — COMPLETELY DISAPPEAR
==================================================

This is extremely important.

The current UI remains slightly visible when idle.

Fix this completely.

When the reader is idle:

THE UI SHOULD FULLY DISAPPEAR.

Not:

- Dimmed
- Semi-transparent
- Faded but still visible
- Slightly visible
- Ghosted

It should become visually absent.

This includes:

- Top toolbar
- Bottom page controls
- Any floating controls
- Temporary UI chrome

The PDF should be the ONLY visible interface.

==================================================
7. IDLE TRANSITION
==================================================

Use a smooth transition.

After a short period of inactivity:

Top controls:

opacity 1 → 0

Bottom controls:

opacity 1 → 0

Floating controls:

opacity 1 → 0

Also remove pointer interaction from invisible controls where appropriate.

Do NOT abruptly remove them.

Use an elegant ease-out transition.

The transition should feel like the UI is melting into the document.

Avoid flashy animations.

==================================================
8. REVEALING THE UI
==================================================

When the user moves the cursor:

Toward the TOP:

Reveal the top toolbar smoothly.

Toward the BOTTOM:

Reveal the bottom page/navigation controls.

Toward the LEFT EDGE:

Allow the Pages/Outline panel trigger to appear.

Do NOT reveal every control just because the cursor moved.

Reveal the region the user is interacting with.

Example:

Cursor moves to top → top controls appear.

Cursor moves to bottom → bottom controls appear.

Cursor moves away → they disappear again after inactivity.

==================================================
9. CURSOR BEHAVIOR
==================================================

When the UI is hidden:

The reader should feel completely clean.

Do not leave floating buttons behind.

Do not leave faint borders.

Do not leave empty toolbar backgrounds.

Do not leave shadows.

Do not leave transparent containers.

Nothing should visually indicate the hidden toolbar.

==================================================
10. FULLSCREEN — TRUE IMMERSIVE MODE
==================================================

Redesign Fullscreen so it is much more immersive.

Current fullscreen still exposes the application-level top area and the other open PDF tabs.

That must be removed.

When Fullscreen is activated:

HIDE EVERYTHING THAT IS NOT PART OF THE CURRENT PDF READING EXPERIENCE.

Specifically hide:

- Application window chrome where technically possible
- Other open PDF tabs
- PDF tab strip
- Application navigation
- Home navigation
- Main sidebar
- Any workspace-level header
- Any browser-like document tab area
- Any unrelated application controls

The current PDF should occupy the ENTIRE available screen.

==================================================
11. NO OTHER PDF TABS IN FULLSCREEN
==================================================

This is a critical requirement.

If multiple PDFs are open:

Normal reader:

[ Report.pdf ] [ Notes.pdf ] [ Research.pdf ]

Fullscreen:

NONE OF THESE TABS SHOULD BE VISIBLE.

Only the CURRENT PDF should remain.

The user should not see the existence of other open documents while in fullscreen.

Fullscreen is a focused single-document environment.

The other tabs still exist internally.

Exiting fullscreen restores them exactly as they were.

Do NOT close the other PDFs.

Simply hide the tab interface while fullscreen is active.

==================================================
12. FULLSCREEN PDF CANVAS
==================================================

The current PDF should expand to use essentially the entire screen.

Do not leave large unused margins caused by application chrome.

Use the full viewport intelligently.

The PDF should scale according to the selected viewing mode.

Single page:

Center the page beautifully.

Two page:

Center the page pair.

Continuous:

Use the entire available width intelligently.

Fit width:

Use the full available horizontal space.

==================================================
13. FULLSCREEN TOOLBAR
==================================================

Fullscreen should NOT show the normal top application toolbar.

Instead, use the same immersive reader controls that appear only when the cursor reaches the top edge.

When idle:

Nothing.

Move cursor to top:

A minimal reader toolbar elegantly fades in.

Move cursor away:

It disappears completely.

This toolbar should contain only the essential current-document controls.

==================================================
14. FULLSCREEN BOTTOM CONTROLS
==================================================

Likewise, the bottom page navigation should disappear completely when idle.

When the cursor approaches the bottom:

Show:

Undo
Redo
Rotate
Previous page
Current page / total pages
Next page

Then fade away again.

The controls should float over the document workspace without creating a permanent footer.

==================================================
15. FULLSCREEN ESCAPE
==================================================

Escape should:

- Exit fullscreen
- Close Command Palette
- Close popovers
- Close temporary panels

Use sensible priority.

For example:

Command Palette open → Escape closes palette first.

Fullscreen active with no overlay → Escape exits fullscreen.

==================================================
16. IMMERSIVE TRANSITIONS
==================================================

Make transitions between:

Normal reader
→ Fullscreen

and

Fullscreen
→ Normal reader

feel seamless.

Do not cause:

- Page jumps
- Rotation changes
- Zoom resets
- View-mode changes
- Scroll-position changes
- Toolbar flickering

The document should remain exactly where the user was reading.

==================================================
17. VIEW STATE MUST REMAIN INDEPENDENT
==================================================

Maintain independent state for:

- Page
- Scroll position
- Zoom
- Rotation
- View mode
- Fullscreen
- Panels

Changing one must NOT unexpectedly change another.

Examples:

Fullscreen should not reset zoom.

Two-page view should not reset rotation.

Rotation should not change fullscreen.

Opening Pages should not change page position.

Closing Pages should not reset zoom.

==================================================
18. FINAL VISUAL HIERARCHY
==================================================

The immersive reader should now have:

TOP:

← Document.pdf                         ⌕  ✎  ◫  🔖  ⛶  ⋯

But ONLY while the cursor is near the top.

LEFT:

Pages / Outline panel
(hidden unless explicitly opened)

CENTER:

PDF

BOTTOM:

↶  ↷  ⟳       ‹  12 / 48  ›

But ONLY while the cursor is near the bottom.

WHEN IDLE:

             PDF

Nothing else.

==================================================
19. FINAL FULLSCREEN EXPERIENCE
==================================================

Fullscreen should feel like:

The user pressed a button and AuraPDF disappeared.

No:

- Other PDF tabs
- App navigation
- Home
- Sidebar
- Workspace header
- Browser-like chrome
- Persistent controls

Only the current document remains.

Controls appear only when the cursor approaches the relevant edge.

Then disappear completely.

==================================================
20. DO NOT ADD FEATURES
==================================================

Do not add:

- Insights
- Aura AI
- Permanent AI sidebar
- New navigation
- New dashboards
- New major document features

This iteration is about:

CONTROL ORGANIZATION
+
KEYBOARD COMMANDS
+
IMMERSION
+
FULLSCREEN

Make those four things exceptionally polished.

==================================================
FINAL PRODUCT PRINCIPLE
==================================================

AuraPDF should feel like this:

Open PDF
↓
Everything else disappears
↓
Read
↓
Controls fade away
↓
Move cursor
↓
Controls elegantly return
↓
Use them
↓
They disappear again

Fullscreen should take this even further:

CURRENT PDF ONLY
FULL SCREEN
ZERO OTHER DOCUMENT TABS
ZERO APPLICATION CHROME
ZERO DISTRACTIONS

The PDF is the entire experience.