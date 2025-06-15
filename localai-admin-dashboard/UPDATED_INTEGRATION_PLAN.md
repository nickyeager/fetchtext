# Updated Integration Plan - Workflow Template System

## Current State Assessment (June 13, 2025)

### ✅ **Completed Infrastructure:**
- Supabase authentication system with user management
- Database schema for workflow templates (002_workflow_templates_system.sql)
- Basic admin dashboard with routing and theming
- Document templating system (different from workflow templates)
- Testing framework with Vitest

### 🔄 **Key Findings from Codebase Research:**

#### **Existing Template Systems:**
1. **Document Templates** (`/features/documents/`) - Markdown/HTML templates for document generation
2. **SQL Templates** - Database query templates in Supabase Studio
3. **Email Templates** - Authentication email templates
4. **Policy Templates** - RLS policy templates

#### **Missing Components for Workflow Templates:**
1. **Multi-tenancy/Team Support** - Schema lacks organization/team structure
2. **Workflow Types** - No TypeScript interfaces for N8N/Flowise workflows
3. **Gallery UI** - No dedicated workflow template browsing interface
4. **External API Integration** - No N8N/Flowise service clients

## 🎯 **Immediate Next Steps (Priority Order)**

### **Step 1: Enhance Database Schema for Teams**
Current schema supports individual users but lacks team/organization context.

**Required Changes:**
```sql
-- Add organization/team support
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Update workflow_templates table
ALTER TABLE workflow_templates 
ADD COLUMN organization_id UUID REFERENCES organizations(id);
```

### **Step 2: Define Workflow Template Types**
Create comprehensive TypeScript interfaces that distinguish between document templates and workflow templates.

### **Step 3: Build Template Gallery Components**
Create new components specifically for workflow templates (not reusing document template components).

### **Step 4: Add External Service Integration**
Build API clients for N8N and Flowise integration.

### **Step 5: Comprehensive Testing**
Add tests for all new functionality.

## 🧪 **Testing Strategy**

### **Current Test Coverage:**
- Authentication context: ✅
- Supabase client: ✅ 
- User auth forms: ✅

### **Required Test Coverage:**
- [ ] Workflow template CRUD operations
- [ ] Template gallery filtering and search
- [ ] N8N/Flowise API integration
- [ ] Multi-tenancy permissions
- [ ] Template sharing and collaboration

## 🔧 **Implementation Approach**

### **Phase 1: Schema Enhancement & Types (1-2 days)**
1. Update database schema for multi-tenancy
2. Create workflow template TypeScript interfaces
3. Add comprehensive tests for schema changes

### **Phase 2: API Integration Layer (2-3 days)**
1. Build N8N API client
2. Build Flowise API client  
3. Create template synchronization services
4. Add integration tests

### **Phase 3: Template Gallery UI (3-4 days)**
1. Build TemplateGallery component
2. Build TemplateCard component
3. Add search and filtering
4. Create template preview modal
5. Add UI tests

### **Phase 4: Advanced Features (2-3 days)**
1. Template sharing and permissions
2. Usage analytics integration
3. Template versioning
4. Collaborative editing

## 🚫 **Avoiding Duplication**

### **Existing Systems to NOT Duplicate:**
1. **Document Templates** - Keep separate from workflow templates
2. **Authentication System** - Reuse existing Supabase auth
3. **UI Components** - Reuse shadcn/ui components from existing code
4. **Testing Setup** - Extend existing Vitest configuration

### **Integration Points:**
1. **Shared Components**: Use existing UI components (Card, Button, etc.)
2. **Shared Services**: Use existing Supabase client and auth context
3. **Shared Routing**: Integrate with existing TanStack Router setup
4. **Shared Theming**: Use existing theme system

## 📋 **Acceptance Criteria**

### **Schema Requirements:**
- [ ] Multi-tenant workflow template storage
- [ ] Proper RLS policies for team isolation
- [ ] Migration scripts with rollback capability
- [ ] Performance indexes for search queries

### **API Requirements:**
- [ ] N8N workflow import/export
- [ ] Flowise chatflow integration
- [ ] Template synchronization
- [ ] Error handling and retry logic

### **UI Requirements:**
- [ ] Responsive template gallery
- [ ] Advanced search and filtering
- [ ] Template preview and editing
- [ ] Team management interface

### **Testing Requirements:**
- [ ] Unit tests for all components
- [ ] Integration tests for API clients
- [ ] E2E tests for critical workflows
- [ ] Performance tests for large template lists

## 🔄 **Next Action Items**

1. **Update database schema** with organization support
2. **Create workflow template types** (separate from document templates)
3. **Write comprehensive tests** for new functionality
4. **Build template gallery components** without duplicating existing document features
5. **Integrate with existing authentication** and routing systems

This plan ensures we build on existing infrastructure while avoiding duplication and maintaining code quality through comprehensive testing.
