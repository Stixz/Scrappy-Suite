/**
 * Scrappy Suite - Core Engine & Communication Store
 */

const globalEvents = {};
const sharedState = {};
const activeContext = {
  lastActivePanelIdx: -1,
  lastFocusedElement: null,
  lastSelection: null
};

export function on(event, callback) {
  if (!globalEvents[event]) globalEvents[event] = [];
  globalEvents[event].push(callback);
  return () => {
    globalEvents[event] = globalEvents[event].filter(cb => cb !== callback);
  };
}

export function emit(event, payload) {
  if (!globalEvents[event]) return;
  const listeners = [...globalEvents[event]];
  listeners.forEach(cb => {
    try { cb(payload); } catch (err) { console.error(`Error in ${event}:`, err); }
  });
}

export function updateActiveContext(updates) {
  Object.assign(activeContext, updates);
  emit('context:updated', activeContext);
}

export function getActiveContext() {
  return { ...activeContext };
}

export function showContextMenu(x, y, items) {
    hideContextMenu();
    const menu = document.createElement('div');
    menu.id = 'scrappy-global-context-menu';
    menu.className = 'scrappy-context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    items.forEach(item => {
        if (item.separator) {
            const sep = document.createElement('div');
            sep.className = 'scrappy-context-menu-separator';
            menu.appendChild(sep);
            return;
        }
        const el = document.createElement('div');
        el.className = `scrappy-context-menu-item ${item.disabled ? 'disabled' : ''}`;
        el.innerHTML = `<span class="icon">${resolveContextIcon(item.icon)}</span> <span>${item.label}</span>`;
        if (!item.disabled) {
            el.onclick = (e) => {
                e.stopPropagation();
                item.action();
                hideContextMenu();
            };
        }
        menu.appendChild(el);
    });

    document.body.appendChild(menu);
    setTimeout(() => { document.addEventListener('click', hideContextMenu, { once: true }); }, 10);
}

export function hideContextMenu() {
    const existing = document.getElementById('scrappy-global-context-menu');
    if (existing) existing.remove();
}

export function resolveContextIcon(icon) {
  const iconMap = {
    add: '+',
    copy: 'C',
    data: 'D',
    delete: 'X',
    edit: 'E',
    extract: 'E',
    info: 'i',
    insert: '>',
    open: 'O',
    path: 'P',
    view: 'V',
    writer: 'W',
    zip: 'Z'
  };

  if (!icon) return '';
  return iconMap[icon] || icon;
}

export function STORE(panelIdx) {
  const localCleanups = [];
  let isClosed = false;

  return {
    on: (event, callback) => {
      if (isClosed) return () => {};
      const unsubscribe = on(event, callback);
      localCleanups.push(unsubscribe);
      return unsubscribe;
    },
    emit: (event, payload) => { if (!isClosed) emit(event, payload); },
    updateContext: (updates) => { if (!isClosed) updateActiveContext(updates); },
    getContext: () => getActiveContext(),
    showContextMenu: (x, y, items) => { if (!isClosed) showContextMenu(x, y, items); },
    close: () => {
      if (isClosed) return;
      isClosed = true;
      while (localCleanups.length > 0) { localCleanups.pop()(); }
      emit('store:closed', { panelIdx });
    },
    get closedState() { return isClosed; },
    panelIdx
  };
}

export const scrappy = { on, emit, STORE, updateActiveContext, getActiveContext, showContextMenu, hideContextMenu, resolveContextIcon };
