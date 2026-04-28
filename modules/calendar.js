import { on, emit } from './scrappy.js';

let panelStates = new Map();

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function renderCalendar(panelIdx) {
  return `
    <div class="module-shell calendar-module" id="calendar-module-${panelIdx}">
      <div class="module-topbar">
        <h2 class="accent module-title" style="display: flex; align-items: center; gap: 12px; flex: 1;">
          Calendar
          <span class="calendar-month-label" id="calendar-month-label-${panelIdx}" style="font-size: 1.1rem; flex: 1; text-align: center; margin-right: 32px;"></span>
        </h2>
        <button class="module-close-btn" data-close-panel="${panelIdx}" title="Close panel">&#10005;</button>
      </div>

      <div class="module-body calendar-body">
        <div class="calendar-toolbar">
          <div class="calendar-nav-group">
            <button class="module-action-btn calendar-nav-btn" data-calendar-nav="prev" data-panel="${panelIdx}" type="button">&#8592;</button>
            <button class="module-action-btn calendar-today-btn" data-calendar-nav="today" data-panel="${panelIdx}" type="button">Today</button>
            <button class="module-action-btn calendar-nav-btn" data-calendar-nav="next" data-panel="${panelIdx}" type="button">&#8594;</button>
          </div>
          <div class="calendar-view-group">
            <button class="module-action-btn calendar-view-btn" data-calendar-view="month" data-panel="${panelIdx}" type="button">Month</button>
            <button class="module-action-btn calendar-view-btn" data-calendar-view="week" data-panel="${panelIdx}" type="button">Week</button>
            <button class="module-action-btn calendar-view-btn" data-calendar-view="year" data-panel="${panelIdx}" type="button">Year</button>
            <button class="module-action-btn calendar-view-btn" data-calendar-view="events" data-panel="${panelIdx}" type="button">Upcoming</button>
          </div>
        </div>

        <div class="calendar-surface" id="calendar-surface-${panelIdx}">        
          <div class="calendar-weekdays" id="calendar-weekdays-${panelIdx}">    
            <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
          </div>
          <div class="calendar-grid" id="calendar-grid-${panelIdx}"></div>      
          <div class="calendar-events-list" id="calendar-events-list-${panelIdx}" style="display: none;"></div>
        </div>

        <div class="calendar-detail-card" id="calendar-detail-card-${panelIdx}">
          <div>
            <div class="calendar-detail-label">Selected Day</div>
            <div class="calendar-detail-date" id="calendar-detail-date-${panelIdx}"></div>
          </div>
          <div class="calendar-detail-notes" id="calendar-detail-notes-${panelIdx}">
            Click a day or event to view details.
          </div>
        </div>
        <div class="calendar-hover-tooltip" id="calendar-hover-tooltip-${panelIdx}" hidden></div>
      </div>
    </div>
  `;
}

