# Contributing to service-keepalive

Thank you for your interest in contributing to `service-keepalive`! We welcome bug fixes, documentation improvements, test additions, and new feature suggestions.

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Getting Started

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/EZDevanshu/service-keepalive.git
   cd service-keepalive
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run the test suite:

   ```bash
   npm test
   ```

4. Run tests in watch mode during development:
   ```bash
   npm run test:watch
   ```

## Available Scripts

| Command                 | Description                                   |
| :---------------------- | :-------------------------------------------- |
| `npm run build`         | Builds ESM, CJS, and CLI binaries to `dist/`  |
| `npm test`              | Runs all Vitest test suites                   |
| `npm run test:watch`    | Runs Vitest in interactive watch mode         |
| `npm run test:coverage` | Generates a test coverage report              |
| `npm run typecheck`     | Validates TypeScript types across the project |
| `npm run lint`          | Lints TypeScript files using ESLint 9         |
| `npm run lint:fix`      | Automatically fixes autofixable lint issues   |
| `npm run format`        | Formats source files with Prettier            |
| `npm run format:check`  | Verifies formatting without modifying files   |
| `npm run clean`         | Cleans `dist` and `coverage` directories      |

## Pull Request Guidelines

1. Create a descriptive feature branch (`git checkout -b feature/my-feature` or `fix/issue-123`).
2. Write unit tests for all new functionality or bug fixes.
3. Ensure all tests and lint checks pass:
   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```
4. Submit a Pull Request targeting the `main` branch with a clear summary of changes.
