Refine the current AuraPDF immersive PDF reader toolbar and control layout.

This is a focused cleanup and restructuring pass.

Do NOT redesign the entire reader.
Do NOT add new major features.
Preserve the current immersive PDF experience.

The goal is to make AuraPDF feel extremely clean, minimal, and intentional — like a premium desktop PDF application.

==================================================
1. PEN ICON — NO "ANNOTATE" TEXT
==================================================

Remove the word "Annotate" completely.

The annotation entry point should be represented ONLY by a simple pen/pencil icon.

Do NOT show:

"Annotate"

as text anywhere on the main toolbar.

Use:

[ pen icon ]

The pen icon should open the annotation tool popover.

When inactive:
- Neutral icon
- No label

When active:
- Subtle active background
- Clear visual indication that annotation mode is active

Use a recognizable pen/pencil icon rather than a generic edit icon.

==================================================
2. PEN POPOVER
==================================================

Clicking the pen icon opens the compact annotation menu.

Only annotation tools belong inside this menu.

DO NOT put viewing controls inside it.

DO NOT put zoom inside it.

DO NOT put rotation inside it.

DO NOT put fullscreen inside it.

The annotation menu should contain:

- Highlight
- Underline
- Strikethrough
- Pen
- Shape
- Text
- Note

Keep the menu compact.

Prefer a clean icon grid with very short labels only where needed.

Example:

┌─────────────────────────┐
│ Highlight  Underline    │
│ Strike     Pen          │
│ Shape      Text         │
│ Note                    │
└─────────────────────────┘

Do not create a large card.

Do not add descriptions.

Selecting a tool immediately closes the menu and activates that tool.

Escape or clicking outside closes the menu.

==================================================
3. REMOVE VIEWING CONTROLS FROM THE PEN MENU
==================================================

The pen menu must contain ONLY annotation functionality.

Remove:

- Zoom
- Zoom percentage
- Fit page
- Fit width
- Actual size
- Rotate
- View mode

These belong elsewhere.

==================================================
4. TOP RIGHT — ICONS ONLY
==================================================

Keep the top-right area extremely minimal.

Use icon-only controls.

Include:

[ Search ] [ View ] [ Bookmark ] [ Fullscreen ] [ More ]

Do NOT write:

"View"

"Bookmark"

"Fullscreen"

as visible text.

Use icons with excellent tooltips on hover.

==================================================
5. VIEW ICON
==================================================

Use a simple view/layout icon for the View control.

Clicking it opens a small compact menu containing viewing/layout options.

Include:

- Single page
- Two pages
- Continuous
- Two-page continuous
- Fit page
- Fit width
- Actual size

This is the ONLY place where viewing modes and fit modes should be presented.

Do not put these options inside the annotation menu.

Do not clutter the top toolbar with individual view controls.

The menu should be compact and native-looking.

==================================================
6. BOOKMARK ICON
==================================================

Use a bookmark icon only.

No "Bookmark" text.

The bookmark icon should represent the CURRENT PAGE bookmark.

States:

Unbookmarked:
- Outline bookmark

Bookmarked:
- Filled bookmark

Clicking the icon toggles the current page bookmark.

A small tooltip can say:

"Bookmark page"

or

"Remove bookmark"

depending on state.

Do not open a large panel simply to bookmark the current page.

If the user wants to browse existing bookmarks, that can be accessed through the More menu or a dedicated lightweight bookmark panel.

==================================================
7. SEARCH
==================================================

Keep Search as an icon.

No visible "Search" text.

Clicking Search opens a compact document-search interface.

Keep the user inside the PDF.

Do not navigate to a separate search page.

==================================================
8. FULLSCREEN
==================================================

Keep Fullscreen as an icon.

No visible label.

Use a standard fullscreen/expand icon.

The control should toggle immersive fullscreen without changing document state.

==================================================
9. REMOVE ROTATE FROM THE TOP
==================================================

Remove rotation from the top toolbar entirely.

Do NOT show:

- Rotate
- Rotate 90°
- Rotate left
- Rotate right

as permanent top controls.

Rotation will now live in the bottom document control area described below.

==================================================
10. BOTTOM DOCUMENT CONTROL BAR
==================================================

Create a compact floating control bar near the bottom-center of the PDF workspace.

This becomes the primary area for frequent document navigation and manipulation.

It should sit visually close to the bottom of the reading canvas without covering important PDF content.

Include:

[ Undo ] [ Redo ] | [ Rotate ] | [ Previous ] [ Page X / Y ] [ Next ]

Use ICONS wherever possible.

Do NOT write:

"Undo"

"Redo"

"Rotate"

as visible labels.

Use:

Undo icon
Redo icon
Rotate icon

The page navigation may use text because the page number is actual information:

‹   12 / 48   ›

==================================================
11. BOTTOM BAR ORDER
==================================================

Use this hierarchy:

[ Undo ] [ Redo ]   |   [ Rotate ]   |   ‹   12 / 48   ›

Keep the controls visually balanced.

Page navigation should be the central element.

Undo/Redo and Rotate should be secondary.

Do not make the bar huge.

It should feel like a subtle floating HUD rather than a traditional toolbar.

==================================================
12. ROTATE BUTTON
==================================================

The bottom rotate control should be icon-only.

Each click rotates the PDF clockwise by 90°.

Cycle:

0°
→ 90°
→ 180°
→ 270°
→ 0°

The UI itself must NEVER rotate.

Only the PDF content rotates.

Rotation must work correctly with:

- Single page
- Two-page
- Continuous
- Two-page continuous
- Zoomed documents

