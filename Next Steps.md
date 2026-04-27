Add .docx import first.
Add .docx export second.
Treat legacy .doc as “open externally and resave as .docx” unless there’s a hard requirement.
For this app, the cleanest model is:

Internal editor format stays HTML/rich text.
.docx import converts Word content into editor HTML.
.docx export converts editor HTML into a Word document.
That keeps the app architecture sane instead of turning the whole editor into a Word clone, which is a hobby that has ruined many weekends.

One important caveat: “compatibility” usually means “good enough for common documents,” not perfect fidelity. Headings, paragraphs, bold/italic, lists, and basic tables are very doable. Complex layouts, tracked changes, comments, embedded objects, and Word-specific styling are where things get slippery.

If you want, I can implement the first practical pass next:

.docx open/import into the rich text editor
.docx save/export from the current rich text content
file dialog updates for .docx