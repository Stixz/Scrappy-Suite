import { resolveContextIcon } from './scrappy.js';

let panelStates = new Map();
let previewResizeState = null;
export function renderFiles(panelIdx) {
  return `
    <div class="module-shell files-module" id="files-module-${panelIdx}">
      <div class="module-topbar">
        <h2 class="accent module-title">Fogre</h2>
        <button class="module-close-btn" data-close-panel="${panelIdx}" title="Close panel">&#10005;</button>
      </div>

      <div class="module-body file-explorer-body" style="gap: 4px;">
        <div class="calendar-toolbar" id="quick-access-${panelIdx}" style="margin-bottom: 2px; gap: 6px; justify-content: flex-start; overflow-x: auto; padding: 4px 0 4px 0;">
          <div class="quick-access-btn" data-quick-path="home"><span class="icon">&#8962;</span> Home</div>
          <div class="quick-access-btn" data-quick-path="downloads"><span class="icon">&#8681;</span> Downloads</div>
          <div class="quick-access-btn" data-quick-path="documents"><span class="icon icon-text">⨌</span> Docs</div>
          <div class="quick-access-btn" data-quick-path="desktop"><span class="icon">&#128421;</span> Desktop</div>
        </div>

        <div class="calendar-toolbar" style="margin-bottom: 2px; gap: 6px; justify-content: flex-start; padding-top: 2px;">
          <button class="module-action-btn" id="new-file-btn-${panelIdx}" title="New File" style="padding: 3px 8px; font-size: 0.7rem; min-width: 55px;">+ File</button>
          <button class="module-action-btn" id="new-folder-btn-${panelIdx}" title="New Folder" style="padding: 3px 8px; font-size: 0.7rem; min-width: 65px;">+ Folder</button>
          <button class="module-action-btn" id="sort-toggle-btn-${panelIdx}" title="Toggle sort order" style="padding: 3px 8px; font-size: 0.7rem; min-width: 56px;">A-Z</button>
        </div>

        <div class="file-breadcrumbs-container">
          <div class="file-breadcrumbs" id="file-breadcrumbs-${panelIdx}">
            Loading...
          </div>
          <select class="drive-select" id="drive-select-${panelIdx}">
            <option value="">Drive...</option>
          </select>
        </div>

        <div class="file-explorer-main">
          <div class="file-list-container">
            <div class="file-list" id="file-list-${panelIdx}">
              <div class="file-item">
                <span class="file-name">Initializing...</span>
              </div>
            </div>
          </div>

          <div class="file-preview-splitter" id="file-preview-splitter-${panelIdx}" role="separator" aria-orientation="vertical" aria-label="Resize preview pane" tabindex="0"></div>

          <div class="file-preview-pane" id="file-preview-pane-${panelIdx}">    
            <div class="file-preview-header">
              <span id="preview-filename-${panelIdx}" style="font-weight:bold; font-size:0.85rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Preview</span>
              <button class="module-close-btn" style="width:24px; height:24px; font-size:0.8rem;" id="close-preview-${panelIdx}">&#10005;</button>
            </div>
            <div class="file-preview-content" id="file-preview-content-${panelIdx}">
              Select a file to preview.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function bindInteractions(panelIdx, initialState, store) {
  if (!panelStates.has(panelIdx)) {
    const homeDir = await window.fileApi.getHomeDir();
    const specialPaths = await window.fileApi.getSpecialPaths();
    const drives = await window.fileApi.getDrives();
    panelStates.set(panelIdx, {
      currentPath: homeDir,
      history: [homeDir],
      historyIdx: 0,
      previewPath: null,
      previewWidth: 380,
      selectedPaths: [],
      selectionAnchorPath: null,
      lastListedEntries: [],
      clipboard: null, // { items: [{ path, name }], mode }
      sortDirection: 'asc',
      specialPaths,
      drives
    });
  }

  const state = panelStates.get(panelIdx);
  if (initialState && typeof initialState === 'object') {
    if (typeof initialState.currentPath === 'string' && initialState.currentPath.trim()) {
      const nextPath = initialState.currentPath.trim();
      state.currentPath = nextPath;
      state.history = [nextPath];
      state.historyIdx = 0;
    }

    if (Array.isArray(initialState.selectedPaths)) {
      state.selectedPaths = [...new Set(initialState.selectedPaths.filter(Boolean))];
    }

    if (typeof initialState.selectionAnchorPath === 'string') {
      state.selectionAnchorPath = initialState.selectionAnchorPath;
    }

    if (typeof initialState.previewPath === 'string') {
      state.previewPath = initialState.previewPath;
    } else if (initialState.previewPath === null) {
      state.previewPath = null;
    }
  }

  updateSortToggleLabel(panelIdx);
  await refreshFileList(panelIdx);
  applyPreviewLayout(panelIdx);

  if (initialState?.previewPath) {
    await showPreview(panelIdx, initialState.previewPath, {
      isDirectory: initialState.previewIsDirectory === true
    });
  }

  const panelContent = document.getElementById(`panel-content-${panelIdx}`);    
  if (!panelContent) return;
  const newFileBtn = document.getElementById(`new-file-btn-${panelIdx}`);
  const newFolderBtn = document.getElementById(`new-folder-btn-${panelIdx}`);

  // Populate Drive Selector
  const driveSelect = document.getElementById(`drive-select-${panelIdx}`);      
  if (driveSelect && state.drives) {
    driveSelect.innerHTML = '<option value="">Drive...</option>';
    state.drives.forEach(drive => {
      const opt = document.createElement('option');
      opt.value = drive;
      opt.textContent = drive;
      opt.selected = state.currentPath.toLowerCase().startsWith(drive.toLowerCase());
      driveSelect.appendChild(opt);
    });

    driveSelect.onchange = (e) => {
      if (e.target.value) {
        navigateTo(panelIdx, e.target.value);
      }
    };
  }

  if (newFileBtn) {
    newFileBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await createNewFile(panelIdx);
    };
  }

  if (newFolderBtn) {
    newFolderBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await createNewFolder(panelIdx);
    };
  }

  setupPreviewResize(panelIdx);

  panelContent.oncontextmenu = (e) => {
    const item = e.target.closest('.file-item');
    if (item) {
        e.preventDefault();
        const path = item.dataset.path;
        if (!isPathSelected(panelIdx, path)) {
          selectPaths(panelIdx, [path], path);
        }
        showContextMenu(panelIdx, e.clientX, e.clientY, item.dataset, store);
    }
  };

  panelContent.onclick = async (e) => {
    hideContextMenu();

    // Quick Access
    const quickBtn = e.target.closest('[data-quick-path]');
    if (quickBtn) {
      const key = quickBtn.dataset.quickPath;
      const targetPath = state.specialPaths[key];
      if (targetPath) navigateTo(panelIdx, targetPath);
      return;
    }

    // New File
    if (e.target.closest(`#new-file-btn-${panelIdx}`)) {
      await createNewFile(panelIdx);
      return;
    }

    // New Folder
    if (e.target.closest(`#new-folder-btn-${panelIdx}`)) {
      await createNewFolder(panelIdx);
      return;
    }

    // Sort Toggle
    if (e.target.closest(`#sort-toggle-btn-${panelIdx}`)) {
      state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';     
      updateSortToggleLabel(panelIdx);
      refreshFileList(panelIdx);
      return;
    }

    // Breadcrumbs
    const bc = e.target.closest('[data-breadcrumb-path]');
    if (bc) {
      navigateTo(panelIdx, bc.dataset.breadcrumbPath);
      return;
    }

    // Close Preview
    if (e.target.closest(`#close-preview-${panelIdx}`)) {
      closePreview(panelIdx);
      return;
    }

    // Item click
    const item = e.target.closest('.file-item');
    if (item && !e.target.closest('.file-action-icon')) {
      const path = item.dataset.path;
      const isDir = item.dataset.isDirectory === 'true';
      if (e.shiftKey) {
        selectRange(panelIdx, path);
      } else if (e.ctrlKey || e.metaKey) {
        toggleSelection(panelIdx, path);
      } else {
        selectPaths(panelIdx, [path], path);
      }

      const state = panelStates.get(panelIdx);
      if (state.selectedPaths.length > 1) {
        showSelectionPreview(panelIdx);
      } else if (state.selectedPaths.length === 1) {
        showPreview(panelIdx, path, { isDirectory: isDir });
      } else {
        closePreview(panelIdx);
      }
      return;
    }

    // Delete
    const del = e.target.closest('[data-file-action="delete"]');
    if (del) {
      e.stopPropagation();
      if (confirm(`Delete ${del.dataset.name}?`)) {
        try {
          await window.fileApi.deleteFile(del.dataset.path);
          if (state.previewPath === del.dataset.path) {
            closePreview(panelIdx);
          }
          refreshFileList(panelIdx);
        } catch (err) { alert(err.message); }
      }
      return;
    }

    // Copy
    const copy = e.target.closest('[data-file-action="copy"]');
    if (copy) {
      e.stopPropagation();
      await beginClipboardTransfer(panelIdx, copy.dataset.path, copy.dataset.name, 'copy');
      return;
    }

    // Cut
    const cut = e.target.closest('[data-file-action="cut"]');
    if (cut) {
      e.stopPropagation();
      await beginClipboardTransfer(panelIdx, cut.dataset.path, cut.dataset.name, 'cut');
      return;
    }

    if (!e.target.closest('.file-preview-pane') && !e.target.closest('.file-breadcrumbs-container')) {
      clearSelection(panelIdx);
    }
  };

  panelContent.onmousedown = (e) => {
    if (e.button === 3) { navigateHistory(panelIdx, -1); }
    else if (e.button === 4) { navigateHistory(panelIdx, 1); }
  };

  panelContent.ondblclick = (e) => {
    const item = e.target.closest('.file-item');
    if (!item || e.target.closest('.file-action-icon')) {
      return;
    }

    const path = item.dataset.path;
    const isDir = item.dataset.isDirectory === 'true';

    if (isDir) {
      navigateTo(panelIdx, path);
    }
  };

  store.on('store:closed', () => {
    hideContextMenu();
  });
}

