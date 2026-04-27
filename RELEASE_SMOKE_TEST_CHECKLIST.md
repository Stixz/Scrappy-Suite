# Scrappy Suite Release Smoke Test Checklist

Use this before the first packaged build and before any public release build.

## Preflight

- [ ] Confirm app metadata is current in `package.json`
- [ ] Confirm `version` is correct for the release
- [ ] Confirm `homepage` and studio links point to `https://ravenforge.info`
- [ ] Confirm `assets/icons/scrappy-suite-icon.ico` is the icon you actually want to ship
- [ ] Confirm `README.md`, `HELP.md`, `RELEASE_NOTES.md`, and `LICENSE` are present and current
- [ ] Confirm `node`, `npm`, and `npx` are available in the shell
- [ ] Confirm `electron` is installed
- [ ] Confirm `electron-builder` is available before running `pack` or `dist`

## Launch And Shutdown

- [ ] Launch the app from source with `npm start`
- [ ] Confirm the app opens without console errors or missing asset failures
- [ ] Confirm the title bar, footer branding, and launcher button render correctly
- [ ] Close the app normally
- [ ] Confirm Electron processes disappear from Task Manager within a moment after close
- [ ] Reopen the app and confirm it starts cleanly again

## Workspace Shell

- [ ] Confirm first launch opens a single blank panel
- [ ] Confirm `Add Panel` creates an empty panel rather than auto-loading a module
- [ ] Confirm the empty panel state shows module chips with icons
- [ ] Confirm clicking a panel makes it the active target for toolbar module loading
- [ ] Confirm panel reordering works by dragging panel headers
- [ ] Confirm panel resizing works by dragging dividers
- [ ] Confirm closing a panel does not disturb the remaining panels

## Calendar

- [ ] Load `Calendar` into a panel
- [ ] Confirm month navigation works with previous, next, and today buttons
- [ ] Confirm view switching works for `Month`, `Week`, and `Upcoming`
- [ ] Create a new event
- [ ] Edit the event and confirm the change persists
- [ ] Delete the event and confirm it disappears
- [ ] Open a second Calendar panel and confirm one panel closing does not break the other

## DirT Writer

- [ ] Load `DirT Writer` into a panel
- [ ] Confirm typing works and placeholder content clears correctly
- [ ] Confirm toolbar actions work: bold, italic, underline, bullet list, numbered list, quote, clear formatting
- [ ] Confirm `Save`, `Save As`, `Open`, and `New` respond correctly
- [ ] Confirm keyboard shortcuts work in the active writer panel
- [ ] Open a second writer panel and confirm shortcuts do not cross-trigger in the wrong panel
- [ ] Reopen the app and confirm unsaved draft state behaves as expected

## Fogre

- [ ] Load `Fogre` into a panel
- [ ] Confirm the file listing renders readable names and icons
- [ ] Browse into a folder and back out using breadcrumbs
- [ ] Preview a text file
- [ ] Preview a markdown file
- [ ] Open a supported file into DirT Writer
- [ ] Confirm HTML files are not rendered inline as active content
- [ ] Confirm `Open In Default Browser` or external open actions work safely
- [ ] Test copy and delete actions on a disposable test file only

## Help And Branding

- [ ] Load `Help` into a panel
- [ ] Confirm the panel content scrolls without showing an ugly visible scrollbar
- [ ] Confirm the `Request a Module` card appears
- [ ] Confirm `About` opens the welcome/about modal
- [ ] Confirm `Visit Studio` opens `https://ravenforge.info`
- [ ] Confirm branding is subtle and centered correctly in the footer

## Launcher

- [ ] Open the launcher window
- [ ] Create a shortcut for a folder
- [ ] Create a shortcut for a file
- [ ] Create a shortcut for a web link
- [ ] Confirm each shortcut opens the intended target
- [ ] Confirm editing and deleting shortcuts works
- [ ] Confirm launcher branding and `Visit Studio` link work
- [ ] Close the launcher and confirm it does not leave orphaned behavior behind

## Persistence

- [ ] Arrange multiple panels with different modules loaded
- [ ] Close and reopen the app
- [ ] Confirm panel count, order, sizes, and loaded modules restore correctly
- [ ] Confirm blank panels remain blank after reopen
- [ ] Confirm launcher shortcuts persist
- [ ] Confirm window size and position restore correctly

## Safety Checks

- [ ] Confirm launcher shortcuts cannot run arbitrary shell commands
- [ ] Confirm external links open through the OS rather than through unsafe in-app execution
- [ ] Confirm local HTML previews in Fogre no longer execute inside the app
- [ ] Confirm there are no obvious raw HTML injection artifacts in launcher shortcut names or file listings

## Packaging Pre-Build

- [ ] Run `node --check main.js`
- [ ] Run `node --check preload.js`
- [ ] Run `node --check renderer.js`
- [ ] Run `node --check modules/calendar.js`
- [ ] Run `node --check modules/writer.js`
- [ ] Run `node --check modules/files.js`
- [ ] Run `node --check modules/help.js`
- [ ] Run `npm install` if dependencies are not present
- [ ] Run `npx electron-builder --version` and confirm it resolves cleanly
- [ ] Only then run `npm run pack`
- [ ] After `pack` succeeds, run `npm run dist`

## Packaged Build Checks

- [ ] Install the generated Windows build
- [ ] Confirm the installed app icon looks correct in the installer, Start menu, taskbar, and desktop shortcut
- [ ] Launch the installed build and repeat the short version of the checks above
- [ ] Confirm the installed build can close cleanly without lingering Electron processes
- [ ] Confirm uninstall works and removes the app cleanly

## Release Call

Ship only if the app can:

- [ ] open cleanly
- [ ] close cleanly
- [ ] load every module
- [ ] save and reopen the user state you claim it saves
- [ ] open the studio link and help/about flow without embarrassment

If one of those fails, the app is not ready yet. Better a delayed build than freeware with a personality disorder.
