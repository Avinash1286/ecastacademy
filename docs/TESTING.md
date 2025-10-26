# Testing guide

This repository does not include a dedicated test runner dependency, so tests are written using:
- Node's built-in test runner (node:test)
- TypeScript execution via the existing "tsx" dev dependency

How to run:
1) Ensure dependencies are installed (npm ci or npm install).
2) Run all tests:
   npx tsx --test

3) Watch mode (reruns on changes):
   npx tsx --test --watch

Notes:
- Tests focus on pure logic and Convex handlers by invoking their `.handler` functions with mocked contexts.
- UI and Next.js route tests are intentionally omitted to avoid adding new dependencies like jsdom.