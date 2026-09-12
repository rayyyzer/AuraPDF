Redesign the current AuraPDF PDF READER based on the existing implementation.

This is a focused refinement of the PDF-reading experience, not a request to redesign the entire application.

The goal is to make entering a PDF feel like entering a dedicated, immersive document workspace.

==================================================
1. REMOVE INSIGHTS COMPLETELY
==================================================

Remove the "Insights" feature completely from the product.

Remove ALL references to:

- Insights
- Insights panel
- Insights button
- Insights badge
- Insights tab
- Insights citations panel
- Any "42p" or page-count badge associated with Insights
- Any Insights-related UI
- Any Insights-related navigation
- Any Insights-related contextual actions

Do not replace it with another branded AI feature.

The PDF reader should NOT have a permanent AI sidebar.

AI functionality can still exist through contextual actions such as:

- Ask
- Explain
- Summarize
- Extract
- Rewrite
- Translate

But these should only appear when useful.

The PDF itself is the primary focus.

==================================================
2. IMMERSIVE PDF MODE
==================================================

When the user opens a PDF, transition into a dedicated immersive reading mode.

The normal application navigation should disappear.

Specifically:

HIDE:

- Home button
- Main sidebar
- Documents navigation
- Recent
- Favorites
- Folders
- Settings
- Normal application navigation

Do not simply collapse the sidebar into a smaller sidebar.

It should completely disappear.

The user should feel like they have ENTERED the document.

The PDF reader should occupy the entire application window.

Think of this as:

Application → Open PDF → Full immersive document workspace

The document workspace becomes the entire UI.

==================================================
3. IMMERSIVE TOP BAR
==================================================

Replace the current large/website-like toolbar with a compact professional document toolbar.

Keep it visually lightweight.

Left side:

- Back button
- Document name

Center:

- Page navigation
- Current page / total pages

Right side:

- Search
- Zoom out
- Zoom percentage
- Zoom in
- Rotate
- View mode
- Fullscreen
- Download/export
- More

Do not overcrowd the toolbar.

Use icon buttons with tooltips for secondary actions.

The toolbar should feel similar to a premium desktop document application.

==================================================
4. HIDEABLE TOOLBAR
==================================================

Add a distraction-free reading mode.

Allow the top toolbar to automatically fade away when the user is reading.

Moving the cursor toward the top should reveal it again.

Also provide a keyboard shortcut/action for toggling the UI visibility.

When hidden:

- PDF becomes the dominant visual element
- No persistent navigation
- No unnecessary controls
- Maximum reading area

This should feel extremely polished.

==================================================
5. PDF CANVAS
==================================================

Make the PDF canvas the dominant element.

Use the available screen real estate intelligently.

The document should be centered with appropriate margins.

Use a subtle workspace background around the pages.

Do not make the document look like a card sitting inside a webpage.

The page should feel like a real document being viewed inside a professional reader.

Scrolling should feel smooth and natural.

==================================================
6. PAGE NAVIGATION
==================================================

Implement proper page navigation.

Include:

- Current page number
- Total page count
- Previous page
- Next page
- Direct page-number input

Example:

<   12 / 48   >

Allow the user to type a page number and immediately navigate to it.

Also support keyboard shortcuts where appropriate.

==================================================
7. TWO-PAGE VIEW
==================================================

Implement a real two-page viewing mode.

Add a View Mode control with options such as:

- Single page
- Two pages
- Two-page continuous
- Continuous scroll

The two-page mode should display two PDF pages side-by-side with appropriate spacing.

Example:

        [ Page 12 ]   [ Page 13 ]

The pages should remain aligned and visually balanced.

When the document has an odd number of pages, handle the final page intelligently.

Two-page mode must adapt correctly to the available viewport width.

Do NOT simply place two tiny pages next to each other.

Scale them appropriately.

When switching between single-page and two-page view:

- Preserve the user's approximate reading position
- Animate the transition subtly
- Do not unexpectedly rotate the document
- Do not unexpectedly jump to another page

==================================================
8. ROTATE FEATURE
==================================================

Implement PDF rotation.

Add a rotate button to the document toolbar.

