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

interface ParsedSections {
  identity: string;
  rules: string[];
  triggerConditions: string[];
  outputExamples: string[];
}

/**
 * Parse a SKILL.md string into a structured LobsterSkill object.
 *
 * Extracts:
 * - Frontmatter fields (name, description, version, triggerInterval, etc.)
 * - Markdown sections: Identity, Behavior Rules, Trigger Conditions, Output Examples
 * - Trigger conditions from markdown list items (merged with frontmatter)
 * - Rules from markdown list items (merged with frontmatter)
 */
export function parseSkill(markdown: string): LobsterSkill {
  const { data, content } = matter(markdown);
  const frontmatter = data as SkillFrontmatter;

  const sections = extractSections(content);

  // Merge trigger conditions from frontmatter and markdown body
  const frontmatterConditions = frontmatter.triggerConditions ?? [];
  const bodyConditions = sections.triggerConditions;
  const allConditions = deduplicateStrings([...frontmatterConditions, ...bodyConditions]);

  return {
    name: frontmatter.name ?? 'unnamed-lobster',
    description: frontmatter.description ?? '',
    version: frontmatter.version ?? '1.0',
    identity: sections.identity ?? '',
    rules: sections.rules,
    triggerInterval: parseDuration(frontmatter.triggerInterval, 15_000),
    maxSuggestionRate: parseDuration(frontmatter.maxSuggestionRate, 30_000),
    triggerConditions: allConditions,
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
 *
 * Recognized sections (case-insensitive, supports Chinese variants):
 * - Identity / 身份
 * - Rules / Behavior Rules / 规则 / 行为规则 / 行为
 * - Trigger Conditions / 触发条件
 * - Output Examples / 输出示例
 */
function extractSections(content: string): ParsedSections {
  const tokens = md.parse(content, {});

  let currentSection = '';
  let identity = '';
  const rules: string[] = [];
  const triggerConditions: string[] = [];
  const outputExamples: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Detect heading to update current section
    if (token.type === 'heading_open') {
      const inlineToken = tokens[i + 1];
      if (inlineToken?.type === 'inline') {
        currentSection = (inlineToken.content ?? '').toLowerCase().trim();
      }
    }

    // Process inline content (not heading text itself)
    if (token.type === 'inline' && tokens[i - 1]?.type !== 'heading_open') {
      const text = token.content.trim();
      if (!text) continue;

      // Identity section
      if (isIdentitySection(currentSection)) {
        identity += (identity ? '\n' : '') + text;
      }

      // Rules / Behavior Rules section
      if (isRulesSection(currentSection)) {
        const parsed = parseListItems(text);
        rules.push(...parsed);
      }

      // Trigger Conditions section
      if (isTriggerConditionsSection(currentSection)) {
        const parsed = parseListItems(text);
        triggerConditions.push(...parsed);
      }

      // Output Examples section
      if (isOutputExamplesSection(currentSection)) {
        outputExamples.push(text);
      }
    }
  }

  return { identity, rules, triggerConditions, outputExamples };
}

function isIdentitySection(section: string): boolean {
  return section.includes('identity') || section.includes('身份');
}

function isRulesSection(section: string): boolean {
  return (
    section.includes('rule') ||
    section.includes('behavior') ||
    section.includes('规则') ||
    section.includes('行为')
  );
}

function isTriggerConditionsSection(section: string): boolean {
  return (
    section.includes('trigger') ||
    section.includes('条件') ||
    section.includes('触发')
  );
}

function isOutputExamplesSection(section: string): boolean {
  return (
    section.includes('output') ||
    section.includes('example') ||
    section.includes('输出') ||
    section.includes('示例')
  );
}

/**
 * Parse bullet/numbered list items from markdown inline content.
 * Handles lines starting with -, *, or numbered prefixes (1., 2., etc.).
 */
function parseListItems(text: string): string[] {
  const items: string[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line
      .replace(/^[-*]\s*/, '')
      .replace(/^\d+\.\s*/, '')
      .trim();
    if (trimmed) {
      items.push(trimmed);
    }
  }
  return items;
}

/**
 * Deduplicate an array of strings while preserving order.
 */
function deduplicateStrings(arr: string[]): string[] {
  return [...new Set(arr)];
}

/**
 * Parse a duration string like "15s" or "1/30s" into milliseconds.
 */
function parseDuration(value: string | undefined, defaultMs: number): number {
  if (!value) return defaultMs;

  // Handle "1/30s" format (rate notation: 1 per 30 seconds)
  const rateMatch = value.match(/^(\d+)\/(\d+)s$/);
  if (rateMatch) {
    return parseInt(rateMatch[2], 10) * 1000;
  }

  // Handle "15s" format
  const secondsMatch = value.match(/^(\d+)s$/);
  if (secondsMatch) {
    return parseInt(secondsMatch[1], 10) * 1000;
  }

  // Handle "2m" format (minutes)
  const minutesMatch = value.match(/^(\d+)m$/);
  if (minutesMatch) {
    return parseInt(minutesMatch[1], 10) * 60 * 1000;
  }

  // Handle plain number (assumed milliseconds)
  const num = parseInt(value, 10);
  return isNaN(num) ? defaultMs : num;
}

function parseCollaborationMode(value: string | undefined): 'passive' | 'reactive' | 'proactive' {
  if (value === 'passive' || value === 'reactive' || value === 'proactive') {
    return value;
  }
  return 'reactive';
}
