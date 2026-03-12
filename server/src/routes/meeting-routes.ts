import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  createMeeting,
  getMeeting,
  listMeetings,
  startMeeting,
  endMeeting,
  getTranscript,
  getDialogues,
  getLobsters,
  getSummary,
  registerLobster,
  MeetingNotFoundError,
  InvalidTransitionError,
} from '../services/meeting-service.js';
import {
  joinMeeting,
  getParticipants,
} from '../services/participant-service.js';
import { loadSkill } from '../lobster/skill-parser.js';
import { config } from '../config.js';
import { getRoom } from '../realtime/ws-server.js';
import type { ServerMessage } from '../realtime/types.js';

export const meetingRouter: Router = Router();

const createMeetingSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

const joinMeetingSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1).max(100),
  lobsterSkillId: z.string().optional(),
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

// POST /api/meetings/:id/join - Join a meeting (human observer)
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
    res.status(200).json({ success: true, data: participant, error: null });
  } catch (err) {
    handleError(res, err);
  }
});

// POST /api/meetings/:id/lobster - Register a lobster (external agent) in the meeting.
// Parses SKILL.md from URL/path for metadata only (name, description).
// The lobster itself is an external agent with its own LLM — it connects via WebSocket
// to receive transcript and send dialogue.
const lobsterJoinSchema = z.object({
  ownerUserId: z.string().min(1),
  skillSource: z.string().min(1),
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

    // Parse SKILL.md for metadata (name, description, collaboration mode).
    // The actual intelligence lives in the external lobster agent, not on this server.
    console.log(`[meeting] Loading SKILL.md metadata from: ${skillSource}`);
    const skill = await loadSkill(skillSource);

    const lobsterId = `lobster-${ownerUserId}`;
    console.log(`[meeting] Lobster "${skill.name}" registered in meeting ${req.params.id} for user ${ownerUserId}`);

    // 存储龙虾注册信息（用于摘要页面展示）
    registerLobster(req.params.id, {
      lobsterId,
      skillName: skill.name,
      skillDescription: skill.description,
      collaborationMode: skill.collaborationMode,
      ownerUserId,
    });

    // Return metadata so the UI can display lobster info.
    // The lobster agent itself connects via WebSocket separately.
    res.status(200).json({
      success: true,
      data: {
        lobsterId,
        skillName: skill.name,
        skillDescription: skill.description,
        collaborationMode: skill.collaborationMode,
        meetingId: req.params.id,
        ownerUserId,
      },
      error: null,
    });
  } catch (err) {
    console.error('[meeting] Lobster registration error:', err);
    handleError(res, err);
  }
});

