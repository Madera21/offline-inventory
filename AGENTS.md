# Repository Guidelines

## Project Structure & Module Organization

This is an Expo and React Native inventory app written in TypeScript, with local SQLite storage and optional online barcode lookup.

- `app/` contains Expo Router screens; `(tabs)/` defines the main navigation, and `[id]` paths handle individual records.
- `src/components/` holds reusable UI; `src/services/` implements workflows such as sales, backup, and product lookup.
- `src/db/` contains database initialization, schema, migrations, and repositories.
- `src/store/`, `src/types/`, `src/validation/`, and `src/utils/` contain cart state, shared types, Zod schemas, and helpers.
- `tests/` contains Jest tests; `assets/` contains app icons and splash images.

## Build, Test, and Development Commands

- `npm ci`: install dependencies from the committed lockfile.
- `npm start`: start the Expo development server.
- `npm run android` / `npm run ios`: build and run the native app with the appropriate platform toolchain; iOS requires macOS and Xcode.
- `npm run web`: start Expo for the browser.
- `npm test -- --runInBand`: run the Jest suite serially.
- `npm test -- --runInBand tests/currency.test.ts`: run one test file.
- `npx tsc --noEmit`: check TypeScript without generating files.

There is no dedicated build, lint, or formatting script.

## Coding Style & Naming Conventions

Use strict TypeScript, two-space indentation, single quotes, and semicolons, matching nearby code. Use PascalCase for components and types, camelCase for functions and variables, and descriptive suffixes such as `.service.ts`, `.repository.ts`, and `.schema.ts`. Preserve Expo Router filename conventions. The `@/*` alias maps to `src/*`.

## Testing Guidelines

Jest uses the `jest-expo` preset and discovers `tests/**/*.test.ts` and `.test.tsx`. Follow existing descriptive snake_case filenames, such as `stock_reconciliation.test.ts`. Cover changed behavior, especially currency calculations, stock changes, validation, barcode handling, and backup restoration. Mock network and native dependencies where needed. No coverage threshold is configured. For UI or native changes, include device or emulator verification.

## Commit & Pull Request Guidelines

Recent commits use Conventional Commit prefixes: `feat:`, `fix:`, and `chore:`. Write concise, imperative subjects. PRs should describe the resulting behavior, link relevant issues, report validation performed, and include screenshots for UI changes. Explain database migration or backup compatibility implications when applicable.

## Data & Configuration

Keep money in integer minor units and preserve transactional sales and stock updates. Add versioned migrations for schema changes. Do not commit `.env` files, SQLite databases, backup archives, or generated native directories.
