import { db } from './database.js';
import { on, emit } from './scrappy.js';

/**
 * DatabaseManager Module
 * Centralized hub for DB operations via the global event bus.
 */

export function initDatabaseManager() {
  console.log('DatabaseManager initialized.');

  // Calendar
  on('db:read:calendar', () => {
    console.log('DBManager received db:read:calendar');
    emit('db:result:calendar', db.getEvents());
  });

  on('db:write:calendar', (payload) => {
    console.log('DBManager received db:write:calendar');
    db.addEvent(payload.event);
    emit('db:result:calendar', db.getEvents());
  });

  on('db:delete:calendar', (payload) => {
    console.log('DBManager received db:delete:calendar');
    db.deleteEvent(payload.id);
    emit('db:result:calendar', db.getEvents());
  });

  on('db:update:calendar', (payload) => {
    console.log('DBManager received db:update:calendar');
    db.updateEvent(payload.id, payload.data);
    emit('db:result:calendar', db.getEvents());
  });
}