function navigateTo(panelIdx, path) {
  const state = panelStates.get(panelIdx);
  if (state.currentPath === path) return;
  state.history = state.history.slice(0, state.historyIdx + 1);
  state.history.push(path);
  state.historyIdx++;
  state.currentPath = path;
  clearSelection(panelIdx, false);
  refreshFileList(panelIdx);
}

function navigateHistory(panelIdx, delta) {
  const state = panelStates.get(panelIdx);
  if (!state) return;
  const nextIdx = state.historyIdx + delta;
  if (nextIdx < 0 || nextIdx >= state.history.length) return;
  state.historyIdx = nextIdx;
  state.currentPath = state.history[nextIdx];
  refreshFileList(panelIdx);
}

function showContextMenu(panelIdx, x, y, dataset, store) {
    hideContextMenu();
    const { path, isDirectory, name } = dataset;
    const isDir = isDirectory === 'true';
    const extension = isDir ? '' : getPathExtension(path);
    const isZipFile = extension === 'zip';
    const activeContext = store.getContext();
    const targetPanelIdx = activeContext.lastActivePanelIdx;
    const targetPanelLabel = getTargetPanelLabel(targetPanelIdx);

    const menu = document.createElement('div');
    menu.id = 'scrappy-file-context-menu';
    menu.className = 'scrappy-context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const addItem = (label, icon, action, disabled = false) => {
        const item = document.createElement('div');
        item.className = `scrappy-context-menu-item ${disabled ? 'disabled' : ''}`;
        item.innerHTML = `<span class="icon">${resolveContextIcon(icon)}</span> <span>${label}</span>`;
        if (!disabled) {
            item.onclick = (e) => {
                e.stopPropagation();
                action();
                hideContextMenu();
            };
        }
        menu.appendChild(item);
    };

    const addSeparator = () => {
        const sep = document.createElement('div');
        sep.className = 'scrappy-context-menu-separator';
        menu.appendChild(sep);
    };

    addItem('Open', 'open', () => {
        if (isDir) navigateTo(panelIdx, path);
        else showPreview(panelIdx, path);
    });

    if (!isDir) {
        addItem('Open in Writer', 'writer', () => window.openFileInWriter(path));
    }

    addSeparator();

    if (isZipFile) {
        addItem('Extract Here', 'extract', () => extractZipHere(panelIdx, path));
        addItem('Extract To Folder...', 'extract', () => extractZipToFolder(panelIdx, path, name));
        addSeparator();
    }

    addItem('Compress to ZIP...', 'zip', () => compressPathToZip(panelIdx, path, name));

    addSeparator();

    // Context Aware Insertion
    const canInsert = targetPanelIdx !== -1 && targetPanelIdx !== panelIdx;
    addItem(`Insert Name into ${targetPanelLabel}`, 'insert', () => {
        store.emit('data:insert', { type: 'text', data: name, targetPanelIdx });
    }, !canInsert);

    addItem(`Insert Path into ${targetPanelLabel}`, 'path', () => {
        store.emit('data:insert', { type: 'text', data: path, targetPanelIdx });
    }, !canInsert);

    addSeparator();

    addItem('Copy Path', 'copy', () => {
        navigator.clipboard.writeText(path);
    });

    addItem('Show in Data Panel', 'data', () => {
        window.openDataPanel({ title: name, data: { name, path, isDir }, type: 'json' });
    });

    document.body.appendChild(menu);

    // Close on click outside
    setTimeout(() => {
        document.addEventListener('click', hideContextMenu, { once: true });
    }, 10);
}

function hideContextMenu() {
    const existing = document.getElementById('scrappy-file-context-menu');
    if (existing) existing.remove();
}

