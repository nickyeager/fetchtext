#!/usr/bin/env ts-node
/**
 * Product Requirements Prompt (PRP) Generator
 * 
 * Generates comprehensive prompts for AI assistants following the Context Engineering methodology.
 * This ensures all feature development includes complete context and requirements.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';

interface FeatureContext {
  name: string;
  claudeMdPath: string;
  initialMdPath: string;
  examplesDir: string;
  validationDir: string;
  hasExamples: boolean;
  hasValidation: boolean;
}

interface PRPOptions {
  includeTests?: boolean;
  includeDocumentation?: boolean;
  includeErrorHandling?: boolean;
  complexity?: 'simple' | 'moderate' | 'complex';
  priority?: 'low' | 'medium' | 'high';
}

class PRPGenerator {
  private readonly projectRoot: string;
  private readonly featuresDir: string;

  constructor() {
    this.projectRoot = resolve(__dirname, '..');
    this.featuresDir = join(this.projectRoot, 'features');
  }

  /**
   * Generate a Product Requirements Prompt for a specific feature
   */
  generatePRP(featureName: string, options: PRPOptions = {}): string {
    const context = this.loadFeatureContext(featureName);
    
    const {
      includeTests = true,
      includeDocumentation = false,
      includeErrorHandling = true,
      complexity = 'moderate',
      priority = 'medium'
    } = options;

    let prompt = this.generateHeader(featureName, priority);
    prompt += this.generateContextSection(context);
    prompt += this.generateRequirementsSection(context);
    prompt += this.generateImplementationGuidance(complexity, includeErrorHandling);
    
    if (includeTests) {
      prompt += this.generateTestingSection(context);
    }
    
    if (includeDocumentation) {
      prompt += this.generateDocumentationSection();
    }
    
    prompt += this.generateValidationSection(context);
    prompt += this.generateDeliverables(includeTests, includeDocumentation);

    return prompt;
  }

  /**
   * Create a new feature structure with INITIAL.md template
   */
  createFeatureStructure(featureName: string, category: string = 'General'): void {
    const featureDir = join(this.featuresDir, featureName);
    
    if (!existsSync(this.featuresDir)) {
      mkdirSync(this.featuresDir, { recursive: true });
    }
    
    if (!existsSync(featureDir)) {
      mkdirSync(featureDir, { recursive: true });
    }

    // Create directories
    const examplesDir = join(featureDir, 'examples');
    const validationDir = join(featureDir, 'validation');
    
    if (!existsSync(examplesDir)) {
      mkdirSync(examplesDir);
    }
    
    if (!existsSync(validationDir)) {
      mkdirSync(validationDir);
    }

    // Create INITIAL.md template
    const initialMdPath = join(featureDir, 'INITIAL.md');
    if (!existsSync(initialMdPath)) {
      const template = this.generateInitialMdTemplate(featureName, category);
      writeFileSync(initialMdPath, template);
    }

    console.log(`✅ Created feature structure for: ${featureName}`);
    console.log(`   📁 ${featureDir}`);
    console.log(`   📄 INITIAL.md`);
    console.log(`   📁 examples/`);
    console.log(`   📁 validation/`);
  }

  private loadFeatureContext(featureName: string): FeatureContext {
    const featureDir = join(this.featuresDir, featureName);
    const claudeMdPath = join(this.projectRoot, 'CLAUDE.md');
    const initialMdPath = join(featureDir, 'INITIAL.md');
    const examplesDir = join(featureDir, 'examples');
    const validationDir = join(featureDir, 'validation');

    if (!existsSync(initialMdPath)) {
      throw new Error(`Feature ${featureName} not found. Run: npm run prp:create ${featureName}`);
    }

    return {
      name: featureName,
      claudeMdPath,
      initialMdPath,
      examplesDir,
      validationDir,
      hasExamples: existsSync(examplesDir) && this.hasFiles(examplesDir),
      hasValidation: existsSync(validationDir) && this.hasFiles(validationDir)
    };
  }

  private hasFiles(directory: string): boolean {
    try {
      const files = require('fs').readdirSync(directory);
      return files.length > 0;
    } catch {
      return false;
    }
  }

  private generateHeader(featureName: string, priority: string): string {
    return `# Implementation Request: ${featureName}

**Priority**: ${priority.toUpperCase()}
**Methodology**: Context Engineering
**Generated**: ${new Date().toISOString()}

---

## Task Overview

I need to implement the **${featureName}** feature for the FetchText document processing platform. This request follows the Context Engineering methodology to provide complete implementation context.

`;
  }

  private generateContextSection(context: FeatureContext): string {
    let section = `## Context Files

The following context files contain all necessary information for implementation:

### 1. Global Project Context
- **File**: \`CLAUDE.md\`
- **Purpose**: Project architecture, conventions, and global rules
- **Status**: ${existsSync(context.claudeMdPath) ? '✅ Available' : '❌ Missing'}

### 2. Feature-Specific Requirements  
- **File**: \`features/${context.name}/INITIAL.md\`
- **Purpose**: Detailed feature requirements and success criteria
- **Status**: ${existsSync(context.initialMdPath) ? '✅ Available' : '❌ Missing'}

`;

    if (context.hasExamples) {
      section += `### 3. Implementation Examples
- **Directory**: \`features/${context.name}/examples/\`
- **Purpose**: Code patterns and implementation references
- **Status**: ✅ Available

`;
    } else {
      section += `### 3. Implementation Examples
- **Directory**: \`features/${context.name}/examples/\`
- **Status**: ⚠️ No examples provided - use existing codebase patterns

`;
    }

    if (context.hasValidation) {
      section += `### 4. Validation Rules
- **Directory**: \`features/${context.name}/validation/\`
- **Purpose**: Automated validation and quality checks
- **Status**: ✅ Available

`;
    } else {
      section += `### 4. Validation Rules
- **Directory**: \`features/${context.name}/validation/\`
- **Status**: ⚠️ No validation rules - create during implementation

`;
    }

    return section;
  }

  private generateRequirementsSection(context: FeatureContext): string {
    let requirements = '';
    
    try {
      const initialContent = readFileSync(context.initialMdPath, 'utf-8');
      
      // Extract key sections from INITIAL.md
      const objective = this.extractSection(initialContent, '## Objective');
      const successCriteria = this.extractSection(initialContent, '### Success Criteria');
      
      requirements = `## Requirements Summary

### Objective
${objective || 'See INITIAL.md for detailed objective'}

### Success Criteria
${successCriteria || 'See INITIAL.md for success criteria'}

`;
    } catch (error) {
      requirements = `## Requirements Summary

**Note**: Full requirements are in \`features/${context.name}/INITIAL.md\`

`;
    }

    return requirements;
  }

  private generateImplementationGuidance(complexity: string, includeErrorHandling: boolean): string {
    let guidance = `## Implementation Guidance

### Complexity Level: ${complexity.toUpperCase()}

`;

    switch (complexity) {
      case 'simple':
        guidance += `This is a simple feature requiring:
- Single component or service modification
- Basic error handling
- Simple validation
- Minimal testing requirements

`;
        break;
      case 'moderate':
        guidance += `This is a moderate complexity feature requiring:
- Multiple component interactions
- Robust error handling with fallbacks
- Integration with existing services
- Comprehensive testing
- Performance considerations

`;
        break;
      case 'complex':
        guidance += `This is a complex feature requiring:
- System-wide changes
- Advanced error handling and recovery
- Multiple service integrations
- Extensive testing including E2E
- Performance optimization
- Monitoring and observability

`;
        break;
    }

    if (includeErrorHandling) {
      guidance += `### Error Handling Requirements

1. **Graceful Degradation**: Feature must work even when dependencies fail
2. **User Communication**: Clear error messages with suggested actions
3. **Fallback Mechanisms**: Alternative approaches when primary method fails
4. **Logging**: Comprehensive error logging for debugging
5. **Recovery**: Automatic retry mechanisms where appropriate

`;
    }

    guidance += `### Implementation Patterns

Follow these established patterns from the codebase:

1. **Service Architecture**: Use existing service patterns
2. **Component Structure**: Follow shadcn/ui and React Query patterns
3. **Type Safety**: Maintain TypeScript strict mode compliance
4. **Testing**: Use Vitest for frontend, pytest for backend
5. **Documentation**: Update relevant context files

`;

    return guidance;
  }

  private generateTestingSection(context: FeatureContext): string {
    return `## Testing Requirements

### Test Coverage Expected

1. **Unit Tests**
   - All new functions and methods
   - Edge cases and error conditions
   - Input validation

2. **Integration Tests**  
   - Component interactions
   - Service integrations
   - Database operations

3. **E2E Tests**
   - Complete user workflows
   - Cross-browser compatibility
   - Performance validation

### Test Framework Usage

- **Frontend**: Vitest (DO NOT use --watch flag)
- **Backend**: pytest
- **E2E**: Playwright or Cypress

`;
  }

  private generateDocumentationSection(): string {
    return `## Documentation Requirements

### Code Documentation
- JSDoc comments for all public functions
- Type definitions with descriptions
- README updates for significant changes

### User Documentation
- Feature usage instructions
- Configuration options
- Troubleshooting guide

`;
  }

  private generateValidationSection(context: FeatureContext): string {
    return `## Validation Workflow

After implementation, run validation:

\`\`\`bash
# Validate specific feature
npm run validate ${context.name}

# Run all validations
npm run validate
\`\`\`

This will check:
- Context file completeness
- Implementation against requirements
- Test coverage and passing status
- Success criteria fulfillment
- Performance benchmarks

`;
  }

  private generateDeliverables(includeTests: boolean, includeDocumentation: boolean): string {
    let deliverables = `## Deliverables

### Required
- [ ] Complete feature implementation
- [ ] All success criteria met
- [ ] Error handling implemented
- [ ] Code follows project conventions

`;

    if (includeTests) {
      deliverables += `### Testing
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] E2E tests for critical paths
- [ ] Test coverage meets requirements

`;
    }

    if (includeDocumentation) {
      deliverables += `### Documentation
- [ ] Code documentation complete
- [ ] User documentation updated
- [ ] Context files updated
- [ ] README changes if needed

`;
    }

    deliverables += `### Validation
- [ ] Feature validation passing
- [ ] Performance requirements met
- [ ] No regressions introduced
- [ ] Ready for production deployment

---

## Instructions for Implementation

1. **Read All Context Files**: Start by thoroughly reviewing CLAUDE.md and the feature's INITIAL.md
2. **Follow Patterns**: Use examples directory patterns or extract from existing codebase  
3. **Implement Systematically**: Follow the step-by-step requirements in INITIAL.md
4. **Test Continuously**: Run tests after each major implementation step
5. **Validate Early**: Use the validation script to catch issues early
6. **Document Changes**: Update context files with any new patterns discovered

**Remember**: The goal is not just working code, but production-ready, maintainable, and well-documented implementation that follows all project conventions.

`;

    return deliverables;
  }

  private extractSection(content: string, sectionHeader: string): string {
    const lines = content.split('\n');
    const startIndex = lines.findIndex(line => line.includes(sectionHeader));
    
    if (startIndex === -1) return '';
    
    const nextHeaderIndex = lines.findIndex((line, idx) => 
      idx > startIndex && line.match(/^#{1,3}\s/)
    );
    
    const endIndex = nextHeaderIndex === -1 ? lines.length : nextHeaderIndex;
    return lines.slice(startIndex + 1, endIndex).join('\n').trim();
  }

  private generateInitialMdTemplate(featureName: string, category: string): string {
    const title = featureName.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');

    return `# ${title} Feature

## Objective
Implement the ${title} feature for the FetchText document processing platform.

**Brief Description**: [Describe what this feature does and why it's needed]

## Current State
- [Describe current state of the codebase related to this feature]
- [List any existing components or services that need to be modified]
- [Note any dependencies or prerequisites]

## Desired Outcome
1. **Primary Goal**: [Main functionality to be implemented]
2. **User Experience**: [How users will interact with this feature]
3. **Technical Integration**: [How it fits into existing architecture]
4. **Performance**: [Any performance requirements or constraints]

## Detailed Requirements

### Functional Requirements
- [ ] [Requirement 1 - be specific and testable]
- [ ] [Requirement 2 - include acceptance criteria]
- [ ] [Requirement 3 - define expected behavior]

### Technical Requirements
- [ ] [Technical constraint or specification]
- [ ] [Integration requirement]
- [ ] [Performance requirement]

### User Experience Requirements
- [ ] [UI/UX requirement]
- [ ] [Accessibility requirement]
- [ ] [Mobile responsiveness requirement]

## Error Handling

1. **Expected Errors**
   - [Error condition 1]: [How to handle]
   - [Error condition 2]: [How to handle]

2. **Fallback Behavior**
   - [When primary method fails, do this]
   - [Graceful degradation strategy]

3. **User Communication**
   - [Clear error messages for users]
   - [Recovery instructions]

## Performance Requirements
- [Specific performance target, e.g., "Response time < 2 seconds"]
- [Throughput requirement, e.g., "Handle 100 concurrent requests"]
- [Resource usage limits]

## Success Criteria
- [ ] [Measurable success criterion 1]
- [ ] [Measurable success criterion 2]
- [ ] [Measurable success criterion 3]
- [ ] [Performance benchmarks met]
- [ ] [Error handling validated]
- [ ] [User acceptance criteria fulfilled]

## Implementation Notes

### Dependencies
- [External service dependencies]
- [Internal service dependencies]
- [Library or framework requirements]

### Integration Points
- [Services that need to be modified]
- [APIs that need to be called]
- [Database changes required]

### Testing Strategy
- [Unit testing approach]
- [Integration testing requirements]
- [E2E testing scenarios]

## Future Considerations
- [Potential enhancements]
- [Scalability considerations]
- [Maintenance requirements]

---

**Category**: ${category}
**Created**: ${new Date().toISOString()}
**Context Engineering Version**: 1.0
`;
  }

  /**
   * Generate PRP for an existing feature and save to file
   */
  savePRP(featureName: string, options: PRPOptions = {}): string {
    const prp = this.generatePRP(featureName, options);
    const outputPath = join(this.featuresDir, featureName, 'PRP.md');
    
    writeFileSync(outputPath, prp);
    console.log(`✅ PRP generated: ${outputPath}`);
    
    return outputPath;
  }

  /**
   * List all available features
   */
  listFeatures(): string[] {
    if (!existsSync(this.featuresDir)) {
      return [];
    }

    return require('fs').readdirSync(this.featuresDir)
      .filter((name: string) => {
        const featureDir = join(this.featuresDir, name);
        const initialMd = join(featureDir, 'INITIAL.md');
        return existsSync(initialMd);
      });
  }
}