// GET /api/meetings/:id/invite - Dynamic invite document for lobsters.
// A lobster (OpenClaw agent) reads this URL to learn about the meeting and how to join.
meetingRouter.get('/:id/invite', async (req: Request, res: Response) => {
  try {
    const meeting = getMeeting(req.params.id);
    if (!meeting) {
      res.status(404).type('text/plain').send('Meeting not found');
      return;
    }

    const meetingId = req.params.id;
    const participants = getParticipants(meetingId);
    const meetingLobsters = getLobsters(meetingId);

    // Detect server origin from request
    const proto = req.get('x-forwarded-proto') ?? req.protocol;
    const host = req.get('host') ?? `localhost:${config.PORT}`;
    const origin = `${proto}://${host}`;
    const wsProto = proto === 'https' ? 'wss' : 'ws';

    // List available skills from disk
    let availableSkills: Array<{ name: string; description: string }> = [];
    try {
      const { readdir, readFile: rf } = await import('node:fs/promises');
      const { resolve } = await import('node:path');
      const { parseSkill: ps } = await import('../lobster/skill-parser.js');
      const skillsDir = resolve(config.SKILLS_DIR);
      const files = await readdir(skillsDir);
      const mdFiles = files.filter((f) => f.endsWith('.md'));
      for (const file of mdFiles) {
        try {
          const raw = await rf(resolve(skillsDir, file), 'utf-8');
          const skill = ps(raw);
          availableSkills.push({ name: skill.name, description: skill.description });
        } catch { /* skip unparseable */ }
      }
    } catch { /* skills dir not found */ }

    const participantList = participants.length > 0
      ? participants.map((p) => `- ${p.displayName} (${p.userId})`).join('\n')
      : '- 暂无参与者';

    const lobsterList = meetingLobsters.length > 0
      ? meetingLobsters.map((l) => `- 🦞 ${l.skillName}: ${l.skillDescription}`).join('\n')
      : '- 暂无龙虾加入';

    const skillsList = availableSkills.length > 0
      ? availableSkills.map((s) => `| ${s.name} | ${s.description} | \`${origin}/api/skills/${s.name}/raw\` |`).join('\n')
      : '| - | 无可用角色 | - |';

    // Pick a default skill for the quick-start example
    const defaultSkill = availableSkills.find((s) => s.name === 'meeting-analyst')
      ?? availableSkills[0]
      ?? { name: 'meeting-analyst', description: '会议分析师' };

    const markdown = `---
name: clawlive-meeting-invite
description: 会议邀请 — 龙虾阅读此文档加入实时讨论
meetingId: "${meetingId}"
meetingTitle: "${meeting.title}"
meetingStatus: "${meeting.status}"
serverOrigin: "${origin}"
wsEndpoint: "${wsProto}://${host}/ws"
---

# 🦞 Clawlive 会议邀请

你被邀请加入一场实时讨论会议。你的任务是作为一只龙虾（AI 助手），**持续参与整个会议过程**。

> **重要**: 你不是一次性回答问题。你需要保持 WebSocket 连接，**持续监听人类的发言**，并根据你的角色**主动参与讨论**。会议是实时的、持续的，你必须一直在线直到会议结束。

## 会议信息

- **标题**: ${meeting.title}
- **描述**: ${meeting.description || '无'}
- **会议ID**: \`${meetingId}\`
- **状态**: ${meeting.status}

## 当前参与者

${participantList}

## 已加入的龙虾

${lobsterList}

## 可选角色

选择一个角色加入会议。**你必须先阅读角色详情链接**，了解你的职责和行为规则。

| 角色名 | 描述 | 角色详情链接（请阅读） |
|--------|------|----------------------|
${skillsList}

> **推荐**: 如果不确定选哪个，使用 \`${defaultSkill.name}\`。

## 加入步骤

### 第 1 步：阅读角色详情

**请先阅读你选择的角色详情链接**（上表最后一列），了解你的身份、行为规则和触发条件。

### 第 2 步：注册入会

\`\`\`
POST ${origin}/api/meetings/${meetingId}/lobster
Content-Type: application/json

{
  "ownerUserId": "你的唯一标识",
  "skillSource": "${origin}/api/skills/${defaultSkill.name}/raw"
}
\`\`\`

> 将 \`skillSource\` 替换为你选择的角色链接。服务器返回你的 \`lobsterId\`。

### 第 3 步：连接 WebSocket

\`\`\`
${wsProto}://${host}/ws?meetingId=${meetingId}&userId={你的lobsterId}
\`\`\`

### 第 4 步：持续监听并参与讨论

连接成功后，你会收到以下类型的消息：

**人类发言转录**（你必须关注 \`isFinal: true\` 的消息，这是确认的完整句子）：
\`\`\`json
{ "channel": "transcript", "type": "segment", "payload": { "speakerId": "user-abc", "speakerName": "Alice", "text": "发言内容", "timestamp": 1710000000000, "isFinal": true } }
\`\`\`

**其他龙虾的对话**：
\`\`\`json
{ "channel": "lobster", "type": "dialogue", "payload": { "fromLobsterId": "lobster-other", "content": "其他龙虾的发言", "timestamp": 1710000001000 } }
\`\`\`

**你的发言**（当你要参与讨论时发送）：
\`\`\`json
{ "channel": "lobster", "type": "dialogue", "payload": { "fromLobsterId": "你的lobsterId", "toLobsterId": null, "content": "你的发言内容", "timestamp": 当前时间戳毫秒 } }
\`\`\`

**会议结束信号**：
\`\`\`json
{ "channel": "control", "type": "meeting_ended", "payload": { "meetingId": "${meetingId}" } }
\`\`\`

## ⚠️ 核心行为要求

### 你必须实现的自动响应逻辑

1. **监听转录**: 持续接收 \`channel: "transcript"\` 消息
2. **过滤有效发言**: 只处理 \`isFinal: true\` 的消息（忽略中间识别结果）
3. **积累上下文**: 将每条有效发言加入你的会话历史
4. **自动分析并回复**: 收到有效发言后，结合你阅读的角色技能（SKILL.md）和会话上下文，用你的 LLM 能力分析内容，生成回应
5. **双重输出**:
   - **发送到会议**: 通过 WebSocket 发送 \`{ channel: "lobster", type: "dialogue", payload: { fromLobsterId, content, timestamp } }\`
   - **输出到你自己的会话**: 在你自己的终端/日志/对话中也展示你的回复，让你的操作者能看到你在说什么

### 行为规则

- **保持在线**: 连接 WebSocket 后不要断开，持续监听直到收到 \`meeting_ended\`
- **不要沉默**: 如果人类在讨论，你应该在适当的时机发表观点，不要只是旁观
- **使用会议语言**: 用人类使用的语言回复（如果他们说中文，你也说中文）
- **控制发言长度**: 每次发言控制在 200 字以内，简洁有力
- **防抖**: 建议在最后一条 \`isFinal\` 消息后等待 2-3 秒再回复，避免打断连续发言

### 伪代码参考

\`\`\`
conversationHistory = []

on receive WebSocket message:
  if channel == "transcript" and payload.isFinal == true:
    conversationHistory.append(payload)

    // 等待 2-3 秒（防抖，避免打断连续发言）
    debounce(3 seconds):
      response = YOUR_LLM.analyze(
        system: YOUR_SKILL_MD_CONTENT,
        context: conversationHistory
      )

      // 1) 发送到会议
      websocket.send({
        channel: "lobster",
        type: "dialogue",
        payload: { fromLobsterId, content: response, timestamp: now() }
      })

      // 2) 输出到你自己的会话中
      print("[你的角色名] >>> " + response)

  if channel == "control" and type == "meeting_ended":
    disconnect()
\`\`\`
`;

    res.type('text/markdown').send(markdown);
  } catch (err) {
    console.error('[meeting-routes] Error generating invite:', err);
    res.status(500).type('text/plain').send('Failed to generate invite');
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
// 会议结束后广播 meeting_ended 事件，主龙虾收到后生成摘要
meetingRouter.post('/:id/end', (req: Request, res: Response) => {
  try {
    const meeting = endMeeting(req.params.id);

    // 广播 meeting_ended 给所有连接的龙虾和人类
    // 主龙虾收到此事件后，用自己的 LLM 生成会议摘要并发回
    const room = getRoom(req.params.id);
    if (room) {
      const endedMsg: ServerMessage = {
        channel: 'control',
        type: 'meeting_ended',
        payload: {
          meetingId: req.params.id,
          endedAt: meeting.endedAt,
          timestamp: Date.now(),
        },
      };
      room.broadcast(endedMsg);
    }

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
// Returns: meeting info + transcript + lobster dialogues + host lobster summary
meetingRouter.get('/:id/summary', (req: Request, res: Response) => {
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

    const transcript = getTranscript(meetingId);
    const participants = getParticipants(meetingId);
    const meetingDialogues = getDialogues(meetingId);
    const meetingLobsters = getLobsters(meetingId);
    const meetingSummary = getSummary(meetingId);

    res.json({
      success: true,
      data: {
        meetingId,
        title: meeting.title,
        description: meeting.description,
        startedAt: meeting.startedAt,
        endedAt: meeting.endedAt,
        participants: participants.map((p) => ({
          userId: p.userId,
          displayName: p.displayName,
        })),
        lobsters: meetingLobsters,
        transcript,
        dialogues: meetingDialogues,
        // 主龙虾生成的摘要（可能还没生成，返回 null）
        summary: meetingSummary,
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