function isPathSelected(panelIdx, filePath) {
  const state = panelStates.get(panelIdx);
  return Boolean(state?.selectedPaths?.includes(filePath));
}

function selectPaths(panelIdx, paths, anchorPath = null) {
  const state = panelStates.get(panelIdx);
  if (!state) return;
  state.selectedPaths = [...new Set(paths)];
  state.selectionAnchorPath = anchorPath ?? state.selectedPaths.at(-1) ?? null;
  syncSelectionUi(panelIdx);
}

function toggleSelection(panelIdx, filePath) {
  const state = panelStates.get(panelIdx);
  if (!state) return;

  if (state.selectedPaths.includes(filePath)) {
    state.selectedPaths = state.selectedPaths.filter((path) => path !== filePath);
  } else {
    state.selectedPaths = [...state.selectedPaths, filePath];
  }

  state.selectionAnchorPath = filePath;
  syncSelectionUi(panelIdx);
}

function selectRange(panelIdx, filePath) {
  const state = panelStates.get(panelIdx);
  if (!state) return;

  const orderedPaths = state.lastListedEntries.map((entry) => entry.path);
  const anchorPath = state.selectionAnchorPath ?? state.selectedPaths.at(-1) ?? filePath;
  const anchorIndex = orderedPaths.indexOf(anchorPath);
  const targetIndex = orderedPaths.indexOf(filePath);

  if (anchorIndex === -1 || targetIndex === -1) {
    selectPaths(panelIdx, [filePath], filePath);
    return;
  }

  const [start, end] = anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
  selectPaths(panelIdx, orderedPaths.slice(start, end + 1), anchorPath);
}

function clearSelection(panelIdx, updateUi = true) {
  const state = panelStates.get(panelIdx);
  if (!state) return;
  state.selectedPaths = [];
  state.selectionAnchorPath = null;
  if (updateUi) {
    syncSelectionUi(panelIdx);
    closePreview(panelIdx);
  }
}

function syncSelectionUi(panelIdx) {
  const state = panelStates.get(panelIdx);
  const selectedPaths = new Set(state?.selectedPaths || []);
  document.querySelectorAll(`#file-list-${panelIdx} .file-item`).forEach((item) => {
    item.classList.toggle('selected', selectedPaths.has(item.dataset.path));
  });
}

async function showPreview(panelIdx, filePath, options = {}) {
  const state = panelStates.get(panelIdx);
  state.previewPath = filePath;
  const pane = document.getElementById(`file-preview-pane-${panelIdx}`);
  const content = document.getElementById(`file-preview-content-${panelIdx}`);  
  const filename = document.getElementById(`preview-filename-${panelIdx}`);     
  pane.classList.add('active');
  applyPreviewLayout(panelIdx);
  filename.textContent = filePath.split(/[\\\/]/).pop();
  content.replaceChildren(document.createTextNode('Loading preview...'));       
  const ext = filePath.split('.').pop().toLowerCase();
  const isDirectory = Boolean(options.isDirectory);

  try {
    if (isDirectory) {
      content.replaceChildren(await renderFolderPreview(filePath));
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
      const img = document.createElement('img');
      img.src = toLocalFileUrl(filePath);
      img.alt = getFileName(filePath);
      img.onerror = () => {
        content.textContent = 'Could not load this image preview.';
      };
      content.replaceChildren(img);
    } else if (ext === 'docx') {
      const { html } = await window.fileApi.readDocxAsHtml(filePath);
      content.innerHTML = html || '<p>No content.</p>';
    } else if (ext === 'pdf') {
      content.replaceChildren(renderPdfPreview(filePath));
    } else if (ext === 'zip') {
      content.replaceChildren(await renderZipPreview(panelIdx, filePath));
    } else if (ext === 'url') {
      const text = await window.fileApi.readFile(filePath);
      content.replaceChildren(renderUrlPreview(text));
    } else if (['txt', 'md', 'markdown', 'html', 'js', 'json', 'css'].includes(ext)) {
      const text = await window.fileApi.readFile(filePath);
      if (ext === 'md' || ext === 'markdown') {
        content.replaceChildren(renderMarkdownPreview(text));
      } else {
        const pre = document.createElement('pre');
        pre.textContent = text;
        content.replaceChildren(pre);
      }
    } else {
      content.innerHTML = `<button class="module-action-btn" style="width:100%" onclick="window.openFileInWriter('${filePath.replace(/\\/g, '\\\\')}')">Open in Writer</button>`;
    }
  } catch (err) {
    content.textContent = `Error: ${err.message}`;
  }
}

function closePreview(panelIdx) {
  const state = panelStates.get(panelIdx);
  if (!state) return;

  state.previewPath = null;
  const pane = document.getElementById(`file-preview-pane-${panelIdx}`);
  if (pane) {
    pane.classList.remove('active');
  }
  applyPreviewLayout(panelIdx);
}

function openPreviewShell(panelIdx, title) {
  const pane = document.getElementById(`file-preview-pane-${panelIdx}`);
  const content = document.getElementById(`file-preview-content-${panelIdx}`);
  const filename = document.getElementById(`preview-filename-${panelIdx}`);
  if (!pane || !content || !filename) {
    return null;
  }

  pane.classList.add('active');
  applyPreviewLayout(panelIdx);
  filename.textContent = title;
  content.replaceChildren();

  return { pane, content, filename };
}

async function beginClipboardTransfer(panelIdx, clickedPath, clickedName, mode) {
  const state = panelStates.get(panelIdx);
  if (!state) {
    return;
  }

  const items = getClipboardSourceItems(panelIdx, clickedPath, clickedName);
  state.clipboard = { items, mode };

  let nextPath = state.currentPath;
  let overwrite = false;

  while (true) {
    const response = await requestTransferDestination(panelIdx, {
      title: mode === 'cut' ? 'Move Items' : 'Copy Items',
      description: buildClipboardPrompt(items, mode),
      initialValue: nextPath,
      initialOverwrite: overwrite,
      actionLabel: mode === 'cut' ? 'Move Here' : 'Copy Here',
      items,
      mode
    });

    if (!response) {
      return;
    }

    try {
      await executeClipboardTransfer(panelIdx, items, mode, response.value, response.overwrite);
      state.clipboard = null;
      await refreshFileList(panelIdx);
      return;
    } catch (err) {
      nextPath = response.value;
      overwrite = response.overwrite;
      await showFogreMessage({
        title: mode === 'cut' ? 'Could Not Move Items' : 'Could Not Copy Items',
        message: err.message || 'The transfer could not be completed.',
        tone: 'error',
        confirmLabel: 'Try Again'
      });
    }
  }
}

