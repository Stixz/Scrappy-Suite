import { STORE, updateActiveContext, getActiveContext } from './modules/scrappy.js';
import { initDatabaseManager } from './modules/db_manager.js';

initDatabaseManager();

const BRANDING = {
  studioName: 'Ravenforge Creations Studio',
  studioUrl: 'https://ravenforge.info'
};

const BRANDING_WELCOME_KEY = 'scrappy_branding_welcome_seen';

const moduleMap = {
  calendar: './modules/calendar.js',
  writer: './modules/writer.js',
  files: './modules/files.js',
  help: './modules/help.js',
  data: './modules/data_panel.js'
};

const panelsContainer = document.getElementById('panels');
const moduleSwitcher = document.getElementById('module-switcher');
const addPanelButton = document.getElementById('add-panel-btn');
const panelState = new Map();
const MIN_PANEL_WIDTH = 120;
let selectedPanel = 0;
let resizeState = null;
const PANEL_ENTER_DURATION = 220;
const PANEL_EXIT_DURATION = 180;
const MODULE_SWAP_OUT_DURATION = 90;
const MODULE_SWAP_IN_DURATION = 190;
const SCRAPPY_THEME_KEY = 'scrappy_theme';
const SCRAPPY_THEMES = ['scrappy-default', 'ember', 'frosted-glass', 'midnight-mint'];
let currentTheme = 'scrappy-default';

function getBrandPromoHtml() {
  return `
    <div class="brand-promo">
      <div class="brand-promo__label">From The Forge</div>
      <p class="brand-promo__copy">
        Scrappy Suite is freeware from ${BRANDING.studioName}. If you want the rest of the Ravenforge orbit, the studio link is the front door.
      </p>
      <div class="brand-promo__actions">
        <button class="brand-link-btn" data-open-brand-modal>About Scrappy Suite</button>
        ${BRANDING.studioUrl ? '<button class="brand-link-btn" data-studio-link>Visit Studio</button>' : ''}
      </div>
    </div>
  `;
}

async function openStudioLink() {
  if (!BRANDING.studioUrl || !window.shellApi?.openExternal) {
    return;
  }

  const result = await window.shellApi.openExternal(BRANDING.studioUrl);        
  if (!result.success) {
    alert(`Failed to open studio link: ${result.error}`);
  }
}

function showBrandModal() {
  const overlay = document.getElementById('brand-modal-overlay');
  if (overlay) {
    overlay.hidden = false;
  }
}

function hideBrandModal() {
  const overlay = document.getElementById('brand-modal-overlay');
  if (overlay) {
    overlay.hidden = true;
  }
}

function bindBrandingInteractions() {
  document.querySelectorAll('[data-studio-link]').forEach((button) => {
    if (!BRANDING.studioUrl) {
      button.hidden = true;
    } else {
      button.hidden = false;
    }
  });

  document.addEventListener('click', (event) => {
    const openTrigger = event.target.closest('[data-open-brand-modal]');        
    if (openTrigger) {
      showBrandModal();
      return;
    }

    const closeTrigger = event.target.closest('[data-close-brand-modal]');      
    if (closeTrigger) {
      hideBrandModal();
      return;
    }

    const studioTrigger = event.target.closest('[data-studio-link]');
    if (studioTrigger && !studioTrigger.hidden) {
      openStudioLink();
    }
  });

  document.getElementById('brand-modal-overlay')?.addEventListener('click', (event) => {
    if (event.target.id === 'brand-modal-overlay') {
      hideBrandModal();
    }
  });
}

function maybeShowWelcomeModal() {
  if (localStorage.getItem(BRANDING_WELCOME_KEY)) {
    return;
  }

  showBrandModal();
  localStorage.setItem(BRANDING_WELCOME_KEY, '1');
}

function getPanels() {
  return Array.from(document.querySelectorAll('.panel'));
}

