# FetchText Project - Complete Documentation Index

**Last Updated**: 2026-02-03
**Purpose**: Comprehensive guide to all documentation in the FetchText project

---

## 🎯 Quick Start Guides

For someone new to the project, start here:

1. **[README.md](../README.md)** - Project overview, prerequisites, installation instructions
2. **[CLAUDE.md](../CLAUDE.md)** - Development guidelines for AI assistants working on this codebase
3. **[documentation/setup.md](../documentation/setup.md)** - Detailed setup verification and service access URLs
4. **[localai-admin-dashboard/SETUP_VERIFICATION.md](../localai-admin-dashboard/SETUP_VERIFICATION.md)** - Frontend-specific setup guide with JWT token verification

---

## 📐 Architecture & System Design

### High-Level Architecture
- **[architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md)** - Complete system architecture diagram
  - Service ports and external access mappings
  - Data flow diagrams (auth, AI chat, workflows, documents)
  - Volume mounts and shared storage configuration
  - Security considerations and network architecture
  - LLM provider integration (Ollama + Azure OpenAI)

### Project Structure
- **[architecture/PROJECT_STRUCTURE.md](architecture/PROJECT_STRUCTURE.md)** - Directory structure explanation
  - Core orchestration files (docker-compose, scripts)
  - Application services (document-processor, admin dashboard)
  - Data, backups, and shared assets
  - Supabase stack organization
  - Dependencies and configuration

### Database
- **[documentation/SUPABASE_STRUCTURE.md](../documentation/SUPABASE_STRUCTURE.md)** - Database schema and tables
- **[documentation/supabase.md](../documentation/supabase.md)** - Supabase integration details
- **[documentation/database_schema.sql](../documentation/database_schema.sql)** - SQL schema definitions

---

## 🚀 Deployment & Operations

### Deployment
- **[PRODUCTION_RESOURCES.md](PRODUCTION_RESOURCES.md)** - **Single source of truth for all production URLs and credentials**
- **[architecture/DEPLOYMENT_PLAN.md](architecture/DEPLOYMENT_PLAN.md)** - Production deployment strategy
- **[documentation/setup.md](../documentation/setup.md)** - Setup verification and port configuration
- **[supabase-deployment-log.md](supabase-deployment-log.md)** - Production Supabase migration tracking
- **[deployment-verification-checklist.md](deployment-verification-checklist.md)** - Deployment verification steps

### Monitoring
- **[../documentation/monitoring.md](../documentation/monitoring.md)** - Monitoring tools overview
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
- **[../localai-admin-dashboard/README.md](../localai-admin-dashboard/README.md)** - Dashboard overview
  - Tech stack (React 19, TanStack Router, Vite, TypeScript)
  - Available scripts and testing commands
  - Environment configuration
  - VSCode debugging setup

- **[../localai-admin-dashboard/SETUP_VERIFICATION.md](../localai-admin-dashboard/SETUP_VERIFICATION.md)** - Setup guide
  - JWT token alignment verification
  - Node.js and pnpm installation
  - Environment variable configuration
  - Common issues and solutions

- **[../localai-admin-dashboard/.vscode/README.md](../localai-admin-dashboard/.vscode/README.md)** - VSCode debugging
  - Setting breakpoints in TypeScript/TSX files
  - Debugging React components
  - Vitest test debugging
  - Performance and network debugging

#### Features & Workflows
- **[../localai-admin-dashboard/DOCUMENT_UPLOAD_FLOW.md](../localai-admin-dashboard/DOCUMENT_UPLOAD_FLOW.md)** - Document upload process
  - Gallery view to document view flow
  - File upload mechanisms
  - Processing status updates
  - Error handling

- **[../localai-admin-dashboard/src/features/documents/README.md](../localai-admin-dashboard/src/features/documents/README.md)** - Documents feature documentation
  - Component structure
  - Service layer architecture
  - State management

#### Testing
- **[../localai-admin-dashboard/TEST_ORGANIZATION_SUMMARY.md](../localai-admin-dashboard/TEST_ORGANIZATION_SUMMARY.md)** - Test organization
- **[../localai-admin-dashboard/tests/README.md](../localai-admin-dashboard/tests/README.md)** - Testing guidelines
- **[../localai-admin-dashboard/src/__tests__/integration/README.md](../localai-admin-dashboard/src/__tests__/integration/README.md)** - Integration tests

#### Changelog
- **[../localai-admin-dashboard/CHANGELOG.md](../localai-admin-dashboard/CHANGELOG.md)** - Version history and changes

### Backend (Document Processor)

- **[../documentation/document-processor-api.md](../documentation/document-processor-api.md)** - API documentation
  - Endpoints and usage
  - Request/response formats
  - Error codes

- **[../document-processor/API_ENDPOINTS.md](../document-processor/API_ENDPOINTS.md)** - Detailed endpoint specs
- **[../document-processor/tests/README.md](../document-processor/tests/README.md)** - Backend testing guide

---

## 🧪 Testing & Quality Assurance

