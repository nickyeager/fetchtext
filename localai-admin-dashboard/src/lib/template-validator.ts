/**
 * Template Validation System
 * Validates template structure and data before saving
 * 
 * Note: Templates are flexible and dynamic. Categories (invoice, contract, etc.) 
 * are for organization only and do NOT enforce specific required fields.
 * Users can create templates with any custom fields they need.
 */

export interface SmartVariable {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'percentage' | 'email' | 'phone';
  description: string;
  extraction_hints: string[];
  default_value?: any;
  validation_rules?: {
    required?: boolean;
    pattern?: string;
    min?: number;
    max?: number;
  };
  confidence_threshold: number;
}

export interface Template {
  id?: string;
  name: string;
  category: string;
  description?: string;
  smart_variables: SmartVariable[];
  created_at?: string;
  updated_at?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  score: number; // 0-100 quality score
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error';
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  severity: 'warning';
  code: string;
  suggestion?: string;
}

/**
 * Template Validator Class
 */
export class TemplateValidator {
  private readonly REQUIRED_FIELDS = ['name', 'category', 'smart_variables'];
  private readonly VALID_TYPES = ['text', 'number', 'date', 'currency', 'percentage', 'email', 'phone'];
  private readonly VALID_CATEGORIES = [
    'invoice', 'contract', 'receipt', 'report', 'correspondence', 
    'legal', 'financial', 'technical', 'form', 'general'
  ];

  /**
   * Validate a complete template
   */
  validate(template: Partial<Template>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic structure validation
    this.validateBasicStructure(template, errors);
    
    // Template metadata validation
    this.validateMetadata(template, errors, warnings);
    
    // Smart variables validation
    if (template.smart_variables) {
      this.validateSmartVariables(template.smart_variables, errors, warnings);
    }

    // Category-specific validation
    if (template.category) {
      this.validateCategorySpecific(template, errors, warnings);
    }

    // Calculate quality score
    const score = this.calculateQualityScore(template, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score
    };
  }

  /**
   * Validate basic template structure
   */
  private validateBasicStructure(template: Partial<Template>, errors: ValidationError[]): void {
    // Check required fields
    for (const field of this.REQUIRED_FIELDS) {
      if (!template[field as keyof Template]) {
        errors.push({
          field,
          message: `${field} is required`,
          severity: 'error',
          code: 'REQUIRED_FIELD_MISSING'
        });
      }
    }

    // Check data types
    if (template.name && typeof template.name !== 'string') {
      errors.push({
        field: 'name',
        message: 'Name must be a string',
        severity: 'error',
        code: 'INVALID_DATA_TYPE'
      });
    }

    if (template.smart_variables && !Array.isArray(template.smart_variables)) {
      errors.push({
        field: 'smart_variables',
        message: 'Smart variables must be an array',
        severity: 'error',
        code: 'INVALID_DATA_TYPE'
      });
    }
  }

  /**
   * Validate template metadata
   */
  private validateMetadata(
    template: Partial<Template>, 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): void {
    // Name validation
    if (template.name) {
      if (template.name.length < 3) {
        errors.push({
          field: 'name',
          message: 'Name must be at least 3 characters long',
          severity: 'error',
          code: 'NAME_TOO_SHORT'
        });
      }

      if (template.name.length > 100) {
        errors.push({
          field: 'name',
          message: 'Name must be less than 100 characters',
          severity: 'error',
          code: 'NAME_TOO_LONG'
        });
      }

      // Check for descriptive name
      if (template.name.toLowerCase().includes('untitled') || 
          template.name.toLowerCase().includes('template') ||
          /^template\s*\d*$/i.test(template.name)) {
        warnings.push({
          field: 'name',
          message: 'Consider using a more descriptive template name',
          severity: 'warning',
          code: 'GENERIC_NAME',
          suggestion: 'Use a name that describes the document type or purpose'
        });
      }
    }

    // Category validation
    if (template.category) {
      if (!this.VALID_CATEGORIES.includes(template.category)) {
        warnings.push({
          field: 'category',
          message: `Category '${template.category}' is not a standard category`,
          severity: 'warning',
          code: 'UNUSUAL_CATEGORY',
          suggestion: `Consider using one of: ${this.VALID_CATEGORIES.join(', ')}`
        });
      }
    }

    // Description validation
    if (template.description && template.description.length > 500) {
      warnings.push({
        field: 'description',
        message: 'Description is very long, consider making it more concise',
        severity: 'warning',
        code: 'DESCRIPTION_TOO_LONG'
      });
    }
  }

  /**
   * Validate smart variables array
   */
  private validateSmartVariables(
    variables: SmartVariable[], 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): void {
    if (variables.length === 0) {
      errors.push({
        field: 'smart_variables',
        message: 'Template must have at least one smart variable',
        severity: 'error',
        code: 'NO_VARIABLES'
      });
      return;
    }

    if (variables.length > 50) {
      warnings.push({
        field: 'smart_variables',
        message: 'Template has many variables, consider grouping related fields',
        severity: 'warning',
        code: 'TOO_MANY_VARIABLES'
      });
    }

    // Validate each variable
    const usedIds = new Set<string>();
    variables.forEach((variable, index) => {
      this.validateSmartVariable(variable, index, usedIds, errors, warnings);
    });
  }