export function bindInteractions(panelIdx, initialState, store) {
  if (!panelStates.has(panelIdx)) {
    panelStates.set(panelIdx, {
      currentDate: new Date(),
      selectedDate: new Date(),
      view: 'month',
      events: []
    });
  }

  const state = panelStates.get(panelIdx);

  store.on('db:result:calendar', (events) => {
    state.events = events;
    updateCalendar(panelIdx);
  });

  store.emit('db:read:calendar', {});
  
  const panelContent = document.getElementById(`panel-content-${panelIdx}`);
  if (!panelContent) return;

  panelContent.onclick = (e) => {
    if (store.closedState) return;

    const eventPill = e.target.closest('.calendar-event-pill');
    if (eventPill) {
      const event = state.events.find(ev => ev.id === eventPill.dataset.id);
      if (event) showEventModal(panelIdx, new Date(event.date), store, event);
      return;
    }

    const navBtn = e.target.closest('[data-calendar-nav]');
    if (navBtn) {
      handleNav(panelIdx, navBtn.dataset.calendarNav);
      return;
    }

    const viewBtn = e.target.closest('[data-calendar-view]');
    if (viewBtn) {
      handleViewChange(panelIdx, viewBtn.dataset.calendarView);
      return;
    }

    const dayEl = e.target.closest('.calendar-day');
    if (dayEl && dayEl.dataset.date) {
      const nextDate = new Date(dayEl.dataset.date);
      state.selectedDate = nextDate;
      if (state.view === 'year') {
        state.currentDate = new Date(nextDate);
        state.view = 'month';
      }
      updateCalendar(panelIdx);
    }
  };

  panelContent.oncontextmenu = (e) => {
    if (store.closedState) return;
    const dayEl = e.target.closest('.calendar-day');
    const pill = e.target.closest('.calendar-event-pill');
    
    if (dayEl || pill) {
        e.preventDefault();
        const items = [];
        if (pill) {
            const event = state.events.find(ev => ev.id === pill.dataset.id);
            if (event) {
                items.push({ label: 'Edit Event', icon: 'edit', action: () => showEventModal(panelIdx, new Date(event.date), store, event) });
                items.push({ label: 'Delete Event', icon: 'delete', action: () => {
                    if (confirm('Delete this event?')) store.emit('db:delete:calendar', { id: event.id });
                }});
                items.push({ separator: true });
                items.push({ label: 'Show in Data Panel', icon: 'data', action: () => window.openDataPanel({ title: event.title, data: event, type: 'json' }) });
            }
        } else if (dayEl) {
            items.push({ label: 'Add Event Here', icon: 'add', action: () => showEventModal(panelIdx, new Date(dayEl.dataset.date), store) });
            items.push({ label: 'View Day Details', icon: 'view', action: () => {
                state.selectedDate = new Date(dayEl.dataset.date);
                updateCalendar(panelIdx);
            }});
        }
        store.showContextMenu(e.clientX, e.clientY, items);
    }
  };

  panelContent.ondragstart = (e) => {
    if (store.closedState) return;
    const pill = e.target.closest('.calendar-event-pill');
    if (!pill?.dataset.id) {
      return;
    }

    const event = state.events.find((entry) => entry.id === pill.dataset.id);
    if (!event) {
      return;
    }

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', event.id);
    pill.classList.add('calendar-event-pill--dragging');
  };

  panelContent.ondragend = () => {
    clearDayDropTargets(panelContent);
    panelContent.querySelectorAll('.calendar-event-pill--dragging').forEach((pill) => {
      pill.classList.remove('calendar-event-pill--dragging');
    });
  };

  panelContent.ondragover = (e) => {
    const dayEl = e.target.closest('.calendar-day');
    if (!dayEl?.dataset.date) {
      return;
    }

    e.preventDefault();
    clearDayDropTargets(panelContent);
    dayEl.classList.add('calendar-day--drop-target');
    e.dataTransfer.dropEffect = 'move';
  };

  panelContent.ondragleave = (e) => {
    const dayEl = e.target.closest('.calendar-day');
    if (dayEl && !dayEl.contains(e.relatedTarget)) {
      dayEl.classList.remove('calendar-day--drop-target');
    }
  };

  panelContent.ondrop = (e) => {
    const dayEl = e.target.closest('.calendar-day');
    const eventId = e.dataTransfer?.getData('text/plain');
    if (!dayEl?.dataset.date || !eventId) {
      return;
    }

    e.preventDefault();
    clearDayDropTargets(panelContent);

    const event = state.events.find((entry) => entry.id === eventId);
    if (!event) {
      return;
    }

    const nextDate = dayEl.dataset.date.split('T')[0];
    if (nextDate === event.date) {
      return;
    }

    store.emit('db:update:calendar', {
      id: event.id,
      data: { date: nextDate }
    });
    state.selectedDate = new Date(dayEl.dataset.date);
  };

  panelContent.onmousemove = (e) => {
    const pill = e.target.closest('.calendar-event-pill--month');
    if (!pill?.dataset.id) {
      hideCalendarTooltip(panelIdx);
      return;
    }

    const event = state.events.find((entry) => entry.id === pill.dataset.id);
    if (!event) {
      hideCalendarTooltip(panelIdx);
      return;
    }

    showCalendarTooltip(panelIdx, e.clientX, e.clientY, event);
  };

  panelContent.onmouseleave = () => {
    hideCalendarTooltip(panelIdx);
  };
}