function requestTransferDestination(panelIdx, { title, description, initialValue, initialOverwrite, actionLabel, items, mode }) {
  return new Promise((resolve) => {
    const shell = openPreviewShell(panelIdx, title);
    if (!shell) {
      resolve(null);
      return;
    }

    const { content } = shell;
    const picker = document.createElement('div');
    picker.className = 'inline-transfer-picker';
    picker.innerHTML = `
      <div class="inline-transfer-picker__copy">${escapeHtml(description || '')}</div>
      <div class="inline-transfer-picker__summary">${items.length === 1 ? escapeHtml(items[0].name) : `${items.length} items selected`}</div>
      <label class="inline-transfer-picker__label" for="inline-transfer-destination">Destination Folder</label>
      <div class="inline-transfer-picker__field-row">
        <input id="inline-transfer-destination" class="inline-transfer-picker__input" type="text" value="${escapeHtmlAttribute(initialValue || '')}" />
        <button class="module-action-btn module-action-btn-secondary inline-transfer-picker__browse" type="button" id="inline-transfer-browse">Browse...</button>
      </div>
      <label class="inline-transfer-picker__checkbox">
        <input id="inline-transfer-overwrite" type="checkbox" ${initialOverwrite ? 'checked' : ''} />
        <span>Overwrite existing items if needed</span>
      </label>
      <div class="inline-transfer-picker__items">
        ${items.slice(0, 12).map((item) => `
          <div class="inline-transfer-picker__item">
            <span class="inline-transfer-picker__name">${escapeHtml(item.name)}</span>
            <span class="inline-transfer-picker__path">${escapeHtml(item.path)}</span>
          </div>
        `).join('')}
      </div>
      ${items.length > 12 ? `<p class="inline-transfer-picker__more">Showing 12 of ${items.length} items.</p>` : ''}
      <div class="inline-transfer-picker__actions">
        <button class="module-action-btn module-action-btn-secondary" type="button" id="inline-transfer-cancel">Cancel</button>
        <button class="module-action-btn" type="button" id="inline-transfer-confirm">${escapeHtml(actionLabel || 'Continue')}</button>
      </div>
    `;

    content.replaceChildren(picker);

    const input = picker.querySelector('#inline-transfer-destination');
    const overwrite = picker.querySelector('#inline-transfer-overwrite');
    const confirm = picker.querySelector('#inline-transfer-confirm');
    const cancel = picker.querySelector('#inline-transfer-cancel');
    const browse = picker.querySelector('#inline-transfer-browse');

    const cleanup = (payload) => {
      resolve(payload);
    };

    confirm.onclick = () => cleanup({
      value: input.value.trim(),
      overwrite: overwrite.checked
    });

    cancel.onclick = () => {
      closePreview(panelIdx);
      cleanup(null);
    };

    browse.onclick = async () => {
      const result = await window.fileApi.select({
        mode: 'folder',
        title: 'Choose Destination Folder',
        defaultPath: input.value.trim() || initialValue || undefined
      });

      if (!result?.canceled && result?.filePath) {
        input.value = result.filePath;
        requestAnimationFrame(() => {
          input.focus();
          input.select();
        });
      }
    };

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        cleanup({
          value: input.value.trim(),
          overwrite: overwrite.checked
        });
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closePreview(panelIdx);
        cleanup(null);
      }
    });

    requestAnimationFrame(() => {
      input?.focus();
      input?.select();
    });
  });
}

function getClipboardSourceItems(panelIdx, clickedPath, clickedName) {
  const state = panelStates.get(panelIdx);
  if (!state) {
    return [{ path: clickedPath, name: clickedName }];
  }

  const selectedEntries = state.lastListedEntries.filter((entry) => state.selectedPaths.includes(entry.path));
  if (selectedEntries.length > 1 && state.selectedPaths.includes(clickedPath)) {
    return selectedEntries.map((entry) => ({ path: entry.path, name: entry.name }));
  }

  return [{ path: clickedPath, name: clickedName }];
}

function buildClipboardPrompt(items, mode) {
  const count = items.length;
  const action = mode === 'cut' ? 'move' : 'copy';
  if (count === 1) {
    return `Choose the destination folder for ${action}ing ${items[0].name}.`;
  }
  return `Choose the destination folder for ${action}ing ${count} selected items.`;
}

async function executeClipboardTransfer(panelIdx, items, mode, destinationFolderPath, overwrite) {
  const state = panelStates.get(panelIdx);
  if (!state) {
    return;
  }

  if (!destinationFolderPath) {
    throw new Error('Choose a destination folder path.');
  }

  for (const item of items) {
    const targetPath = await resolveClipboardDestination(item.name, destinationFolderPath, overwrite);
    if (mode === 'cut') {
      await window.fileApi.moveFile(item.path, targetPath);
      if (state.previewPath === item.path || state.previewPath === targetPath) {
        closePreview(panelIdx);
      }
    } else {
      await window.fileApi.copyFile(item.path, targetPath);
    }
  }
}

async function resolveClipboardDestination(name, destinationFolderPath, overwrite) {
  let candidateName = name;
  let candidatePath = joinCurrentPath(destinationFolderPath, candidateName);

  if (overwrite) {
    return candidatePath;
  }

  while (await window.fileApi.exists(candidatePath)) {
    candidateName = getCopyName(candidateName);
    candidatePath = joinCurrentPath(destinationFolderPath, candidateName);
  }

  return candidatePath;
}

function getCopyName(name) {
  const parts = name.split('.');
  if (parts.length > 1) {
    const ext = parts.pop();
    const stem = parts.join('.');
    if (/ - copy(?: \d+)?$/i.test(stem)) {
      return `${incrementCopyStem(stem)}.${ext}`;
    }
    return `${stem} - copy.${ext}`;
  }

  if (/ - copy(?: \d+)?$/i.test(name)) {
    return incrementCopyStem(name);
  }

  return `${name} - copy`;
}

function incrementCopyStem(stem) {
  const match = stem.match(/^(.* - copy)(?: (\d+))?$/i);
  if (!match) {
    return `${stem} - copy`;
  }

  const base = match[1];
  const nextNumber = Number(match[2] || 1) + 1;
  return `${base} ${nextNumber}`;
}

function showSelectionPreview(panelIdx) {
  const state = panelStates.get(panelIdx);
  const pane = document.getElementById(`file-preview-pane-${panelIdx}`);
  const content = document.getElementById(`file-preview-content-${panelIdx}`);
  const filename = document.getElementById(`preview-filename-${panelIdx}`);
  if (!state || !pane || !content || !filename) {
    return;
  }

  pane.classList.add('active');
  applyPreviewLayout(panelIdx);

  const selectedEntries = state.lastListedEntries.filter((entry) => state.selectedPaths.includes(entry.path));
  const folderCount = selectedEntries.filter((entry) => entry.isDirectory).length;
  const fileCount = selectedEntries.length - folderCount;

  filename.textContent = `${selectedEntries.length} items selected`;
  content.replaceChildren(renderSelectionPreview(selectedEntries, fileCount, folderCount));
}

function getTargetPanelLabel(panelIdx) {
  if (panelIdx === -1) {
    return 'selected module';
  }

  const title = document.querySelector(`.panel[data-panel="${panelIdx}"] .module-title`);
  const label = title?.textContent?.trim();
  if (label) {
    return label;
  }

  return `Panel ${panelIdx + 1}`;
}

