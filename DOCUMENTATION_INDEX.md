# FetchText Project - Complete Documentation Index

**Last Updated**: 2025-11-22
**Purpose**: Comprehensive guide to all documentation in the FetchText project

---

## 🎯 Quick Start Guides

For someone new to the project, start here:

1. **[README.md](README.md)** - Project overview, prerequisites, installation instructions
2. **[CLAUDE.md](CLAUDE.md)** - Development guidelines for AI assistants working on this codebase
3. **[documentation/setup.md](documentation/setup.md)** - Detailed setup verification and service access URLs
4. **[localai-admin-dashboard/SETUP_VERIFICATION.md](localai-admin-dashboard/SETUP_VERIFICATION.md)** - Frontend-specific setup guide with JWT token verification

---

## 📐 Architecture & System Design

### High-Level Architecture
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Complete system architecture diagram
  - Service ports and external access mappings
  - Data flow diagrams (auth, AI chat, workflows, documents)
  - Volume mounts and shared storage configuration
  - Security considerations and network architecture
  - LLM provider integration (Ollama + Azure OpenAI)

### Project Structure
- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Directory structure explanation
  - Core orchestration files (docker-compose, scripts)
  - Application services (document-processor, admin dashboard)
  - Data, backups, and shared assets
  - Supabase stack organization
  - Dependencies and configuration

### Database
- **[documentation/SUPABASE_STRUCTURE.md](documentation/SUPABASE_STRUCTURE.md)** - Database schema and tables
- **[documentation/supabase.md](documentation/supabase.md)** - Supabase integration details
- **[documentation/database_schema.sql](documentation/database_schema.sql)** - SQL schema definitions

---

## 🚀 Deployment & Operations

### Deployment
- **[DEPLOYMENT_PLAN.md](DEPLOYMENT_PLAN.md)** - Production deployment strategy
- **[documentation/setup.md](documentation/setup.md)** - Setup verification and port configuration

### Monitoring
- **[documentation/monitoring.md](documentation/monitoring.md)** - Monitoring tools overview
  - Langfuse (AI observability)
  - Health check scripts
  - Service status monitoring

### Service Management
- Scripts: `start_services.py`, `kill-and-restart-services.py`, `monitor_services.py`
- Health check: `quick_health_check.sh`

---

## 💻 Development Documentation

### Frontend (LocalAI Admin Dashboard)

#### Setup & Configuration
- **[localai-admin-dashboard/README.md](localai-admin-dashboard/README.md)** - Dashboard overview
  - Tech stack (React 19, TanStack Router, Vite, TypeScript)
  - Available scripts and testing commands
  - Environment configuration
  - VSCode debugging setup

- **[localai-admin-dashboard/SETUP_VERIFICATION.md](localai-admin-dashboard/SETUP_VERIFICATION.md)** - Setup guide
  - JWT token alignment verification
  - Node.js and pnpm installation
  - Environment variable configuration
  - Common issues and solutions

- **[localai-admin-dashboard/.vscode/README.md](localai-admin-dashboard/.vscode/README.md)** - VSCode debugging
  - Setting breakpoints in TypeScript/TSX files
  - Debugging React components
  - Vitest test debugging
  - Performance and network debugging

#### Features & Workflows
- **[localai-admin-dashboard/DOCUMENT_UPLOAD_FLOW.md](localai-admin-dashboard/DOCUMENT_UPLOAD_FLOW.md)** - Document upload process
  - Gallery view to document view flow
  - File upload mechanisms
  - Processing status updates
  - Error handling

- **[localai-admin-dashboard/src/features/documents/README.md](localai-admin-dashboard/src/features/documents/README.md)** - Documents feature documentation
  - Component structure
  - Service layer architecture
  - State management

#### Testing
- **[localai-admin-dashboard/TEST_ORGANIZATION_SUMMARY.md](localai-admin-dashboard/TEST_ORGANIZATION_SUMMARY.md)** - Test organization
- **[localai-admin-dashboard/tests/README.md](localai-admin-dashboard/tests/README.md)** - Testing guidelines
- **[localai-admin-dashboard/src/__tests__/integration/README.md](localai-admin-dashboard/src/__tests__/integration/README.md)** - Integration tests