Each click should rotate the document clockwise by 90 degrees.

Support:

0°
90°
180°
270°

Allow repeated clicks to cycle through rotations.

Rotation should apply to the document view without changing the underlying PDF file.

Do NOT rotate the entire application UI.

Only rotate the PDF/document canvas.

The toolbar and controls must remain correctly oriented and usable.

Rotation must work correctly in:

- Single-page mode
- Two-page mode
- Continuous mode
- Zoomed-in mode

Make the transition smooth.

==================================================
9. THUMBNAILS / DOCUMENT NAVIGATION
==================================================

Add a lightweight optional thumbnail panel.

It should NOT permanently consume screen space.

Provide a button in the toolbar to open/close it.

When opened:

- Show page thumbnails
- Highlight the current page
- Allow clicking a thumbnail to navigate
- Allow scrolling through thumbnails

The panel should overlay or intelligently occupy space without destroying the reading experience.

Make it easy to dismiss.

==================================================
10. OUTLINE
==================================================

If the PDF contains bookmarks/outline information, provide an optional document outline panel.

Allow users to switch between:

- Pages
- Outline

Keep this panel hidden until requested.

==================================================
11. SEARCH
==================================================

Implement a polished document search experience.

Clicking Search should open a compact search interface.

Show:

- Search field
- Number of results
- Previous result
- Next result
- Highlighted matches
- Current result

Allow Enter / Shift+Enter navigation where appropriate.

Search results should visually highlight matching text in the PDF.

Do not create a giant search page.

Keep the user inside the document.

==================================================
12. CONTEXTUAL TEXT SELECTION
==================================================

When the user selects text inside the PDF, display a compact contextual toolbar.

Actions:

- Ask
- Explain
- Summarize
- Rewrite
- Translate
- Copy

Do NOT make this a permanent AI sidebar.

The toolbar should appear near the selection and disappear when no longer needed.

Keep it compact and elegant.

==================================================
13. CONTEXTUAL AI PANEL
==================================================

If the user chooses "Ask", "Explain", "Summarize", etc., open a temporary contextual panel.

It should:

- Overlay or occupy a limited portion of the workspace
- Keep the PDF visible
- Show the selected text/context
- Display the result
- Allow the user to jump to relevant source pages
- Be dismissible

The user should always feel that the AI is assisting with THE DOCUMENT.

Never make it feel like the user left the PDF to enter a chatbot.

==================================================
14. ANNOTATION SYSTEM
==================================================

Add a professional annotation toolbar.

Available tools:

- Select
- Hand/pan
- Highlight
- Underline
- Strikethrough
- Text note
- Drawing
- Shapes
- Comment
- Undo
- Redo

Keep the annotation tools compact.

Use a floating contextual toolbar or compact toolbar rather than a huge permanent toolbar.

Make active tools visually obvious.

==================================================
15. ZOOM
==================================================

Implement polished zoom controls.

Support:

- Zoom out
- Zoom percentage
- Zoom in
- Fit width
- Fit page
- Actual size

Allow keyboard shortcuts and mouse/trackpad zoom where appropriate.

Zoom should remain smooth.

When zooming, preserve the user's reading position.

==================================================
16. FULLSCREEN
==================================================

Add a true fullscreen reading mode.

When enabled:

- Hide application chrome
- Hide operating-style UI where supported
- Maximize PDF canvas
- Keep only essential controls accessible

Make exiting fullscreen obvious.

==================================================
17. MORE MENU
==================================================

Move secondary actions into a clean More menu.

Possible actions:

- Print
- Download
- Export
- Share
- Document information
- Keyboard shortcuts
- Reading preferences

Do not clutter the main toolbar.

==================================================
18. READING EXPERIENCE
==================================================

Prioritize actual reading.

The user should be able to open a PDF and simply read without feeling surrounded by UI.

Create:

- Comfortable page margins
- Smooth scrolling
- Subtle page transitions
- Clear page separation
- Excellent contrast
- Appropriate zoom behavior
- Minimal visual distractions

The interface should disappear into the background.

==================================================
19. KEYBOARD SHORTCUTS
==================================================