function setupPreviewResize(panelIdx) {
  const splitter = document.getElementById(`file-preview-splitter-${panelIdx}`);
  const main = document.querySelector(`#files-module-${panelIdx} .file-explorer-main`);
  if (!splitter || !main) {
    return;
  }

  const beginResize = (event) => {
    const state = panelStates.get(panelIdx);
    if (!state?.previewPath) {
      return;
    }

    previewResizeState = {
      panelIdx,
      mainRect: main.getBoundingClientRect()
    };

    splitter.classList.add('dragging');
    document.body.classList.add('is-resizing-preview');
    document.body.style.cursor = 'col-resize';
    event.preventDefault();
    event.stopPropagation();
  };

  splitter.onmousedown = beginResize;
  splitter.onkeydown = (event) => {
    const state = panelStates.get(panelIdx);
    if (!state?.previewPath) {
      return;
    }

    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    const delta = event.key === 'ArrowLeft' ? -24 : 24;
    adjustPreviewWidth(panelIdx, delta);
    event.preventDefault();
  };
}

function adjustPreviewWidth(panelIdx, delta) {
  const state = panelStates.get(panelIdx);
  const main = document.querySelector(`#files-module-${panelIdx} .file-explorer-main`);
  if (!state || !main) {
    return;
  }

  const mainWidth = main.getBoundingClientRect().width;
  const maxPreviewWidth = Math.max(260, mainWidth - 260);
  state.previewWidth = clampPreviewWidth((state.previewWidth || 380) - delta, maxPreviewWidth);
  applyPreviewLayout(panelIdx);
}

function handlePreviewResize(event) {
  if (!previewResizeState) {
    return;
  }

  const { panelIdx, mainRect } = previewResizeState;
  const state = panelStates.get(panelIdx);
  if (!state) {
    stopPreviewResize();
    return;
  }

  const maxPreviewWidth = Math.max(260, mainRect.width - 260);
  const nextPreviewWidth = mainRect.right - event.clientX;
  state.previewWidth = clampPreviewWidth(nextPreviewWidth, maxPreviewWidth);
  applyPreviewLayout(panelIdx);
}

function stopPreviewResize() {
  if (!previewResizeState) {
    return;
  }

  const splitter = document.getElementById(`file-preview-splitter-${previewResizeState.panelIdx}`);
  splitter?.classList.remove('dragging');
  previewResizeState = null;
  document.body.classList.remove('is-resizing-preview');
  document.body.style.cursor = '';
}

function clampPreviewWidth(width, maxWidth) {
  return Math.max(260, Math.min(maxWidth, width));
}

function applyPreviewLayout(panelIdx) {
  const state = panelStates.get(panelIdx);
  const main = document.querySelector(`#files-module-${panelIdx} .file-explorer-main`);
  const splitter = document.getElementById(`file-preview-splitter-${panelIdx}`);
  const pane = document.getElementById(`file-preview-pane-${panelIdx}`);
  if (!state || !main || !splitter || !pane) {
    return;
  }

  const hasPreview = Boolean(state.previewPath);
  splitter.classList.toggle('active', hasPreview);

  if (!hasPreview) {
    pane.style.width = '';
    return;
  }

  const mainWidth = main.getBoundingClientRect().width;
  const maxPreviewWidth = Math.max(260, mainWidth - 260);
  state.previewWidth = clampPreviewWidth(state.previewWidth || 380, maxPreviewWidth);
  pane.style.width = `${state.previewWidth}px`;
}

window.addEventListener('mousemove', handlePreviewResize);
window.addEventListener('mouseup', stopPreviewResize);
window.addEventListener('resize', () => {
  panelStates.forEach((_, panelIdx) => applyPreviewLayout(panelIdx));
});

function renderSimpleMarkdown(md) {
  const container = document.createElement('div');
  container.innerHTML = md.split(/\r?\n/).map(line => `<div>${escapeHtml(line)}</div>`).join('');
  return container;
}

function renderMarkdownPreview(md) {
  const container = document.createElement('div');
  container.className = 'markdown-preview';

  const lines = md.split(/\r?\n/);
  let inList = false;
  let inCodeBlock = false;
  let codeLines = [];

  const flushList = () => {
    if (!inList) return;
    inList = false;
    const list = document.createElement('ul');
    list.className = 'markdown-preview-list';
    list.innerHTML = codeLines.join('');
    container.appendChild(list);
    codeLines = [];
  };

  const flushCode = () => {
    if (!inCodeBlock) return;
    inCodeBlock = false;
    const pre = document.createElement('pre');
    pre.textContent = codeLines.join('\n');
    container.appendChild(pre);
    codeLines = [];
  };

  lines.forEach((line) => {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        flushCode();
      } else {
        flushList();
        inCodeBlock = true;
        codeLines = [];
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    const listMatch = line.match(/^\s*[-*]\s+(.+)$/);
    if (listMatch) {
      if (!inList) {
        flushCode();
        inList = true;
        codeLines = [];
      }
      codeLines.push(`<li>${renderInlineMarkdown(listMatch[1])}</li>`);
      return;
    }

    flushList();

    if (!line.trim()) {
      container.appendChild(document.createElement('br'));
      return;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(6, headingMatch[1].length);
      const heading = document.createElement(`h${level}`);
      heading.innerHTML = renderInlineMarkdown(headingMatch[2]);
      container.appendChild(heading);
      return;
    }

    const blockquoteMatch = line.match(/^\s*>\s?(.*)$/);
    if (blockquoteMatch) {
      const blockquote = document.createElement('blockquote');
      blockquote.innerHTML = renderInlineMarkdown(blockquoteMatch[1]);
      container.appendChild(blockquote);
      return;
    }

    const paragraph = document.createElement('p');
    paragraph.innerHTML = renderInlineMarkdown(line);
    container.appendChild(paragraph);
  });

  flushList();
  flushCode();

  return container;
}

function renderInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function renderPdfPreview(filePath) {
  const wrapper = document.createElement('div');
  wrapper.className = 'pdf-preview';

  const toolbar = document.createElement('div');
  toolbar.className = 'file-preview-toolbar';

  const openButton = document.createElement('button');
  openButton.className = 'module-action-btn';
  openButton.type = 'button';
  openButton.textContent = 'Open PDF';
  openButton.onclick = () => window.shellApi.openPath(filePath);

  toolbar.appendChild(openButton);

  const iframe = document.createElement('iframe');
  iframe.className = 'pdf-preview-frame';
  iframe.src = `${toLocalFileUrl(filePath)}#view=FitH`;
  iframe.title = 'PDF Preview';

  wrapper.appendChild(toolbar);
  wrapper.appendChild(iframe);
  return wrapper;
}

