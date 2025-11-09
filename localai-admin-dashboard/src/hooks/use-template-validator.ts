/**
 * React hook for template validation
 */
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  templateValidator, 
  Template, 
  ValidationResult, 
  ValidationError, 
  ValidationWarning 
} from '@/lib/template-validator';

export interface UseTemplateValidatorResult {
  // Validation state
  validationResult: ValidationResult | null;
  isValidating: boolean;
  
  // Validation actions
  validate: (template: Partial<Template>) => Promise<ValidationResult>;
  validateAsync: (template: Partial<Template>) => Promise<ValidationResult>;
  clearValidation: () => void;
  
  // Auto-fix functionality
  autoFix: (template: Partial<Template>) => Promise<Template>;
  
  // Convenience getters
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  qualityScore: number;
  
  // Error/warning filters
  getErrorsByField: (field: string) => ValidationError[];
  getWarningsByField: (field: string) => ValidationWarning[];
  hasFieldErrors: (field: string) => boolean;
  hasFieldWarnings: (field: string) => boolean;
}

/**
 * Hook for template validation with real-time feedback
 */
export function useTemplateValidator(): UseTemplateValidatorResult {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  /**
   * Synchronous validation (now async)
   */
  const validate = useCallback(async (template: Partial<Template>): Promise<ValidationResult> => {
    const result = await templateValidator.validate(template);
    setValidationResult(result);
    return result;
  }, []);

  /**
   * Asynchronous validation (for future server-side validation)
   */
  const validateAsync = useCallback(async (template: Partial<Template>): Promise<ValidationResult> => {
    setIsValidating(true);
    
    try {
      // Simulate async validation (could be server-side in the future)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = await templateValidator.validate(template);
      setValidationResult(result);
      return result;
    } finally {
      setIsValidating(false);
    }
  }, []);

  /**
   * Clear validation results
   */
  const clearValidation = useCallback(() => {
    setValidationResult(null);
  }, []);

  /**
   * Auto-fix template issues
   */
  const autoFix = useCallback(async (template: Partial<Template>): Promise<Template> => {
    return await templateValidator.autoFix(template);
  }, []);

  /**
   * Get errors for specific field
   */
  const getErrorsByField = useCallback((field: string): ValidationError[] => {
    if (!validationResult) return [];
    return validationResult.errors.filter(error => 
      error.field === field || error.field.startsWith(`${field}.`)
    );
  }, [validationResult]);

  /**
   * Get warnings for specific field
   */
  const getWarningsByField = useCallback((field: string): ValidationWarning[] => {
    if (!validationResult) return [];
    return validationResult.warnings.filter(warning => 
      warning.field === field || warning.field.startsWith(`${field}.`)
    );
  }, [validationResult]);

  /**
   * Check if field has errors
   */
  const hasFieldErrors = useCallback((field: string): boolean => {
    return getErrorsByField(field).length > 0;
  }, [getErrorsByField]);

  /**
   * Check if field has warnings
   */
  const hasFieldWarnings = useCallback((field: string): boolean => {
    return getWarningsByField(field).length > 0;
  }, [getWarningsByField]);

  // Memoized convenience getters
  const isValid = useMemo(() => validationResult?.isValid ?? false, [validationResult]);
  const errors = useMemo(() => validationResult?.errors ?? [], [validationResult]);
  const warnings = useMemo(() => validationResult?.warnings ?? [], [validationResult]);
  const qualityScore = useMemo(() => validationResult?.score ?? 0, [validationResult]);

  return {
    // State
    validationResult,
    isValidating,
    
    // Actions
    validate,
    validateAsync,
    clearValidation,
    autoFix,
    
    // Convenience getters
    isValid,
    errors,
    warnings,
    qualityScore,
    
    // Field-specific helpers
    getErrorsByField,
    getWarningsByField,
    hasFieldErrors,
    hasFieldWarnings
  };
}

/**
 * Hook for real-time template validation
 * Automatically validates when template changes
 */
export function useRealtimeTemplateValidation(
  template: Partial<Template> | null,
  options: {
    debounceMs?: number;
    validateOnMount?: boolean;
    enabled?: boolean;
  } = {}
): UseTemplateValidatorResult {
  const {
    debounceMs = 500,
    validateOnMount = true,
    enabled = true
  } = options;

  const validator = useTemplateValidator();

  // Debounced validation effect
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedValidate = useCallback((templateToValidate: Partial<Template>) => {
    if (!enabled) return;

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(async () => {
      await validator.validate(templateToValidate);
    }, debounceMs);
  }, [enabled, debounceMs, validator]);

  // Effect to validate when template changes
  useEffect(() => {
    if (!template) {
      validator.clearValidation();
      return;
    }

    debouncedValidate(template);

    // Cleanup timer on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [template, debouncedValidate, validator]);

  return validator;
}

/**
 * Validation summary component helpers
 */
export function getValidationSummary(result: ValidationResult | null): {
  hasIssues: boolean;
  errorCount: number;
  warningCount: number;
  qualityScore: number;
  qualityLevel: 'excellent' | 'good' | 'fair' | 'poor';
  summary: string;
} {
  if (!result) {
    return {
      hasIssues: false,
      errorCount: 0,
      warningCount: 0,
      qualityScore: 0,
      qualityLevel: 'poor',
      summary: 'No validation performed'
    };
  }

  const errorCount = result.errors.length;
  const warningCount = result.warnings.length;
  const qualityScore = result.score;

  let qualityLevel: 'excellent' | 'good' | 'fair' | 'poor';
  if (qualityScore >= 90) qualityLevel = 'excellent';
  else if (qualityScore >= 75) qualityLevel = 'good';
  else if (qualityScore >= 60) qualityLevel = 'fair';
  else qualityLevel = 'poor';

  let summary = '';
  if (errorCount === 0 && warningCount === 0) {
    summary = 'Template is valid and ready to use';
  } else if (errorCount > 0) {
    summary = `${errorCount} error${errorCount !== 1 ? 's' : ''} must be fixed`;
    if (warningCount > 0) {
      summary += ` and ${warningCount} warning${warningCount !== 1 ? 's' : ''}`;
    }
  } else {
    summary = `${warningCount} warning${warningCount !== 1 ? 's' : ''} to consider`;
  }

  return {
    hasIssues: errorCount > 0 || warningCount > 0,
    errorCount,
    warningCount,
    qualityScore,
    qualityLevel,
    summary
  };
}