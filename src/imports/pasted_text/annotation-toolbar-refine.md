Refine the PDF annotation toolbar to make it significantly cleaner and more minimal.

The current annotation toolbar exposes too many individual text/annotation tools at once.

Replace that approach with a single "Annotate" control that expands into a compact annotation menu.

==================================================
1. COLLAPSE ANNOTATION TOOLS
==================================================

Remove the individual annotation/text tools from the permanent toolbar.

Do NOT permanently show:

- Text selection/annotation tools
- Highlight
- Underline
- Strikethrough
- Text box
- Drawing
- Shapes
- Notes/comments

Instead, the main toolbar should have ONE control:

[ Annotate ]

Use a simple, recognizable annotation icon.

The main toolbar should remain extremely clean.

==================================================
2. ANNOTATE POPOVER
==================================================

When the user clicks "Annotate", open a small floating popover directly beneath or beside the button.

Keep it compact.

Organize the tools into a simple, intuitive set of actions:

ANNOTATE

[ Highlight ]
[ Underline ]
[ Strikethrough ]

DRAW

[ Pen ]
[ Shapes ]

ADD

[ Text ]
[ Note ]

Do not use large cards or excessive labels.

Prefer compact icon + short label buttons.

If appropriate, use a small horizontal grid of icons instead of a vertical menu.

The popover should feel like a native desktop application's tool menu.

==================================================
3. SIMPLIFY THE TOOL NAMES
==================================================

Use extremely simple terminology.

Instead of:

"Add Text Annotation"

use:

"Text"

Instead of:

"Freehand Drawing"

use:

"Pen"

Instead of:

"Add Comment"

use:

"Note"

Use:

- Highlight
- Underline
- Strike
- Pen
- Shape
- Text
- Note

Do not add unnecessary explanatory text.

==================================================
4. SMART CONTEXTUAL BEHAVIOR
==================================================

When the user selects an annotation tool:

- Close the popover
- Activate the selected tool
- Visually indicate the active tool
- Allow the user to immediately interact with the PDF

The toolbar should then show the active annotation state subtly.

For example:

Annotate ●

or a small active indicator.

Clicking Annotate again should reopen the tool menu.

Escape should close the menu.

Clicking outside should close the menu.

==================================================
5. CONTEXTUAL TEXT ANNOTATION
==================================================

When the user selects text in the PDF, do NOT automatically open the entire Annotate menu.

Instead show a very small contextual toolbar near the selected text.

Prioritize:

[ Highlight ] [ Underline ] [ Strike ] [ More ]

"More" can expose:

- Note
- Ask
- Explain
- Summarize
- Rewrite
- Translate
- Copy

Keep this contextual toolbar separate from the main Annotate menu.

The user should only see the tools relevant to the current action.

==================================================
6. UNDO / REDO
==================================================

Keep Undo and Redo outside the Annotate menu.

They are global document actions and should remain easily accessible.

Use compact icon buttons.

Do not place them inside the annotation popover.

==================================================
7. VISUAL DESIGN
==================================================

Make the entire system much cleaner than the current toolbar.

The permanent toolbar should look approximately like:

[ Select ] [ Annotate ] | [ Undo ] [ Redo ]

with the rest of the PDF controls handled elsewhere.

Do not fill the toolbar with individual annotation icons.

Use:

- Compact controls
- Small radii
- Subtle borders
- Minimal shadows
- Clear active states
- Simple icons
- Short labels

Avoid:

- Large menus
- Huge popovers
- Excessive text
- Nested menus unless genuinely necessary
- Decorative elements
- Excessive spacing

==================================================
8. TOOL MENU BEHAVIOR
==================================================

The Annotate popover should feel like an extension of the toolbar, not a separate window.

Animate it subtly when opening.

Keep the opening animation very short.

The menu should appear close to the Annotate button.

Selecting a tool should immediately return focus to the PDF.

==================================================
9. IMPORTANT
==================================================

Do not redesign the rest of the PDF reader.

Do not bring back Insights.

Do not add a permanent AI panel.

Do not add new navigation.

Only simplify the annotation system.

The goal is:

CURRENT:

[Select] [Text] [Text] [Text] [Pen] [Note] [Undo] [Redo]

BECOMES:

[Select] [Annotate] [Undo] [Redo]

Clicking Annotate:

┌─────────────────────────┐
│ ANNOTATE                │
│                         │
│ Highlight  Underline   │
│ Strike                  │
│                         │
│ Pen        Shape        │
│                         │
│ Text       Note         │
└─────────────────────────┘

Make this feel extremely clean, compact, and native to a premium desktop PDF application.