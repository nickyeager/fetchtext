// Validation rules for Document Gallery feature
// These rules ensure the implementation meets all requirements

export interface GalleryValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  score: number;
}

export class DocumentGalleryValidator {
  
  /**
   * Validate document gallery implementation
   */
  static validateImplementation(galleryComponent: any): GalleryValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    // Check required props and functionality
    if (!galleryComponent) {
      errors.push('Gallery component is required');
      return { valid: false, errors, warnings, score: 0 };
    }

    // Validate data fetching
    score -= this.validateDataFetching(galleryComponent, errors, warnings);
    
    // Validate UI components
    score -= this.validateUIComponents(galleryComponent, errors, warnings);
    
    // Validate search and filtering
    score -= this.validateSearchAndFilter(galleryComponent, errors, warnings);
    
    // Validate error handling
    score -= this.validateErrorHandling(galleryComponent, errors, warnings);
    
    // Validate performance considerations
    score -= this.validatePerformance(galleryComponent, errors, warnings);
    
    // Validate accessibility
    score -= this.validateAccessibility(galleryComponent, errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      score: Math.max(0, score)
    };
  }

  private static validateDataFetching(component: any, errors: string[], warnings: string[]): number {
    let deduction = 0;

    // Check for TanStack Query usage
    if (!component.useQuery && !component.useDocuments) {
      errors.push('Must use TanStack Query for data fetching');
      deduction += 15;
    }

    // Check for real-time subscriptions
    if (!component.useDocumentSubscription && !component.subscription) {
      warnings.push('Consider implementing real-time updates via Supabase subscriptions');
      deduction += 5;
    }

    // Check for proper error handling in queries
    if (!component.error && !component.queryError) {
      warnings.push('Query error handling should be implemented');
      deduction += 5;
    }

    // Check for loading states
    if (!component.isLoading && !component.loading) {
      errors.push('Loading states must be properly handled');
      deduction += 10;
    }

    return deduction;
  }

  private static validateUIComponents(component: any, errors: string[], warnings: string[]): number {
    let deduction = 0;

    // Check for shadcn/ui component usage
    const requiredComponents = ['Card', 'Button', 'Badge', 'Input', 'Select'];
    const missingComponents = requiredComponents.filter(comp => 
      !component.imports?.includes(comp) && !component.dependencies?.includes(comp)
    );

    if (missingComponents.length > 0) {
      warnings.push(`Consider using shadcn/ui components: ${missingComponents.join(', ')}`);
      deduction += missingComponents.length * 2;
    }

    // Check for responsive design
    if (!component.responsive && !component.className?.includes('grid')) {
      warnings.push('Implement responsive grid layout for different screen sizes');
      deduction += 5;
    }

    // Check for proper document card structure
    if (!component.DocumentCard && !component.documentCard) {
      errors.push('Document card component is required');
      deduction += 15;
    }

    return deduction;
  }

  private static validateSearchAndFilter(component: any, errors: string[], warnings: string[]): number {
    let deduction = 0;

    // Check for search functionality
    if (!component.search && !component.onSearchChange) {
      errors.push('Search functionality is required');
      deduction += 10;
    }

    // Check for debounced search
    if (!component.debounce && !component.debouncedSearch) {
      warnings.push('Search should be debounced to improve performance');
      deduction += 5;
    }

    // Check for status filtering
    if (!component.statusFilter && !component.filterByStatus) {
      errors.push('Status filtering is required');
      deduction += 10;
    }

    // Check for file type filtering
    if (!component.fileTypeFilter && !component.filterByFileType) {
      warnings.push('File type filtering should be implemented');
      deduction += 5;
    }

    // Check for date range filtering
    if (!component.dateFilter && !component.dateRange) {
      warnings.push('Date range filtering enhances user experience');
      deduction += 3;
    }

    return deduction;
  }

  private static validateErrorHandling(component: any, errors: string[], warnings: string[]): number {
    let deduction = 0;

    // Check for network error handling
    if (!component.errorBoundary && !component.errorHandling) {
      errors.push('Error handling for network failures is required');
      deduction += 10;
    }

    // Check for empty state handling
    if (!component.emptyState && !component.noDocuments) {
      errors.push('Empty state handling is required');
      deduction += 8;
    }

    // Check for permission error handling
    if (!component.permissionError && !component.authError) {
      warnings.push('Permission error handling should be implemented');
      deduction += 5;
    }

    // Check for retry mechanisms
    if (!component.retry && !component.refetch) {
      warnings.push('Retry mechanism improves user experience');
      deduction += 3;
    }

    return deduction;
  }

  private static validatePerformance(component: any, errors: string[], warnings: string[]): number {
    let deduction = 0;

    // Check for pagination
    if (!component.pagination && !component.infiniteScroll) {
      errors.push('Pagination or infinite scroll is required for performance');
      deduction += 15;
    }

    // Check for lazy loading
    if (!component.lazyLoading && !component.virtualization) {
      warnings.push('Consider lazy loading for images/thumbnails');
      deduction += 5;
    }

    // Check for memoization
    if (!component.useMemo && !component.useCallback) {
      warnings.push('Use memoization for expensive calculations');
      deduction += 3;
    }

    // Check for query caching
    if (!component.staleTime && !component.cacheTime) {
      warnings.push('Configure appropriate cache settings for queries');
      deduction += 3;
    }

    return deduction;
  }

  private static validateAccessibility(component: any, errors: string[], warnings: string[]): number {
    let deduction = 0;

    // Check for keyboard navigation
    if (!component.onKeyDown && !component.tabIndex) {
      warnings.push('Implement keyboard navigation support');
      deduction += 5;
    }

    // Check for ARIA labels
    if (!component.ariaLabel && !component.role) {
      warnings.push('Add ARIA labels for screen readers');
      deduction += 5;
    }

    // Check for focus management
    if (!component.focusManagement && !component.autoFocus) {
      warnings.push('Implement proper focus management');
      deduction += 3;
    }

    // Check for semantic HTML
    if (!component.semantic && !component.htmlStructure) {
      warnings.push('Use semantic HTML elements');
      deduction += 2;
    }

    return deduction;
  }

  /**
   * Validate performance requirements
   */
  static validatePerformanceRequirements(metrics: any): GalleryValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    // Check load time (< 2 seconds for initial load)
    if (metrics.initialLoadTime > 2000) {
      errors.push(`Initial load time ${metrics.initialLoadTime}ms exceeds 2 second requirement`);
      score -= 20;
    }

    // Check search response time (< 1 second)
    if (metrics.searchResponseTime > 1000) {
      errors.push(`Search response time ${metrics.searchResponseTime}ms exceeds 1 second requirement`);
      score -= 15;
    }

    // Check pagination response time (< 1 second)
    if (metrics.paginationResponseTime > 1000) {
      warnings.push(`Pagination response time ${metrics.paginationResponseTime}ms should be under 1 second`);
      score -= 10;
    }

    // Check memory usage
    if (metrics.memoryUsage > 100) { // 100MB threshold
      warnings.push(`Memory usage ${metrics.memoryUsage}MB is high, consider optimization`);
      score -= 5;
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      score: Math.max(0, score)
    };
  }

  /**
   * Validate user experience requirements
   */
  static validateUserExperience(uxMetrics: any): GalleryValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    // Check responsive design
    if (!uxMetrics.responsiveDesign) {
      errors.push('Responsive design is required for all screen sizes');
      score -= 15;
    }

    // Check loading states
    if (!uxMetrics.loadingStates) {
      errors.push('Loading states must be implemented');
      score -= 10;
    }

    // Check empty states
    if (!uxMetrics.emptyStates) {
      errors.push('Empty states must be implemented');
      score -= 10;
    }

    // Check error states
    if (!uxMetrics.errorStates) {
      errors.push('Error states must be implemented');
      score -= 10;
    }

    // Check accessibility score
    if (uxMetrics.accessibilityScore < 95) {
      if (uxMetrics.accessibilityScore < 80) {
        errors.push(`Accessibility score ${uxMetrics.accessibilityScore} is below 95 requirement`);
        score -= 15;
      } else {
        warnings.push(`Accessibility score ${uxMetrics.accessibilityScore} should reach 95`);
        score -= 5;
      }
    }

    // Check mobile usability
    if (!uxMetrics.mobileUsability) {
      warnings.push('Mobile usability should be optimized');
      score -= 5;
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      score: Math.max(0, score)
    };
  }
}