function showEventModal(panelIdx, date, store, existingEvent = null) {
  const dateString = date.toISOString().split('T')[0];
  const overlay = document.createElement('div');
  overlay.className = 'event-modal-overlay';
  overlay.innerHTML = `
    <div class="event-modal">
      <h3>${existingEvent ? 'Edit Event' : 'Add Event'}</h3>
      <div class="calendar-detail-label">Event Date</div>
      <input type="date" id="event-date" value="${escapeHtml(existingEvent?.date || dateString)}" />
      <input type="text" id="event-title" placeholder="Title" required autofocus value="${escapeHtml(existingEvent?.title || '')}" />
      <input type="text" id="event-location" placeholder="Location" value="${escapeHtml(existingEvent?.location || '')}" />
      <div style="display: flex; gap: 8px;">
        <input type="time" id="event-start" value="${escapeHtml(existingEvent?.start || '09:00')}" />
        <input type="time" id="event-end" value="${escapeHtml(existingEvent?.end || '10:00')}" />
      </div>
      <textarea id="event-notes" placeholder="Notes..." rows="3">${escapeHtml(existingEvent?.notes || '')}</textarea>
      <div style="display: flex; align-items: center; gap: 8px; margin: 8px 0;">
        <input type="checkbox" id="event-completed" ${existingEvent?.completed ? 'checked' : ''} />
        <label for="event-completed">Completed</label>
      </div>
      <div class="event-modal-actions">
        ${existingEvent ? `<button class="event-modal-btn cancel" id="event-delete" style="background: #ef4444; margin-right: auto;">Delete</button>` : ''}     
        <button class="event-modal-btn cancel" id="event-cancel">Cancel</button>
        <button class="event-modal-btn save" id="event-save">${existingEvent ? 'Update' : 'Save'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('#event-cancel').onclick = close;
  if (existingEvent) {
      overlay.querySelector('#event-delete').onclick = () => {
          if (confirm('Delete this event?')) { store.emit('db:delete:calendar', { id: existingEvent.id }); close(); }
      };
  }
  overlay.querySelector('#event-save').onclick = () => {
    const title = document.getElementById('event-title').value.trim();
    if (!title) return alert('Title required');
    const nextDate = document.getElementById('event-date').value;
    if (!nextDate) return alert('Date required');
    const data = {
      date: nextDate, title,
      location: document.getElementById('event-location').value,
      start: document.getElementById('event-start').value,
      end: document.getElementById('event-end').value,
      notes: document.getElementById('event-notes').value,
      completed: document.getElementById('event-completed').checked
    };
    if (existingEvent) store.emit('db:update:calendar', { id: existingEvent.id, data });
    else store.emit('db:write:calendar', { event: data });
    close();
  };
}

function handleNav(panelIdx, direction) {
  const state = panelStates.get(panelIdx);
  let d = new Date(state.currentDate);
  if (state.view === 'month') {
    if (direction === 'prev') d.setMonth(d.getMonth() - 1);
    else if (direction === 'next') d.setMonth(d.getMonth() + 1);
    else {
      d = new Date();
      state.selectedDate = new Date(d);
    }
  } else if (state.view === 'year') {
    if (direction === 'prev') d.setFullYear(d.getFullYear() - 1);
    else if (direction === 'next') d.setFullYear(d.getFullYear() + 1);
    else {
      d = new Date();
      state.selectedDate = new Date(d);
    }
  } else {
    if (direction === 'prev') d.setDate(d.getDate() - 7);
    else if (direction === 'next') d.setDate(d.getDate() + 7);
    else {
      d = new Date();
      state.selectedDate = new Date(d);
    }
  }
  state.currentDate = d;
  updateCalendar(panelIdx);
}

function handleViewChange(panelIdx, view) {
  panelStates.get(panelIdx).view = view;
  updateCalendar(panelIdx);
}

function updateCalendar(panelIdx) {
  const state = panelStates.get(panelIdx);
  const panelContent = document.getElementById(`panel-content-${panelIdx}`);
  const grid = document.getElementById(`calendar-grid-${panelIdx}`);
  const weekdays = document.getElementById(`calendar-weekdays-${panelIdx}`);
  const eventsList = document.getElementById(`calendar-events-list-${panelIdx}`);
  const monthLabel = document.getElementById(`calendar-month-label-${panelIdx}`);
  const detailDate = document.getElementById(`calendar-detail-date-${panelIdx}`);
  const detailNotes = document.getElementById(`calendar-detail-notes-${panelIdx}`);
  if (!grid || !monthLabel || !weekdays || !eventsList) return;

  panelContent?.querySelectorAll('[data-calendar-view]').forEach((button) => {
    button.classList.toggle('active', button.dataset.calendarView === state.view);
  });

  grid.style.display = '';
  weekdays.style.display = '';
  eventsList.style.display = 'none';
  eventsList.innerHTML = '';

  if (state.view === 'events') {
    renderUpcomingView(state, monthLabel, weekdays, grid, eventsList, detailDate, detailNotes);
    return;
  }

  if (state.view === 'week') {
    renderWeekView(state, monthLabel, weekdays, grid, detailDate, detailNotes);
    return;
  }

  if (state.view === 'year') {
    renderYearView(state, monthLabel, weekdays, grid, detailDate, detailNotes);
    return;
  }

  renderMonthView(state, monthLabel, weekdays, grid, detailDate, detailNotes);
}

function renderMonthView(state, monthLabel, weekdays, grid, detailDate, detailNotes) {
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();
  monthLabel.textContent = `${MONTH_NAMES[month]} ${year}`;
  weekdays.innerHTML = '<span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>';
  grid.className = 'calendar-grid calendar-grid--month';

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  grid.innerHTML = '';

  for (let i = 0; i < firstDay; i++) grid.appendChild(document.createElement('div'));
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    const ds = d.toISOString().split('T')[0];
    const dayEvents = state.events.filter(e => e.date === ds);
    const el = document.createElement('div');
    el.className = 'calendar-day';
    el.dataset.date = d.toISOString();
    if (d.toDateString() === new Date().toDateString()) el.classList.add('today');
    if (d.toDateString() === state.selectedDate.toDateString()) el.classList.add('selected');
    el.innerHTML = `
      <span class="calendar-day-num">${i}</span>
      <div class="calendar-day-events">
        ${renderMonthDayEvents(dayEvents)}
      </div>
    `;
    grid.appendChild(el);
  }

  detailDate.textContent = state.selectedDate.toDateString();
  const selDs = state.selectedDate.toISOString().split('T')[0];
  const selEvents = state.events.filter(e => e.date === selDs);
  detailNotes.innerHTML = selEvents.length ? selEvents.map(renderCalendarDetailEvent).join('') : 'No events.';
}

function renderWeekView(state, monthLabel, weekdays, grid, detailDate, detailNotes) {
  const current = new Date(state.currentDate);
  const weekStart = new Date(current);
  weekStart.setDate(current.getDate() - current.getDay());

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  monthLabel.textContent = `${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getDate()} - ${MONTH_NAMES[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
  weekdays.innerHTML = '<span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>';
  grid.className = 'calendar-grid';
  grid.innerHTML = '';

  if (state.selectedDate < weekStart || state.selectedDate > weekEnd) {
    state.selectedDate = new Date(weekStart);
  }

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    const dayEvents = state.events.filter(e => e.date === ds);
    const el = document.createElement('div');
    el.className = 'calendar-day';
    el.dataset.date = d.toISOString();
    if (d.toDateString() === new Date().toDateString()) el.classList.add('today');
    if (d.toDateString() === state.selectedDate.toDateString()) el.classList.add('selected');
    el.innerHTML = `<span class="calendar-day-num">${d.getDate()}</span><div class="calendar-day-events">${dayEvents.map(renderWeekDayEvent).join('')}</div>`;
    grid.appendChild(el);
  }

  detailDate.textContent = state.selectedDate.toDateString();
  const selectedDayKey = state.selectedDate.toISOString().split('T')[0];
  const selectedEvents = state.events
    .filter((event) => event.date === selectedDayKey)
    .sort(sortEventsByDateTime);

  detailNotes.innerHTML = selectedEvents.length
    ? selectedEvents.map(renderCalendarDetailEvent).join('')
    : 'No events for this day.';
}

function renderYearView(state, monthLabel, weekdays, grid, detailDate, detailNotes) {
  const year = state.currentDate.getFullYear();
  const todayKey = new Date().toISOString().split('T')[0];
  const selectedDayKey = state.selectedDate.toISOString().split('T')[0];

  monthLabel.textContent = `${year}`;
  weekdays.style.display = 'none';
  grid.className = 'calendar-grid calendar-grid--year';
  grid.innerHTML = '';

  const eventsByDay = state.events.reduce((map, event) => {
    const list = map.get(event.date) || [];
    list.push(event);
    map.set(event.date, list);
    return map;
  }, new Map());

  for (let month = 0; month < 12; month++) {
    const monthCard = document.createElement('section');
    monthCard.className = 'calendar-year-month';

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthEvents = state.events.filter((event) => {
      const eventDate = new Date(event.date);
      return eventDate.getFullYear() === year && eventDate.getMonth() === month;
    });

    const dayButtons = [];
    for (let i = 0; i < firstDay; i++) {
      dayButtons.push('<div class="calendar-year-day calendar-year-day--placeholder" aria-hidden="true"></div>');
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayKey = date.toISOString().split('T')[0];
      const dayEvents = eventsByDay.get(dayKey) || [];
      const classes = ['calendar-day', 'calendar-year-day'];
      if (dayKey === todayKey) {
        classes.push('today');
      }
      if (dayKey === selectedDayKey) {
        classes.push('selected');
      }
      if (dayEvents.length) {
        classes.push('calendar-year-day--has-events');
      }

      dayButtons.push(`
        <button
          class="${classes.join(' ')}"
          data-date="${date.toISOString()}"
          type="button"
          title="${escapeHtml(buildYearDayTitle(date, dayEvents))}"
        >
          <span class="calendar-year-day__number">${day}</span>
          ${dayEvents.length ? `<span class="calendar-year-day__count">${dayEvents.length}</span>` : ''}
        </button>
      `);
    }

    monthCard.innerHTML = `
      <div class="calendar-year-month__header">
        <div class="calendar-year-month__title">${MONTH_NAMES[month]}</div>
        <div class="calendar-year-month__meta">${monthEvents.length} event${monthEvents.length === 1 ? '' : 's'}</div>
      </div>
      <div class="calendar-year-month__weekdays">
        <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
      </div>
      <div class="calendar-year-month__days">
        ${dayButtons.join('')}
      </div>
    `;
    grid.appendChild(monthCard);
  }

  detailDate.textContent = state.selectedDate.toDateString();
  const selectedEvents = (eventsByDay.get(selectedDayKey) || []).sort(sortEventsByDateTime);
  detailNotes.innerHTML = selectedEvents.length
    ? selectedEvents.map(renderCalendarDetailEvent).join('')
    : 'Pick a day to jump into that month. No events on the selected date.';
}

function renderMonthDayEvents(dayEvents) {
  if (!dayEvents.length) {
    return '';
  }

  const visibleEvents = dayEvents.slice(0, 2);
  const remainingCount = dayEvents.length - visibleEvents.length;

  const cards = visibleEvents.map((event) => `
    <div class="${getEventPillClassNames(event, ['calendar-event-pill--month'])}" data-id="${event.id}" draggable="true">
      <span class="calendar-event-pill__time">${escapeHtml(event.start || '')}</span>
      <span class="calendar-event-pill__title">${escapeHtml(event.title || 'Untitled Event')}</span>
    </div>
  `);

  if (remainingCount > 0) {
    cards.push(`<div class="calendar-event-more">+${remainingCount} more</div>`);
  }

  return cards.join('');
}

function renderWeekDayEvent(event) {
  return `
    <div class="${getEventPillClassNames(event)}" data-id="${event.id}" draggable="true">
      <strong>${escapeHtml(event.start || '')}</strong> ${escapeHtml(event.title || 'Untitled Event')}
    </div>
  `;
}

function renderUpcomingView(state, monthLabel, weekdays, grid, eventsList, detailDate, detailNotes) {
  const upcomingEvents = [...state.events].sort(sortEventsByDateTime);

  monthLabel.textContent = 'Upcoming Events';
  weekdays.style.display = 'none';
  grid.style.display = 'none';
  eventsList.style.display = 'block';

  if (upcomingEvents.length === 0) {
    eventsList.innerHTML = '<div class="calendar-empty-state">No upcoming events yet.</div>';
    detailDate.textContent = 'Upcoming Events';
    detailNotes.textContent = 'Add an event to see it here.';
    return;
  }

  eventsList.innerHTML = upcomingEvents.map((event) => `
    <div class="${getEventPillClassNames(event)}" data-id="${event.id}" draggable="true">
      <strong>${escapeHtml(formatEventDay(event.date))} ${escapeHtml(event.start || '')}</strong> ${escapeHtml(event.title || 'Untitled Event')}
    </div>
  `).join('');

  const nextEvent = upcomingEvents[0];
  detailDate.textContent = formatEventDay(nextEvent.date);
  detailNotes.innerHTML = upcomingEvents.map((event) => `
    ${renderCalendarDetailEvent(event)}
  `).join('');
}

function renderCalendarDetailEvent(event) {
  const when = [formatEventDay(event.date), event.start].filter(Boolean).join(' ');
  const notes = (event.notes || '').trim();
  const location = (event.location || '').trim();

  return `
    <div class="${getEventPillClassNames(event, ['calendar-event-pill-detail'])}" data-id="${event.id}" draggable="true">
      <strong>${escapeHtml(when)}</strong> ${escapeHtml(event.title || 'Untitled Event')}
      ${location ? `<div class="calendar-event-pill__meta">${escapeHtml(location)}</div>` : ''}
      ${notes ? `<div class="calendar-event-pill__notes">${escapeHtml(notes).replace(/\n/g, '<br>')}</div>` : '<div class="calendar-event-pill__notes calendar-event-pill__notes--empty">No notes.</div>'}
    </div>
  `;
}

function getEventPillClassNames(event, extraClasses = []) {
  const classes = ['calendar-event-pill', `calendar-event-pill--${inferEventCategory(event)}`];
  if (event.completed) {
    classes.push('completed');
  }
  classes.push(...extraClasses);
  return classes.join(' ');
}

function inferEventCategory(event) {
  const haystack = `${event.title || ''} ${event.notes || ''} ${event.location || ''}`.toLowerCase();

  if (event.completed) return 'completed';
  if (/\b(meeting|client|office|project|deadline|review|standup|work)\b/.test(haystack)) return 'work';
  if (/\b(doctor|dentist|therapy|gym|workout|health|med|checkup)\b/.test(haystack)) return 'health';
  if (/\b(bill|rent|invoice|payment|budget|tax|bank|finance)\b/.test(haystack)) return 'finance';
  if (/\b(flight|trip|travel|hotel|airport|train|drive)\b/.test(haystack)) return 'travel';
  if (/\b(birthday|party|dinner|lunch|coffee|family|friend|date)\b/.test(haystack)) return 'social';
  if (/\b(home|repair|clean|house|yard|delivery)\b/.test(haystack)) return 'home';
  return 'general';
}

function showCalendarTooltip(panelIdx, clientX, clientY, event) {
  const tooltip = document.getElementById(`calendar-hover-tooltip-${panelIdx}`);
  if (!tooltip) {
    return;
  }

  const location = (event.location || '').trim();
  const notes = (event.notes || '').trim();
  const when = [formatEventDay(event.date), event.start, event.end ? `- ${event.end}` : ''].filter(Boolean).join(' ');

  tooltip.innerHTML = `
    <div class="calendar-hover-tooltip__title">${escapeHtml(event.title || 'Untitled Event')}</div>
    <div class="calendar-hover-tooltip__meta">${escapeHtml(when)}</div>
    ${location ? `<div class="calendar-hover-tooltip__meta">${escapeHtml(location)}</div>` : ''}
    <div class="calendar-hover-tooltip__notes">${notes ? escapeHtml(notes).replace(/\n/g, '<br>') : 'No notes.'}</div>
  `;
  tooltip.hidden = false;

  const offset = 16;
  const maxLeft = window.innerWidth - tooltip.offsetWidth - 12;
  const maxTop = window.innerHeight - tooltip.offsetHeight - 12;
  tooltip.style.left = `${Math.max(12, Math.min(maxLeft, clientX + offset))}px`;
  tooltip.style.top = `${Math.max(12, Math.min(maxTop, clientY + offset))}px`;
}

function hideCalendarTooltip(panelIdx) {
  const tooltip = document.getElementById(`calendar-hover-tooltip-${panelIdx}`);
  if (!tooltip) {
    return;
  }

  tooltip.hidden = true;
  tooltip.innerHTML = '';
}

function clearDayDropTargets(panelContent) {
  panelContent.querySelectorAll('.calendar-day--drop-target').forEach((dayEl) => {
    dayEl.classList.remove('calendar-day--drop-target');
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function sortEventsByDateTime(a, b) {
  return new Date(`${a.date}T${a.start || '00:00'}`) - new Date(`${b.date}T${b.start || '00:00'}`);
}

function formatEventDay(dateString) {
  return new Date(dateString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
}

function buildYearDayTitle(date, dayEvents) {
  const label = date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  if (!dayEvents.length) {
    return `${label} - no events`;
  }
  const eventSummary = dayEvents
    .sort(sortEventsByDateTime)
    .slice(0, 3)
    .map((event) => [event.start, event.title || 'Untitled Event'].filter(Boolean).join(' '))
    .join(' | ');
  const moreCount = dayEvents.length - Math.min(dayEvents.length, 3);
  return `${label} - ${eventSummary}${moreCount > 0 ? ` | +${moreCount} more` : ''}`;
}
