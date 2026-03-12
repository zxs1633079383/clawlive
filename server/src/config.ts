import { resolve } from 'node:path';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  SKILLS_DIR: z.string().default('./skills'),
  DEFAULT_SKILL: z.string().default('meeting-analyst'),
  WS_HEARTBEAT_INTERVAL_MS: z.coerce.number().default(30_000),
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }
  const raw = result.data;

  // Resolve SKILLS_DIR relative to the monorepo root (one level up from server/)
  // When running from server/ cwd, "./skills" would incorrectly resolve to "server/skills"
  let skillsDir = raw.SKILLS_DIR;
  if (!skillsDir.startsWith('/')) {
    // Relative path: resolve from monorepo root (parent of server/)
    skillsDir = resolve(process.cwd(), '..', skillsDir);
  }

  return { ...raw, SKILLS_DIR: skillsDir };
}

export const config: Config = loadConfig();