  /**
   * Validate individual smart variable
   */
  private validateSmartVariable(
    variable: SmartVariable,
    index: number,
    usedIds: Set<string>,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const fieldPrefix = `smart_variables[${index}]`;

    // Required fields
    const requiredVarFields = ['id', 'name', 'type', 'description', 'extraction_hints', 'confidence_threshold'];
    for (const field of requiredVarFields) {
      if (!variable[field as keyof SmartVariable]) {
        errors.push({
          field: `${fieldPrefix}.${field}`,
          message: `Variable ${field} is required`,
          severity: 'error',
          code: 'VARIABLE_REQUIRED_FIELD'
        });
      }
    }

    // ID validation
    if (variable.id) {
      // Check uniqueness
      if (usedIds.has(variable.id)) {
        errors.push({
          field: `${fieldPrefix}.id`,
          message: `Variable ID '${variable.id}' must be unique`,
          severity: 'error',
          code: 'DUPLICATE_VARIABLE_ID'
        });
      }
      usedIds.add(variable.id);

      // Check format (snake_case)
      if (!/^[a-z][a-z0-9_]*[a-z0-9]$/.test(variable.id)) {
        errors.push({
          field: `${fieldPrefix}.id`,
          message: 'Variable ID must be in snake_case format',
          severity: 'error',
          code: 'INVALID_VARIABLE_ID_FORMAT'
        });
      }
    }

    // Type validation
    if (variable.type && !this.VALID_TYPES.includes(variable.type)) {
      errors.push({
        field: `${fieldPrefix}.type`,
        message: `Invalid variable type '${variable.type}'`,
        severity: 'error',
        code: 'INVALID_VARIABLE_TYPE'
      });
    }

    // Name validation
    if (variable.name) {
      if (variable.name.length < 2) {
        errors.push({
          field: `${fieldPrefix}.name`,
          message: 'Variable name must be at least 2 characters',
          severity: 'error',
          code: 'VARIABLE_NAME_TOO_SHORT'
        });
      }
    }

    // Description validation
    if (variable.description) {
      if (variable.description.length < 5) {
        warnings.push({
          field: `${fieldPrefix}.description`,
          message: 'Variable description should be more descriptive',
          severity: 'warning',
          code: 'VARIABLE_DESCRIPTION_TOO_SHORT'
        });
      }
    }

    // Extraction hints validation
    if (variable.extraction_hints) {
      if (variable.extraction_hints.length < 2) {
        warnings.push({
          field: `${fieldPrefix}.extraction_hints`,
          message: 'Variable should have at least 2 extraction hints',
          severity: 'warning',
          code: 'INSUFFICIENT_EXTRACTION_HINTS'
        });
      }

      // Check for empty hints
      const emptyHints = variable.extraction_hints.filter(hint => !hint.trim());
      if (emptyHints.length > 0) {
        errors.push({
          field: `${fieldPrefix}.extraction_hints`,
          message: 'Extraction hints cannot be empty',
          severity: 'error',
          code: 'EMPTY_EXTRACTION_HINTS'
        });
      }
    }

    // Confidence threshold validation
    if (variable.confidence_threshold !== undefined) {
      if (variable.confidence_threshold < 0 || variable.confidence_threshold > 1) {
        errors.push({
          field: `${fieldPrefix}.confidence_threshold`,
          message: 'Confidence threshold must be between 0 and 1',
          severity: 'error',
          code: 'INVALID_CONFIDENCE_THRESHOLD'
        });
      }

      if (variable.confidence_threshold < 0.3) {
        warnings.push({
          field: `${fieldPrefix}.confidence_threshold`,
          message: 'Very low confidence threshold may result in poor extraction',
          severity: 'warning',
          code: 'LOW_CONFIDENCE_THRESHOLD'
        });
      }
    }

    // Validation rules validation
    if (variable.validation_rules) {
      this.validateValidationRules(variable.validation_rules, fieldPrefix, variable.type, errors, warnings);
    }

    // Type-specific validation
    this.validateVariableByType(variable, fieldPrefix, errors, warnings);
  }

  /**
   * Validate validation rules
   */
  private validateValidationRules(
    rules: NonNullable<SmartVariable['validation_rules']>,
    fieldPrefix: string,
    variableType: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Pattern validation
    if (rules.pattern) {
      try {
        new RegExp(rules.pattern);
      } catch (e) {
        errors.push({
          field: `${fieldPrefix}.validation_rules.pattern`,
          message: 'Invalid regular expression pattern',
          severity: 'error',
          code: 'INVALID_REGEX_PATTERN'
        });
      }
    }

    // Min/max validation for numbers
    if (variableType === 'number' || variableType === 'currency' || variableType === 'percentage') {
      if (rules.min !== undefined && rules.max !== undefined && rules.min > rules.max) {
        errors.push({
          field: `${fieldPrefix}.validation_rules`,
          message: 'Minimum value cannot be greater than maximum value',
          severity: 'error',
          code: 'INVALID_MIN_MAX_RANGE'
        });
      }
    }
  }