// Test utilities for validation
export class GalleryTestUtils {
  
  /**
   * Create mock document data for testing
   */
  static createMockDocuments(count: number = 10) {
    return Array.from({ length: count }, (_, i) => ({
      id: `doc-${i + 1}`,
      filename: `document-${i + 1}.pdf`,
      file_size: Math.floor(Math.random() * 10000000) + 1000,
      upload_date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: ['pending', 'analyzing', 'completed', 'failed'][Math.floor(Math.random() * 4)],
      document_type: ['invoice', 'contract', 'report', 'form'][Math.floor(Math.random() * 4)],
      file_type: ['pdf', 'docx', 'txt', 'xlsx'][Math.floor(Math.random() * 4)],
      user_id: 'test-user-id',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  }

  /**
   * Simulate performance metrics
   */
  static simulatePerformanceMetrics() {
    return {
      initialLoadTime: Math.floor(Math.random() * 3000) + 500,
      searchResponseTime: Math.floor(Math.random() * 1500) + 200,
      paginationResponseTime: Math.floor(Math.random() * 1200) + 300,
      memoryUsage: Math.floor(Math.random() * 150) + 50,
    };
  }

  /**
   * Simulate UX metrics
   */
  static simulateUXMetrics() {
    return {
      responsiveDesign: Math.random() > 0.1,
      loadingStates: Math.random() > 0.1,
      emptyStates: Math.random() > 0.1,
      errorStates: Math.random() > 0.2,
      accessibilityScore: Math.floor(Math.random() * 30) + 70,
      mobileUsability: Math.random() > 0.2,
    };
  }
}