import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  ANTHROPIC_API_KEY: z.string().default(''),
  OPENAI_API_KEY: z.string().default(''),
  SKILLS_DIR: z.string().default('../skills'),
  WS_HEARTBEAT_INTERVAL_MS: z.coerce.number().default(30_000),
  LOBSTER_TRIGGER_INTERVAL_MS: z.coerce.number().default(15_000),
  LOBSTER_MAX_SUGGESTION_RATE_MS: z.coerce.number().default(30_000),
  TRANSCRIPT_WINDOW_MINUTES: z.coerce.number().default(5),
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }
  return result.data;
}

export const config: Config = loadConfig();
