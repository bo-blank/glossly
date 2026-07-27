# Glossly

*A quiet copilot for writers who already have an ear for sound and structure.*

## Overview

Glossly is a privacy-first writing assistant that provides alternative phrasings for selected text. It acts as a margin note from a trusted editor, helping writers tighten, vary, or elevate specific words and phrases without breaking their creative flow.

## Key Features

- **Tactical phrase suggestions** - 3 alternatives for selected text (3-220 characters)
- **Modifier system** - Tighter, More vivid, Plainer options
- **Rich manuscript editor** - headings, lists, blockquotes, code blocks, images, links, highlights, text alignment
- **Table of contents** - clickable heading navigation
- **Writing dashboard** - word/character count, reading time, Flesch readability scoring, on-demand AI-likeness detection
- **Local-first architecture** - Zero network calls outside localhost, ever
- **Undo support** - Native undo/redo for suggestion swaps
- **Privacy-focused** - manuscript and API keys never leave your machine

## Technology Stack

- **Frontend:** Vite + Svelte 5 + TypeScript
- **Editor:** Tiptap 3 (ProseMirror-based)
- **State Management:** Svelte stores and reactive programming
- **Backend:** Node.js + Express (local proxy)
- **LLM Providers:** Ollama, LM Studio, any OpenAI-compatible endpoint (local only)

## Architecture

### Components

- **Editor** - manuscript editing surface with rich formatting toolbar
- **MarginNote** - Alternative phrasings UI with leader line
- **TableOfContents** - heading navigation rail
- **Dashboard** - readability stats and AI-likeness detector
- **SettingsPanel** - Provider and model configuration
- **Local Proxy** (`apps/server`) - CORS-safe forwarding to LLM providers

### Data Flow

1. **Selection** → Editor tracks text selection changes
2. **Request** → Proxy forwards to appropriate LLM provider
3. **Response** → Suggestions displayed in margin note
4. **Swap** → Tiptap transaction updates document

## Quick Start

### Prerequisites

- Node.js 18+
- Git

### Installation

```bash
git clone https://github.com/your-repo/glossly.git
cd glossly

npm install                     # installs all workspaces (root, apps/web, apps/server)

cp .env.example apps/server/.env
```

### Running Development

```bash
# Starts the local proxy (:3000) and the web app (:5173) together
npm run dev
```

### Build for Production

```bash
# Build both frontend and backend
npm run build
```

## Features

### v1 (Current Prototype)

- ✅ Rich-formatted editor (headings, lists, images, links, and more)
- ✅ Selection → margin note → 3 suggestions, streamed in as they're generated
- ✅ Modifier chips: Tighter, More vivid, Plainer, plus your own custom chips
- ✅ Click to swap with undo support
- ✅ Full-sentence rewrite mode (opt-in) alongside the default phrase-level suggestions
- ✅ Keyboard-only flow: select, review (Alt+1–3 apply, Alt+N new, Esc dismiss), apply
- ✅ In-session response caching — re-selecting the same phrase/modifier is instant
- ✅ Local provider switcher (Ollama / LM Studio / OpenAI-compatible)
- ✅ Settings panel configuration
- ✅ Local document persistence
- ✅ Light/dark theme, following the OS preference by default
- ✅ Table of contents, readability dashboard, AI-likeness detector (beyond the original v1 spec)

See `docs/next-iteration-features.md` for the full roadmap (v1.2 and beyond).

## Local LLM Setup

For local LLM providers (recommended for privacy):

### Ollama

```bash
# Install Ollama from ollama.ai
# Pull a model:
ollama pull llama3.2
```

### LM Studio

```bash
# Download and launch LM Studio desktop app
# Ensure "Local Server" is enabled
```

### Self-hosted OpenAI-compatible

Any server supporting OpenAI-compatible API (llama.cpp, vLLM, LocalAI, etc.)

## Provider Configuration

### Local Options

- **Ollama** - Fastest setup, runs locally
- **LM Studio** - GUI-based model management
- **OpenAI-compatible** - Flexible for custom servers

## Usage

1. **Type or paste** your manuscript
2. **Select** 3-220 characters of text
3. **Wait** for suggestions to appear in the margin note
4. **Click** a suggestion to swap it in
5. **Use modifier chips** to adjust suggestion style

## Development

### Scripts

```bash
# Root: run proxy + web app together
npm run dev
npm run build
npm run lint            # lints apps/server
npm test                # runs vitest across workspaces

# apps/web only
npm run preview --prefix apps/web   # preview production build
npm run format --prefix apps/web    # prettier
```

### Testing

Unit tests (Vitest, in both `apps/server` and `apps/web`) cover the pure logic: readability
scoring, word-boundary and sentence-boundary snapping, the incremental SSE suggestion
parser, and the response cache. Run them with `npm test`. The end-to-end LLM suggestion
flow is still verified manually against a running local provider.

## Privacy

### Local Mode

When a local provider is selected:

- ✅ Zero network calls outside `localhost`
- ✅ No analytics or telemetry
- ✅ Manuscript never leaves your machine
- ✅ API keys stay local

See `docs/specification/specs.md` for the architecture decisions and rationale behind the stack choices.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Create a pull request

## License

MIT

## Support

For issues and questions, please create a GitHub issue in this repository.
