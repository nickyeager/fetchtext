# Context Engineering Integration Guide for FetchText

## Overview

This guide integrates the Context Engineering methodology from [coleam00/context-engineering-intro](https://github.com/coleam00/context-engineering-intro) into the FetchText document processing platform. Context Engineering provides a systematic approach to AI-assisted development that goes beyond simple prompts.

## Core Principles

### 1. The "Screenplay" Approach
Instead of giving AI assistants brief prompts, provide complete implementation details like a movie screenplay - every scene, dialogue, and action detailed.

### 2. Three-Tier Context Structure

```
├── CLAUDE.md           # Global project rules (already exists ✓)
├── INITIAL.md          # Feature-specific requirements
├── examples/           # Code pattern references
└── validation/         # Test cases and validation rules
```

## Integration into FetchText Workflow

### For Document Processing Features

#### Step 1: Create Feature-Specific Context Files

**Example: Smart Template Generation Feature**

Create `features/smart-templates/INITIAL.md`:

```markdown
# Smart Template Generation Feature

## Objective
Implement an AI-powered template generation system that analyzes documents and creates reusable extraction templates with smart variables.

## Current State
- Backend has issues with .txt files and Ollama integration
- Using fallback mock template generator
- Smart variables need proper extraction rules

## Desired Outcome
1. Robust template generation that handles all file types
2. Intelligent field detection based on document content
3. Category-specific smart variables with confidence scores
4. Seamless fallback when AI services are unavailable

## Implementation Requirements
- Must handle text files (.txt) without Docling
- Graceful degradation when Ollama is offline
- Smart variable validation and type inference
- Template versioning and improvement tracking

## Success Criteria
- [ ] All document types generate valid templates
- [ ] Smart variables have >80% extraction accuracy
- [ ] Template generation completes in <10 seconds
- [ ] Fallback templates are production-ready
```

#### Step 2: Create Example Patterns

Create `features/smart-templates/examples/`:

```typescript
// smart-variable-pattern.ts
interface SmartVariablePattern {
  // Pattern: Always include extraction hints and confidence
  invoice_number: {
    id: 'invoice_number',
    name: 'Invoice Number',
    type: 'text',
    extraction_hints: ['Invoice #', 'Invoice No.', 'INV-'],
    confidence_threshold: 0.8,
    validation_regex: /^[A-Z]{2,}-\d{4,}$/,
    fallback_extraction: 'searchNearKeywords'
  }
}

// Pattern: Category-based variable generation
const generateCategoryVariables = (category: string): SmartVariable[] => {
  const baseVariables = getBaseVariables();
  const categorySpecific = getCategorySpecificVariables(category);
  return mergeWithoutDuplicates(baseVariables, categorySpecific);
};
```

#### Step 3: Create Validation Rules

Create `features/smart-templates/validation/template-validation.ts`:

```typescript
// Validation pattern for generated templates
export const validateGeneratedTemplate = (template: any): ValidationResult => {
  const errors: string[] = [];
  
  // Must have required fields
  if (!template.name) errors.push('Template name is required');
  if (!template.variables || template.variables.length === 0) {
    errors.push('Template must have at least one variable');
  }
  
  // Each variable must be valid
  template.variables?.forEach((variable: any, index: number) => {
    if (!variable.id) errors.push(`Variable ${index} missing ID`);
    if (!variable.type) errors.push(`Variable ${index} missing type`);
    if (!variable.extraction_hints || variable.extraction_hints.length === 0) {
      errors.push(`Variable ${variable.id} missing extraction hints`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
};
```

### For Document Upload Workflow

#### Step 1: Create Workflow Context

Create `workflows/document-upload/INITIAL.md`:

```markdown
# Document Upload Workflow

## Objective
Create a seamless document upload experience with AI-powered analysis and processing options.

## Workflow Steps
1. User drops/selects file
2. System validates file and creates record
3. AI analyzes document type
4. System suggests processing options
5. User selects action
6. System processes with selected method
7. Results displayed with extraction preview

## Edge Cases to Handle
- Network failures during upload
- Unsupported file formats
- AI service unavailable
- Large file handling (>10MB)
- Concurrent uploads
- Browser refresh during processing

## UI/UX Requirements
- Real-time progress indicators
- Clear error messages with recovery actions
- Fallback options always visible
- Processing time estimates
- Cancel/retry capabilities
```

### Implementation Workflow

#### 1. Product Requirements Prompt (PRP) Generation

Create a systematic prompt generator for new features:

```typescript
// prp-generator.ts
export function generatePRP(feature: string): string {
  return `
I need to implement the ${feature} feature for FetchText.

Context Files:
- CLAUDE.md: Global project rules and architecture
- features/${feature}/INITIAL.md: Feature requirements
- features/${feature}/examples/: Code patterns to follow

Please implement this feature following:
1. All patterns in the examples directory
2. Validation rules for quality assurance
3. Error handling patterns from existing code
4. Test cases that verify success criteria

Begin by reviewing all context files, then provide implementation.
  `;
}
```

#### 2. Validation Workflow

Create `scripts/validate-implementation.ts`:

```typescript
#!/usr/bin/env ts-node

import { validateGeneratedTemplate } from '../features/smart-templates/validation/template-validation';
import { runE2ETests } from '../test/e2e';

async function validateImplementation(feature: string) {
  console.log(`🔍 Validating ${feature} implementation...`);
  
  // Run validation rules
  const validationResults = await runFeatureValidation(feature);
  
  // Run E2E tests
  const testResults = await runE2ETests(feature);
  
  // Check against success criteria
  const criteriaResults = await checkSuccessCriteria(feature);
  
  // Generate report
  generateValidationReport({
    feature,
    validation: validationResults,
    tests: testResults,
    criteria: criteriaResults
  });
}
```

### Best Practices for FetchText

#### 1. Document Processing Context
```markdown
# Document Processing Context Rules

1. **Always provide fallbacks**: Every AI-powered feature must have a non-AI fallback
2. **Handle all file types**: If backend doesn't support it, handle it in frontend
3. **Progress visibility**: Users should always know what's happening
4. **Error recovery**: Every error should have a suggested action
5. **Performance targets**: Template generation <10s, Upload <5s, Processing <30s
```

#### 2. Template Generation Context
```markdown
# Template Generation Rules

1. **Smart Variables Must Include**:
   - Unique ID
   - Human-readable name
   - Data type with validation
   - Extraction hints (min 3)
   - Confidence threshold
   - Default value

2. **Category Handling**:
   - Auto-detect from filename
   - Allow user override
   - Merge category-specific variables
   - Include general variables as fallback

3. **Validation Requirements**:
   - All templates must pass validation before use
   - Variables must have extraction rules
   - Templates must be testable with sample data
```

#### 3. Integration Patterns

Create `patterns/ai-service-integration.md`:

```markdown
# AI Service Integration Pattern

## Pattern: Graceful Degradation
```typescript
async function callAIService<T>(
  primaryService: () => Promise<T>,
  fallbackService: () => Promise<T>,
  mockResponse: () => T
): Promise<T> {
  try {
    // Try primary service with timeout
    return await withTimeout(primaryService(), 10000);
  } catch (primaryError) {
    console.warn('Primary service failed:', primaryError);
    
    try {
      // Try fallback service
      return await withTimeout(fallbackService(), 5000);
    } catch (fallbackError) {
      console.warn('Fallback service failed:', fallbackError);
      
      // Use mock response
      return mockResponse();
    }
  }
}
```

## Pattern: Progressive Enhancement
```typescript
interface DocumentAnalysis {
  basic: BasicAnalysis;      // Always available
  enhanced?: EnhancedAnalysis; // When AI available
  premium?: PremiumAnalysis;   // When advanced AI available
}
```
```

### Automated Context Management

Create `scripts/update-context.ts`:

```typescript
#!/usr/bin/env ts-node

// Automatically update context files based on implementation changes
async function updateContextFiles() {
  // Scan for new patterns
  const newPatterns = await scanForPatterns('./src');
  
  // Update examples
  await updateExamples(newPatterns);
  
  // Update validation rules
  await generateValidationRules(newPatterns);
  
  // Update CLAUDE.md with new patterns
  await updateClaudeMd(newPatterns);
}
```

## Implementation Checklist

- [ ] Create feature-specific INITIAL.md files for current features
- [ ] Extract code patterns into examples/ directories
- [ ] Build validation rules for each feature
- [ ] Create PRP generator script
- [ ] Set up automated validation workflow
- [ ] Document AI service integration patterns
- [ ] Create context update automation

## Benefits for FetchText

1. **Consistent Implementation**: All features follow established patterns
2. **Faster Development**: AI has complete context for accurate generation
3. **Better Error Handling**: Edge cases documented upfront
4. **Quality Assurance**: Automated validation ensures standards
5. **Knowledge Preservation**: Context files serve as living documentation

## Next Steps

1. Start with one feature (e.g., Smart Template Generation)
2. Create its complete context structure
3. Use the PRP workflow for implementation
4. Validate against success criteria
5. Iterate and improve context based on results