import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { meetings } from './meetings.js';

export const lobsterMessages = sqliteTable('lobster_messages', {
  id: text('id').primaryKey(),
  meetingId: text('meeting_id')
    .notNull()
    .references(() => meetings.id),
  lobsterId: text('lobster_id').notNull(),
  ownerUserId: text('owner_user_id').notNull(),
  type: text('type', { enum: ['suggestion', 'response', 'dialogue'] }).notNull(),
  content: text('content').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  metadata: text('metadata', { mode: 'json' }),
});