#### Changelog
- **[localai-admin-dashboard/CHANGELOG.md](localai-admin-dashboard/CHANGELOG.md)** - Version history and changes

### Backend (Document Processor)

- **[documentation/document-processor-api.md](documentation/document-processor-api.md)** - API documentation
  - Endpoints and usage
  - Request/response formats
  - Error codes

- **[document-processor/API_ENDPOINTS.md](document-processor/API_ENDPOINTS.md)** - Detailed endpoint specs
- **[document-processor/tests/README.md](document-processor/tests/README.md)** - Backend testing guide

---

## 🧪 Testing & Quality Assurance

### Testing Guides
- **[memory/TESTING.md](memory/TESTING.md)** - Overall testing strategy
- **[memory/E2E_DOCUMENT_UPLOAD_TEST_PLAN.md](memory/E2E_DOCUMENT_UPLOAD_TEST_PLAN.md)** - E2E test plans
- **[memory/DOCUMENT_UPLOAD_INTEGRATION_TEST_PLAN.md](memory/DOCUMENT_UPLOAD_INTEGRATION_TEST_PLAN.md)** - Integration test plans
- **[memory/END_USER_TESTING_WITH_AUTH.md](memory/END_USER_TESTING_WITH_AUTH.md)** - User testing with authentication

### Test Results & Analysis
- **[AUTH_TEST_RESULTS.md](AUTH_TEST_RESULTS.md)** - Authentication test results
- **[memory/ACTUAL_TEST_RESULTS_TEMPLATE_MATCHING.md](memory/ACTUAL_TEST_RESULTS_TEMPLATE_MATCHING.md)** - Template matching test results
- **[memory/REAL_INTEGRATION_TEST_SUMMARY.md](memory/REAL_INTEGRATION_TEST_SUMMARY.md)** - Integration test summary
- **[memory/OBSOLETE_TESTS_ANALYSIS.md](memory/OBSOLETE_TESTS_ANALYSIS.md)** - Deprecated tests analysis

### Bug Fixes & Resolutions
- **[localai-admin-dashboard/PROGRESS_INDICATOR_FIX_MANUAL_TEST.md](localai-admin-dashboard/PROGRESS_INDICATOR_FIX_MANUAL_TEST.md)** - Progress indicator fix documentation
- **[memory/DOCUMENT_STATUS_FIX_SUMMARY.md](memory/DOCUMENT_STATUS_FIX_SUMMARY.md)** - Document status fix
- **[memory/DOCUMENT_STATUS_UPDATE_FIX_SUMMARY.md](memory/DOCUMENT_STATUS_UPDATE_FIX_SUMMARY.md)** - Status update fix
- **[memory/TEMPLATE_GENERATION_TEST_FIX.md](memory/TEMPLATE_GENERATION_TEST_FIX.md)** - Template generation fixes

---

## 🔐 Authentication & Security

### Authentication Documentation
- **[memory/AUTHENTICATION_REMEDIATION_GUIDE_ROOT.md](memory/AUTHENTICATION_REMEDIATION_GUIDE_ROOT.md)** - Root-level auth remediation
- **[memory/AUTHENTICATION_REMEDIATION_GUIDE.md](memory/AUTHENTICATION_REMEDIATION_GUIDE.md)** - Dashboard auth remediation
- **[CLAUDE.md](CLAUDE.md)** - Section on JWT token synchronization and RLS policies

### Key Security Lessons
From CLAUDE.md - "Critical: Authentication & Database Issues (Lessons Learned)":
1. JWT token mismatch between frontend/backend
2. CORS header blocking (PostgREST)
3. PostgreSQL role permissions
4. RLS policy conflicts
5. Recovery checklist for auth failures

---

## 🎨 Features & Implementation

### Template System
- **[memory/TEMPLATE_ANALYSIS_INSTRUCTIONS.md](memory/TEMPLATE_ANALYSIS_INSTRUCTIONS.md)** - Template analysis process
  - AI-powered template matching
  - Azure OpenAI integration
  - Confidence scoring and fallback logic