Changing rotation must NOT change the selected view mode.

Do not unexpectedly reset the page position.

==================================================
13. UNDO / REDO
==================================================

Place Undo and Redo beside the Rotate control in the bottom bar.

Use standard recognizable icons.

They should primarily represent annotation/editing history.

Disabled state:

- Reduced opacity
- Clearly non-interactive

Enabled state:

- Normal contrast
- Subtle hover state

Do not add text labels.

Tooltips can identify them.

Keyboard shortcuts should continue to work:

Ctrl/Cmd + Z → Undo

Ctrl/Cmd + Shift + Z → Redo

==================================================
14. PAGE NUMBER POSITION
==================================================

Move page numbers completely out of the top toolbar.

The page indicator belongs at the bottom.

Use:

‹   12 / 48   ›

Position it approximately at the bottom-center of the AVAILABLE PDF CANVAS.

IMPORTANT:

It must be centered relative to the actual document workspace.

If the Pages/Outline panel is open on the left, account for that panel's width.

Do not blindly center it relative to the entire browser/application window.

It should always feel visually centered beneath the PDF.

==================================================
15. PAGE NUMBER INTERACTION
==================================================

The current page number should be interactive.

Clicking:

12 / 48

should allow the user to enter a page.

Example:

12 / 48

→ click 12

→ input appears

→ type 37

→ Enter

→ navigate to page 37

Do not turn the entire page indicator into a large input box.

Keep it compact.

==================================================
16. BOTTOM BAR AUTO-HIDE
==================================================

Make the bottom control bar unobtrusive.

When the user is actively reading:

- Reduce its visual prominence
- Optionally fade it slightly

When the cursor approaches the bottom:

- Restore full visibility

The bar should never aggressively disappear while the user is interacting with it.

Keep the transition fast and subtle.

==================================================
17. LEFT PAGES / OUTLINE
==================================================

Keep Pages and Outline on the LEFT side.

They should NOT appear in the top toolbar.

Create a compact collapsible panel.

Tabs:

[ Pages ] [ Outline ]

Pages:

- Page thumbnails
- Current page highlighted
- Click thumbnail to navigate

Outline:

- PDF bookmarks/TOC
- Hierarchical structure
- Click section to navigate

The panel should be CLOSED by default.

When closed, the PDF gets maximum space.

When opened, it should slide in cleanly.

==================================================
18. FINAL TOP BAR
==================================================

The top toolbar should now be extremely minimal.

LEFT:

[ Back ] [ Document name ]

RIGHT:

[ Search ] [ Pen ] [ View ] [ Bookmark ] [ Fullscreen ] [ More ]

Nothing else.

Do NOT put:

- Page numbers
- Zoom controls
- Rotate
- Undo
- Redo
- Annotation labels
- View labels

in the top toolbar.

==================================================
19. FINAL LAYOUT
==================================================

The resulting hierarchy should be:

                 TOP
┌─────────────────────────────────────────────────────────┐
│ ← Document.pdf                 ⌕  ✎  ◫  🔖  ⛶  ⋯       │
└─────────────────────────────────────────────────────────┘

                 LEFT
          ┌───────────────┐
          │ Pages Outline │
          │               │
          │  thumbnails   │
          │               │
          └───────────────┘

                 CENTER

                 PDF
          ┌───────────────┐
          │               │
          │   DOCUMENT    │
          │               │
          │               │
          └───────────────┘

               BOTTOM

        ↶   ↷    ⟳    ‹ 12 / 48 ›

The actual visual implementation should be much more refined than this ASCII representation.

==================================================
20. COMMAND PALETTE
==================================================

Keep Ctrl/Cmd + K as the universal command palette.

Update it so it reflects the new control hierarchy.

Commands should include:

NAVIGATION
- Go to page
- Next page
- Previous page
- Open Pages
- Open Outline

VIEW
- Single page
- Two pages
- Continuous
- Two-page continuous
- Fit page
- Fit width
- Actual size
- Fullscreen

DOCUMENT
- Bookmark page
- Search document
- Print
- Download
- Share

ANNOTATION
- Highlight
- Underline
- Strikethrough
- Pen
- Shape
- Text
- Note

EDIT
- Undo
- Redo

ROTATION
- Rotate clockwise

Typing "rotate" should find Rotate.

Typing "page" should find Go to page and navigation.

Typing "bookmark" should find Bookmark page.

Typing "two" should find Two-page view.

The command palette should remain compact and fast.

==================================================
21. DO NOT DUPLICATE CONTROLS UNNECESSARILY
==================================================

Every action should have a clear primary location.

Primary locations:

Annotation → Pen icon

View modes → View icon

Bookmark current page → Bookmark icon

Search → Search icon

Rotate → Bottom control

Undo/Redo → Bottom control

Page navigation → Bottom control

Pages/Outline → Left panel

Universal access → Command palette

This should prevent toolbar clutter.

==================================================
22. IMPORTANT
==================================================

Do not add additional features in this iteration.

Do not bring back:

- Insights
- Aura AI
- Permanent AI sidebar
- Main application sidebar
- Home navigation
- Documents navigation

Keep the PDF immersive.

The user should feel like the interface disappears around the document.

==================================================
FINAL DESIGN PRINCIPLE
==================================================

TOP = identity + a few essential tools

LEFT = document structure

CENTER = document

BOTTOM = navigation + document manipulation

POPovers = deeper controls

COMMAND PALETTE = universal access

The result should feel extremely clean, premium, quiet, and intentional.

Prioritize reducing visible UI over adding more UI.

If a control does not need to be permanently visible, hide it behind an icon, popover, or command palette.