// CLI execution
async function main() {
  const generator = new PRPGenerator();
  const args = process.argv.slice(2);
  const command = args[0];
  const featureName = args[1];

  try {
    switch (command) {
      case 'create':
        if (!featureName) {
          console.error('❌ Feature name required: npm run prp:create <feature-name>');
          process.exit(1);
        }
        const category = args[2] || 'General';
        generator.createFeatureStructure(featureName, category);
        break;

      case 'generate':
        if (!featureName) {
          console.error('❌ Feature name required: npm run prp:generate <feature-name>');
          process.exit(1);
        }
        
        const options: PRPOptions = {
          complexity: (args[2] as any) || 'moderate',
          priority: (args[3] as any) || 'medium',
          includeTests: true,
          includeDocumentation: args.includes('--docs'),
          includeErrorHandling: true
        };
        
        const prpPath = generator.savePRP(featureName, options);
        console.log('\\n📄 PRP generated successfully!');
        console.log('\\n🔗 Next steps:');
        console.log('1. Review the generated PRP file');
        console.log('2. Use it as context for AI implementation');
        console.log('3. Run validation after implementation');
        break;

      case 'list':
        const features = generator.listFeatures();
        if (features.length === 0) {
          console.log('No features found. Create one with: npm run prp:create <feature-name>');
        } else {
          console.log('\\n📋 Available features:');
          features.forEach(feature => console.log(`  - ${feature}`));
        }
        break;

      default:
        console.log(`
🎯 Product Requirements Prompt (PRP) Generator

Usage:
  npm run prp:create <feature-name> [category]     Create new feature structure
  npm run prp:generate <feature-name> [complexity] [priority]  Generate PRP
  npm run prp:list                                 List all features

Examples:
  npm run prp:create smart-templates Financial
  npm run prp:generate smart-templates complex high --docs
  npm run prp:list

Complexity levels: simple, moderate, complex
Priority levels: low, medium, high
        `);
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export type { PRPOptions };
export { PRPGenerator };