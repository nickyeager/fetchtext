#!/usr/bin/env ts-node
/**
 * Context Engineering Validation Workflow
 * 
 * This script validates feature implementations against their Context Engineering requirements.
 * It checks INITIAL.md files, runs tests, and validates against success criteria.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { execSync } from 'child_process';

interface ValidationResult {
  feature: string;
  status: 'pass' | 'fail' | 'warning';
  score: number;
  details: ValidationDetail[];
}

interface ValidationDetail {
  check: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  severity: 'critical' | 'major' | 'minor';
}

interface FeatureRequirements {
  name: string;
  objective: string;
  successCriteria: string[];
  implementationRequirements: string[];
  errorHandling: string[];
  performanceRequirements: string[];
}

class ContextEngineeringValidator {
  private readonly projectRoot: string;
  private readonly featuresDir: string;

  constructor() {
    this.projectRoot = resolve(__dirname, '..');
    this.featuresDir = join(this.projectRoot, 'features');
  }

  async validateFeature(featureName: string): Promise<ValidationResult> {
    console.log(`🔍 Validating ${featureName} implementation...`);

    const result: ValidationResult = {
      feature: featureName,
      status: 'pass',
      score: 100,
      details: []
    };

    try {
      // Load feature requirements
      const requirements = this.loadFeatureRequirements(featureName);
      
      // Run validation checks
      await this.validateContextFiles(featureName, result);
      await this.validateImplementation(featureName, requirements, result);
      await this.validateTests(featureName, result);
      await this.validateSuccessCriteria(featureName, requirements, result);
      await this.validatePerformance(featureName, requirements, result);

      // Calculate final score and status
      this.calculateFinalScore(result);

    } catch (error) {
      result.details.push({
        check: 'validation-setup',
        status: 'fail',
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical'
      });
      result.status = 'fail';
      result.score = 0;
    }

    return result;
  }

  private loadFeatureRequirements(featureName: string): FeatureRequirements {
    const initialMdPath = join(this.featuresDir, featureName, 'INITIAL.md');
    
    if (!existsSync(initialMdPath)) {
      throw new Error(`INITIAL.md not found for feature: ${featureName}`);
    }

    const content = readFileSync(initialMdPath, 'utf-8');
    
    // Parse the INITIAL.md file to extract requirements
    return {
      name: featureName,
      objective: this.extractSection(content, '## Objective'),
      successCriteria: this.extractListItems(content, '### Success Criteria'),
      implementationRequirements: this.extractListItems(content, '## Implementation Requirements', '## Detailed Requirements'),
      errorHandling: this.extractListItems(content, '### Error Handling'),
      performanceRequirements: this.extractListItems(content, '### Performance Requirements')
    };
  }

  private extractSection(content: string, sectionHeader: string): string {
    const lines = content.split('\n');
    const startIndex = lines.findIndex(line => line.includes(sectionHeader));
    
    if (startIndex === -1) return '';
    
    const nextHeaderIndex = lines.findIndex((line, idx) => 
      idx > startIndex && line.startsWith('##') && !line.includes(sectionHeader)
    );
    
    const endIndex = nextHeaderIndex === -1 ? lines.length : nextHeaderIndex;
    return lines.slice(startIndex + 1, endIndex).join('\n').trim();
  }

  private extractListItems(content: string, startHeader: string, endHeader?: string): string[] {
    const lines = content.split('\n');
    const startIndex = lines.findIndex(line => line.includes(startHeader));
    
    if (startIndex === -1) return [];
    
    const endIndex = endHeader 
      ? lines.findIndex((line, idx) => idx > startIndex && line.includes(endHeader))
      : lines.length;
    
    const sectionLines = lines.slice(startIndex + 1, endIndex === -1 ? lines.length : endIndex);
    
    return sectionLines
      .filter(line => line.trim().startsWith('- [ ]') || line.trim().startsWith('- ✅'))
      .map(line => line.trim().replace(/^- \[.\]\s*/, ''));
  }

  private async validateContextFiles(featureName: string, result: ValidationResult): Promise<void> {
    const featureDir = join(this.featuresDir, featureName);
    
    // Check for INITIAL.md
    const initialMdExists = existsSync(join(featureDir, 'INITIAL.md'));
    result.details.push({
      check: 'initial-md-exists',
      status: initialMdExists ? 'pass' : 'fail',
      message: initialMdExists ? 'INITIAL.md found' : 'INITIAL.md missing',
      severity: 'critical'
    });

    // Check for examples directory
    const examplesDir = join(featureDir, 'examples');
    const examplesExist = existsSync(examplesDir);
    result.details.push({
      check: 'examples-exist',
      status: examplesExist ? 'pass' : 'warning',
      message: examplesExist ? 'Examples directory found' : 'Examples directory missing - consider adding implementation patterns',
      severity: 'minor'
    });

    if (examplesExist) {
      const exampleFiles = readdirSync(examplesDir);
      result.details.push({
        check: 'examples-populated',
        status: exampleFiles.length > 0 ? 'pass' : 'warning',
        message: `Found ${exampleFiles.length} example files`,
        severity: 'minor'
      });
    }

    // Check for validation directory
    const validationDir = join(featureDir, 'validation');
    const validationExists = existsSync(validationDir);
    result.details.push({
      check: 'validation-rules-exist',
      status: validationExists ? 'pass' : 'warning',
      message: validationExists ? 'Validation directory found' : 'Validation rules missing - consider adding automated validation',
      severity: 'minor'
    });
  }

  private async validateImplementation(featureName: string, requirements: FeatureRequirements, result: ValidationResult): Promise<void> {
    // Look for implementation files based on feature name
    const possibleDirs = [
      join(this.projectRoot, 'dashboard', 'src', 'features', featureName),
      join(this.projectRoot, 'dashboard', 'src', 'lib'),
      join(this.projectRoot, 'document-processor', 'app', 'services'),
    ];

    let implementationFound = false;
    
    for (const dir of possibleDirs) {
      if (existsSync(dir)) {
        const files = this.findImplementationFiles(dir, featureName);
        if (files.length > 0) {
          implementationFound = true;
          
          result.details.push({
            check: 'implementation-files-found',
            status: 'pass',
            message: `Found ${files.length} implementation files: ${files.join(', ')}`,
            severity: 'major'
          });

          // Validate error handling patterns
          this.validateErrorHandling(files, requirements.errorHandling, result);
          break;
        }
      }
    }

    if (!implementationFound) {
      result.details.push({
        check: 'implementation-files-found',
        status: 'fail',
        message: 'No implementation files found matching feature name',
        severity: 'critical'
      });
    }
  }

  private findImplementationFiles(dir: string, featureName: string): string[] {
    if (!existsSync(dir)) return [];
    
    const files = readdirSync(dir, { recursive: true, withFileTypes: true });
    const searchTerms = [
      featureName.toLowerCase(),
      featureName.replace(/-/g, '_'),
      featureName.replace(/_/g, '-')
    ];

    return files
      .filter(file => file.isFile() && (file.name.endsWith('.ts') || file.name.endsWith('.tsx') || file.name.endsWith('.py')))
      .map(file => join(file.parentPath || dir, file.name))
      .filter(filePath => {
        const fileName = filePath.toLowerCase();
        return searchTerms.some(term => fileName.includes(term));
      });
  }

  private validateErrorHandling(implementationFiles: string[], errorRequirements: string[], result: ValidationResult): void {
    const errorPatterns = [
      'try.*catch',
      'throw new Error',
      'console.error',
      'logger.error',
      '.catch\\(',
      'fallback',
      'retry'
    ];

    let errorHandlingFound = false;

    for (const file of implementationFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        const hasErrorHandling = errorPatterns.some(pattern => 
          new RegExp(pattern, 'i').test(content)
        );
        
        if (hasErrorHandling) {
          errorHandlingFound = true;
          break;
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    result.details.push({
      check: 'error-handling-implemented',
      status: errorHandlingFound ? 'pass' : 'warning',
      message: errorHandlingFound ? 'Error handling patterns found' : 'Limited error handling detected',
      severity: 'major'
    });
  }

  private async validateTests(featureName: string, result: ValidationResult): Promise<void> {
    const testDirs = [
      join(this.projectRoot, 'dashboard', 'src', '__tests__'),
      join(this.projectRoot, 'dashboard', 'src', 'features', featureName, '__tests__'),
      join(this.projectRoot, 'document-processor', 'tests'),
    ];

    let testFilesFound = 0;

    for (const testDir of testDirs) {
      if (existsSync(testDir)) {
        const testFiles = readdirSync(testDir, { recursive: true })
          .filter(file => typeof file === 'string' && (
            file.includes(featureName) || 
            file.includes(featureName.replace(/-/g, '_'))
          ))
          .filter(file => typeof file === 'string' && (file.endsWith('.test.ts') || file.endsWith('.test.tsx') || file.endsWith('.test.py')));
        
        testFilesFound += testFiles.length;
      }
    }

    result.details.push({
      check: 'tests-exist',
      status: testFilesFound > 0 ? 'pass' : 'warning',
      message: `Found ${testFilesFound} test files for feature`,
      severity: 'major'
    });

    // Try to run tests if they exist
    if (testFilesFound > 0) {
      try {
        // Run frontend tests
        const frontendTestDir = join(this.projectRoot, 'dashboard');
        if (existsSync(frontendTestDir)) {
          execSync('pnpm test', { cwd: frontendTestDir, stdio: 'pipe' });
          result.details.push({
            check: 'tests-passing',
            status: 'pass',
            message: 'Frontend tests are passing',
            severity: 'major'
          });
        }
      } catch (error) {
        result.details.push({
          check: 'tests-passing',
          status: 'fail',
          message: 'Some tests are failing',
          severity: 'major'
        });
      }
    }
  }

  private async validateSuccessCriteria(featureName: string, requirements: FeatureRequirements, result: ValidationResult): Promise<void> {
    // This would ideally run functional tests against the success criteria
    // For now, we'll do a basic check that success criteria are defined
    
    if (requirements.successCriteria.length === 0) {
      result.details.push({
        check: 'success-criteria-defined',
        status: 'fail',
        message: 'No success criteria defined in INITIAL.md',
        severity: 'major'
      });
      return;
    }

    result.details.push({
      check: 'success-criteria-defined',
      status: 'pass',
      message: `${requirements.successCriteria.length} success criteria defined`,
      severity: 'major'
    });

    // Check if criteria are testable (contain measurable terms)
    const measurableTerms = ['<', '>', 'seconds', 'milliseconds', '%', 'accuracy', 'complete'];
    const measurableCriteria = requirements.successCriteria.filter(criteria =>
      measurableTerms.some(term => criteria.toLowerCase().includes(term))
    );

    result.details.push({
      check: 'success-criteria-measurable',
      status: measurableCriteria.length > 0 ? 'pass' : 'warning',
      message: `${measurableCriteria.length}/${requirements.successCriteria.length} criteria are measurable`,
      severity: 'minor'
    });
  }

  private async validatePerformance(featureName: string, requirements: FeatureRequirements, result: ValidationResult): Promise<void> {
    if (requirements.performanceRequirements.length === 0) {
      result.details.push({
        check: 'performance-requirements',
        status: 'warning',
        message: 'No performance requirements specified',
        severity: 'minor'
      });
      return;
    }

    result.details.push({
      check: 'performance-requirements',
      status: 'pass',
      message: `${requirements.performanceRequirements.length} performance requirements defined`,
      severity: 'minor'
    });

    // TODO: Implement actual performance testing
    // This would run performance benchmarks and validate against requirements
  }

  private calculateFinalScore(result: ValidationResult): void {
    let totalWeight = 0;
    let weightedScore = 0;

    const weights = {
      critical: 40,
      major: 20,
      minor: 5
    };

    for (const detail of result.details) {
      const weight = weights[detail.severity];
      totalWeight += weight;

      if (detail.status === 'pass') {
        weightedScore += weight;
      } else if (detail.status === 'warning') {
        weightedScore += weight * 0.5;
      }
      // fail contributes 0 to score
    }

    result.score = totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) : 0;
    
    if (result.score >= 80) {
      result.status = 'pass';
    } else if (result.score >= 60) {
      result.status = 'warning';
    } else {
      result.status = 'fail';
    }
  }

  generateReport(results: ValidationResult[]): string {
    let report = '# Context Engineering Validation Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;

    // Summary
    const totalFeatures = results.length;
    const passedFeatures = results.filter(r => r.status === 'pass').length;
    const warningFeatures = results.filter(r => r.status === 'warning').length;
    const failedFeatures = results.filter(r => r.status === 'fail').length;

    report += '## Summary\n\n';
    report += `- **Total Features**: ${totalFeatures}\n`;
    report += `- **Passed**: ${passedFeatures} ✅\n`;
    report += `- **Warnings**: ${warningFeatures} ⚠️\n`;
    report += `- **Failed**: ${failedFeatures} ❌\n\n`;

    // Individual feature results
    for (const result of results) {
      const statusEmoji = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
      
      report += `## ${result.feature} ${statusEmoji}\n\n`;
      report += `**Score**: ${result.score}/100\n\n`;

      for (const detail of result.details) {
        const detailEmoji = detail.status === 'pass' ? '✅' : detail.status === 'warning' ? '⚠️' : '❌';
        report += `- ${detailEmoji} **${detail.check}**: ${detail.message}\n`;
      }
      
      report += '\n';
    }

    return report;
  }

  async validateAllFeatures(): Promise<ValidationResult[]> {
    if (!existsSync(this.featuresDir)) {
      console.log('No features directory found. Creating example...');
      return [];
    }

    const featureNames = readdirSync(this.featuresDir)
      .filter(name => existsSync(join(this.featuresDir, name, 'INITIAL.md')));

    const results: ValidationResult[] = [];

    for (const featureName of featureNames) {
      const result = await this.validateFeature(featureName);
      results.push(result);
    }

    return results;
  }
}

// CLI execution
async function main() {
  const validator = new ContextEngineeringValidator();
  
  const args = process.argv.slice(2);
  const featureName = args[0];

  try {
    if (featureName) {
      // Validate specific feature
      const result = await validator.validateFeature(featureName);
      console.log('\n📊 Validation Results:\n');
      console.log(validator.generateReport([result]));
    } else {
      // Validate all features
      console.log('🔍 Validating all features...\n');
      const results = await validator.validateAllFeatures();
      
      if (results.length === 0) {
        console.log('No features found with INITIAL.md files.');
        console.log('Create features using the Context Engineering methodology:');
        console.log('1. Create features/<feature-name>/INITIAL.md');
        console.log('2. Run validation: npm run validate <feature-name>');
        return;
      }

      console.log('📊 Validation Results:\n');
      console.log(validator.generateReport(results));
    }
  } catch (error) {
    console.error('❌ Validation failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export type { ValidationResult, ValidationDetail };
export { ContextEngineeringValidator };