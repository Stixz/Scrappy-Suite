import { emit } from './scrappy.js';

// Scrappy Suite - Shared Database Module
const DB_NAME = 'scrappy_suite_db';

function safeParse(rawValue, fallback) {
  if (!rawValue) return fallback;
  try { return JSON.parse(rawValue); } catch { return fallback; }
}

function _getDB() {
  const data = localStorage.getItem(DB_NAME);
  const db = safeParse(data, { calendar: [], notes: [], tasks: [], tables: [] });
  if (!Array.isArray(db.tables)) db.tables = [];
  if (!Array.isArray(db.calendar)) db.calendar = [];
  return db;
}

function _saveDB(db) {
  localStorage.setItem(DB_NAME, JSON.stringify(db));
  emit('db:updated', db);
}

export const db = {
  getEvents: () => _getDB().calendar,
  addEvent: (event) => {
    const store = _getDB();
    const newEvent = { id: Date.now().toString(), ...event, createdAt: new Date().toISOString() };
    store.calendar.push(newEvent);
    _saveDB(store);
    emit('event:added', newEvent);
    return newEvent;
  },
  deleteEvent: (eventId) => {
    const store = _getDB();
    store.calendar = store.calendar.filter(e => e.id !== eventId);
    _saveDB(store);
    emit('event:deleted', { eventId });
  },
  updateEvent: (eventId, data) => {
    const store = _getDB();
    const index = store.calendar.findIndex(e => e.id === eventId);
    if (index !== -1) {
      store.calendar[index] = { ...store.calendar[index], ...data, updatedAt: new Date().toISOString() };
      _saveDB(store);
      emit('event:updated', store.calendar[index]);
      return store.calendar[index];
    }
    return null;
  }
};
