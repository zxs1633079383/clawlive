<div align="center">

<img src="docs/lobster-logo.png" alt="Clawlive Logo" width="120" />

# :lobster: Clawlive

### Every Voice Deserves a Lobster

**Real-time meeting enhancement platform where every participant gets an AI lobster assistant**

[Demo](#demo) · [Quick Start](#quick-start) · [SKILL.md Format](#skillmd-format) · [Architecture](#architecture) · [Contributing](#contributing)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://makeapullrequest.com)

---

*What if every person in a meeting had a brilliant assistant*
*who never interrupts but always has the right insight?*

</div>

<br />

## :sparkles: What is Clawlive?

**Clawlive** assigns each meeting participant a personal AI **lobster** assistant. While you focus on the conversation, your lobster works silently in the background:

| | Capability | Description |
|---|---|---|
| :microphone: | **Listens** | Real-time speech-to-text captures every word |
| :brain: | **Thinks** | Analyzes discussion based on its assigned role |
| :bulb: | **Suggests** | Provides timely, contextual insights only when needed |
| :lobster: | **Collaborates** | Lobsters discuss among themselves, combining perspectives |

> Meetings are where decisions happen. Clawlive makes sure no insight is missed, no decision is forgotten, and every voice is amplified.

<br />

## :film_projector: Demo

<div align="center">

```
+--------------------------------------------------+
|  Clawlive Meeting Room                     [3/3] |
|--------------------------------------------------|
|                                                  |
|  Alice: "I think we should go with               |
|          microservices for the new auth system"   |
|                                                  |
|  Bob: "Agreed, monolith is getting too heavy"     |
|                                                  |
|  +--------------------------------------------+  |
|  | YOUR LOBSTER (Devil's Advocate)             |  |
|  | ------------------------------------------ |  |
|  | Counter-point: Both of you favor micro-    |  |
|  | services, but have we estimated the ops    |  |
|  | overhead? Current team is 4 engineers.     |  |
|  | Netflix had 100+ when they migrated.       |  |
|  +--------------------------------------------+  |
|                                                  |
+--------------------------------------------------+
```

</div>

<br />

## :zap: How It Works

```
                    +-------------------+
                    |   You speak in    |
                    |   the meeting     |
                    +--------+----------+
                             |
                             v
                    +-------------------+
                    |  Audio captured   |
                    |  via WebSocket    |
                    +--------+----------+
                             |
                             v
                    +-------------------+
                    |  Speech-to-Text   |
                    |  (Web Speech API  |
                    |   or Deepgram)    |
                    +--------+----------+
                             |
                             v
                +------------+-------------+
                |                          |
                v                          v
     +------------------+      +------------------+
     | Your Lobster     |      | Other Lobsters   |
     | analyzes with    |      | analyze with     |
     | its SKILL.md     |      | their roles      |
     | role definition  |      |                  |
     +--------+---------+      +--------+---------+
              |                         |
              v                         v
     +------------------+      +------------------+
     | Trigger system   |      | Inter-lobster    |
     | evaluates:       |      | dialogue         |
     | Should I speak?  |      | (optional)       |
     +--------+---------+      +--------+---------+
              |                         |
              +------------+------------+
                           |
                           v
                  +-------------------+
                  | Insight appears   |
                  | in your sidebar   |
                  +-------------------+
```

<br />

## :lobster: Key Features

### Customizable Lobster Roles (SKILL.md)

Define your lobster's personality, expertise, and behavior with simple Markdown files. Each `.skill.md` file contains frontmatter configuration and natural language instructions.

| Role | Mode | Description |
|------|------|-------------|
| :mag: **Meeting Analyst** | Reactive | Tracks decisions, flags off-topic drift, catches action items |
| :smiling_imp: **Devil's Advocate** | Proactive | Challenges groupthink, questions assumptions, stress-tests ideas |
| :memo: **Note Taker** | Passive | Structured running notes with topics, decisions, and actions |
| :dart: **Action Tracker** | Reactive | Laser-focused on WHO does WHAT by WHEN |

> **Create your own!** Drop a `.skill.md` file in `skills/` and your custom lobster is ready.

---

### :electric_plug: Pluggable Architecture

Swap components without changing your meeting flow:

| Layer | Free Tier | Pro Tier |
|-------|-----------|----------|
| **Speech-to-Text** | Web Speech API | Deepgram |
| **LLM Provider** | Any OpenAI-compatible | Claude / GPT-4 |
| **Audio Transport** | WebSocket | Agora RTC |

---

### :chart_with_upwards_trend: Smart Trigger System

Lobsters don't spam. Each role defines **trigger conditions** and **rate limits** in its SKILL.md frontmatter:

```yaml
triggerInterval: 15        # Minimum seconds between suggestions
maxSuggestionRate: 30      # Max suggestions per meeting
collaborationMode: reactive # Only speak when triggered
```

---

### :handshake: Inter-Lobster Dialogue

When enabled, lobsters can share observations and debate among themselves, providing **multi-perspective analysis** before surfacing insights to participants.

```
Alice's Lobster (Analyst):  "Decision point detected - no one has confirmed."
Bob's Lobster (Advocate):   "The assumption behind Option B hasn't been tested."
                     |
                     v
            Combined Insight surfaced to the room
```

<br />

## :building_construction: Architecture

```
clawlive/
├── ui/                    # Next.js 14 frontend
│   ├── src/
│   │   ├── app/           # App router pages
│   │   └── components/    # React components
│   ├── tailwind.config.ts
│   └── package.json
│
├── server/                # Express + WebSocket backend
│   ├── src/
│   └── package.json
│
├── packages/
│   ├── shared/            # Shared types and utilities
│   └── db/                # Database schema (Drizzle ORM)
│
├── skills/                # Lobster role definitions
│   ├── meeting-analyst.skill.md
│   ├── devils-advocate.skill.md
│   ├── note-taker.skill.md
│   └── action-tracker.skill.md
│
├── pnpm-workspace.yaml    # Monorepo configuration
└── package.json
```

<br />

## :rocket: Quick Start

### Prerequisites

- **Node.js** >= 18
- **pnpm** >= 8

### Setup

```bash
# Clone the repository
git clone https://github.com/user/clawlive.git
cd clawlive

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env and add your API keys:
#   LLM_API_KEY=your_key_here
#   DEEPGRAM_API_KEY=optional_for_pro_stt

# Start development
pnpm dev
```

The app will be available at `http://localhost:3000`.

<br />

## :page_facing_up: SKILL.md Format

Every lobster role is defined by a single Markdown file with YAML frontmatter:

```markdown
---
name: my-custom-lobster
description: What this lobster does
version: "1.0"
triggerInterval: 15          # Seconds between suggestions
maxSuggestionRate: 30        # Max suggestions per meeting
collaborationMode: reactive  # reactive | proactive | passive
preferredFormat: bullet_points
maxLength: 200               # Max characters per suggestion
language: match_meeting_language
---

# My Custom Lobster

## Identity
Describe who this lobster is and what it focuses on.

## Behavior Rules
- Rule 1: What it should always do
- Rule 2: What it should never do

## Trigger Conditions
- condition_that_activates_the_lobster
- another_trigger_condition

## Output Examples
- "Example suggestion the lobster might make"
```

### Collaboration Modes

| Mode | Behavior |
|------|----------|
| **`passive`** | Only produces output at intervals or milestones |
| **`reactive`** | Responds when specific conditions are detected |
| **`proactive`** | Actively monitors and speaks up when it has valuable input |

<br />

## :wrench: Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 + React | App router, server components |
| **Styling** | Tailwind CSS | Utility-first responsive design |
| **Backend** | Express + WebSocket | Real-time communication |
| **Speech-to-Text** | Web Speech API / Deepgram | Audio transcription |
| **LLM** | Claude / GPT via API | Lobster intelligence |
| **Database** | SQLite (dev) / PostgreSQL (prod) | Meeting persistence |
| **ORM** | Drizzle | Type-safe database access |
| **Monorepo** | pnpm workspaces | Package management |

<br />

## :world_map: Roadmap

- [x] Core meeting infrastructure
- [x] Real-time WebSocket communication
- [x] Lobster agent runtime
- [x] SKILL.md role system
- [x] Four pre-built lobster roles
- [ ] Agora RTC integration for production audio
- [ ] Deepgram STT upgrade for accuracy
- [ ] Post-meeting summary generation
- [ ] CompanyBrain memory integration
- [ ] Mobile-responsive meeting view
- [ ] Custom lobster role builder UI
- [ ] Meeting analytics dashboard
- [ ] Multi-language support

<br />

## :people_holding_hands: Contributing

We welcome contributions! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feat/amazing-feature`
3. **Commit** your changes: `git commit -m 'feat: add amazing feature'`
4. **Push** to the branch: `git push origin feat/amazing-feature`
5. **Open** a Pull Request

### Ways to Contribute

- :lobster: **Create new SKILL.md roles** - Design new lobster personalities
- :bug: **Report bugs** - Open an issue with reproduction steps
- :bulb: **Suggest features** - We love new ideas
- :book: **Improve docs** - Help others get started faster
- :wrench: **Submit PRs** - Code contributions are always welcome

Please read our commit message convention: `<type>: <description>` where type is one of `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.

<br />

## :scroll: License

[MIT](LICENSE) - Copyright (c) 2024 Clawlive Contributors

<br />

<div align="center">

---

**Built with :lobster: by the Clawlive team**

*Every voice deserves a lobster.*

</div>
