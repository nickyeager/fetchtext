# Local AI Admin Dashboard

Admin Dashboard for the Local AI document processing system. Built with Shadcn/UI and integrated with N8N, Ollama, and Supabase for ## Contributing

This project is part of the Local AI ecosystem. Contributions are welcome!

### Development Guidelines
- Follow the existing code style and conventions
- Write tests for new features and bug fixes
- Use Vitest for all testing needs
- Ensure E2E tests pass before submitting PRs
- Update documentation for significant changes

### Codebase Cleanup
Recent improvements include:
- Removed redundant and unused files
- Consolidated duplicate monitoring scripts
- Implemented comprehensive E2E testing
- Enhanced error handling and graceful degradation
- Updated documentation and README

## License

Licensed under the [MIT License](https://choosealicense.com/licenses/mit/)

## Acknowledgments

Built on top of the excellent [Shadcn Admin](https://github.com/satnaing/shadcn-admin) template by [@satnaing](https://github.com/satnaing).powered document workflows.

![alt text](public/images/shadcn-admin.png)

This dashboard provides a modern interface for managing AI document processing workflows, including document upload, processing automation via N8N, AI-powered extraction using Ollama models, and data storage with Supabase.

## Features

- Light/dark mode
- Responsive design with mobile support
- Accessible components following WCAG guidelines
- Document upload and processing interface
- AI model management and monitoring
- N8N workflow integration and management
- Real-time processing status updates
- Comprehensive E2E testing suite
- Global Search Command
- Built-in Sidebar navigation
- 10+ pages including document management
- Extra custom components for AI workflows

## Tech Stack

**UI:** [ShadcnUI](https://ui.shadcn.com) (TailwindCSS + RadixUI)

**Build Tool:** [Vite](https://vitejs.dev/)

**Routing:** [TanStack Router](https://tanstack.com/router/latest)

**Type Checking:** [TypeScript](https://www.typescriptlang.org/)

**Testing:** [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/)

**Linting/Formatting:** [Eslint](https://eslint.org/) & [Prettier](https://prettier.io/)

**Icons:** [Tabler Icons](https://tabler.io/icons)

**AI Integration:** [Ollama](https://ollama.ai/) for local AI models

**Workflow Engine:** [N8N](https://n8n.io/) for document processing automation

**Database:** [Supabase](https://supabase.com/) for data storage and authentication

**Containerization:** [Docker](https://docker.com/) for service orchestration

## Quick Start

### Prerequisites
- Node.js 18+ and PNPM
- Docker and Docker Compose
- Local AI services running (N8N, Ollama, Supabase)

### Installation

Clone the project and navigate to the admin dashboard:

```bash
cd localai-admin-dashboard
```

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm run dev
```

The dashboard will be available at `http://localhost:3000`

### Testing

This project includes comprehensive testing with unit, integration, and E2E tests.

**⚠️ Important Testing Rules:**
- **Always run tests without the watcher** - Use `pnpm test` (runs once) instead of watch mode
- **Never use watch mode in CI or automated testing**
- **Use explicit run commands** for all test execution

```bash
# Run all tests (recommended - no watcher)
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run specific test file
npx vitest path/to/test.test.ts --run

# Run tests with verbose output
npx vitest --run --reporter=verbose

# E2E tests with service checks
./scripts/run-e2e-tests-simple.sh

# UI mode (for debugging, not CI)
pnpm test:ui
```

**Available Test Scripts:**
- `pnpm test` - Run all tests once (no watcher)
- `pnpm test:coverage` - Run tests with coverage report
- `pnpm test:ui` - Open Vitest UI (development only)
- `pnpm test:watch` - Watch mode (development only, not for CI)

For detailed testing information, see [TESTING.md](./TESTING.md).

### Environment Configuration

Create a `.env.local` file with the following variables:

```env
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_N8N_URL=http://localhost:5678
VITE_OLLAMA_URL=http://localhost:11434
```

Note: Vite embeds env at build time. If you change `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY`, rebuild the dashboard image and restart the container:

```bash
docker compose build --no-cache localai-admin-dashboard
docker compose up -d localai-admin-dashboard
```

## Project Structure

```
localai-admin-dashboard/
├── src/
│   ├── components/          # UI components
│   ├── features/           # Feature-specific components
│   ├── lib/               # Utilities and configurations
│   ├── pages/             # Page components
│   ├── types/             # TypeScript type definitions
│   └── __tests__/         # Test files
│       ├── unit/          # Unit tests
│       ├── integration/   # Integration tests
│       └── e2e/          # End-to-end tests
├── scripts/               # Build and utility scripts
├── public/               # Static assets
└── docs/                # Additional documentation
```

## Testing Strategy

This project implements a comprehensive testing strategy:

### Test Types
- **Unit Tests**: Component and utility function tests
- **Integration Tests**: Feature workflow tests
- **E2E Tests**: Full system integration tests

### Test Coverage
- ✅ Service health monitoring (N8N, Ollama, Supabase)
- ✅ AI model management and text generation
- ✅ Document processing workflows
- ✅ Admin dashboard accessibility
- ✅ Error handling and graceful degradation

See [E2E_TESTING_SUMMARY.md](./E2E_TESTING_SUMMARY.md) for detailed testing documentation.

### Verify embedded Supabase URL (optional)

You can confirm the production bundle points to the host gateway URL with a quick check:

```bash
curl -s http://localhost:5174/ | grep -o "/assets/[^"]\+\.js" | head -n1 | xargs -I{} sh -c 'curl -s http://localhost:5174{} | grep -m1 -o "http://localhost:8000" || echo MISSING'
```

### Authenticated E2E (Supabase Session Bootstrap)

Playwright tests can reuse a pre-authenticated Supabase session generated during `globalSetup`.

Environment variables required for auth bootstrap (set in `.env` or CI secrets):

```env
TEST_USER_EMAIL=test.user@example.com
TEST_USER_PASSWORD=change_me_local
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

You can place these in `.env.e2e` (copy from `.env.e2e.example`) and run:

```bash
pnpm test:e2e:auth
```

How it works:
- `tests/auth/global-setup.ts` performs a password grant against Supabase auth API.
- It writes `playwright/.auth/user.json` with the expected `sb-<projectRef>-auth-token` localStorage entries.
- `playwright.config.ts` points `use.storageState` at that file so subsequent tests start authenticated.

If env vars are absent, the auth file is skipped and auth-dependent specs should be treated as pending (avoid adding fragile assumptions). For strict CI, ensure these variables are set so the authenticated upload and document workflow tests execute fully.

Security notes:
- Use a dedicated low-privilege test user.
- Never commit real credentials.
- Rotate the test user password periodically.


## Development

### Code Quality
- ESLint for code linting
- Prettier for code formatting
- TypeScript for type safety
- Vitest for testing

### Key Scripts
```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm preview      # Preview production build
pnpm test         # Run all tests (no watcher)
pnpm test:coverage # Run tests with coverage
pnpm test:ui      # Open Vitest UI (dev only)
pnpm lint         # Run ESLint
pnpm format       # Format code with Prettier
```

## Sponsoring this project ❤️

If you find this project helpful or use this in your own work, consider [sponsoring me](https://github.com/sponsors/satnaing) to support development and maintenance. You can [buy me a coffee](https://buymeacoffee.com/satnaing) as well. Don’t worry, every penny helps. Thank you! 🙏

For questions or sponsorship inquiries, feel free to reach out at [contact@satnaing.dev](mailto:contact@satnaing.dev).

### Current Sponsor

- [Clerk](https://go.clerk.com/GttUAaK) - for backing the implementation of Clerk in this project

## Author

Crafted with 🤍 by [@satnaing](https://github.com/satnaing)

## License

Licensed under the [MIT License](https://choosealicense.com/licenses/mit/)
