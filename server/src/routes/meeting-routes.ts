import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  createMeeting,
  getMeeting,
  listMeetings,
  startMeeting,
  endMeeting,
  getTranscript,
  MeetingNotFoundError,
  InvalidTransitionError,
} from '../services/meeting-service.js';
import {
  joinMeeting,
  getParticipants,
} from '../services/participant-service.js';
import { getOrCreateOrchestrator, getLobsterOrchestrator, removeOrchestrator } from '../lobster/lobster-orchestrator.js';
import { parseSkillFile, loadSkill } from '../lobster/skill-parser.js';
import { SummaryService, type MeetingSummary } from '../services/summary-service.js';
import { ClaudeProvider } from '../llm/claude-provider.js';
import { config } from '../config.js';
import { resolve } from 'node:path';

// In-memory cache for generated summaries
const summaryCache = new Map<string, MeetingSummary>();

// Lazy-initialized summary service
let summaryService: SummaryService | null = null;
function getSummaryService(): SummaryService {
  if (!summaryService) {
    summaryService = new SummaryService(new ClaudeProvider());
  }
  return summaryService;
}

export const meetingRouter: Router = Router();

const createMeetingSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

const joinMeetingSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1).max(100),
  lobsterSkillId: z.string().optional(),
  // Custom path to a SKILL.md file — lobster reads this to know how to participate
  skillPath: z.string().optional(),
});

// POST /api/meetings - Create a new meeting
meetingRouter.post('/', (req: Request, res: Response) => {
  try {
    const parsed = createMeetingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        data: null,
        error: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const meeting = createMeeting(parsed.data);
    res.status(201).json({ success: true, data: meeting, error: null });
  } catch (err) {
    handleError(res, err);
  }
});

// GET /api/meetings - List all meetings
meetingRouter.get('/', (_req: Request, res: Response) => {
  try {
    const meetings = listMeetings();
    res.json({ success: true, data: meetings, error: null });
  } catch (err) {
    handleError(res, err);
  }
});

// GET /api/meetings/:id - Get a single meeting
meetingRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const meeting = getMeeting(req.params.id);
    if (!meeting) {
      res.status(404).json({ success: false, data: null, error: 'Meeting not found' });
      return;
    }
    const participants = getParticipants(req.params.id);
    res.json({ success: true, data: { ...meeting, participants }, error: null });
  } catch (err) {
    handleError(res, err);
  }
});

// POST /api/meetings/:id/join - Join a meeting
meetingRouter.post('/:id/join', async (req: Request, res: Response) => {
  try {
    const meeting = getMeeting(req.params.id);
    if (!meeting) {
      res.status(404).json({ success: false, data: null, error: 'Meeting not found' });
      return;
    }

    const parsed = joinMeetingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        data: null,
        error: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const participant = joinMeeting(req.params.id, parsed.data);
    // Human joins without a lobster — lobsters join independently via POST /:id/lobster
    res.status(200).json({ success: true, data: participant, error: null });
  } catch (err) {
    handleError(res, err);
  }
});

// POST /api/meetings/:id/lobster - A lobster joins the meeting
// The lobster reads its SKILL.md (from URL or local path) to know how to participate.
// This is how external lobster agents register themselves with a meeting.
const lobsterJoinSchema = z.object({
  // The lobster's owner/associated user
  ownerUserId: z.string().min(1),
  // SKILL.md source: URL (https://xxx.com/SKILL.md) or local file path
  skillSource: z.string().min(1),
  // Optional display name for the lobster
  lobsterName: z.string().optional(),
});

meetingRouter.post('/:id/lobster', async (req: Request, res: Response) => {
  try {
    const meeting = getMeeting(req.params.id);
    if (!meeting) {
      res.status(404).json({ success: false, data: null, error: 'Meeting not found' });
      return;
    }

    const parsed = lobsterJoinSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        data: null,
        error: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { ownerUserId, skillSource } = parsed.data;

    // Load the SKILL.md — the lobster reads this to understand its role
    console.log(`[meeting] Lobster loading SKILL.md from: ${skillSource}`);
    const skill = await loadSkill(skillSource);

    const orchestrator = getOrCreateOrchestrator(req.params.id);

    if (orchestrator.hasLobster(ownerUserId)) {
      // Remove existing lobster and replace with new one
      orchestrator.removeLobster(ownerUserId);
    }

    orchestrator.createLobster(ownerUserId, skill);

    // If meeting is already active, set meeting context
    if (meeting.status === 'active') {
      const participants = getParticipants(req.params.id);
      orchestrator.onMeetingStart({
        title: meeting.title,
        description: meeting.description,
        participants: participants.map((p) => ({
          displayName: p.displayName,
          userId: p.userId,
        })),
      });
    }

    console.log(`[meeting] Lobster "${skill.name}" joined meeting ${req.params.id} for user ${ownerUserId} (source: ${skillSource})`);

    res.status(200).json({
      success: true,
      data: {
        lobsterId: `lobster-${ownerUserId}`,
        skillName: skill.name,
        skillDescription: skill.description,
        collaborationMode: skill.collaborationMode,
        meetingId: req.params.id,
        ownerUserId,
      },
      error: null,
    });
  } catch (err) {
    console.error('[meeting] Lobster join error:', err);
    handleError(res, err);
  }
});

