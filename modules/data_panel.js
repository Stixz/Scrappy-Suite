/**
 * Scrappy Suite - Data Panel Module
 * Displays contextual data, JSON, tables, etc.
 */

export function renderDataPanel(panelIdx) {
  return `
    <div class="module-shell data-panel-module">
      <div class="module-topbar">
        <h2 class="accent module-title">Data Explorer</h2>
        <button class="module-close-btn" data-close-panel="${panelIdx}" title="Close panel">&#10005;</button>
      </div>

      <div class="module-body data-panel-body" style="padding: 10px; display: flex; flex-direction: column; gap: 10px; height: 100%; overflow: hidden;">
        <div id="data-panel-header-${panelIdx}" class="data-panel-header" style="font-weight: bold; border-bottom: 1px solid #3a404a; padding-bottom: 8px;">
          No Data Loaded
        </div>
        
        <div id="data-panel-content-${panelIdx}" class="data-panel-content" style="flex: 1; overflow: auto; background: #10151f; border-radius: 4px; padding: 10px; font-family: monospace; font-size: 0.85rem;">
          <div style="opacity: 0.5; text-align: center; padding-top: 40px;">
            Waiting for data...
          </div>
        </div>

        <div class="module-actions" style="margin-top: 0;">
          <button id="clear-data-btn-${panelIdx}" class="module-action-btn" style="padding: 4px 10px; font-size: 0.75rem;">Clear</button>
          <button id="copy-json-btn-${panelIdx}" class="module-action-btn module-action-btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;">Copy JSON</button>
        </div>
      </div>
    </div>
  `;
}

export function bindInteractions(panelIdx, initialState, store) {
  const header = document.getElementById(`data-panel-header-${panelIdx}`);
  const content = document.getElementById(`data-panel-content-${panelIdx}`);    
  const clearBtn = document.getElementById(`clear-data-btn-${panelIdx}`);       
  const copyBtn = document.getElementById(`copy-json-btn-${panelIdx}`);

  let currentData = null;

  const displayData = (payload) => {
    if (!payload) return;
    currentData = payload;

    const { title, data, type } = payload;
    header.textContent = title || 'Data Preview';

    if (type === 'transfer-picker' && data) {
        renderTransferPicker(content, data);
    } else if (type === 'table' && Array.isArray(data)) {
        renderTable(content, data);
    } else if (typeof data === 'object') {
        content.innerHTML = `<pre style="margin: 0;">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
    } else {
        content.textContent = String(data);
    }
  };

  if (initialState) {
    displayData(initialState);
  }

  // Listen for data:push events
  store.on('data:push', (payload) => {
    displayData(payload);
  });

  clearBtn.onclick = () => {
    header.textContent = 'No Data Loaded';
    content.innerHTML = `<div style="opacity: 0.5; text-align: center; padding-top: 40px;">Waiting for data...</div>`;
    currentData = null;
  };

  copyBtn.onclick = () => {
    if (currentData) {
        navigator.clipboard.writeText(JSON.stringify(currentData.data, null, 2))
            .then(() => alert('Copied to clipboard!'))
            .catch(err => console.error('Copy failed:', err));
    }
  };
}

function renderTransferPicker(container, data) {
    const items = Array.isArray(data.items) ? data.items : [];
    const itemSummary = items.length === 1
        ? escapeHtml(items[0].name)
        : `${items.length} items selected`;

    container.innerHTML = `
      <div class="data-transfer-picker">
        <p class="data-transfer-picker__copy">${escapeHtml(data.description || '')}</p>
        <div class="data-transfer-picker__summary">${itemSummary}</div>
        <label class="data-transfer-picker__label" for="data-transfer-destination">Destination Folder</label>
        <input id="data-transfer-destination" class="data-transfer-picker__input" type="text" value="${escapeHtmlAttribute(data.initialValue || '')}" />
        <label class="data-transfer-picker__checkbox">
          <input id="data-transfer-overwrite" type="checkbox" ${data.initialOverwrite ? 'checked' : ''} />
          <span>Overwrite existing items if needed</span>
        </label>
        <div class="data-transfer-picker__items">
          ${items.slice(0, 12).map((item) => `
            <div class="data-transfer-picker__item">
              <span class="data-transfer-picker__name">${escapeHtml(item.name)}</span>
              <span class="data-transfer-picker__path">${escapeHtml(item.path)}</span>
            </div>
          `).join('')}
        </div>
        ${items.length > 12 ? `<p class="data-transfer-picker__more">Showing 12 of ${items.length} items.</p>` : ''}
        <div class="data-transfer-picker__actions">
          <button id="data-transfer-cancel" class="module-action-btn module-action-btn-secondary" type="button">Cancel</button>
          <button id="data-transfer-confirm" class="module-action-btn" type="button">${escapeHtml(data.actionLabel || 'Continue')}</button>
        </div>
      </div>
    `;

    const input = container.querySelector('#data-transfer-destination');
    const overwrite = container.querySelector('#data-transfer-overwrite');
    const confirm = container.querySelector('#data-transfer-confirm');
    const cancel = container.querySelector('#data-transfer-cancel');

    const submit = () => {
        window.fogreTransferApi?.submit(data.requestId, {
            value: input.value.trim(),
            overwrite: overwrite.checked
        });
    };

    const abort = () => {
        window.fogreTransferApi?.cancel(data.requestId);
    };

    confirm.onclick = submit;
    cancel.onclick = abort;
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            submit();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            abort();
        }
    });

    requestAnimationFrame(() => {
        input?.focus();
        input?.select();
    });
}

function renderTable(container, data) {
    if (data.length === 0) {
        container.textContent = 'Empty table';
        return;
    }

    const keys = Object.keys(data[0]);
    let html = `<table style="width: 100%; border-collapse: collapse;"><thead><tr style="border-bottom: 2px solid #3a404a;">`;
    keys.forEach(key => {
        html += `<th style="text-align: left; padding: 6px; border-right: 1px solid #3a404a;">${escapeHtml(key)}</th>`;
    });
    html += `</tr></thead><tbody>`;

    data.forEach(row => {
        html += `<tr style="border-bottom: 1px solid #3a404a;">`;
        keys.forEach(key => {
            html += `<td style="padding: 6px; border-right: 1px solid #3a404a;">${escapeHtml(String(row[key] || ''))}</td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
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
