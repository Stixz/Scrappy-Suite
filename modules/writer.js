export function renderWriter(panelIdx) {
  return `
    <div class="module-shell writer-module">
      <div class="module-topbar">
        <h2 class="accent module-title">DirT Writer</h2>
        <button class="module-close-btn" data-close-panel="${panelIdx}" title="Close panel">&#10005;</button>
      </div>

      <div class="module-body writer-body">
        <input id="doc-title-${panelIdx}" class="writer-title-input" type="text" placeholder="Untitled document" value="Untitled Document" />

        <div class="writer-toolbar" role="toolbar" aria-label="Document formatting toolbar">
          <button class="writer-tool-btn" data-writer-command="bold" data-panel="${panelIdx}" type="button" title="Bold"><strong>B</strong></button>
          <button class="writer-tool-btn" data-writer-command="italic" data-panel="${panelIdx}" type="button" title="Italic"><em>I</em></button>
          <button class="writer-tool-btn" data-writer-command="underline" data-panel="${panelIdx}" type="button" title="Underline"><u>U</u></button>
          <button class="writer-tool-btn" data-writer-command="insertUnorderedList" data-panel="${panelIdx}" type="button" title="Bullet List">&#8226; List</button>
          <button class="writer-tool-btn" data-writer-command="insertOrderedList" data-panel="${panelIdx}" type="button" title="Numbered List">1. List</button>
          <button class="writer-tool-btn" data-writer-action="insert-blockquote" data-panel="${panelIdx}" type="button" title="Quote">&#10077; Quote</button>
          <button class="writer-tool-btn" data-writer-action="insert-inline-code" data-panel="${panelIdx}" type="button" title="Inline Code">&lt;&gt;</button>  
          <button class="writer-tool-btn" data-writer-action="insert-code-block" data-panel="${panelIdx}" type="button" title="Code Block">&lt;/&gt;</button>   
          <button class="writer-tool-btn" data-writer-action="insert-image-block" data-panel="${panelIdx}" type="button" title="Image Block">&#128247;</button> 
          <button class="writer-tool-btn" data-writer-command="removeFormat" data-panel="${panelIdx}" type="button" title="Clear Selected Formatting">Clear Selection</button>
        </div>

        <div id="doc-writer-area-${panelIdx}" class="doc-writer-textarea doc-writer-editor" contenteditable="true" spellcheck="true" data-placeholder="Start writing here..."><p>Start writing here...</p></div>

        <div class="module-actions writer-actions">
          <button id="new-doc-btn-${panelIdx}" class="module-action-btn" type="button">New</button>
          <button id="open-doc-btn-${panelIdx}" class="module-action-btn" type="button">Open</button>
          <button id="save-doc-btn-${panelIdx}" class="module-action-btn" type="button">Save</button>
          <button id="save-as-doc-btn-${panelIdx}" class="module-action-btn module-action-btn-secondary" type="button">Save As</button>
          <button id="print-doc-btn-${panelIdx}" class="module-action-btn module-action-btn-secondary" type="button">Print</button>
          <button id="save-pdf-doc-btn-${panelIdx}" class="module-action-btn module-action-btn-secondary" type="button">Save PDF</button>
          <span id="save-status-${panelIdx}" class="module-status writer-status"></span>
        </div>
      </div>
    </div>
  `;
}

const WRITER_DRAFT_KEY = 'scrappy_writer_draft';
const writerStates = new Map();