function renderUrlPreview(text) {
  const wrapper = document.createElement('div');
  wrapper.className = 'url-preview';

  const urlMatch = text.match(/^\s*URL=(.+)$/im);
  const url = urlMatch?.[1]?.trim();

  const label = document.createElement('div');
  label.className = 'file-preview-meta';
  label.textContent = url ? 'Internet Shortcut' : 'URL shortcut file';
  wrapper.appendChild(label);

  const target = document.createElement(url ? 'a' : 'pre');
  if (url) {
    target.href = url;
    target.target = '_blank';
    target.rel = 'noreferrer';
    target.textContent = url;
  } else {
    target.textContent = text;
  }
  wrapper.appendChild(target);

  if (url) {
    const actions = document.createElement('div');
    actions.className = 'file-preview-toolbar';

    const button = document.createElement('button');
    button.className = 'module-action-btn';
    button.type = 'button';
    button.textContent = 'Open Link';
    button.onclick = () => window.shellApi.openExternal(url);
    actions.appendChild(button);
    wrapper.appendChild(actions);
  }

  return wrapper;
}

async function renderZipPreview(panelIdx, zipPath) {
  const summary = await window.fileApi.readZipContents(zipPath);
  const wrapper = document.createElement('div');
  wrapper.className = 'zip-preview';

  const meta = document.createElement('div');
  meta.className = 'file-preview-meta';
  meta.textContent = `${summary.fileCount} file${summary.fileCount === 1 ? '' : 's'} • ${summary.directoryCount} folder${summary.directoryCount === 1 ? '' : 's'} inside archive`;
  wrapper.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'file-preview-toolbar';

  const extractHereButton = document.createElement('button');
  extractHereButton.className = 'module-action-btn';
  extractHereButton.type = 'button';
  extractHereButton.textContent = 'Extract Here';
  extractHereButton.onclick = () => extractZipHere(panelIdx, zipPath);

  const extractToButton = document.createElement('button');
  extractToButton.className = 'module-action-btn module-action-btn-secondary';
  extractToButton.type = 'button';
  extractToButton.textContent = 'Extract To Folder...';
  extractToButton.onclick = () => extractZipToFolder(panelIdx, zipPath, getFileName(zipPath));

  actions.appendChild(extractHereButton);
  actions.appendChild(extractToButton);
  wrapper.appendChild(actions);

  const list = document.createElement('div');
  list.className = 'zip-preview-list';

  if (summary.entries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'folder-preview-empty';
    empty.textContent = 'This ZIP archive is empty.';
    wrapper.appendChild(empty);
    return wrapper;
  }

  summary.entries.slice(0, 40).forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'zip-preview-item';
    row.innerHTML = `
      <span class="file-icon">${entry.isDirectory ? 'DIR' : getFileIcon({ name: entry.fullName, isDirectory: false })}</span>
      <span class="zip-preview-name">${escapeHtml(entry.fullName)}</span>
      <span class="zip-preview-size">${entry.isDirectory ? '' : formatBytes(entry.length)}</span>
    `;
    list.appendChild(row);
  });

  wrapper.appendChild(list);

  if (summary.entries.length > 40) {
    const more = document.createElement('p');
    more.className = 'folder-preview-more';
    more.textContent = `Showing 40 of ${summary.entries.length} archive entries.`;
    wrapper.appendChild(more);
  }

  return wrapper;
}

async function renderFolderPreview(folderPath) {
  const entries = await window.fileApi.listDir(folderPath);
  const wrapper = document.createElement('div');
  wrapper.className = 'folder-preview';

  const meta = document.createElement('div');
  meta.className = 'file-preview-meta';
  const folderCount = entries.filter((entry) => entry.isDirectory).length;
  const fileCount = entries.length - folderCount;
  meta.textContent = `${folderCount} folder${folderCount === 1 ? '' : 's'} • ${fileCount} file${fileCount === 1 ? '' : 's'}`;
  wrapper.appendChild(meta);

  const list = document.createElement('div');
  list.className = 'folder-preview-list';

  if (entries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'folder-preview-empty';
    empty.textContent = 'This folder is empty.';
    wrapper.appendChild(empty);
    return wrapper;
  }

  entries
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, 24)
    .forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'folder-preview-item';
      row.innerHTML = `
        <span class="file-icon">${getFileIcon(entry)}</span>
        <span class="folder-preview-name">${escapeHtml(entry.name)}</span>
      `;
      list.appendChild(row);
    });

  wrapper.appendChild(list);

  if (entries.length > 24) {
    const more = document.createElement('p');
    more.className = 'folder-preview-more';
    more.textContent = `Showing 24 of ${entries.length} items. Double-click the folder to open it.`;
    wrapper.appendChild(more);
  }

  return wrapper;
}

function renderSelectionPreview(entries, fileCount, folderCount) {
  const wrapper = document.createElement('div');
  wrapper.className = 'selection-preview';

  const meta = document.createElement('div');
  meta.className = 'file-preview-meta';
  meta.textContent = `${folderCount} folder${folderCount === 1 ? '' : 's'} • ${fileCount} file${fileCount === 1 ? '' : 's'} selected`;
  wrapper.appendChild(meta);

  const list = document.createElement('div');
  list.className = 'selection-preview-list';

  entries.slice(0, 24).forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'selection-preview-item';
    row.innerHTML = `
      <span class="file-icon">${getFileIcon(entry)}</span>
      <span class="selection-preview-name">${escapeHtml(entry.name)}</span>
      <span class="selection-preview-kind">${entry.isDirectory ? 'Folder' : getPathExtension(entry.name).toUpperCase() || 'File'}</span>
    `;
    list.appendChild(row);
  });

  wrapper.appendChild(list);

  if (entries.length > 24) {
    const more = document.createElement('p');
    more.className = 'folder-preview-more';
    more.textContent = `Showing 24 of ${entries.length} selected items.`;
    wrapper.appendChild(more);
  }

  return wrapper;
}

function joinCurrentPath(basePath, name) {
  const sep = basePath.includes(':') ? '\\' : '/';
  return basePath + (basePath.endsWith(sep) ? '' : sep) + name;
}

function getFileName(filePath) {
  return String(filePath).split(/[\\\/]/).pop() || filePath;
}

function toLocalFileUrl(filePath) {
  const normalized = String(filePath).replace(/\\/g, '/');

  if (/^[A-Za-z]:\//.test(normalized)) {
    const [drive, ...segments] = normalized.split('/');
    return `file:///${drive}/${segments.map(encodeURIComponent).join('/')}`;
  }

  const trimmed = normalized.startsWith('/') ? normalized.slice(1) : normalized;
  return `file:///${trimmed.split('/').map(encodeURIComponent).join('/')}`;
}

function getPathExtension(filePath) {
  const name = getFileName(filePath);
  const dotIndex = name.lastIndexOf('.');
  return dotIndex === -1 ? '' : name.slice(dotIndex + 1).toLowerCase();
}

