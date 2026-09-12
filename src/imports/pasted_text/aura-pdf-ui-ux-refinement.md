Refine the current AuraPDF immersive PDF reader. This is a focused UI/UX restructuring pass.

Do NOT redesign the entire application.

The goal is to make the PDF reader significantly cleaner, more immersive, and more logically organized by moving secondary controls out of the main toolbar and improving navigation.

Keep the existing immersive desktop-app direction.

==================================================
1. ANNOTATE MENU — EXPAND ITS RESPONSIBILITIES
==================================================

The current Annotate menu should become the central "document tools" menu.

Keep the main toolbar clean.

Move these controls OUT of the top toolbar:

- Rotate
- Zoom out
- Zoom percentage
- Zoom in

These should no longer appear as individual permanent controls in the top toolbar.

Instead, place them inside the Annotate/document-tools popover.

The popover should contain two clearly separated groups:

ANNOTATE

- Highlight
- Underline
- Strike
- Pen
- Shape
- Text
- Note

VIEW

- Zoom out
- Zoom percentage
- Zoom in
- Fit page
- Fit width
- Actual size
- Rotate clockwise

Keep the menu compact.

Do not make it a giant panel.

Use simple icons with short labels.

The rotation control should clearly indicate the action:

Rotate 90°

Repeated clicks should continue:

0° → 90° → 180° → 270° → 0°

Rotation should affect only the PDF document, never the surrounding UI.

==================================================
2. TOP TOOLBAR — MAKE IT MUCH CLEANER
==================================================

Remove unnecessary controls from the top toolbar.

Do NOT permanently show:

- Zoom controls
- Rotation
- Large annotation toolbar
- Pages
- Outline
- AI
- Insights
- Permanent AI panel

The top toolbar should primarily contain:

LEFT:

[ Back ] [ Document name ]

CENTER / ESSENTIAL NAVIGATION:

Minimal document state/navigation where appropriate.

RIGHT:

[ Search ] [ Annotate ] [ Fullscreen ] [ More ]

Keep this extremely clean.

Do not fill every available space.

The PDF should dominate the interface.

==================================================
3. MOVE PAGES AND OUTLINE TO THE LEFT
==================================================

Move document navigation into a dedicated left-side panel.

The panel should contain two tabs:

[ Pages ] [ Outline ]

Pages:

- Show page thumbnails
- Current page is clearly highlighted
- Clicking a thumbnail navigates to that page
- Smooth scrolling
- Compact thumbnails
- Optional page number beside each thumbnail

Outline:

- Show the PDF's bookmark/outline hierarchy
- Nested sections should be visually clear
- Clicking an entry navigates to the corresponding location
- If the PDF has no outline, show a clean empty state

The left panel should be COLLAPSIBLE.

When closed:

The PDF gets the full available width.

When opened:

The panel should occupy a reasonable fixed width without making the PDF unnecessarily small.

Do not permanently show this panel.

The user should be able to toggle it from the toolbar.

Use a subtle slide animation when opening/closing.

==================================================
4. PAGE NAVIGATION — MOVE TO THE BOTTOM
==================================================

Remove the large page navigation from the top toolbar.

Move page navigation to the bottom of the document workspace.

Create a compact floating or anchored page-navigation control.

It should sit near the bottom-center of the PDF workspace.

Use something visually similar to:

          ┌─────────────────────┐
          │  ‹   12 / 48   ›   │
          └─────────────────────┘

Include:

- Previous page
- Current page
- Total pages
- Next page

The current page number should be editable.

Clicking the current page number should allow direct page entry.

Example:

12 / 48

Click "12" → input field → type 37 → Enter → navigate to page 37.

The control should be visually subtle and should NOT cover important PDF content.

Position it intelligently based on the viewport.

It should remain centered relative to the available document canvas, not blindly centered relative to the entire application window.

If the left Pages/Outline panel is open, account for its width when positioning the bottom page control.

==================================================
5. BOTTOM PAGE CONTROL BEHAVIOR
==================================================

Make the page navigation unobtrusive.

When the user is actively reading:

The control can become slightly less prominent.

When the cursor approaches the bottom:

It becomes more visible.

It should never obstruct the document unnecessarily.

Do not make it huge.

Do not turn it into a website-style sticky footer.

It should feel like a native PDF application control.

==================================================
6. TWO-PAGE VIEW + PAGE NAVIGATION
==================================================

Make the bottom navigation work intelligently with all view modes.

Single page:

12 / 48

Two-page:

12–13 / 48

or an equally clear representation.

When navigating forward in two-page mode:

12–13 → 14–15 → 16–17

When the final page is reached, handle odd page counts intelligently.

Do NOT unexpectedly rotate pages.

Do NOT jump to unrelated pages.

Preserve reading position when switching between view modes.

==================================================
7. COMMAND PALETTE — REDESIGN IT PROPERLY
==================================================

Improve the command palette substantially.

Shortcut:

Ctrl/Cmd + K

It should become the universal command center for AuraPDF.

Do NOT make it a generic search modal.

It should combine:

COMMANDS + DOCUMENT SEARCH + NAVIGATION

The palette should open as a refined floating panel in the center of the workspace.

At the top:

Search or type a command...

Below it, show useful categorized commands.

For example:

NAVIGATE

→ Go to page
→ Next page
→ Previous page
→ Open Pages
→ Open Outline

VIEW

→ Single-page view
→ Two-page view
→ Continuous view
→ Fit page
→ Fit width
→ Actual size
→ Fullscreen
→ Rotate clockwise

DOCUMENT

→ Add bookmark
→ Search document
→ Print
→ Download
→ Share

ANNOTATE

→ Highlight
→ Underline
→ Strike
→ Pen
→ Text
→ Note

