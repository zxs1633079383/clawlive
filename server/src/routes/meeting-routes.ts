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
import { getOrCreateOrchestrator, removeOrchestrator } from '../lobster/lobster-orchestrator.js';
import { parseSkillFile } from '../lobster/skill-parser.js';
import { config } from '../config.js';
import { resolve } from 'node:path';

export const meetingRouter: Router = Router();

const createMeetingSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

const joinMeetingSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1).max(100),
  skillName: z.string().optional(),
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

    // If a skill was specified, set up the lobster agent
    if (parsed.data.skillName) {
      try {
        const skillPath = resolve(config.SKILLS_DIR, `${parsed.data.skillName}.md`);
        const skill = await parseSkillFile(skillPath);
        const orchestrator = getOrCreateOrchestrator(req.params.id);
        orchestrator.createLobster(parsed.data.userId, skill);
      } catch (skillErr) {
        console.warn(`[meeting] Failed to load skill "${parsed.data.skillName}":`, skillErr);
        // Don't fail the join; the user just won't have a lobster
      }
    }

    res.status(200).json({ success: true, data: participant, error: null });
  } catch (err) {
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

// GET /api/meetings/:id/summary - Get meeting summary (placeholder)
meetingRouter.get('/:id/summary', (req: Request, res: Response) => {
  try {
    const meeting = getMeeting(req.params.id);
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

    // TODO: Generate summary using LLM based on transcript
    const transcript = getTranscript(req.params.id);
    res.json({
      success: true,
      data: {
        meetingId: req.params.id,
        summary: 'Summary generation not yet implemented',
        transcriptSegments: transcript.length,
      },
      error: null,
    });
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