// POST /api/meetings/:id/start - Start a meeting
meetingRouter.post('/:id/start', (req: Request, res: Response) => {
  try {
    const meeting = startMeeting(req.params.id);
    res.json({ success: true, data: meeting, error: null });
  } catch (err) {
    handleError(res, err);
  }
});

// POST /api/meetings/:id/end - End a meeting
meetingRouter.post('/:id/end', (req: Request, res: Response) => {
  try {
    const meeting = endMeeting(req.params.id);
    removeOrchestrator(req.params.id);
    res.json({ success: true, data: meeting, error: null });
  } catch (err) {
    handleError(res, err);
  }
});

// GET /api/meetings/:id/transcript - Get meeting transcript
meetingRouter.get('/:id/transcript', (req: Request, res: Response) => {
  try {
    const meeting = getMeeting(req.params.id);
    if (!meeting) {
      res.status(404).json({ success: false, data: null, error: 'Meeting not found' });
      return;
    }

    const transcript = getTranscript(req.params.id);
    res.json({ success: true, data: transcript, error: null });
  } catch (err) {
    handleError(res, err);
  }
});

// GET /api/meetings/:id/summary - Get meeting summary
meetingRouter.get('/:id/summary', async (req: Request, res: Response) => {
  try {
    const meetingId = req.params.id;
    const meeting = getMeeting(meetingId);
    if (!meeting) {
      res.status(404).json({ success: false, data: null, error: 'Meeting not found' });
      return;
    }

    if (meeting.status !== 'ended') {
      res.status(400).json({
        success: false,
        data: null,
        error: 'Summary is only available after the meeting has ended',
      });
      return;
    }

    // Check cache first
    const cached = summaryCache.get(meetingId);
    if (cached) {
      const userId = (req.query.userId as string) ?? '';
      const personalSummary = cached.personalSummaries.get(userId);

      res.json({
        success: true,
        data: {
          meetingId,
          summary: cached.globalSummary,
          globalSummary: cached.globalSummary,
          personalSummary: personalSummary ?? null,
          keyDecisions: cached.keyDecisions.map((d) => ({
            decision: d.decision,
            timestamp: d.timestamp.toISOString(),
            participants: d.participants,
          })),
          actionItems: cached.actionItems.map((a) => ({
            action: a.action,
            assignee: a.assignee,
            deadline: a.deadline ?? null,
            status: a.status,
          })),
          generatedAt: cached.generatedAt.toISOString(),
        },
        error: null,
      });
      return;
    }

    // Generate summary using SummaryService
    const transcript = getTranscript(meetingId);
    const participants = getParticipants(meetingId);
    const participantIds = participants.map((p) => p.userId);

    // Collect lobster messages and dialogue from the orchestrator if available
    const orchestrator = getLobsterOrchestrator(meetingId);
    const lobsterDialogue = orchestrator?.getRecentDialogue(100) ?? [];

    // Build transcript segments in the format SummaryService expects
    const transcriptSegments = transcript.map((seg) => ({
      speakerId: seg.speakerId,
      text: seg.text,
      timestamp: seg.timestamp,
      isFinal: true,
    }));

    try {
      const service = getSummaryService();
      const result = await service.generateMeetingSummary(
        meetingId,
        meeting.title,
        transcriptSegments,
        [], // lobster messages (would need separate storage; empty for now)
        lobsterDialogue,
        participantIds,
      );

      // Cache the result
      summaryCache.set(meetingId, result);

      const userId = (req.query.userId as string) ?? '';
      const personalSummary = result.personalSummaries.get(userId);

      res.json({
        success: true,
        data: {
          meetingId,
          summary: result.globalSummary,
          globalSummary: result.globalSummary,
          personalSummary: personalSummary ?? null,
          keyDecisions: result.keyDecisions.map((d) => ({
            decision: d.decision,
            timestamp: d.timestamp.toISOString(),
            participants: d.participants,
          })),
          actionItems: result.actionItems.map((a) => ({
            action: a.action,
            assignee: a.assignee,
            deadline: a.deadline ?? null,
            status: a.status,
          })),
          generatedAt: result.generatedAt.toISOString(),
        },
        error: null,
      });
    } catch (llmErr) {
      console.error('[meeting-routes] Summary generation failed:', llmErr);

      // Fallback: return basic info without LLM-generated content
      res.json({
        success: true,
        data: {
          meetingId,
          summary: 'Summary generation failed. Please try again later.',
          globalSummary: 'Summary generation failed. Please try again later.',
          personalSummary: null,
          keyDecisions: [],
          actionItems: [],
          generatedAt: new Date().toISOString(),
        },
        error: null,
      });
    }
  } catch (err) {
    handleError(res, err);
  }
});

function handleError(res: Response, err: unknown): void {
  if (err instanceof MeetingNotFoundError) {
    res.status(404).json({ success: false, data: null, error: err.message });
    return;
  }
  if (err instanceof InvalidTransitionError) {
    res.status(400).json({ success: false, data: null, error: err.message });
    return;
  }
  console.error('[meeting-routes] Unexpected error:', err);
  res.status(500).json({
    success: false,
    data: null,
    error: err instanceof Error ? err.message : 'Internal server error',
  });
}