function stripLastExtension(name) {
  const dotIndex = name.lastIndexOf('.');
  return dotIndex === -1 ? name : name.slice(0, dotIndex);
}

function getParentPath(filePath) {
  const normalized = String(filePath).replace(/\//g, '\\');
  const driveMatch = normalized.match(/^[A-Za-z]:\\$/);
  if (driveMatch) {
    return normalized;
  }

  const trimmed = normalized.replace(/\\+$/, '');
  const lastSlash = trimmed.lastIndexOf('\\');
  if (lastSlash <= 0) {
    return normalized;
  }
  return trimmed.slice(0, lastSlash);
}

async function extractZipHere(panelIdx, zipPath) {
  const destinationPath = getParentPath(zipPath);
  try {
    await window.fileApi.extractZip(zipPath, destinationPath, true);
    await refreshFileList(panelIdx);
  } catch (err) {
    alert(`Could not extract ZIP: ${err.message}`);
  }
}

async function extractZipToFolder(panelIdx, zipPath, zipName) {
  const parentPath = getParentPath(zipPath);
  let nextPath = joinCurrentPath(parentPath, stripLastExtension(zipName));
  let overwrite = false;

  while (true) {
    const response = await requestPathOperation({
      title: 'Extract ZIP',
      description: 'Choose the destination folder for the extracted contents.',
      placeholder: nextPath,
      initialValue: nextPath,
      actionLabel: 'Extract',
      overwriteLabel: 'Overwrite if destination already exists',
      initialOverwrite: overwrite
    });

    if (!response) {
      return;
    }

    try {
      await window.fileApi.extractZip(zipPath, response.value, response.overwrite);
      await refreshFileList(panelIdx);
      return;
    } catch (err) {
      nextPath = response.value;
      overwrite = response.overwrite;
      await showFogreMessage({
        title: 'Could Not Extract ZIP',
        message: err.message || 'The archive could not be extracted.',
        tone: 'error',
        confirmLabel: 'Try Again'
      });
    }
  }
}

async function compressPathToZip(panelIdx, sourcePath, sourceName) {
  const parentPath = getParentPath(sourcePath);
  let nextPath = joinCurrentPath(parentPath, `${sourceName}.zip`);
  let overwrite = false;

  while (true) {
    const response = await requestPathOperation({
      title: 'Create ZIP',
      description: 'Pick the ZIP file path for this archive.',
      placeholder: nextPath,
      initialValue: nextPath,
      actionLabel: 'Compress',
      overwriteLabel: 'Overwrite existing ZIP if needed',
      initialOverwrite: overwrite
    });

    if (!response) {
      return;
    }

    try {
      await window.fileApi.createZip(sourcePath, response.value, response.overwrite);
      await refreshFileList(panelIdx);
      return;
    } catch (err) {
      nextPath = response.value;
      overwrite = response.overwrite;
      await showFogreMessage({
        title: 'Could Not Create ZIP',
        message: err.message || 'The ZIP archive could not be created.',
        tone: 'error',
        confirmLabel: 'Try Again'
      });
    }
  }
}

async function createNewFile(panelIdx) {
  const state = panelStates.get(panelIdx);
  if (!state) return;

  const name = await requestName({
    title: 'New File',
    placeholder: 'example.txt',
    actionLabel: 'Create File'
  });
  if (!name?.trim()) return;

  try {
    const fullPath = joinCurrentPath(state.currentPath, name.trim());
    await window.fileApi.createFile(fullPath);
    await refreshFileList(panelIdx);
  } catch (err) {
    alert(`Could not create file: ${err.message}`);
  }
}

async function createNewFolder(panelIdx) {
  const state = panelStates.get(panelIdx);
  if (!state) return;

  const name = await requestName({
    title: 'New Folder',
    placeholder: 'My Folder',
    actionLabel: 'Create Folder'
  });
  if (!name?.trim()) return;

  try {
    const fullPath = joinCurrentPath(state.currentPath, name.trim());
    await window.fileApi.createFolder(fullPath);
    await refreshFileList(panelIdx);
  } catch (err) {
    alert(`Could not create folder: ${err.message}`);
  }
}

function requestName({ title, placeholder, actionLabel }) {
  return new Promise((resolve) => {
    const existing = document.getElementById('fogre-name-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'fogre-name-modal-overlay';
    overlay.className = 'event-modal-overlay';
    overlay.innerHTML = `
      <div class="event-modal">
        <h3>${escapeHtml(title)}</h3>
        <input type="text" id="fogre-name-input" placeholder="${escapeHtmlAttribute(placeholder || '')}" autofocus />
        <div class="event-modal-actions">
          <button class="event-modal-btn cancel" id="fogre-name-cancel">Cancel</button>
          <button class="event-modal-btn save" id="fogre-name-confirm">${escapeHtml(actionLabel || 'Create')}</button>
        </div>
      </div>
    `;

    const cleanup = (value) => {
      overlay.remove();
      resolve(value);
    };

    document.body.appendChild(overlay);

    const input = overlay.querySelector('#fogre-name-input');
    const confirmButton = overlay.querySelector('#fogre-name-confirm');
    const cancelButton = overlay.querySelector('#fogre-name-cancel');

    cancelButton.onclick = () => cleanup(null);
    confirmButton.onclick = () => cleanup(input.value);

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        cleanup(null);
      }
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        cleanup(input.value);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        cleanup(null);
      }
    });

    input.focus();
    input.select();
  });
}

function requestPathOperation({ title, description, placeholder, initialValue, actionLabel, overwriteLabel, initialOverwrite = false }) {
  return new Promise((resolve) => {
    const existing = document.getElementById('fogre-path-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'fogre-path-modal-overlay';
    overlay.className = 'event-modal-overlay';
    overlay.innerHTML = `
      <div class="event-modal fogre-path-modal">
        <h3>${escapeHtml(title)}</h3>
        <p class="fogre-modal-copy">${escapeHtml(description || '')}</p>
        <input type="text" id="fogre-path-input" placeholder="${escapeHtmlAttribute(placeholder || '')}" value="${escapeHtmlAttribute(initialValue || '')}" autofocus />
        <label class="fogre-modal-checkbox">
          <input type="checkbox" id="fogre-path-overwrite" ${initialOverwrite ? 'checked' : ''} />
          <span>${escapeHtml(overwriteLabel || 'Overwrite if needed')}</span>
        </label>
        <div class="event-modal-actions">
          <button class="event-modal-btn cancel" id="fogre-path-cancel">Cancel</button>
          <button class="event-modal-btn save" id="fogre-path-confirm">${escapeHtml(actionLabel || 'Continue')}</button>
        </div>
      </div>
    `;

    const cleanup = (value) => {
      overlay.remove();
      resolve(value);
    };

    document.body.appendChild(overlay);

    const input = overlay.querySelector('#fogre-path-input');
    const overwrite = overlay.querySelector('#fogre-path-overwrite');
    const confirmButton = overlay.querySelector('#fogre-path-confirm');
    const cancelButton = overlay.querySelector('#fogre-path-cancel');

    cancelButton.onclick = () => cleanup(null);
    confirmButton.onclick = () => cleanup({ value: input.value.trim(), overwrite: overwrite.checked });

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        cleanup(null);
      }
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        cleanup({ value: input.value.trim(), overwrite: overwrite.checked });
      } else if (event.key === 'Escape') {
        event.preventDefault();
        cleanup(null);
      }
    });

    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  });
}

