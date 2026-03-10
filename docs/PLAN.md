# Clawlive - 多龙虾实时会议增强平台

## Context

构建一个实时会议增强平台：真人在开会时，每人配备一个 OpenClaw 龙虾 AI 助手。龙虾通过麦克风实时 STT 感知会议内容，基于 SKILL.md 定义的角色提供实时建议，龙虾之间也能互相交流观点。

## 技术栈

| 层 | 选型 | 理由 |
|---|------|------|
| 前端 | React + Next.js | 与 Paperclip 生态一致 |
| 后端 | Node.js/TypeScript + Express | WebSocket 实时通信成熟 |
| 实时音频 | Agora RTC SDK | 已有 API Key，处理 NAT/回声消除 |
| STT Phase 1 | 浏览器 Web Speech API | 零成本验证 |
| STT Phase 2 | Deepgram 流式 | 可插拔升级 |
| LLM | Claude/GPT via API | 龙虾智能核心 |
| DB | SQLite(dev) / PostgreSQL(prod) | Drizzle ORM |
| 包管理 | pnpm workspaces | monorepo |
| SKILL.md 解析 | gray-matter + markdown-it | 标准 frontmatter |

## 架构概览

```
clawlive/
├── packages/
│   ├── shared/          # 共享类型、常量、验证器
│   └── db/              # Drizzle schema + migrations
├── server/              # Express + WebSocket 服务
│   └── src/
│       ├── realtime/    # WebSocket 会议室
│       ├── services/    # 会议生命周期、龙虾编排、STT 路由
│       ├── stt/         # 可插拔 STT 提供者接口
│       ├── llm/         # 可插拔 LLM 提供者接口
│       └── routes/      # REST API
├── ui/                  # React + Next.js 前端
│   └── src/
│       ├── pages/       # 首页、大厅、会议室、总结
│       ├── components/  # 参会者网格、转录面板、龙虾面板
│       └── hooks/       # useAgora, useMeetingWs, useStt, useLobster
└── skills/              # SKILL.md 龙虾角色模板
```

## 核心数据流

```
人说话 → Agora RTC(浏览器采集) → STT层(可插拔)
    → TranscriptSegment {speakerId, text, timestamp, isFinal}
    → WebSocket 广播到会议室所有客户端
    → lobster-orchestrator 分发给每个龙虾
    → 每个龙虾独立思考 → 生成建议(LobsterMessage)
    → 通过 WebSocket 推送给对应的人类主人
    → 同时可选择发到 lobster-dialogue-bus 与其他龙虾交流
```

## WebSocket 协议

单连接多通道复用，JSON 消息格式：

```typescript
// 上行 (client → server)
type ClientMessage =
  | { channel: 'transcript'; type: 'segment'; payload: TranscriptSegment }
  | { channel: 'lobster'; type: 'user_prompt'; payload: { text: string } }
  | { channel: 'control'; type: 'mute' | 'unmute' | 'leave' }

// 下行 (server → client)
type ServerMessage =
  | { channel: 'transcript'; type: 'segment'; payload: TranscriptSegment }
  | { channel: 'lobster'; type: 'suggestion'; payload: LobsterMessage; targetUserId: string }
  | { channel: 'lobster'; type: 'dialogue'; payload: LobsterDialogueTurn }
  | { channel: 'control'; type: 'participant_joined' | 'participant_left' | 'meeting_state_changed' | 'error'; payload: any }
```

## 龙虾 Agent 设计

### 初始化
每个人类加入会议时，为其创建一个龙虾实例，加载 SKILL.md 作为系统提示。

### 上下文窗口
```
[SYSTEM]  SKILL.md 内容（角色、规则）
[SYSTEM]  会议元数据（主题、议程、参会者列表）
[TRANSCRIPT]  最近 N 分钟转录文本
[LOBSTER_DIALOGUE]  近期龙虾间对话
[USER]  主人的直接提问
[ASSISTANT]  龙虾此前的输出
```

### 触发策略
- 不是每句话都响应，每 10-15 秒评估一次是否需要输出
- 轻量级判断调用："此刻是否应该提供建议？"
- 最大频率：每 30 秒 1 条建议（SKILL.md 可配）

### 龙虾间协作模式（SKILL.md 配置）
- `passive` — 只帮自己主人，不参与龙虾间对话
- `reactive` — 被其他龙虾提问时回应
- `proactive` — 主动分享观察和问题

## SKILL.md Schema

