Refine the current AuraPDF PDF reader by implementing ONLY the following four features.

Do not redesign unrelated parts of the application.
Do not add additional features beyond what is requested.
Keep the current immersive PDF-reader direction intact.

The goal is to make the reader feel more like a polished professional desktop application while keeping it clean and distraction-free.

==================================================
1. PDF TABS
==================================================

Add document tabs to the immersive PDF workspace.

When multiple PDFs are opened, allow them to remain open simultaneously.

Example:

[ Research.pdf × ] [ Lecture Notes.pdf × ] [ Report.pdf × ]

Requirements:

- Opening another PDF creates a new tab.
- Clicking a tab switches documents instantly.
- Active tab is clearly identifiable but visually subtle.
- Each tab shows the document name.
- Each tab has a close button.
- If the document has unsaved changes, indicate this subtly.
- Do not make tabs visually dominant.
- Keep the PDF canvas as the primary focus.

Allow the user to close a tab.

If the active tab is closed, intelligently activate the adjacent tab.

Do not bring back the main application sidebar while switching tabs.

The user remains inside immersive PDF mode.

==================================================
2. BOOKMARK CURRENT PAGE
==================================================

Add a simple page-bookmark feature.

Place a bookmark icon in the document toolbar.

Clicking it bookmarks the current page.

States:

- Unbookmarked
- Bookmarked

Make the active bookmark visually obvious.

Add a lightweight bookmark panel accessible from the toolbar.

The panel should show:

- Bookmark name or page reference
- Page number
- Short document context where useful

Clicking a bookmark should immediately navigate to that page.

Allow users to remove bookmarks.

Keep the bookmark UI compact.

Do NOT create a large management dashboard.

Bookmarks are document-specific.

==================================================
3. COMMAND PALETTE
==================================================

Add a keyboard-driven command palette.

Shortcut:

Ctrl/Cmd + K

Opening it should display a compact centered command/search interface over the PDF.

The command palette should allow users to quickly access common actions.

Include:

- Search document
- Go to page
- Previous page
- Next page
- Single-page view
- Two-page view
- Continuous view
- Zoom in
- Zoom out
- Fit page
- Fit width
- Rotate
- Toggle thumbnails
- Toggle outline
- Toggle fullscreen
- Add bookmark
- Remove bookmark
- Print
- Download

The command palette should:

- Support keyboard navigation
- Support text filtering
- Highlight the selected command
- Close with Escape
- Execute commands immediately
- Remain visually minimal

Example:

Search commands...

→ Go to page
→ Two-page view
→ Rotate clockwise
→ Add bookmark
→ Fit width

Do not turn this into a huge settings interface.

==================================================
4. REMEMBER READING POSITION
==================================================

Remember the user's last reading position for each document.

If the user leaves a PDF on page 37 and later opens it again:

Return them to approximately page 37.

Also preserve, where practical:

- Zoom level
- Rotation
- View mode
- Scroll position

When reopening a document, do not create an intrusive popup.

Optionally provide a very subtle indication such as:

"Continue from page 37"

but do not interrupt the user.

The reader should simply restore the previous state naturally.

==================================================
5. IMPORTANT INTERACTION RULES
==================================================

These features must work together without interfering with the existing reader.

Tabs must preserve each document's:

- Current page
- Zoom
- Rotation
- View mode
- Bookmark state

Switching tabs must NOT:

- Reset the reader
- Rotate the document unexpectedly
- Change view mode
- Jump to an unrelated page
- Reopen the application sidebar

The command palette should control the same underlying reader actions rather than creating duplicate implementations.

Bookmarks should navigate within the current document.

==================================================
6. KEEP THE IMMERSIVE EXPERIENCE
==================================================

Do NOT bring back:

- Home sidebar
- Documents sidebar
- Recent navigation
- Favorites navigation
- Settings navigation
- Insights
- Permanent AI sidebar
- Aura AI branding

When a PDF is open, the user remains inside the immersive document workspace.

The hierarchy remains:

DOCUMENT → READING → NAVIGATION → TOOLS

The new features should support that hierarchy rather than compete with it.

==================================================
7. VISUAL DIRECTION
==================================================

Keep the current clean visual direction.

Use:

- Compact controls
- Subtle borders
- Small radii
- Neutral surfaces
- Excellent spacing
- Clear active states
- Minimal shadows
- Restrained animations

Avoid:

- Large cards
- Giant controls
- Excessive gradients
- Excessive glassmorphism
- Dashboard-style layouts
- Marketing-style UI
- Decorative elements that don't improve usability

These features should feel like they were always part of AuraPDF.

==================================================
FINAL GOAL
==================================================

The user should be able to:

Open multiple PDFs → switch between them with tabs → bookmark important pages → use Ctrl/Cmd+K to quickly access reader commands → close and reopen a PDF and automatically return to where they left off.

Implement these features cleanly and cohesively.

Do not add anything else in this iteration.