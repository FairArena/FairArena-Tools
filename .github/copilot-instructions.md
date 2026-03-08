# FairArena - GitHub Copilot Instructions

## Project Context

FairArena - Curl Tester is a developer playground that provides sandboxed
Docker terminals, a cURL/API testing UI, and a webhook inspector for learning
and debugging HTTP integrations.

## Technology Stack

### Frontend

- React 19 with TypeScript (strict)
- Vite, TailwindCSS
- Local state via React hooks and lightweight libraries as needed

### Backend

- Node 22 with Express
- TypeScript (strict)
- `node-pty` for PTY handling and Docker for sandboxed shells

## Code Generation Guidelines

### General Principles

1. **Type Safety First**: Always use TypeScript with strict mode.
2. **Async/Await**: Use async/await for asynchronous operations.
3. **Error Handling**: Use try-catch and return consistent API errors.

### React Component Patterns

```typescript
interface Props {
  data: string;
}

export const Component: React.FC<Props> = ({ data }) => {
  return <div>{data}</div>;
};
```

### API Endpoint Patterns

```typescript
import { z } from 'zod';

export const handler = async (req, res) => {
  try {
    // validate with zod
  } catch (error) {
    // consistent error response
    res.status(500).json({ error: String(error) });
  }
};
```

## Important Reminders

1. **Never commit secrets**
2. **Validate inputs** (use `zod` for runtime validation)
3. **Keep Docker sandboxes ephemeral and resource-limited**
