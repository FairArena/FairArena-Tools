# Contributing to FairArena

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/fairarena/[Repo-Name].git`
3. Create a branch: `git checkout -b feature/your-feature-name`

## Development Setup

### Backend

```bash
cd Backend
pnpm install
cp .env.example .env.local
pnpm run dev
```

### Prerequisites

- Node.js 22+
- pnpm 10+

## Code Standards

- Write clean, readable code
- Follow existing code style
- Add comments only when necessary
- Keep functions small and focused

## Commit Guidelines

Format: `type: description`

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Maintenance

Example: `feat: add user authentication`

## Pull Request Process

1. Update documentation if needed
2. Ensure all tests pass: `pnpm run build`
3. Push to your fork
4. Open a PR with a clear description
5. Link related issues

## Reporting Issues

Include:

- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Environment details

## Questions?

Open an issue with the `question` label.