export function bindInteractions(panelIdx, initialState = null, store) {        
  const restoredDraft = !initialState ? loadDraft() : null;
  const resolvedInitialState = initialState ?? restoredDraft;
  const state = {
    filePath: resolvedInitialState?.filePath || null,
    title: resolvedInitialState?.title
      || (resolvedInitialState?.filePath ? resolvedInitialState.filePath.split(/[\\\/]/).pop() : 'Untitled Document'),
    lastRange: null,
    lastSavedTitle: resolvedInitialState?.title
      || (resolvedInitialState?.filePath ? resolvedInitialState.filePath.split(/[\\\/]/).pop() : 'Untitled Document'),
    lastSavedContent: resolvedInitialState?.content !== undefined
      ? resolvedInitialState.content
      : '<p>Start writing here...</p>'
  };
  writerStates.set(panelIdx, state);

  const editor = document.getElementById(`doc-writer-area-${panelIdx}`);        
  const titleInput = document.getElementById(`doc-title-${panelIdx}`);
  const saveBtn = document.getElementById(`save-doc-btn-${panelIdx}`);
  const saveAsBtn = document.getElementById(`save-as-doc-btn-${panelIdx}`);     
  const printBtn = document.getElementById(`print-doc-btn-${panelIdx}`);
  const savePdfBtn = document.getElementById(`save-pdf-doc-btn-${panelIdx}`);
  const openBtn = document.getElementById(`open-doc-btn-${panelIdx}`);
  const saveStatus = document.getElementById(`save-status-${panelIdx}`);        

  if (resolvedInitialState?.content !== undefined) {
    editor.innerHTML = resolvedInitialState.content;
  }
  if (titleInput && state.title) {
    titleInput.value = state.title;
  }

  ensureEditorReady(editor);
  ensureEditorCaret(editor);

  persistDraftFromEditor(panelIdx);
  syncDirtyState(panelIdx);

  const performSave = async (saveAs = false) => {
    try {
      const payload = {
        filePath: state.filePath,
        title: titleInput.value,
        contentHtml: editor.innerHTML,
        plainText: editor.innerText,
        preferredExtension: 'docx'
      };

      const result = saveAs
        ? await window.documentApi.saveAs(payload)
        : await window.documentApi.save(payload);

      if (!result.canceled) {
        state.filePath = result.filePath;
        const fileName = result.filePath.split(/[\\\/]/).pop();
        state.title = fileName.replace(/\.[^/.]+$/, "");
        titleInput.value = state.title;
        state.lastSavedTitle = state.title;
        state.lastSavedContent = editor.innerHTML;
        persistDraft(state, editor.innerHTML);
        syncDirtyState(panelIdx);
        saveStatus.textContent = saveAs ? 'Saved As!' : 'Saved!';
        setTimeout(() => { if (saveStatus) saveStatus.textContent = ''; }, 1200);
      }
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    }
  };

  const buildDocumentPayload = () => ({
    filePath: state.filePath,
    title: titleInput.value,
    contentHtml: editor.innerHTML,
    plainText: editor.innerText,
    preferredExtension: 'docx'
  });

  const flashStatus = (message, duration = 1600) => {
    if (!saveStatus) {
      return;
    }
    saveStatus.textContent = message;
    setTimeout(() => {
      if (saveStatus.textContent === message) {
        saveStatus.textContent = '';
      }
    }, duration);
  };

  const performPrint = async (mode = 'print') => {
    try {
      const payload = buildDocumentPayload();
      const result = mode === 'pdf'
        ? await window.documentApi.savePdf(payload)
        : await window.documentApi.print(payload);

      if (result?.success) {
        flashStatus(mode === 'pdf' ? 'PDF Saved' : 'Print Ready', 1800);
        return;
      }

      if (!result?.canceled) {
        alert(`${mode === 'pdf' ? 'PDF export' : 'Print'} failed: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      alert(`${mode === 'pdf' ? 'PDF export' : 'Print'} failed: ${error.message}`);
    }
  };

  if (saveBtn) saveBtn.onclick = () => performSave(false);
  if (saveAsBtn) saveAsBtn.onclick = () => performSave(true);
  if (printBtn) printBtn.onclick = () => performPrint('print');
  if (savePdfBtn) savePdfBtn.onclick = () => performPrint('pdf');
  if (openBtn) {
    openBtn.onclick = async () => {
      try {
        const result = await window.documentApi.open();
        if (result.canceled) return;
        editor.innerHTML = result.content || '<p>Start writing here...</p>';    
        state.filePath = result.filePath;
        state.title = result.title || result.filePath?.split(/[\\\/]/).pop() || 'Untitled Document';
        titleInput.value = state.title;
        state.lastSavedTitle = state.title;
        state.lastSavedContent = editor.innerHTML;
        persistDraft(state, editor.innerHTML);
        syncDirtyState(panelIdx);
        saveStatus.textContent = 'Opened';
        setTimeout(() => { if (saveStatus) saveStatus.textContent = ''; }, 1500);
      } catch (err) { alert(`Open failed: ${err.message}`); }
    };
  }

  const newBtn = document.getElementById(`new-doc-btn-${panelIdx}`);
  if (newBtn) {
    newBtn.onclick = () => {
      state.filePath = null;
      state.title = 'Untitled Document';
      titleInput.value = state.title;
      editor.innerHTML = '<p>Start writing here...</p>';
      state.lastSavedTitle = state.title;
      state.lastSavedContent = editor.innerHTML;
      persistDraft(state, editor.innerHTML);
      syncDirtyState(panelIdx);
      ensureEditorReady(editor);
      ensureEditorCaret(editor);
    };
  }

  // Event listener for data insertion
  store.on('data:insert', (payload) => {
    if (payload.targetPanelIdx !== panelIdx) return;
    
    if (payload.type === 'text') {
        insertTextAtLastContext(editor, state, payload.data);
    }
    persistDraftFromEditor(panelIdx);
    syncDirtyState(panelIdx);
  });

  // Track selection for insertion and context menu
  const updateSelection = () => {
      const selection = window.getSelection();
      if (selection.rangeCount > 0 && editor.contains(selection.anchorNode)) {
          state.lastRange = selection.getRangeAt(0).cloneRange();
      }
  };

  editor.addEventListener('blur', updateSelection);
  editor.addEventListener('keyup', updateSelection);
  editor.addEventListener('mouseup', updateSelection);
  editor.addEventListener('focus', () => ensureEditorCaret(editor));
  editor.addEventListener('mousedown', () => {
    setTimeout(() => {
      if (document.activeElement === editor) {
        ensureEditorCaret(editor);
      }
    }, 0);
  });

  editor.oncontextmenu = (e) => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();

      // Let Electron's native editable context menu handle spellcheck suggestions by default.
      // Hold Shift while right-clicking to access the writer-specific action menu instead.
      if (!e.shiftKey) {
          return;
      }

      if (selectedText) {
          e.preventDefault();
          const items = [
              { label: 'Create Calendar Event', icon: 'add', action: async () => {
                  const { db } = await import('./database.js');
                  db.addEvent({ title: selectedText, date: new Date().toISOString().split('T')[0], start: '09:00', end: '10:00' });
                  alert(`Event created: ${selectedText}`);
              }},
              { label: 'Send to Data Panel', icon: 'data', action: () => {
                  window.openDataPanel({ title: 'Writer Selection', data: selectedText, type: 'text' });
              }},
              { separator: true },
              { label: 'Copy Selection', icon: 'copy', action: () => {
                  navigator.clipboard.writeText(selectedText);
              }}
          ];
          store.showContextMenu(e.clientX, e.clientY, items);
      }
  };

  const panelRoot = document.getElementById(`panel-content-${panelIdx}`);       
  const toolbar = panelRoot?.querySelector('.writer-toolbar');
  if (toolbar) {
    toolbar.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-writer-command]');
      const actionBtn = e.target.closest('[data-writer-action]');
      if (btn) {
        document.execCommand(btn.dataset.writerCommand, false, btn.dataset.writerValue || null);
        editor.focus();
        persistDraftFromEditor(panelIdx);
        syncDirtyState(panelIdx);
      } else if (actionBtn) {
        const action = actionBtn.dataset.writerAction;
        editor.focus();
        if (action === 'insert-inline-code') insertInlineCode(editor);
        else if (action === 'insert-blockquote') insertBlockquote(editor);
        else if (action === 'insert-code-block') insertCodeBlock(editor);
        else if (action === 'insert-image-block') await insertImageBlock(editor);
        persistDraftFromEditor(panelIdx);
        syncDirtyState(panelIdx);
      }
    });
  }

  editor?.addEventListener('input', () => {
    persistDraftFromEditor(panelIdx);
    syncDirtyState(panelIdx);
  });
  editor?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    if (handleBlockquoteExit(editor)) {
      event.preventDefault();
      persistDraftFromEditor(panelIdx);
      syncDirtyState(panelIdx);
    }
  });
  titleInput?.addEventListener('input', () => {
    state.title = titleInput.value;
    persistDraftFromEditor(panelIdx);
    syncDirtyState(panelIdx);
  });
  
  store.on('store:closed', () => {
    persistDraftFromEditor(panelIdx);
    syncDirtyState(panelIdx);
    writerStates.delete(panelIdx);
  });
}

export function getWriterUnsavedSummary(panelIdx) {
  const state = writerStates.get(panelIdx);
  const editor = document.getElementById(`doc-writer-area-${panelIdx}`);
  const titleInput = document.getElementById(`doc-title-${panelIdx}`);
  if (!state || !editor || !titleInput) {
    return null;
  }

  const changedFields = [];
  if (titleInput.value !== state.lastSavedTitle) {
    changedFields.push('title');
  }
  if (editor.innerHTML !== state.lastSavedContent) {
    changedFields.push('content');
  }

  if (changedFields.length === 0) {
    return null;
  }

  const currentTitle = titleInput.value?.trim() || 'Untitled Document';

  return {
    module: 'DirT Writer',
    panelIdx,
    title: currentTitle,
    filePath: state.filePath || null,
    locationLabel: state.filePath || `Unsaved document in panel ${panelIdx + 1}`,
    changedFields
  };
}

function ensureEditorReady(editor) {
  if (!editor) return;
  editor.contentEditable = 'true';
  editor.setAttribute('contenteditable', 'true');
  editor.setAttribute('spellcheck', 'true');
  editor.tabIndex = 0;
}

function ensureEditorCaret(editor) {
  if (!editor) return;
  editor.focus();

  const selection = window.getSelection();
  if (!selection) return;

  if (selection.rangeCount > 0 && editor.contains(selection.anchorNode)) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function insertTextAtLastContext(editor, state, text) {
    if (state.lastRange) {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(state.lastRange);
        document.execCommand('insertText', false, text);
        state.lastRange = selection.getRangeAt(0).cloneRange();
    } else {
        editor.focus();
        document.execCommand('insertText', false, text);
    }
}

function insertInlineCode(editor) {
  const selection = window.getSelection();
  const codeText = (selection && selection.toString()) || 'inline-code';
  insertHtmlAtCursor(editor, `<code>${escapeHtml(codeText)}</code>&nbsp;`);
}

function insertBlockquote(editor) {
  const selection = window.getSelection();
  const quoteText = (selection && selection.toString().trim()) || 'Quote';
  insertHtmlAtCursor(editor, `<blockquote><p>${escapeHtml(quoteText)}</p></blockquote><p><br></p>`);
}

function insertCodeBlock(editor) {
  const selection = window.getSelection();
  const codeText = (selection && selection.toString()) || 'Write code here...';
  insertHtmlAtCursor(editor, `<pre class="writer-code-block"><code>${escapeHtml(codeText)}</code></pre><p><br></p>`);
}

async function insertImageBlock(editor) {
  const result = await window.fileApi.select({ filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }] });
  if (result?.canceled) return;
  const fileName = result.filePath.split(/[\\\/]/).pop() || 'Image';
  const imageSrc = `file://${result.filePath.replace(/\\/g, '/')}`;
  insertHtmlAtCursor(editor, `<figure class="writer-image-block"><img src="${imageSrc}"><figcaption>${escapeHtml(fileName)}</figcaption></figure><p><br></p>`);
}

function insertHtmlAtCursor(editor, html) {
  editor.focus();
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    editor.insertAdjacentHTML('beforeend', html);
    return;
  }
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const fragment = document.createRange().createContextualFragment(html);
  const lastNode = fragment.lastChild;
  range.insertNode(fragment);
  if (lastNode) {
    range.setStartAfter(lastNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function handleBlockquoteExit(editor) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  const range = selection.getRangeAt(0);
  const anchorNode = selection.anchorNode;
  const blockquote = getClosestElement(anchorNode, 'BLOCKQUOTE');
  if (!blockquote || !editor.contains(blockquote)) {
    return false;
  }

  const currentBlock = getClosestBlockElement(anchorNode, blockquote);
  if (!currentBlock) {
    return false;
  }

  const blockText = currentBlock.textContent.replace(/\u00a0/g, ' ').trim();
  if (blockText.length > 0) {
    return false;
  }

  let nextParagraph = blockquote.nextElementSibling;
  if (!nextParagraph || nextParagraph.tagName !== 'P') {
    nextParagraph = document.createElement('p');
    nextParagraph.innerHTML = '<br>';
    blockquote.insertAdjacentElement('afterend', nextParagraph);
  }

  const nextRange = document.createRange();
  nextRange.selectNodeContents(nextParagraph);
  nextRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(nextRange);
  return true;
}

function getClosestElement(node, tagName) {
  let current = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  while (current) {
    if (current.tagName === tagName) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function getClosestBlockElement(node, boundary) {
  let current = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  while (current && current !== boundary) {
    if (['P', 'DIV', 'LI'].includes(current.tagName)) {
      return current;
    }
    current = current.parentElement;
  }

  return boundary?.querySelector('p, div, li') || null;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function loadDraft() {
  const raw = localStorage.getItem(WRITER_DRAFT_KEY);
  return raw ? JSON.parse(raw) : null;
}

function persistDraftFromEditor(panelIdx) {
  const state = writerStates.get(panelIdx);
  const editor = document.getElementById(`doc-writer-area-${panelIdx}`);        
  const titleInput = document.getElementById(`doc-title-${panelIdx}`);
  if (!state || !editor || !titleInput) return;
  persistDraft(state, editor.innerHTML);
}

function persistDraft(state, content) {
  localStorage.setItem(WRITER_DRAFT_KEY, JSON.stringify({
    filePath: state.filePath, title: state.title, content: content
  }));
}

function syncDirtyState(panelIdx) {
  const state = writerStates.get(panelIdx);
  const editor = document.getElementById(`doc-writer-area-${panelIdx}`);
  const titleInput = document.getElementById(`doc-title-${panelIdx}`);
  if (!state || !editor || !titleInput || !window.documentApi?.setDirty) return;

  const isDirty = (
    titleInput.value !== state.lastSavedTitle ||
    editor.innerHTML !== state.lastSavedContent
  );
  window.documentApi.setDirty(isDirty);
}

