# Glossly - Project Structure

## Documentation

- **Specification**: `docs/specification/` - Full technical spec and examples
- **Architecture**: See `specs.md` for detailed architecture decisions
- **Examples**: See `example-prototype.html` for UI prototypes

## Current Implementation

This repository contains the Svelte-based prototype implementation with:

- **Frontend**: `apps/web/` - Svelte components and configuration
- **Backend**: `apps/server/` - Local proxy for LLM providers
- **Documentation**: `docs/specification/` - Technical specifications
- **Configuration**: `package.json` files - Development setup

## Key Files

- `README.md` - Project overview and setup instructions
- `specs.md` - Complete technical specification
- `example-prototype.html` - UI prototype reference

## Project Structure

The project follows the specification outlined in `specs.md`, focusing on:

1. **Privacy-first**: Local-first LLM integration
2. **Reactive UI**: Svelte-based component architecture
3. **Editor integration**: Tiptap for manuscript editing
4. **Local proxy**: CORS-safe forwarding to LLM providers