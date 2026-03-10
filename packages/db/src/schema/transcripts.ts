import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { meetings } from './meetings.js';

export const transcriptSegments = sqliteTable('transcript_segments', {
  id: text('id').primaryKey(),
  meetingId: text('meeting_id')
    .notNull()
    .references(() => meetings.id),
  speakerId: text('speaker_id').notNull(),
  speakerName: text('speaker_name').notNull(),
  text: text('text').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  isFinal: integer('is_final', { mode: 'boolean' }).notNull().default(false),
  language: text('language'),
});