  /**
   * Type-specific variable validation
   */
  private validateVariableByType(
    variable: SmartVariable,
    fieldPrefix: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    switch (variable.type) {
      case 'email':
        if (variable.validation_rules?.pattern && 
            !variable.validation_rules.pattern.includes('@')) {
          warnings.push({
            field: `${fieldPrefix}.validation_rules.pattern`,
            message: 'Email pattern should include @ symbol',
            severity: 'warning',
            code: 'EMAIL_PATTERN_MISSING_AT'
          });
        }
        break;

      case 'phone':
        if (variable.validation_rules?.pattern && 
            !variable.validation_rules.pattern.includes('\\d')) {
          warnings.push({
            field: `${fieldPrefix}.validation_rules.pattern`,
            message: 'Phone pattern should include digit matching',
            severity: 'warning',
            code: 'PHONE_PATTERN_NO_DIGITS'
          });
        }
        break;

      case 'currency':
        if (variable.default_value && typeof variable.default_value !== 'number') {
          errors.push({
            field: `${fieldPrefix}.default_value`,
            message: 'Currency default value must be a number',
            severity: 'error',
            code: 'INVALID_CURRENCY_DEFAULT'
          });
        }
        break;

      case 'date':
        if (variable.default_value && 
            !(variable.default_value instanceof Date) && 
            !this.isValidDateString(variable.default_value)) {
          warnings.push({
            field: `${fieldPrefix}.default_value`,
            message: 'Date default value should be a valid date format',
            severity: 'warning',
            code: 'INVALID_DATE_DEFAULT'
          });
        }
        break;
    }
  }

  /**
   * Category-specific validation
   */
  private validateCategorySpecific(
    template: Partial<Template>,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Removed hardcoded field requirements - templates should be flexible and dynamic
    // Categories are now just for organization, not for enforcing specific fields
    return;
  }

  // Removed checkRequiredCategoryFields - templates should be flexible without hardcoded field requirements

  /**
   * Calculate template quality score
   */
  private calculateQualityScore(
    template: Partial<Template>,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): number {
    let score = 100;

    // Deduct for errors (major issues)
    score -= errors.length * 15;

    // Deduct for warnings (minor issues)
    score -= warnings.length * 5;

    // Bonus points for good practices
    if (template.description && template.description.length > 10) {
      score += 5;
    }

    if (template.smart_variables && template.smart_variables.length >= 3) {
      score += 5;
    }

    // Bonus for comprehensive extraction hints
    if (template.smart_variables) {
      const avgHints = template.smart_variables.reduce(
        (sum, v) => sum + (v.extraction_hints?.length || 0), 0
      ) / template.smart_variables.length;
      
      if (avgHints >= 3) {
        score += 10;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Auto-fix common template issues
   */
  autoFix(template: Partial<Template>): Template {
    const fixed = { ...template } as Template;

    // Fix missing required fields with defaults
    if (!fixed.name) {
      fixed.name = 'Untitled Template';
    }

    if (!fixed.category) {
      fixed.category = 'general';
    }

    if (!fixed.smart_variables) {
      fixed.smart_variables = [];
    }

    // Fix variable IDs to snake_case
    fixed.smart_variables = fixed.smart_variables.map(variable => ({
      ...variable,
      id: this.toSnakeCase(variable.id || variable.name || 'unnamed_field')
    }));

    // Add missing extraction hints
    fixed.smart_variables = fixed.smart_variables.map(variable => ({
      ...variable,
      extraction_hints: variable.extraction_hints && variable.extraction_hints.length > 0
        ? variable.extraction_hints
        : this.generateDefaultExtractionHints(variable)
    }));

    // Set default confidence thresholds
    fixed.smart_variables = fixed.smart_variables.map(variable => ({
      ...variable,
      confidence_threshold: variable.confidence_threshold ?? 0.5
    }));

    return fixed;
  }

  /**
   * Generate default extraction hints for a variable
   */
  private generateDefaultExtractionHints(variable: SmartVariable): string[] {
    const name = variable.name?.toLowerCase() || '';
    const type = variable.type || 'text';

    const hints = [variable.name || 'field'];

    // Add type-specific hints
    switch (type) {
      case 'date':
        hints.push('date', 'when', 'time');
        break;
      case 'currency':
        hints.push('amount', 'total', 'cost', 'price');
        break;
      case 'email':
        hints.push('email', 'contact', '@');
        break;
      case 'phone':
        hints.push('phone', 'tel', 'number');
        break;
    }

    // Add name-based hints
    if (name.includes('name')) {
      hints.push('name', 'named', 'called');
    }
    if (name.includes('address')) {
      hints.push('address', 'location', 'located');
    }

    return hints.slice(0, 3); // Return first 3 unique hints
  }

  /**
   * Convert string to snake_case
   */
  private toSnakeCase(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');
  }

  /**
   * Check if string is valid date
   */
  private isValidDateString(str: any): boolean {
    if (typeof str !== 'string') return false;
    const date = new Date(str);
    return !isNaN(date.getTime());
  }
}

// Export singleton instance
export const templateValidator = new TemplateValidator();