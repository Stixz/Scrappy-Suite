# Scrappy Suite Release Notes

## 1.0.0

Initial public freeware release from Ravenforge Creations Studio.

### Highlights

- Blank-panel workspace that lets you build your own layout.
- Multi-panel interface with resizing and panel reordering.
- Calendar module for lightweight scheduling and event tracking.
- DirT Writer for drafting, opening, and saving documents.
- Fogre file explorer with preview support and quick access paths.
- Built-in Help module and local help documentation.
- Launcher for saved shortcuts to apps, files, folders, and links.
- Studio branding and About flow linked to <https://ravenforge.info>.

### Polished Before Release

- Add Panel now opens an empty panel instead of loading a default module.
- First launch now starts with a blank workspace.
- Critical renderer and launcher security issues were reduced by removing raw command execution paths and unsafe HTML injection routes.
- Panel drag listener duplication was fixed.
- Calendar panel unsubscribe bleed was fixed.
- Writer toolbar and keyboard shortcut scoping were fixed.
- Several visible UI glyph encoding issues were cleaned up.

### Known Limitations

- Some modules are still evolving and may feel more practical than polished.
- Icon and installer artwork are not yet configured in the packaging metadata.
- A final installer smoke test is still recommended before wide distribution.