function getPanelContent(panelIdx) {
  return document.getElementById(`panel-content-${panelIdx}`);
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function getMotionDuration(duration) {
  return prefersReducedMotion() ? 0 : duration;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function animatePanelEntry(panel) {
  if (!panel || prefersReducedMotion()) {
    return;
  }

  panel.classList.add('panel-enter');
  window.setTimeout(() => panel.classList.remove('panel-enter'), PANEL_ENTER_DURATION);
}

async function animatePanelRemoval(panel) {
  if (!panel || prefersReducedMotion()) {
    return;
  }

  panel.classList.add('panel-removing');
  await delay(getMotionDuration(PANEL_EXIT_DURATION));
}

async function animateModuleSwapOut(content) {
  if (!content || prefersReducedMotion()) {
    return;
  }

  content.classList.remove('module-swap-in');
  content.classList.add('module-swap-out');
  await delay(getMotionDuration(MODULE_SWAP_OUT_DURATION));
}

function animateModuleSwapIn(content) {
  if (!content || prefersReducedMotion()) {
    return;
  }

  content.classList.remove('module-swap-out');
  content.classList.add('module-swap-in');
  window.setTimeout(() => content.classList.remove('module-swap-in'), MODULE_SWAP_IN_DURATION);
}

function savePanelState() {
  const panels = getPanels();
  const state = [];
  panels.forEach((panel, index) => {
    const panelStateData = panelState.get(index);
    state.push({
      moduleKey: panelStateData?.moduleKey || null
    });
  });
  try {
    localStorage.setItem('scrappy_panel_state', JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to mirror panel state to localStorage:', error);       
  }

  if (window.appStateApi?.savePanelState) {
    window.appStateApi.savePanelState(state).catch((error) => {
      console.error('Failed to persist panel state:', error);
    });
  }
}

function getCurrentTheme() {
  return currentTheme;
}

function applyTheme(themeName, options = {}) {
  const { persist = true } = options;
  const nextTheme = SCRAPPY_THEMES.includes(themeName) ? themeName : 'scrappy-default';
  currentTheme = nextTheme;
  document.body.dataset.theme = nextTheme;

  if (persist) {
    if (window.settingsApi?.update) {
      window.settingsApi.update({ theme: nextTheme }).catch((error) => {
        console.warn('Failed to persist theme to settings:', error);
        localStorage.setItem(SCRAPPY_THEME_KEY, nextTheme);
      });
    } else {
      localStorage.setItem(SCRAPPY_THEME_KEY, nextTheme);
    }
  }

  document.dispatchEvent(new CustomEvent('scrappy:theme-changed', {
    detail: { theme: nextTheme }
  }));
}

async function loadInitialTheme() {
  if (window.settingsApi?.get) {
    try {
      const settings = await window.settingsApi.get();
      const configuredTheme = settings?.theme;
      if (SCRAPPY_THEMES.includes(configuredTheme)) {
        return configuredTheme;
      }
    } catch (error) {
      console.warn('Failed to load theme from settings:', error);
    }
  }

  const storedTheme = localStorage.getItem(SCRAPPY_THEME_KEY);
  return SCRAPPY_THEMES.includes(storedTheme) ? storedTheme : 'scrappy-default';
}

async function loadPanelState() {
  if (window.appStateApi?.loadPanelState) {
    try {
      const saved = await window.appStateApi.loadPanelState();
      if (Array.isArray(saved)) {
        return saved;
      }
    } catch (error) {
      console.warn('Failed to load panel state from app storage:', error);      
    }
  }

  const saved = localStorage.getItem('scrappy_panel_state');
  if (!saved) return null;

  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

function ensurePanelState(panelIdx) {
  if (!panelState.has(panelIdx)) {
    panelState.set(panelIdx, { moduleKey: null });
  }

  return panelState.get(panelIdx);
}

function selectPanel(panelIdx) {
  const context = getActiveContext();
  if (selectedPanel !== panelIdx && selectedPanel !== -1) {
    updateActiveContext({ lastActivePanelIdx: selectedPanel });
  }
  
  selectedPanel = panelIdx;
  getPanels().forEach((panel) => {
    panel.classList.toggle('selected', Number(panel.dataset.panel) === panelIdx);
  });
}

function normalizePanelWidths() {
  const panels = getPanels();
  if (panels.length === 0) {
    return;
  }

  const explicitWidths = panels.filter((panel) => panel.style.width);
  if (explicitWidths.length === 0) {
    return;
  }

  const containerWidth = panelsContainer.clientWidth;
  if (!containerWidth) {
    return;
  }

  let totalWidth = 0;
  panels.forEach((panel) => {
    const panelWidth = panel.getBoundingClientRect().width;
    totalWidth += panelWidth;
  });

  if (!totalWidth) {
    return;
  }

  panels.forEach((panel) => {
    const panelWidth = panel.getBoundingClientRect().width;
    const nextWidth = Math.max(MIN_PANEL_WIDTH, (panelWidth / totalWidth) * containerWidth);
    panel.style.flex = '0 0 auto';
    panel.style.width = `${nextWidth}px`;
  });
}

function refreshResizeHandles() {
  const panels = getPanels();
  panels.forEach((panel, index) => {
    let handle = panel.querySelector('.drag-handle');

    if (index === panels.length - 1) {
      if (handle) {
        handle.remove();
      }
      return;
    }

    if (!handle) {
      handle = document.createElement('div');
      handle.className = 'drag-handle';
      panel.appendChild(handle);
    }

    handle.dataset.handle = String(index);
  });
}

function reindexPanels() {
  const nextState = new Map();

  getPanels().forEach((panel, index) => {
    const previousIndex = Number(panel.dataset.panel);
    const content = panel.querySelector('.panel-content');

    panel.dataset.panel = String(index);
    if (content) {
      content.id = `panel-content-${index}`;
    }

    nextState.set(index, panelState.get(previousIndex) ?? { moduleKey: null }); 
  });

  panelState.clear();
  nextState.forEach((value, key) => {
    panelState.set(key, value);
    // Update IDs for any existing modules
    const panel = document.querySelector(`.panel[data-panel="${key}"]`);        
    const content = panel?.querySelector('.panel-content');
    if (content) {
        content.id = `panel-content-${key}`;
    }
  });

  refreshResizeHandles();
  normalizePanelWidths();

  const panels = getPanels();
  if (panels.length === 0) {
    selectedPanel = -1;
    return;
  }

  if (selectedPanel >= panels.length) {
    selectedPanel = panels.length - 1;
  }

  setupPanelEvents();
  selectPanel(selectedPanel < 0 ? 0 : selectedPanel);
}

async function removePanel(panelIdx) {
  const panel = document.querySelector(`.panel[data-panel="${panelIdx}"]`);     
  if (!panel) {
    return;
  }

  const state = panelState.get(panelIdx);
  if (state && state.store) {
    state.store.close();
  }

  await animatePanelRemoval(panel);
  panel.remove();
  panelState.delete(panelIdx);
  reindexPanels();

  if (getPanels().length === 0) {
    addPanel();
    return;
  }

  savePanelState();
}

async function addPanel(moduleKey = null, initialState = null) {
  const panelIdx = getPanels().length;
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.dataset.panel = String(panelIdx);
  panel.innerHTML = `
    <div class="panel-content" id="panel-content-${panelIdx}"></div>
  `;

  panelsContainer.appendChild(panel);
  animatePanelEntry(panel);
  panelState.set(panelIdx, { moduleKey });
  reindexPanels();
  selectPanel(panelIdx);
  if (moduleKey) {
    await loadModule(panelIdx, moduleKey, initialState);
  } else {
    const content = getPanelContent(panelIdx);
    if (content) {
      content.innerHTML = `
        <div class="module-shell">
          <div class="module-body module-empty-state-wrap">
            <div class="module-empty-state">
              <div class="module-empty-state__eyebrow">Empty Panel</div>        
              <h2 class="module-empty-state__title">Pick a module when you need one.</h2>
              <p class="module-empty-state__copy">
                This panel is standing by. Use the toolbar above to load Calendar, Writer, Fogre, or Help.
              </p>
              <div class="module-empty-state__chips" aria-hidden="true">        
                <span class="module-empty-state__chip">
                  <span class="module-empty-state__chip-icon">&#9715;</span>    
                  <span>Calendar</span>
                </span>
                <span class="module-empty-state__chip">
                  <span class="module-empty-state__chip-icon">&#9636;</span>    
                  <span>Writer</span>
                </span>
                <span class="module-empty-state__chip">
                  <span class="module-empty-state__chip-icon">&#9635;</span>    
                  <span>Files</span>
                </span>
                <span class="module-empty-state__chip">
                  <span class="module-empty-state__chip-icon">?</span>
                  <span>Help</span>
                </span>
              </div>
              ${getBrandPromoHtml()}
            </div>
          </div>
        </div>
      `;
    }
  }
  savePanelState();
}

// Global for File module to open files in Writer
window.openFileInWriter = async (filePath) => {
  try {
    const documentData = await window.fileApi.readDocument(filePath);

    // Find an existing writer panel
    let targetIdx = -1;
    for (const [idx, state] of panelState.entries()) {
      if (state.moduleKey === 'writer') {
        targetIdx = idx;
        break;
      }
    }

    const initialState = {
      filePath,
      title: documentData?.title || null,
      content: documentData?.content || '<p>Start writing here...</p>'
    };

    if (targetIdx !== -1) {
      loadModule(targetIdx, 'writer', initialState);
      selectPanel(targetIdx);
    } else {
      addPanel('writer', initialState);
    }
  } catch (err) {
    alert(`Failed to open file: ${err.message}`);
  }
};

window.openDataPanel = async (dataPayload = null) => {
    try {
        let targetIdx = -1;
        for (const [idx, state] of panelState.entries()) {
            if (state.moduleKey === 'data') {
                targetIdx = idx;
                break;
            }
        }

        if (targetIdx !== -1) {
            const state = panelState.get(targetIdx);
            if (state.store) {
                state.store.emit('data:push', dataPayload);
            } else {
                await loadModule(targetIdx, 'data', dataPayload);
            }
            selectPanel(targetIdx);
        } else {
            await addPanel('data', dataPayload);
        }
    } catch (err) {
        alert(`Failed to open data panel: ${err.message}`);
    }
};

function getSelectedPanelModuleState() {
  if (selectedPanel < 0) {
    return null;
  }

  return panelState.get(selectedPanel) || null;
}

function getDirectoryPath(filePath) {
  const normalized = String(filePath || '').replace(/[\\\/]+$/, '');
  const lastSlashIdx = Math.max(normalized.lastIndexOf('\\'), normalized.lastIndexOf('/'));
  if (lastSlashIdx === -1) {
    return normalized;
  }
  return normalized.slice(0, lastSlashIdx) || normalized;
}

async function openPathInFogre(targetPath, options = {}) {
  const isDirectory = options.isDirectory === true;
  let targetIdx = Number.isInteger(options.targetPanelIdx) ? options.targetPanelIdx : -1;

  if (targetIdx === -1) {
    for (const [idx, state] of panelState.entries()) {
      if (state.moduleKey === 'files') {
        targetIdx = idx;
        break;
      }
    }
  }

  const initialState = isDirectory
    ? { currentPath: targetPath, selectedPaths: [], previewPath: null }
    : {
        currentPath: getDirectoryPath(targetPath),
        selectedPaths: [targetPath],
        selectionAnchorPath: targetPath,
        previewPath: targetPath,
        previewIsDirectory: false
      };

  if (targetIdx !== -1) {
    await loadModule(targetIdx, 'files', initialState);
    selectPanel(targetIdx);
    return;
  }

  await addPanel('files', initialState);
}

async function handleLauncherAction(payload = {}) {
  const requestId = payload?.requestId;
  const action = payload?.action;
  const shortcut = payload?.shortcut || {};
  const target = shortcut.target;
  const type = shortcut.type || 'app';
  const respond = (result) => {
    if (requestId && window.launcherApi?.respondActionResult) {
      window.launcherApi.respondActionResult({ requestId, result });
    }
    return result;
  };

  if (!action || !target) {
    return respond({ success: false, error: 'Launcher action is missing a valid target.' });
  }

  try {
    if (action === 'open-in-fogre') {
      if (/^(https?:|mailto:)/i.test(target)) {
        return respond({ success: false, error: 'Fogre can only open local files and folders.' });
      }
      await openPathInFogre(target, { isDirectory: type === 'folder' });
      return respond({ success: true });
    }

    if (action === 'open-in-writer') {
      if (/^(https?:|mailto:)/i.test(target)) {
        return respond({ success: false, error: 'DirT Writer cannot open web links directly.' });
      }
      if (type === 'folder') {
        return respond({ success: false, error: 'DirT Writer cannot open folders.' });
      }
      await window.openFileInWriter(target);
      return respond({ success: true });
    }

    if (action === 'send-to-selected-panel') {
      const selectedState = getSelectedPanelModuleState();
      if (!selectedState) {
        return respond({ success: false, error: 'Select a panel first so Scrappy knows where to send the target.' });
      }

      if (selectedState.moduleKey === 'writer' || selectedState.moduleKey === 'data') {
        selectedState.store?.emit('data:insert', {
          type: 'text',
          data: target,
          targetPanelIdx: selectedPanel
        });
        return respond({ success: true });
      }

      if (selectedState.moduleKey === 'files' && !/^(https?:|mailto:)/i.test(target)) {
        await openPathInFogre(target, {
          isDirectory: type === 'folder',
          targetPanelIdx: selectedPanel
        });
        return respond({ success: true });
      }

      await window.openDataPanel({
        title: shortcut.title || 'Launcher Target',
        data: target,
        type: 'text'
      });
      return respond({ success: true });
    }

    return respond({ success: false, error: `Scrappy does not recognize the launcher action "${action}".` });
  } catch (error) {
    return respond({ success: false, error: error?.message || 'Scrappy could not complete that launcher action.' });
  }
}

window.scrappyThemeApi = {
  getCurrentTheme,
  setTheme: (themeName) => applyTheme(themeName, true)
};

async function collectUnsavedChanges() {
  const summaries = [];

  for (const [panelIdx, state] of panelState.entries()) {
    if (state.moduleKey !== 'writer') {
      continue;
    }

    const writerModule = await import('./modules/writer.js');
    const summary = writerModule.getWriterUnsavedSummary(panelIdx);
    if (summary) {
      summaries.push(summary);
    }
  }

  return summaries;
}

function formatChangedFields(changedFields = []) {
  if (changedFields.length === 0) {
    return 'unsaved changes';
  }

  if (changedFields.length === 1) {
    return changedFields[0];
  }

  return `${changedFields.slice(0, -1).join(', ')} and ${changedFields[changedFields.length - 1]}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function showUnsavedChangesDialog(changes) {
  return new Promise((resolve) => {
    document.getElementById('scrappy-unsaved-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'scrappy-unsaved-overlay';
    overlay.className = 'event-modal-overlay unsaved-modal-overlay';
    overlay.innerHTML = `
      <div class="event-modal unsaved-modal">
        <div class="unsaved-modal__eyebrow">Unsaved Changes</div>
        <h3>DirT Writer still has work that is not saved to file.</h3>
        <p class="unsaved-modal__copy">
          Scrappy kept the live draft in memory, but closing now will discard these file-level changes.
        </p>
        <div class="unsaved-modal__list">
          ${changes.map((change) => `
            <div class="unsaved-change-item">
              <div class="unsaved-change-item__title">${escapeHtml(change.title)}</div>
              <div class="unsaved-change-item__meta">${escapeHtml(change.locationLabel)}</div>
              <div class="unsaved-change-item__detail">Changed: ${escapeHtml(formatChangedFields(change.changedFields))}</div>
            </div>
          `).join('')}
        </div>
        <div class="event-modal-actions">
          <button class="event-modal-btn cancel" id="unsaved-cancel-btn">Keep Editing</button>
          <button class="event-modal-btn save" id="unsaved-discard-btn">Discard And Close</button>
        </div>
      </div>
    `;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      }
    };

    const finish = (approved) => {
      document.removeEventListener('keydown', onKeyDown);
      overlay.remove();
      resolve(approved);
    };

    document.body.appendChild(overlay);

    overlay.querySelector('#unsaved-cancel-btn')?.addEventListener('click', () => finish(false));
    overlay.querySelector('#unsaved-discard-btn')?.addEventListener('click', () => finish(true));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        finish(false);
      }
    });

    document.addEventListener('keydown', onKeyDown);
  });
}

function setupCloseConfirmationHandling() {
  if (!window.unsavedChangesApi?.onRequestCloseConfirmation) {
    return;
  }

  window.unsavedChangesApi.onRequestCloseConfirmation(async ({ requestId }) => {
    try {
      const changes = await collectUnsavedChanges();
      const approved = changes.length === 0
        ? true
        : await showUnsavedChangesDialog(changes);

      window.unsavedChangesApi.respondCloseConfirmation({ requestId, approved });
    } catch (error) {
      console.error('Failed handling close confirmation:', error);
      window.unsavedChangesApi.respondCloseConfirmation({ requestId, approved: false });
    }
  });
}

window.launcherApi?.onActionRequested?.((payload) => {
  handleLauncherAction(payload).catch((error) => {
    console.error('Failed handling launcher action:', error);
  });
});

async function loadModule(panelIdx, moduleKey, initialState = null) {
  if (moduleKey === 'tables') {
    const content = getPanelContent(panelIdx);
    const state = ensurePanelState(panelIdx);
    if (state.store) {
      state.store.close();
      state.store = null;
    }
    state.moduleKey = null;

    if (content) {
      content.innerHTML = `
        <div class="module-shell">
          <div class="module-body module-empty-state-wrap">
            <div class="module-empty-state">
              <div class="module-empty-state__eyebrow">Feature Removed</div>
              <h2 class="module-empty-state__title">Scrappy Grid is no longer available.</h2>
              <p class="module-empty-state__copy">
                This panel was restored from older saved state. Pick another module to continue.
              </p>
            </div>
          </div>
        </div>
      `;
    }

    savePanelState();
    return;
  }

  const modulePath = moduleMap[moduleKey];
  const content = getPanelContent(panelIdx);
  if (!modulePath || !content) {
    return;
  }

  await animateModuleSwapOut(content);

  const state = ensurePanelState(panelIdx);
  if (state.store) {
    state.store.close();
  }
  state.store = STORE(panelIdx);

  const mod = await import(modulePath);
  let html = '';

  switch (moduleKey) {
    case 'calendar':
      html = mod.renderCalendar(panelIdx);
      break;
    case 'writer':
      html = mod.renderWriter(panelIdx);
      break;
    case 'files':
      html = mod.renderFiles(panelIdx);
      break;
    case 'help':
      html = mod.renderHelp(panelIdx);
      break;
    case 'data':
      html = mod.renderDataPanel(panelIdx);
      break;
    default:
      html = `<p>Unknown module: ${moduleKey}</p>`;
  }

  content.innerHTML = html;
  animateModuleSwapIn(content);
  state.moduleKey = moduleKey;

  bindModuleCloseInteractions(panelIdx);

  if (mod.bindInteractions) {
    mod.bindInteractions(panelIdx, initialState, state.store);
  }

  // Re-setup panel events after module loads (headers now exist)
  setupPanelEvents();
  savePanelState();
}

function bindModuleCloseInteractions(panelIdx) {
  const closeBtn = document.querySelector(`[data-close-panel="${panelIdx}"]`);  
  if (closeBtn) {
    closeBtn.onclick = () => removePanel(panelIdx);
  }
}

function movePanel(panelIdx, direction) {
  const panels = getPanels();
  if (panels.length < 2) {
    return;
  }

  const targetIdx = direction === 'left' ? panelIdx - 1 : panelIdx + 1;
  if (targetIdx < 0 || targetIdx >= panels.length) {
    return;
  }

  swapPanels(panelIdx, targetIdx);
  selectPanel(targetIdx);
}

function swapPanels(fromIdx, toIdx) {
  if (fromIdx === toIdx) {
    return;
  }

  const fromPanel = document.querySelector(`.panel[data-panel="${fromIdx}"]`);  
  const toPanel = document.querySelector(`.panel[data-panel="${toIdx}"]`);      

  if (!fromPanel || !toPanel) {
    return;
  }

  const fromAfter = fromPanel.nextSibling === toPanel ? fromPanel : fromPanel.nextSibling;
  panelsContainer.insertBefore(fromPanel, toPanel);
  panelsContainer.insertBefore(toPanel, fromAfter);
  reindexPanels();
  savePanelState();
}

function ensurePanelHeaderControls(panel) {
  const panelIdx = Number(panel.dataset.panel);
  const header = panel.querySelector('.module-topbar');
  if (!header) {
    return;
  }

  let actions = header.querySelector('.panel-header-actions');
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'panel-header-actions';
  }

  let moveLeftBtn = actions.querySelector('.panel-move-btn[data-direction="left"]');
  if (!moveLeftBtn) {
    moveLeftBtn = document.createElement('button');
    moveLeftBtn.type = 'button';
    moveLeftBtn.className = 'panel-move-btn';
    moveLeftBtn.dataset.direction = 'left';
    moveLeftBtn.title = 'Move panel left';
    moveLeftBtn.setAttribute('aria-label', 'Move panel left');
    moveLeftBtn.innerHTML = '&#8592;';
    actions.appendChild(moveLeftBtn);
  }

  let moveRightBtn = actions.querySelector('.panel-move-btn[data-direction="right"]');
  if (!moveRightBtn) {
    moveRightBtn = document.createElement('button');
    moveRightBtn.type = 'button';
    moveRightBtn.className = 'panel-move-btn';
    moveRightBtn.dataset.direction = 'right';
    moveRightBtn.title = 'Move panel right';
    moveRightBtn.setAttribute('aria-label', 'Move panel right');
    moveRightBtn.innerHTML = '&#8594;';
    actions.appendChild(moveRightBtn);
  }

  const closeBtn = header.querySelector(`[data-close-panel="${panelIdx}"]`);
  if (closeBtn && closeBtn.parentElement !== actions) {
    actions.appendChild(closeBtn);
  }

  if (actions.parentElement !== header) {
    header.appendChild(actions);
  }

  const panelCount = getPanels().length;
  moveLeftBtn.disabled = panelIdx === 0;
  moveRightBtn.disabled = panelIdx >= panelCount - 1;
}

function setupPanelEvents() {
  getPanels().forEach((panel) => {
    panel.onclick = (event) => {
      if (event.target.closest('.drag-handle')) {
        return;
      }

      selectPanel(Number(panel.dataset.panel));
    };
    ensurePanelHeaderControls(panel);
  });

  document.querySelectorAll('.panel-move-btn').forEach((button) => {
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const panel = button.closest('.panel');
      if (!panel) {
        return;
      }
      movePanel(Number(panel.dataset.panel), button.dataset.direction);
    };
  });

  document.querySelectorAll('.drag-handle').forEach((handle) => {
    handle.onmousedown = (event) => {
      const leftIndex = Number(handle.dataset.handle);
      const panels = getPanels();
      const leftPanel = panels[leftIndex];
      const rightPanel = panels[leftIndex + 1];

      if (!leftPanel || !rightPanel) {
        return;
      }

      resizeState = {
        leftIndex,
        startX: event.clientX,
        startLeftWidth: leftPanel.getBoundingClientRect().width,
        startRightWidth: rightPanel.getBoundingClientRect().width
      };

      handle.classList.add('dragging');
      document.body.classList.add('is-resizing-panels');
      document.body.style.cursor = 'col-resize';
      event.preventDefault();
      event.stopPropagation();
    };
  });
}

function handlePanelResize(event) {
  if (!resizeState) {
    return;
  }

  const panels = getPanels();
  const leftPanel = panels[resizeState.leftIndex];
  const rightPanel = panels[resizeState.leftIndex + 1];
  if (!leftPanel || !rightPanel) {
    stopPanelResize();
    return;
  }

  const deltaX = event.clientX - resizeState.startX;
  let nextLeftWidth = resizeState.startLeftWidth + deltaX;
  let nextRightWidth = resizeState.startRightWidth - deltaX;

  if (nextLeftWidth < MIN_PANEL_WIDTH) {
    nextRightWidth -= MIN_PANEL_WIDTH - nextLeftWidth;
    nextLeftWidth = MIN_PANEL_WIDTH;
  }

  if (nextRightWidth < MIN_PANEL_WIDTH) {
    nextLeftWidth -= MIN_PANEL_WIDTH - nextRightWidth;
    nextRightWidth = MIN_PANEL_WIDTH;
  }

  leftPanel.style.flex = '0 0 auto';
  rightPanel.style.flex = '0 0 auto';
  leftPanel.style.width = `${nextLeftWidth}px`;
  rightPanel.style.width = `${nextRightWidth}px`;
}

function stopPanelResize() {
  if (!resizeState) {
    return;
  }

  resizeState = null;
  document.querySelectorAll('.drag-handle').forEach((handle) => handle.classList.remove('dragging'));
  document.body.classList.remove('is-resizing-panels');
  document.body.style.cursor = '';
}

function setupHeaderButtons() {
  if (window.windowControls) {
    document.getElementById('win-min')?.addEventListener('click', () => window.windowControls.minimize());
    document.getElementById('win-max')?.addEventListener('click', () => window.windowControls.maximize());
    document.getElementById('win-close')?.addEventListener('click', () => window.windowControls.close());

    window.windowControls.onStateChange((isMaximized) => {
      const maxButton = document.getElementById('win-max');
      if (maxButton) {
        maxButton.innerHTML = isMaximized ? '&#x2750;' : '&#x25A1;';
        maxButton.title = isMaximized ? 'Restore Down' : 'Maximize';
      }
    });
  }

  // Launcher button
  document.getElementById('launcher-btn')?.addEventListener('click', () => {    
    if (window.launcherApi) {
      window.launcherApi.open();
    }
  });

  moduleSwitcher?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-module]');
    if (!button) {
      return;
    }

    const moduleKey = button.dataset.module;

    if (!moduleKey || selectedPanel < 0) {
      return;
    }

    loadModule(selectedPanel, moduleKey);
  });

  addPanelButton?.addEventListener('click', () => addPanel());
}

function setupContextTracking() {
    document.addEventListener('focusin', (e) => {
        const panel = e.target.closest('.panel');
        if (panel) {
            const panelIdx = Number(panel.dataset.panel);
            updateActiveContext({
                lastActivePanelIdx: panelIdx,
                lastFocusedElement: e.target
            });
        }
    });

    document.addEventListener('selectionchange', () => {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const panel = range.commonAncestorContainer.nodeType === 1 
                ? range.commonAncestorContainer.closest('.panel') 
                : range.commonAncestorContainer.parentElement.closest('.panel');
            
            if (panel) {
                updateActiveContext({
                    lastSelection: {
                        panelIdx: Number(panel.dataset.panel),
                        range: range.cloneRange()
                    }
                });
            }
        }
    });
}

async function initialize() {
  applyTheme(await loadInitialTheme(), { persist: false });
  setupHeaderButtons();
  bindBrandingInteractions();
  setupContextTracking();
  setupCloseConfirmationHandling();

  const savedState = await loadPanelState();

  // Clear existing panels first to avoid duplicating them
  panelsContainer.innerHTML = '';
  panelState.clear();
  selectedPanel = -1;

  // Setup panel events first
  setupPanelEvents();

  // Load saved modules or default
  if (savedState && savedState.length > 0) {
    for (const panelData of savedState) {
      await addPanel(panelData?.moduleKey || null);
    }
  } else {
    await addPanel();
  }

  if (getPanels().length > 0) {
    selectPanel(0);
  }
  savePanelState();
  maybeShowWelcomeModal();

  window.addEventListener('mousemove', handlePanelResize);
  window.addEventListener('mouseup', stopPanelResize);
  window.addEventListener('blur', stopPanelResize);
}

initialize();

window.settingsApi?.onChanged?.((settings) => {
  const nextTheme = settings?.theme;
  if (SCRAPPY_THEMES.includes(nextTheme) && nextTheme !== currentTheme) {
    applyTheme(nextTheme, { persist: false });
  }
});

// Persist panel state when the window is about to close
window.addEventListener('beforeunload', () => {
  try {
    savePanelState();
  } catch (e) {
    console.error('Failed to save panel state on unload:', e);
  }
});

window.addEventListener("DOMContentLoaded", () => {
    import('./modules/scrappyThoughts.js')
        .then(module => module.startScrappyThoughtEngine())
        .catch(err => console.error("Thought Engine failed to load:", err));    
});
