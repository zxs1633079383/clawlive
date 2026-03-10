import { Router, type Request, type Response } from 'express';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, basename } from 'node:path';
import { z } from 'zod';
import { config } from '../config.js';
import { parseSkill } from '../lobster/skill-parser.js';

export const skillRouter: Router = Router();

const createSkillSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Skill name must be lowercase alphanumeric with hyphens'),
  content: z.string().min(10).max(10_000),
});

// GET /api/skills - List all available skills
skillRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const skillsDir = resolve(config.SKILLS_DIR);

    let files: string[];
    try {
      files = await readdir(skillsDir);
    } catch {
      // Skills directory doesn't exist yet
      res.json({ success: true, data: [], error: null });
      return;
    }

    const mdFiles = files.filter((f) => extname(f) === '.md');
    const skills = await Promise.all(
      mdFiles.map(async (file) => {
        try {
          const filePath = resolve(skillsDir, file);
          const raw = await readFile(filePath, 'utf-8');
          const skill = parseSkill(raw);
          return {
            name: skill.name,
            description: skill.description,
            version: skill.version,
            collaborationMode: skill.collaborationMode,
            fileName: file,
          };
        } catch (err) {
          console.warn(`[skills] Failed to parse ${file}:`, err);
          return {
            name: basename(file, '.md'),
            description: 'Failed to parse skill file',
            version: 'unknown',
            collaborationMode: 'reactive' as const,
            fileName: file,
          };
        }
      }),
    );

    res.json({ success: true, data: skills, error: null });
  } catch (err) {
    console.error('[skill-routes] Error listing skills:', err);
    res.status(500).json({
      success: false,
      data: null,
      error: err instanceof Error ? err.message : 'Failed to list skills',
    });
  }
});

// GET /api/skills/:name - Get a single skill
skillRouter.get('/:name', async (req: Request, res: Response) => {
  try {
    const skillsDir = resolve(config.SKILLS_DIR);
    const filePath = resolve(skillsDir, `${req.params.name}.md`);

    let raw: string;
    try {
      raw = await readFile(filePath, 'utf-8');
    } catch {
      res.status(404).json({ success: false, data: null, error: 'Skill not found' });
      return;
    }

    const skill = parseSkill(raw);
    res.json({ success: true, data: { ...skill, rawMarkdown: raw }, error: null });
  } catch (err) {
    console.error('[skill-routes] Error reading skill:', err);
    res.status(500).json({
      success: false,
      data: null,
      error: err instanceof Error ? err.message : 'Failed to read skill',
    });
  }
});

// POST /api/skills - Upload a new skill
skillRouter.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = createSkillSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        data: null,
        error: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    // Validate that the content is valid skill markdown
    const skill = parseSkill(parsed.data.content);

    const skillsDir = resolve(config.SKILLS_DIR);
    await mkdir(skillsDir, { recursive: true });

    const filePath = resolve(skillsDir, `${parsed.data.name}.md`);
    await writeFile(filePath, parsed.data.content, 'utf-8');

    res.status(201).json({ success: true, data: skill, error: null });
  } catch (err) {
    console.error('[skill-routes] Error creating skill:', err);
    res.status(500).json({
      success: false,
      data: null,
      error: err instanceof Error ? err.message : 'Failed to create skill',
    });
  }
});