- **[memory/TEMPLATE_ANALYSIS_IMPLEMENTATION_STATUS.md](memory/TEMPLATE_ANALYSIS_IMPLEMENTATION_STATUS.md)** - Implementation status
- **[memory/TEMPLATE_MATCHING_IMPLEMENTATION_PLAN.md](memory/TEMPLATE_MATCHING_IMPLEMENTATION_PLAN.md)** - Implementation plan
- **[memory/TEMPLATE_MATCHING_PRODUCTION_READY_VERIFICATION.md](memory/TEMPLATE_MATCHING_PRODUCTION_READY_VERIFICATION.md)** - Production readiness
- **[memory/END_USER_TEMPLATE_MATCHING_TESTING_GUIDE.md](memory/END_USER_TEMPLATE_MATCHING_TESTING_GUIDE.md)** - User testing guide

### Document Features
- **[features/document-complete-deletion/IMPLEMENTATION_SUMMARY.md](features/document-complete-deletion/IMPLEMENTATION_SUMMARY.md)** - Document deletion feature

---

## 📋 Historical Context & Decisions

### Project Status
- **[memory/PROJECT_COMPLETION_SUMMARY.md](memory/PROJECT_COMPLETION_SUMMARY.md)** - Project milestones
- **[memory/FINAL_PRODUCTION_READINESS_ASSESSMENT.md](memory/FINAL_PRODUCTION_READINESS_ASSESSMENT.md)** - Production readiness
- **[memory/COMMIT_READY_SUMMARY.md](memory/COMMIT_READY_SUMMARY.md)** - Commit readiness checks

### Historical Documentation
- **[memory/SUPABASE_MIGRATION_PLAN.md](memory/SUPABASE_MIGRATION_PLAN.md)** - Supabase migration details
- **[memory/ARCHITECTURE.md_20250905_193220.md](memory/ARCHITECTURE.md_20250905_193220.md)** - Archived architecture snapshot
- **[memory/TEMPLATE_MATCHING_E2E_TESTING_GUIDE_20250905_190219.md](memory/TEMPLATE_MATCHING_E2E_TESTING_GUIDE_20250905_190219.md)** - Archived testing guide

### Context Engineering
- **[memory/CONTEXT_ENGINEERING_GUIDE.md](memory/CONTEXT_ENGINEERING_GUIDE.md)** - Guide for context management

---

## 🛠️ Development Tools & Workflows

### IDE Configuration
- **[localai-admin-dashboard/.vscode/README.md](localai-admin-dashboard/.vscode/README.md)** - VSCode debugging setup
- **[.vscode/launch.json](.vscode/launch.json)** - Debug configurations

### Git & Workflows
- **[.github/CONTRIBUTING.md](.github/CONTRIBUTING.md)** - Contribution guidelines
- **[.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md)** - PR template
- **[.github/CODE_OF_CONDUCT.md](.github/CODE_OF_CONDUCT.md)** - Code of conduct

### Prompts & Agents
- **[.github/chatmodes/task-planner.chatmode.md](.github/chatmodes/task-planner.chatmode.md)** - Task planning chatmode
- **[.github/chatmodes/task-researcher.chatmode.md](.github/chatmodes/task-researcher.chatmode.md)** - Research chatmode
- **[.github/prompts/](.github/prompts/)** - Various AI prompts for development tasks
- **[.claude/agents/](.claude/agents/)** - Specialized AI agents (test-engineer, playwright-tester, etc.)

---

## 📝 Plans & Roadmaps

### Implementation Plans
- **[plans/20240904-template-generation-testing-plan.md](plans/20240904-template-generation-testing-plan.md)** - Template generation testing
- **[plans/20240904-template-generation-fix-plan.md](plans/20240904-template-generation-fix-plan.md)** - Template generation fixes
- **[plans/20251117-password-alignment-plan.md](plans/20251117-password-alignment-plan.md)** - Password alignment