### Testing Guides
- **[localai-admin-dashboard/tests/README.md](localai-admin-dashboard/tests/README.md)** - Frontend/unit testing workflow and tooling
- **[localai-admin-dashboard/src/__tests__/integration/README.md](localai-admin-dashboard/src/__tests__/integration/README.md)** - Integration test harness details
- **[document-processor/tests/README.md](document-processor/tests/README.md)** - Backend testing instructions
- **[localai-admin-dashboard/TEST_ORGANIZATION_SUMMARY.md](localai-admin-dashboard/TEST_ORGANIZATION_SUMMARY.md)** - Coverage expectations and suite structure

### Test Results & Analysis
- **[AUTH_TEST_RESULTS.md](AUTH_TEST_RESULTS.md)** - Authentication test coverage snapshot
- **[DOCUMENT_PROCESSING_COMPLETE_GUIDE.md](DOCUMENT_PROCESSING_COMPLETE_GUIDE.md)** - Latest end-to-end document processing validation steps

### Bug Fixes & Resolutions
- **[localai-admin-dashboard/PROGRESS_INDICATOR_FIX_MANUAL_TEST.md](localai-admin-dashboard/PROGRESS_INDICATOR_FIX_MANUAL_TEST.md)** - Progress indicator remediation steps
- **[DOCUMENT_PROCESSING_COMPLETE_GUIDE.md](DOCUMENT_PROCESSING_COMPLETE_GUIDE.md)** - Consolidated extraction + rerun fixes

---

## 🔐 Authentication & Security

### Authentication Documentation
- **[CLAUDE.md](CLAUDE.md)** - JWT token synchronization, Supabase auth policies, and remediation steps
- **[documentation/supabase.md](documentation/supabase.md)** - Supabase structure, auth tables, and environment configuration
- **[documentation/setup.md](documentation/setup.md)** - Environment/bootstrap steps including auth configuration

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
- **[TEMPLATE_MATCHING_CURRENT_STATE.md](TEMPLATE_MATCHING_CURRENT_STATE.md)** - Deep dive into template matching and enhancement proposals
- **[RERUN_SMART_EXTRACTION_FLOW.md](RERUN_SMART_EXTRACTION_FLOW.md)** - Smart extraction rerun flow documentation
- **[DOCUMENT_PROCESSING_COMPLETE_GUIDE.md](DOCUMENT_PROCESSING_COMPLETE_GUIDE.md)** - Full document processing flow plus extraction rerun details

### Document Features
- **[features/document-complete-deletion/IMPLEMENTATION_SUMMARY.md](features/document-complete-deletion/IMPLEMENTATION_SUMMARY.md)** - Document deletion feature

---

## 📋 Historical Context & Decisions

### Project Status
- **[Copilot-Processing.md](Copilot-Processing.md)** - Running activity log of assistant-led changes
- **[plans/](plans/)** - Implementation plans and retrospectives
- **[DOCUMENT_PROCESSING_COMPLETE_GUIDE.md](DOCUMENT_PROCESSING_COMPLETE_GUIDE.md)** - Latest end-to-end verification guide

### Historical Documentation
- **[.copilot-tracking/](.copilot-tracking/)** - Archived research, changes, and plan details
- **[documentation/README.md](documentation/README.md)** - Entry point for structured docs
- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Current repository layout summary

### Context Engineering
- **[CLAUDE.md](CLAUDE.md)** - Canonical process + agent coordination instructions

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
| **Writing tests** | localai-admin-dashboard/tests/README.md → localai-admin-dashboard/src/__tests__/integration/README.md |
| **Deploying to production** | PRODUCTION_RESOURCES.md → DEPLOYMENT_PLAN.md → deployment-verification-checklist.md |
| **Understanding templates** | TEMPLATE_MATCHING_CURRENT_STATE.md |
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
1. localai-admin-dashboard/tests/README.md
2. localai-admin-dashboard/src/__tests__/integration/README.md
3. localai-admin-dashboard/TEST_ORGANIZATION_SUMMARY.md
4. DOCUMENT_PROCESSING_COMPLETE_GUIDE.md

#### DevOps/SRE
1. PRODUCTION_RESOURCES.md
2. DEPLOYMENT_PLAN.md
3. deployment-verification-checklist.md
4. documentation/monitoring.md
5. ARCHITECTURE.md (Service Architecture section)

---

## 📚 Documentation Categories

### ✅ Active & Current
- All root-level files (README, CLAUDE, ARCHITECTURE, PROJECT_STRUCTURE, etc.)
- documentation/ folder
- localai-admin-dashboard/ documentation
- document-processor/ docs and testing guides

### 📦 Historical/Reference
- .copilot-tracking/ folder
- plans/ folder (older implementation plans)
- Archived references inside `documentation/` and `DOCUMENT_PROCESSING_COMPLETE_GUIDE.md`

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
4. **Feature-specific**: DOCUMENT_PROCESSING_COMPLETE_GUIDE.md or TEMPLATE_MATCHING_CURRENT_STATE.md
5. **Testing**: localai-admin-dashboard/tests/README.md

---

**Note**: This index is a living document. If you add new documentation, please update this file to help others find it.
