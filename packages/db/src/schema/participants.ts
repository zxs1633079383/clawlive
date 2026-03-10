import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { meetings } from './meetings.js';

export const participants = sqliteTable('participants', {
  id: text('id').primaryKey(),
  meetingId: text('meeting_id')
    .notNull()
    .references(() => meetings.id),
  userId: text('user_id').notNull(),
  displayName: text('display_name').notNull(),
  lobsterSkillId: text('lobster_skill_id'),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull(),
  leftAt: integer('left_at', { mode: 'timestamp' }),
  isMuted: integer('is_muted', { mode: 'boolean' }).notNull().default(false),
});