### Copilot Tracking
- **[.copilot-tracking/research/](.copilot-tracking/research/)** - Research documentation
- **[.copilot-tracking/plans/](.copilot-tracking/plans/)** - Implementation plans
- **[.copilot-tracking/changes/](.copilot-tracking/changes/)** - Change tracking
- **[.copilot-tracking/details/](.copilot-tracking/details/)** - Detailed implementation notes

---

## 🔍 Finding the Right Documentation

### By Task Type

| Task | Documentation |
|------|---------------|
| **Setting up the project** | README.md → documentation/setup.md → localai-admin-dashboard/SETUP_VERIFICATION.md |
| **Understanding architecture** | ARCHITECTURE.md → PROJECT_STRUCTURE.md → documentation/SUPABASE_STRUCTURE.md |
| **Developing frontend** | localai-admin-dashboard/README.md → CLAUDE.md → .vscode/README.md |
| **Working with APIs** | documentation/document-processor-api.md → document-processor/API_ENDPOINTS.md |
| **Debugging issues** | localai-admin-dashboard/.vscode/README.md → CLAUDE.md (auth section) |
| **Writing tests** | memory/TESTING.md → localai-admin-dashboard/tests/README.md |
| **Deploying to production** | DEPLOYMENT_PLAN.md → documentation/setup.md |
| **Understanding templates** | memory/TEMPLATE_ANALYSIS_INSTRUCTIONS.md |
| **Monitoring services** | documentation/monitoring.md → documentation/setup.md |

### By Role

#### New Developer
1. README.md
2. ARCHITECTURE.md
3. PROJECT_STRUCTURE.md
4. localai-admin-dashboard/README.md
5. CLAUDE.md

#### Frontend Developer
1. localai-admin-dashboard/README.md
2. localai-admin-dashboard/SETUP_VERIFICATION.md
3. localai-admin-dashboard/DOCUMENT_UPLOAD_FLOW.md
4. localai-admin-dashboard/.vscode/README.md
5. CLAUDE.md (Frontend Architecture section)

#### Backend Developer
1. documentation/document-processor-api.md
2. document-processor/API_ENDPOINTS.md
3. CLAUDE.md (Python Development Standards)
4. documentation/SUPABASE_STRUCTURE.md

#### QA/Tester
1. memory/TESTING.md
2. memory/E2E_DOCUMENT_UPLOAD_TEST_PLAN.md
3. localai-admin-dashboard/TEST_ORGANIZATION_SUMMARY.md
4. memory/END_USER_TESTING_WITH_AUTH.md

#### DevOps/SRE
1. DEPLOYMENT_PLAN.md
2. documentation/setup.md
3. documentation/monitoring.md
4. ARCHITECTURE.md (Service Architecture section)

---

## 📚 Documentation Categories

### ✅ Active & Current
- All files in root level (README, CLAUDE, ARCHITECTURE, etc.)
- documentation/ folder
- localai-admin-dashboard/ documentation
- memory/ files dated 2024 or later

### 📦 Historical/Reference
- memory/ files with timestamps in names (e.g., ARCHITECTURE.md_20250905_193220.md)
- .copilot-tracking/ folder
- plans/ folder (older implementation plans)

### 🔧 Internal/Tooling
- .github/ folder (prompts, chatmodes, templates)
- .claude/ folder (AI agents)
- .vscode/ folder (IDE configuration)

---

## 🔄 Keeping Documentation Updated

### When to Update This Index
- New markdown files added to the project
- Major architectural changes
- New features implemented
- Documentation reorganization

### Documentation Standards
From documentation/README.md:
- All documentation in Markdown format
- Clear, descriptive headings
- Include code examples where appropriate
- Keep documentation up to date with code changes
- Cross-reference related documentation

---

## 📞 Need Help?

1. **Quick questions**: Check README.md or CLAUDE.md
2. **Setup issues**: See documentation/setup.md or localai-admin-dashboard/SETUP_VERIFICATION.md
3. **Architecture questions**: ARCHITECTURE.md
4. **Feature-specific**: Check memory/ folder for implementation guides
5. **Testing**: memory/TESTING.md

---

**Note**: This index is a living document. If you add new documentation, please update this file to help others find it.