Support useful shortcuts where appropriate.

Examples:

Ctrl/Cmd + F → Search

Ctrl/Cmd + + → Zoom in

Ctrl/Cmd + - → Zoom out

R → Rotate

F → Fullscreen

Arrow keys → Navigate pages

Esc → Close panels / exit modes

B → Toggle sidebar/thumbnails if appropriate

Make the shortcuts discoverable through the More menu.

==================================================
20. VIEW STATE PERSISTENCE
==================================================

Remember the user's reading preferences where appropriate.

For example:

- Zoom level
- Single/two-page view
- Rotation
- Sidebar visibility
- Reading position

Opening the same document again should feel consistent.

==================================================
21. RESPONSIVE BEHAVIOR
==================================================

Desktop is the primary experience.

On smaller screens:

- Hide secondary controls
- Move tools into menus
- Use a compact bottom toolbar where appropriate
- Make two-page view optional based on available width
- Keep touch targets large enough
- Make AI contextual panels slide in rather than permanently occupy space

Never allow the UI to cover important PDF content unnecessarily.

==================================================
22. VISUAL DIRECTION
==================================================

The current visual direction should become significantly cleaner.

Use:

- Compact controls
- Small/subtle radii
- Neutral surfaces
- Minimal borders
- Restrained shadows
- Excellent typography
- Precise spacing
- Strong alignment
- Subtle transitions

Avoid:

- Marketing website layouts
- Giant headings
- Large cards
- Excessive rounded containers
- Excessive gradients
- Excessive glassmorphism
- Permanent AI panels
- Decorative UI that does not improve functionality

The PDF should visually dominate.

==================================================
23. IMPORTANT PRODUCT PRINCIPLE
==================================================

The hierarchy of the PDF reader should be:

1. DOCUMENT
2. READING
3. NAVIGATION
4. TOOLS
5. AI ASSISTANCE
6. EVERYTHING ELSE

Do not let secondary functionality compete with the document.

==================================================
24. IMPORTANT BUG-PREVENTION REQUIREMENTS
==================================================

Pay particular attention to view transitions.

When switching between:

- Single page ↔ Two page
- Portrait ↔ Rotated
- Normal ↔ Fullscreen
- Zoom levels
- Thumbnail panel open/closed

DO NOT:

- Automatically rotate the document
- Change the user's selected rotation
- Jump unexpectedly to another page
- Lose the current reading position
- Break page alignment
- Make pages disappear
- Cause controls to rotate with the PDF
- Change unrelated application state

Each viewing mode should be independent.

Rotation controls document orientation.

View mode controls page layout.

Zoom controls scale.

Fullscreen controls available UI.

Do not mix these responsibilities.

==================================================
25. ADDITIONAL USEFUL FEATURES
==================================================

Use your own product-design judgment to add other genuinely useful PDF-reader functionality where appropriate.

Consider:

- Page labels
- Document information
- Print
- Download
- Share
- Copy link/page reference
- Recent page history
- Bookmark page
- "Go to last read position"
- Reading preferences
- Fit-to-width
- Presentation/distraction-free mode
- Keyboard shortcut reference
- Page rotation persistence

Only add features that genuinely improve the PDF workflow.

Do not add features just to make the interface look more complex.

==================================================
FINAL GOAL
==================================================

When the user clicks a PDF from AuraPDF, the experience should feel like:

"Everything else disappeared. I'm inside my document."

The application shell should disappear.

The PDF should become the center of the experience.

Controls should appear when needed and disappear when not needed.

The result should feel like a premium, professional desktop PDF application with an exceptionally clean and immersive reading experience.

Remove Insights completely.

Remove the permanent AI sidebar.

Remove the normal application navigation while inside a PDF.

Implement:

- Immersive reading mode
- Rotate
- Single-page view
- Two-page view
- Continuous view
- Thumbnail navigation
- Outline
- Search
- Zoom
- Fullscreen
- Contextual text actions
- Annotations
- Useful keyboard shortcuts
- Other genuinely useful document-reader features you believe belong here

Make all interactions feel deliberate, stable, and polished.