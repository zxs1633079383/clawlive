import { readFile } from 'node:fs/promises';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import type { LobsterSkill } from '../realtime/types.js';

const md = new MarkdownIt();

interface SkillFrontmatter {
  name?: string;
  description?: string;
  version?: string;
  triggerInterval?: string;
  maxSuggestionRate?: string;
  triggerConditions?: string[];
  collaborationMode?: string;
  preferredFormat?: string;
  maxLength?: number;
  language?: string;
}

/**
 * Parse a SKILL.md string into a structured LobsterSkill object.
 */
export function parseSkill(markdown: string): LobsterSkill {
  const { data, content } = matter(markdown);
  const frontmatter = data as SkillFrontmatter;

  const sections = extractSections(content);

  return {
    name: frontmatter.name ?? 'unnamed-lobster',
    description: frontmatter.description ?? '',
    version: frontmatter.version ?? '1.0',
    identity: sections.identity ?? '',
    rules: sections.rules ?? [],
    triggerInterval: parseDuration(frontmatter.triggerInterval, 15_000),
    maxSuggestionRate: parseDuration(frontmatter.maxSuggestionRate, 30_000),
    triggerConditions: frontmatter.triggerConditions ?? [],
    collaborationMode: parseCollaborationMode(frontmatter.collaborationMode),
    preferredFormat: frontmatter.preferredFormat ?? 'bullet_points',
    maxLength: frontmatter.maxLength ?? 200,
    language: frontmatter.language ?? 'match_meeting_language',
    rawContent: content.trim(),
  };
}

/**
 * Parse a SKILL.md file from disk.
 */
export async function parseSkillFile(filePath: string): Promise<LobsterSkill> {
  const raw = await readFile(filePath, 'utf-8');
  return parseSkill(raw);
}

/**
 * Extract markdown sections by heading.
 */
function extractSections(content: string): { identity: string; rules: string[] } {
  const tokens = md.parse(content, {});

  let currentSection = '';
  let identity = '';
  const rules: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === 'heading_open') {
      const inlineToken = tokens[i + 1];
      if (inlineToken?.type === 'inline') {
        currentSection = (inlineToken.content ?? '').toLowerCase().trim();
      }
    }

    if (token.type === 'inline' && tokens[i - 1]?.type !== 'heading_open') {
      const text = token.content.trim();
      if (!text) continue;

      if (currentSection.includes('identity') || currentSection.includes('身份')) {
        identity += (identity ? '\n' : '') + text;
      }

      if (currentSection.includes('rule') || currentSection.includes('规则') || currentSection.includes('行为')) {
        // Parse bullet list items
        const lines = text.split('\n');
        for (const line of lines) {
          const trimmed = line.replace(/^[-*]\s*/, '').trim();
          if (trimmed) {
            rules.push(trimmed);
          }
        }
      }
    }
  }

  return { identity, rules };
}

/**
 * Parse a duration string like "15s" or "1/30s" into milliseconds.
 */
function parseDuration(value: string | undefined, defaultMs: number): number {
  if (!value) return defaultMs;

  // Handle "1/30s" format (rate notation)
  const rateMatch = value.match(/^(\d+)\/(\d+)s$/);
  if (rateMatch) {
    return parseInt(rateMatch[2], 10) * 1000;
  }

  // Handle "15s" format
  const secondsMatch = value.match(/^(\d+)s$/);
  if (secondsMatch) {
    return parseInt(secondsMatch[1], 10) * 1000;
  }

  // Handle plain number (milliseconds)
  const num = parseInt(value, 10);
  return isNaN(num) ? defaultMs : num;
}

function parseCollaborationMode(value: string | undefined): 'passive' | 'reactive' | 'proactive' {
  if (value === 'passive' || value === 'reactive' || value === 'proactive') {
    return value;
  }
  return 'reactive';
}
