let themeSyncHandlerBound = false;

export function renderHelp(panelIdx) {
  return `
    <div class="module-shell help-module">
      <div class="module-topbar">
        <h2 class="accent module-title">Help</h2>
        <button class="module-close-btn" data-close-panel="${panelIdx}" title="Close panel">&#10005;</button>
      </div>

      <div class="module-body help-body">
        <section class="help-section">
          <h3>Quick Start</h3>
          <p>Scrappy Suite opens with a blank panel so you can build the workspace you actually want.</p>
          <ul class="help-list">
            <li>Click <strong>Add Panel</strong> to create another empty panel.</li>
            <li>Select a panel before loading a module into it.</li>
            <li>Use the toolbar to load Calendar, DirT Writer, Fogre, or Help.</li>
            <li>Use the left and right arrows in a panel header to move it, and drag dividers to resize panels.</li>
          </ul>
        </section>

        <section class="help-section">
          <h3>Modules</h3>
          <div class="help-grid">
            <article class="help-card">
              <h4>Calendar</h4>
              <p>Create, review, and navigate events inside the app.</p>
            </article>
            <article class="help-card">
              <h4>DirT Writer</h4>
              <p>Draft, edit, open, and save documents.</p>
            </article>
            <article class="help-card">
              <h4>Fogre</h4>
              <p>Browse files, preview content, and open files into Writer.</p>
            </article>
            <article class="help-card">
              <h4>Launcher</h4>
              <p>Open saved shortcuts for apps, files, folders, and web links from anywhere in the workspace.</p>
            </article>
            <article class="help-card help-card-request">
              <h4>Request a Module</h4>
              <p>Have an idea for another tool? This slot is reserved for future module requests once that workflow is wired in.</p>
            </article>
          </div>
        </section>

        <section class="help-section">
          <h3>Persistence</h3>
          <ul class="help-list">
            <li>Panel layout and loaded modules are restored between sessions.</li>
            <li>Blank panels stay blank until you choose something.</li>
            <li>Launcher shortcuts and local app state are stored locally.</li>
            <li>Window size and position are remembered.</li>
          </ul>
        </section>

        <section class="help-section">
          <h3>Launcher</h3>
          <p>The launcher gives you quick access to saved shortcuts without leaving the workspace.</p>
          <ul class="help-list">
            <li>Open it from the toolbar using the circular launcher button.</li>
            <li>Save shortcuts for apps, files, folders, and web links.</li>
            <li>Edit or remove shortcuts from the launcher context menu.</li>
            <li>Use <strong>Visit Studio</strong> for a direct jump to Ravenforge Creations Studio.</li>
          </ul>
        </section>

        <section class="help-section">
          <h3>Appearance</h3>
          <p>Scrappy includes a small set of built-in themes. Pick one and the app will remember it next time.</p>
          <div class="theme-picker-grid">
            <button class="theme-option-btn" data-theme="scrappy-default" type="button">
              <span class="theme-option-btn__swatch theme-option-btn__swatch--scrappy-default" aria-hidden="true"></span>
              <span class="theme-option-btn__content">
                <strong>Scrappy Default</strong>
                <span>Charcoal and orange. The house blend.</span>
              </span>
            </button>
            <button class="theme-option-btn" data-theme="ember" type="button">
              <span class="theme-option-btn__swatch theme-option-btn__swatch--ember" aria-hidden="true"></span>
              <span class="theme-option-btn__content">
                <strong>Ember</strong>
                <span>Hotter forge tones, soot-dark panels, and a more obvious fire glow.</span>
              </span>
            </button>
            <button class="theme-option-btn" data-theme="frosted-glass" type="button">
              <span class="theme-option-btn__swatch theme-option-btn__swatch--frosted-glass" aria-hidden="true"></span>
              <span class="theme-option-btn__content">
                <strong>Frosted Glass</strong>
                <span>Cool smoke, pale glass edges, and a brighter iced accent.</span>
              </span>
            </button>
            <button class="theme-option-btn" data-theme="midnight-mint" type="button">
              <span class="theme-option-btn__swatch theme-option-btn__swatch--midnight-mint" aria-hidden="true"></span>
              <span class="theme-option-btn__content">
                <strong>Midnight Mint</strong>
                <span>The calmer, cleaner late-night option.</span>
              </span>
            </button>
          </div>
        </section>

        <section class="help-section">
          <h3>Known Limitations</h3>
          <ul class="help-list">
            <li>Some modules are still evolving and may feel more practical than polished.</li>
            <li>Local persistence is helpful, but it is not the same as explicitly saving files you care about.</li>
            <li>This is freeware software, so now and then it may reveal a little personality.</li>
          </ul>
        </section>

        <section class="help-section help-about">
          <h3>About</h3>
          <p>Scrappy Suite is freeware from Ravenforge Creations Studio.</p>
          <p><a class="help-link" href="https://ravenforge.info" target="_blank" rel="noreferrer">https://ravenforge.info</a></p>
        </section>
      </div>
    </div>
  `;
}

export function bindInteractions() {
  document.querySelectorAll('.help-link').forEach((link) => {
    link.addEventListener('click', async (event) => {
      event.preventDefault();
      const href = link.getAttribute('href');
      if (!href || !window.shellApi?.openExternal) {
        return;
      }

      await window.shellApi.openExternal(href);
    });
  });

  const syncThemeButtons = () => {
    const currentTheme = window.scrappyThemeApi?.getCurrentTheme?.() || 'scrappy-default';
    document.querySelectorAll('.theme-option-btn').forEach((button) => {
      button.classList.toggle('active', button.dataset.theme === currentTheme);
    });
  };

  document.querySelectorAll('.theme-option-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const { theme } = button.dataset;
      if (!theme || !window.scrappyThemeApi?.setTheme) {
        return;
      }

      window.scrappyThemeApi.setTheme(theme);
      syncThemeButtons();
    });
  });

  if (!themeSyncHandlerBound) {
    document.addEventListener('scrappy:theme-changed', syncThemeButtons);
    themeSyncHandlerBound = true;
  }
  syncThemeButtons();
}
