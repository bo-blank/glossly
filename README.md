# Glossly

*A quiet copilot for writers who already have an ear for sound and structure.*

## Overview

Glossly is a privacy-first writing assistant that provides alternative phrasings for selected text. It acts as a margin note from a trusted editor, helping writers tighten, vary, or elevate specific words and phrases without breaking their creative flow.

## Key Features

- **Tactical phrase suggestions** - 3 alternatives for selected text (3-220 characters)
- **Modifier system** - Tighter, More vivid, Plainer options
- **Local-first architecture** - Zero network calls outside localhost when using local LLMs
- **Undo support** - Native undo/redo for suggestion swaps
- **Privacy-focused** - API keys stay local, manuscript never leaves your machine by default

## Technology Stack

- **Frontend:** Vite + Svelte 4 + TypeScript
- **Editor:** Tiptap (ProseMirror-based)
- **State Management:** Svelte stores and reactive programming
- **Backend:** Node.js + Express (local proxy)
- **LLM Providers:** Anthropic (cloud), Ollama, LM Studio, OpenAI-compatible

## Architecture

### Components

- **Editor** - Manuscript with paragraphs, bold, italic formatting
- **MarginNote** - Alternative phrasings UI with leader line
- **SettingsPanel** - Provider and model configuration
- **Local Proxy** - CORS-safe forwarding to LLM providers

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

# Install frontend dependencies
cd apps/web
npm install  # or yarn, pnpm

# Install backend dependencies  
cd ../server
npm install
```

### Running Development

```bash
# Start development server
npm run dev

# Backend proxy (in another terminal)
cd ../server
npm run dev
```

### Build for Production

```bash
# Build both frontend and backend
npm run build
```

## Features

### v1 (Current Prototype)

- ✅ Plain-text editor with basic formatting
- ✅ Selection → margin note → 3 suggestions
- ✅ Modifier chips: Tighter, More vivid, Plainer
- ✅ Click to swap with undo support
- ✅ Provider switcher (cloud vs local)
- ✅ Settings panel configuration
- ✅ Local document persistence

### v1.1 (Planned Enhancements)

- ✅ Full-sentence rewrite mode (opt-in)
- ✅ Custom modifier chips
- ✅ Response caching
- ✅ Streaming suggestions
- ✅ Keyboard-only flow

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

### Cloud (Anthropic)
- Requires API key (stored locally)
- API calls go directly to Anthropic

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
# Start development server
npm run dev

# Build for production
npm run build

# Lint TypeScript
npm run lint

# Preview production build
npm run preview
```

### Testing

- Component testing with Vitest
- End-to-end testing with Playwright (planned)
- Local LLM integration testing

## Privacy

### Local Mode

When a local provider is selected:
- ✅ Zero network calls outside `localhost`
- ✅ No analytics or telemetry
- ✅ Manuscript never leaves your machine
- ✅ API keys stay local

### Cloud Mode

- ✅ API keys stored locally in `.env`
- ✅ Never bundled or committed to version control
- ✅ Only sent when explicitly requested

## Architecture Details

### Why Tiptap?

Tiptap was chosen over Quill for:

- **Position mapping** - Handles async suggestions correctly
- **Decorations** - View-only highlight effects (not saved to document)
- **Undo support** - Native transaction handling
- **Future extensibility** - Ready for v1.1 features

### Why Svelte?

Svelte provides:

- **Compiled away at build time** - No runtime overhead
- **Better TypeScript integration** - Native Svelte components
- **Reactive programming** - Perfect for tracking selection changes
- **Smaller bundle size** - Important for writing tools performance

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