function showFogreMessage({ title, message, tone = 'info', confirmLabel = 'OK' }) {
  return new Promise((resolve) => {
    const existing = document.getElementById('fogre-message-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'fogre-message-modal-overlay';
    overlay.className = 'event-modal-overlay';
    overlay.innerHTML = `
      <div class="event-modal fogre-message-modal fogre-message-modal--${escapeHtmlAttribute(tone)}">
        <h3>${escapeHtml(title)}</h3>
        <p class="fogre-modal-copy">${escapeHtml(message || '')}</p>
        <div class="event-modal-actions">
          <button class="event-modal-btn save" id="fogre-message-confirm">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;

    const cleanup = () => {
      overlay.remove();
      resolve();
    };

    document.body.appendChild(overlay);

    const confirmButton = overlay.querySelector('#fogre-message-confirm');
    confirmButton.onclick = cleanup;

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        cleanup();
      }
    });

    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault();
        cleanup();
      }
    });

    requestAnimationFrame(() => {
      confirmButton.focus();
    });
  });
}

function updateSortToggleLabel(panelIdx) {
  const state = panelStates.get(panelIdx);
  const button = document.getElementById(`sort-toggle-btn-${panelIdx}`);
  if (!state || !button) return;

  const isDescending = state.sortDirection === 'desc';
  button.textContent = isDescending ? 'Z-A' : 'A-Z';
  button.title = isDescending ? 'Sort descending' : 'Sort ascending';
}

function getFileIcon(entry) {
  if (entry.isDirectory) {
    return 'DIR';
  }

  const ext = entry.name.includes('.') ? entry.name.split('.').pop().toLowerCase() : '';
  const iconMap = {
    css: 'CSS',
    docx: 'DOC',
    gif: 'IMG',
    htm: 'WEB',
    html: 'WEB',
    jpeg: 'IMG',
    jpg: 'IMG',
    js: 'JS',
    json: 'JSON',
    markdown: 'MD',
    md: 'MD',
    png: 'IMG',
    svg: 'SVG',
    txt: 'TXT',
    webp: 'IMG',
    zip: 'ZIP'
  };

  return iconMap[ext] || 'FILE';
}

function renderBreadcrumbs(pathValue) {
  if (!pathValue) {
    return 'Loading...';
  }

  const normalized = pathValue.replace(/\//g, '\\');
  const driveMatch = normalized.match(/^[A-Za-z]:\\/);

  if (driveMatch) {
    const driveRoot = driveMatch[0];
    const segments = normalized.slice(driveRoot.length).split('\\').filter(Boolean);
    const crumbs = [
      `<button type="button" class="breadcrumb-btn" data-breadcrumb-path="${escapeHtmlAttribute(driveRoot)}">${escapeHtml(driveRoot.replace(/\\$/, ''))}</button>`
    ];

    let currentPath = driveRoot;
    segments.forEach((segment) => {
      currentPath = `${currentPath}${segment}\\`;
      crumbs.push(`<span class="breadcrumb-separator">/</span>`);
      crumbs.push(`<button type="button" class="breadcrumb-btn" data-breadcrumb-path="${escapeHtmlAttribute(currentPath.replace(/\\$/, ''))}">${escapeHtml(segment)}</button>`);
    });

    return crumbs.join('');
  }

  const isAbsoluteUnix = normalized.startsWith('\\');
  const segments = normalized.split('\\').filter(Boolean);
  if (segments.length === 0) {
    return escapeHtml(pathValue);
  }

  const crumbs = [];
  let currentPath = isAbsoluteUnix ? '\\' : '';

  if (isAbsoluteUnix) {
    crumbs.push(`<button type="button" class="breadcrumb-btn" data-breadcrumb-path="\\">Root</button>`);
  }

  segments.forEach((segment, index) => {
    currentPath = isAbsoluteUnix
      ? `${currentPath}${currentPath.endsWith('\\') ? '' : '\\'}${segment}`
      : (currentPath ? `${currentPath}\\${segment}` : segment);

    if (crumbs.length > 0) {
      crumbs.push(`<span class="breadcrumb-separator">/</span>`);
    }

    crumbs.push(`<button type="button" class="breadcrumb-btn" data-breadcrumb-path="${escapeHtmlAttribute(currentPath)}">${escapeHtml(segment)}</button>`);
  });

  return crumbs.join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeHtmlAttribute(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function formatBytes(bytes) {
  const numeric = Number(bytes) || 0;
  if (numeric < 1024) {
    return `${numeric} B`;
  }

  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = numeric / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

async function refreshFileList(panelIdx) {
  const state = panelStates.get(panelIdx);
  if (!state) return;
  const bcEl = document.getElementById(`file-breadcrumbs-${panelIdx}`);
  const listEl = document.getElementById(`file-list-${panelIdx}`);
  try {
    const entries = await window.fileApi.listDir(state.currentPath);
    const direction = state.sortDirection === 'desc' ? -1 : 1;
    entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name) * direction;
    });
    state.lastListedEntries = entries;
    state.selectedPaths = state.selectedPaths.filter((selectedPath) => entries.some((entry) => entry.path === selectedPath));
    if (state.selectionAnchorPath && !state.selectedPaths.includes(state.selectionAnchorPath)) {
      state.selectionAnchorPath = state.selectedPaths.at(-1) ?? null;
    }
    bcEl.innerHTML = renderBreadcrumbs(state.currentPath);
    listEl.innerHTML = entries.map(entry => `
      <div class="file-item ${state.selectedPaths.includes(entry.path) ? 'selected' : ''}" data-path="${escapeHtmlAttribute(entry.path)}" data-is-directory="${entry.isDirectory}" data-name="${escapeHtmlAttribute(entry.name)}">
        <span class="file-icon">${getFileIcon(entry)}</span>
        <span class="file-name">${entry.name}</span>
        <div class="file-actions-menu">
          <span class="file-action-icon" data-file-action="cut" data-path="${escapeHtmlAttribute(entry.path)}" data-name="${escapeHtmlAttribute(entry.name)}" title="Cut">K</span>
          <span class="file-action-icon" data-file-action="copy" data-path="${escapeHtmlAttribute(entry.path)}" data-name="${escapeHtmlAttribute(entry.name)}" title="Copy">C</span>
          <span class="file-action-icon" data-file-action="delete" data-path="${escapeHtmlAttribute(entry.path)}" data-name="${escapeHtmlAttribute(entry.name)}" title="Delete">X</span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    listEl.textContent = err.message;
  }
}