AI / DOCUMENT TOOLS

→ Ask about selection
→ Explain selection
→ Summarize selection
→ Extract selection

Only show AI commands when relevant.

For example:

If text is selected:

→ Ask about selection

should appear prominently.

If no text is selected:

Do not prioritize selection-specific commands.

==================================================
8. COMMAND PALETTE SEARCH BEHAVIOR
==================================================

Make the command palette intelligently filter results.

Typing:

"rotate"

should show:

→ Rotate clockwise

Typing:

"page"

should show:

→ Go to page
→ Open Pages
→ Next page
→ Previous page

Typing:

"two"

should show:

→ Two-page view

Typing:

"bookmark"

should show:

→ Add bookmark
→ Open bookmarks

Typing a page number should provide:

→ Go to page 37

Typing a document name should allow:

→ Open document

Use keyboard navigation.

Arrow keys:

↑ ↓ → navigate results

Enter:

Execute selected command

Escape:

Close

Support command categories.

Show keyboard shortcuts on the right side where useful.

Example:

Go to page                     ⌘G

Two-page view                  ⌘2

Fullscreen                     F

Do not display shortcuts for every command if it creates clutter.

==================================================
9. COMMAND PALETTE SHOULD FEEL FAST
==================================================

The palette should open almost instantly.

Use a subtle scale/fade animation.

Do not use a giant modal transition.

The PDF should remain subtly visible behind it.

The user should feel like the command palette is an overlay on top of their document, not a different screen.

==================================================
10. TOOLBAR ORGANIZATION
==================================================

The resulting reader hierarchy should be:

TOP:

Back | Document | Search | Annotate | Fullscreen | More

LEFT:

Pages / Outline — hidden by default

CENTER:

PDF

BOTTOM:

Page navigation

OVERLAYS:

Command palette
Contextual text toolbar
Optional thumbnail/outline panel

This should create a very clean visual hierarchy.

==================================================
11. IMMERSIVE MODE
==================================================

Preserve the immersive behavior.

Once a PDF is opened:

The normal application sidebar remains completely hidden.

Do NOT bring back:

- Home
- Documents
- Recent
- Favorites
- Folders
- Settings

The user is inside the document.

The PDF reader should feel like its own application mode.

==================================================
12. HOVER / AUTO-HIDE BEHAVIOR
==================================================

Keep the interface minimal while reading.

When the user is actively reading:

- Top toolbar can subtly fade
- Bottom page controls can become less prominent
- Side panels remain hidden unless explicitly opened

Moving the cursor toward the top reveals the toolbar.

Moving toward the bottom reveals page navigation.

This should be subtle and fast.

Do not make controls difficult to discover.

==================================================
13. MORE MENU
==================================================

Use the More menu for secondary actions.

Possible items:

- Print
- Download
- Share
- Document information
- Keyboard shortcuts
- Reading preferences

Do NOT duplicate controls that already exist in Annotate or the command palette unless there is a strong usability reason.

==================================================
14. CONSISTENCY BETWEEN CONTROLS
==================================================

There should be one source of truth for each action.

For example:

Rotate can be accessed through:

- Annotate/document tools menu
- Command palette

Both should trigger the SAME rotate action.

Do not create separate fake implementations.

Likewise:

Zoom
View mode
Fullscreen
Page navigation
Bookmarks

should all operate on the same underlying reader state.

==================================================
15. VISUAL CLEANUP
==================================================

Make this iteration noticeably cleaner than the current screenshot.

Reduce:

- Number of visible buttons
- Toolbar clutter
- Large panels
- Excessive labels
- Visual noise

Increase:

- Alignment
- Whitespace
- Consistency
- Precision
- Visual hierarchy
- Immersion

Use small radii and restrained shadows.

Keep the UI dark and sophisticated if that matches the current design.

Do not introduce flashy gradients or decorative effects.

==================================================
16. IMPORTANT — DO NOT BREAK EXISTING FEATURES
==================================================

Preserve the existing:

- PDF rendering
- Single-page view
- Two-page view
- Continuous view
- Rotation
- Zoom
- Search
- Annotation
- Text selection
- Contextual actions
- Fullscreen

This is a UI restructuring.

Do not remove functionality merely because its button moved.

==================================================
17. FINAL EXPERIENCE
==================================================

The final PDF reader should feel approximately like this:

                AURAPDF

┌───────────────────────────────────────────────────────────────┐
│ ←  Document.pdf                         Search Annotate  ⛶  ⋯ │
├───────┬───────────────────────────────────────────────────────┤
│       │                                                       │
│ Pages │                                                       │
│       │                                                       │
│  ▣    │                     PDF PAGE                          │
│  ▣    │                                                       │
│  ▣    │                                                       │
│       │                                                       │
│Outline│                                                       │
│       │                                                       │
│       │                                                       │
│       │                                                       │
├───────┴───────────────────────────────────────────────────────┤
│                         ‹  12 / 48  ›                         │
└───────────────────────────────────────────────────────────────┘

But keep the Pages/Outline panel hidden by default.

The reader should feel spacious when the panel is closed.

The main toolbar should be extremely minimal.

The bottom page navigation should be subtle.

The Annotate button should open annotation + view tools.

Ctrl/Cmd + K should provide a powerful universal command palette.

==================================================
FINAL PRINCIPLE
==================================================

Every control should have a clear home.

TOP = essential application/document controls

LEFT = document structure and navigation

BOTTOM = page navigation

ANNOTATE = annotation + viewing tools

COMMAND PALETTE = universal access to everything

PDF = the center of the experience

Do not add more features in this iteration.

Focus on making this structure exceptionally clean, intuitive, and polished.