```yaml
---
name: meeting-analyst
description: 分析会议动态，识别关键决策和行动项
version: "1.0"
---

# 会议分析龙虾

## 身份
你是一个会议分析龙虾...

## 行为规则
- 绝不打断人类对话流
- 以简洁要点呈现洞察
- 标记偏题讨论
- 高亮被忽视的决策点

## 触发策略
triggerInterval: 15s
maxSuggestionRate: 1/30s
triggerConditions:
  - new_topic_detected
  - decision_point_reached
  - action_item_mentioned

## 协作模式
collaborationMode: reactive

## 输出格式
preferredFormat: bullet_points
maxLength: 200 tokens
language: match_meeting_language
```

## 会议生命周期

```
CREATE → LOBBY → ACTIVE → ENDED → SUMMARY
           |         |         |
       参会者加入   转录+龙虾    龙虾生成
       龙虾初始化   运行中      个人化总结
```

### REST API
| Method | Path | 描述 |
|--------|------|------|
| POST | /api/meetings | 创建会议 |
| POST | /api/meetings/:id/join | 加入（选龙虾角色） |
| POST | /api/meetings/:id/start | 开始会议 |
| POST | /api/meetings/:id/end | 结束，触发总结 |
| GET | /api/meetings/:id/transcript | 获取转录 |
| GET | /api/meetings/:id/summary | 获取总结 |
| WS | /api/meetings/:id/ws | 实时 WebSocket |
| POST/GET | /api/skills | 管理 SKILL.md |

## 前端布局

```
┌──────────────────────────────────────────────────────┐
│  MeetingControls (静音, 离开, 会议信息)                │
├──────────────────────────┬───────────────────────────┤
│  ParticipantGrid         │  右侧面板 (Tab切换)        │
│  ┌──────┐ ┌──────┐      │  [转录] [我的龙虾] [龙虾对话]│
│  │Alice │ │ Bob  │      │                           │
│  │ +🦞  │ │ +🦞  │      │  (当前 Tab 内容)           │
│  └──────┘ └──────┘      │                           │
│  AgoraBridge (隐藏)      │                           │
│  SttCapture (隐藏)       │                           │
└──────────────────────────┴───────────────────────────┘
```

## 实施阶段

### Phase 1: 基础脚手架 (Day 1)
- [ ] pnpm monorepo 初始化，shared types，DB schema
- [ ] 会议 CRUD REST API
- [ ] WebSocket 服务器 + 通道复用
- [ ] 基础 React 页面（首页、大厅、会议室骨架）

### Phase 2: 音频 + STT (Day 2-3)
- [ ] Agora RTC 浏览器集成（useAgora hook）
- [ ] Web Speech API STT 实现（useStt hook）
- [ ] 实时转录流通过 WebSocket 广播
- [ ] TranscriptPanel 组件

### Phase 3: 龙虾核心 (Day 4-5)
- [ ] SKILL.md 解析器 (gray-matter)
- [ ] 单龙虾 Agent 运行时 (lobster-agent.ts)
- [ ] 触发评估逻辑
- [ ] LobsterPanel 组件 + 直接提问输入框
- [ ] LLM 提供者接口 + Claude/GPT 实现

### Phase 4: 龙虾协作 (Day 6-7)
- [ ] LobsterDialogueBus 实现
- [ ] 龙虾间消息协议
- [ ] LobsterDialoguePanel 组件
- [ ] 协作模式执行（passive/reactive/proactive）

### Phase 5: 收尾 + 集成 (Day 8-10)
- [ ] 会后总结生成（每人个性化 + 全局总结）
- [ ] Deepgram STT 可插拔升级
- [ ] CompanyBrain 经验存储集成
- [ ] 预置 SKILL.md 角色模板

## 验证计划

1. **单元测试**: SKILL.md 解析、WebSocket 消息路由、龙虾触发逻辑
2. **集成测试**: 完整数据流 — 模拟转录输入 → 龙虾响应输出
3. **E2E 测试**: 两个浏览器窗口模拟两人会议，验证实时转录和龙虾建议
4. **手动验证**: 实际开会场景，2-3人 + 龙虾，验证延迟和实用性

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| LLM 延迟影响实时性 | 触发评估减少无效调用；流式响应；频率限制 |
| Web Speech API 兼容性 | 优雅降级提示；可插拔切换到 Deepgram |
| 龙虾间对话失控 | 每阶段最大轮次；频率限制；编排器熔断 |
| 长会议上下文溢出 | 滚动窗口 + 定时摘要检查点 |
