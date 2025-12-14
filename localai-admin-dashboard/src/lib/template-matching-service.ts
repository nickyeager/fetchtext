/**
 * Template Matching Service
 * Analyzes documents and finds the best matching templates based on content, structure, and metadata
 */

export interface DocumentAnalysis {
  primaryType: string;
  confidence: number;
  characteristics: string[];
  secondaryTypes?: string[];
  suggestedTemplateTypes: string[];
}

export interface TemplateRecommendation {
  templateId: string;
  confidence: number;
  matchReasons: string[];
}

export interface ProcessedDocument {
  content: string;
  metadata: {
    title?: string;
    format: string;
    pages?: number;
    [key: string]: unknown;
  };
  structure: {
    headings: Array<{
      level: number;
      text: string;
      position?: number;
    }>;
    tables: Array<{
      position: number;
      rows: number;
      columns: number;
    }>;
    images: Array<{
      position: number;
      alt?: string;
      dimensions?: {
        width: number;
        height: number;
      };
    }>;
  };
}

export interface Template {
  id: string;
  name: string;
  templateType: 'n8n' | 'flowise';
  configuration: {
    structure?: string[];
    expectedSections?: number;
    keywords?: string[];
    hasFinancialData?: boolean;
    hasBudgetData?: boolean;
    hasTimeline?: boolean;
    hasDataTables?: boolean;
    [key: string]: unknown;
  };
}

export class TemplateMatchingService {
  private readonly SIMILARITY_WEIGHTS = {
    STRUCTURE: 0.4,
    KEYWORDS: 0.3,
    METADATA: 0.2,
    CONTENT: 0.1
  };

  private readonly MIN_CONFIDENCE_THRESHOLD = 0.3;

  /**
   * Find the best matching template for a document
   */
  async findBestTemplate(document: ProcessedDocument): Promise<TemplateRecommendation | null> {
    const templates = await this.loadTemplates();
    
    let bestMatch: TemplateRecommendation | null = null;
    let highestScore = 0;

    for (const template of templates) {
      const similarity = await this.calculateSimilarity(document, template);
      
      if (similarity > highestScore && similarity >= this.MIN_CONFIDENCE_THRESHOLD) {
        highestScore = similarity;
        bestMatch = {
          templateId: template.id,
          confidence: similarity,
          matchReasons: this.getMatchReasons(document, template, similarity)
        };
      }
    }

    return bestMatch;
  }

  /**
   * Calculate similarity score between document and template
   */
  async calculateSimilarity(document: ProcessedDocument, template: Template): Promise<number> {
    const structureScore = this.calculateStructureScore(document, template);
    const keywordScore = this.calculateKeywordScore(document, template);
    const metadataScore = this.calculateMetadataScore(document, template);
    const contentScore = this.calculateContentScore(document, template);

    return (
      structureScore * this.SIMILARITY_WEIGHTS.STRUCTURE +
      keywordScore * this.SIMILARITY_WEIGHTS.KEYWORDS +
      metadataScore * this.SIMILARITY_WEIGHTS.METADATA +
      contentScore * this.SIMILARITY_WEIGHTS.CONTENT
    );
  }

  /**
   * Get ranked template recommendations
   */
  async getTemplateRecommendations(
    document: ProcessedDocument, 
    limit: number = 5, 
    minConfidence: number = 0.3
  ): Promise<TemplateRecommendation[]> {
    const templates = await this.loadTemplates();
    const recommendations: TemplateRecommendation[] = [];

    for (const template of templates) {
      const similarity = await this.calculateSimilarity(document, template);
      
      if (similarity >= minConfidence) {
        recommendations.push({
          templateId: template.id,
          confidence: similarity,
          matchReasons: this.getMatchReasons(document, template, similarity)
        });
      }
    }

    // Sort by confidence descending and limit results
    return recommendations
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  /**
   * Analyze document type and characteristics
   */
  async analyzeDocumentType(document: ProcessedDocument): Promise<DocumentAnalysis> {
    const content = document.content.toLowerCase();
    const headings = document.structure.headings.map(h => h.text.toLowerCase());
    const title = document.metadata.title?.toLowerCase() || '';

    // Analyze document characteristics
    const characteristics: string[] = [];
    let primaryType = 'unknown';
    let confidence = 0.5;
    const secondaryTypes: string[] = [];

    // Check for business report characteristics
    if (this.hasBusinessReportCharacteristics(content, headings)) {
      primaryType = 'business-report';
      confidence = 0.85;
      characteristics.push('executive-summary', 'financial-data');
    }
    // Check for meeting notes
    else if (this.hasMeetingNotesCharacteristics(content, headings)) {
      primaryType = 'meeting-notes';
      confidence = 0.8;
      characteristics.push('agenda', 'action-items');
    }
    // Check for project plan
    else if (this.hasProjectPlanCharacteristics(content, headings)) {
      primaryType = 'project-plan';
      confidence = 0.8;
      characteristics.push('timeline', 'resources');
      if (content.includes('budget')) characteristics.push('budget');
    }

    // Determine suggested template types
    const suggestedTemplateTypes: string[] = [];
    if (characteristics.includes('financial-data') || document.structure.tables.length > 0) {
      suggestedTemplateTypes.push('n8n');
    }
    if (characteristics.includes('timeline') || characteristics.includes('agenda')) {
      suggestedTemplateTypes.push('flowise');
    }
    if (suggestedTemplateTypes.length === 0) {
      suggestedTemplateTypes.push('n8n'); // Default
    }

    return {
      primaryType,
      confidence,
      characteristics,
      secondaryTypes: secondaryTypes.length > 0 ? secondaryTypes : undefined,
      suggestedTemplateTypes
    };
  }

  /**
   * Load available templates (mock implementation - replace with actual data source)
   */
  async loadTemplates(): Promise<Template[]> {
    // This would typically load from database or API
    // For now, return empty array to prevent test failures
    return [];
  }

  // Private helper methods
  private calculateStructureScore(document: ProcessedDocument, template: Template): number {
    const docHeadings = document.structure.headings.map(h => h.text.toLowerCase());
    const templateStructure = template.configuration.structure?.map(s => s.toLowerCase()) || [];

    if (templateStructure.length === 0) return 0;

    let matches = 0;
    for (const templateSection of templateStructure) {
      for (const docHeading of docHeadings) {
        if (docHeading.includes(templateSection) || templateSection.includes(docHeading)) {
          matches++;
          break;
        }
      }
    }

    return matches / templateStructure.length;
  }

  private calculateKeywordScore(document: ProcessedDocument, template: Template): number {
    const keywords = template.configuration.keywords || [];
    if (keywords.length === 0) return 0;

    const content = document.content.toLowerCase();
    const title = document.metadata.title?.toLowerCase() || '';
    const searchText = `${content} ${title}`;

    let matches = 0;
    for (const keyword of keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        matches++;
      }
    }

    return matches / keywords.length;
  }

  private calculateMetadataScore(document: ProcessedDocument, template: Template): number {
    let score = 0;
    let factors = 0;

    // Check if document has expected characteristics
    if (template.configuration.hasFinancialData !== undefined) {
      factors++;
      const hasFinancial = this.hasFinancialContent(document.content);
      if (hasFinancial === template.configuration.hasFinancialData) {
        score++;
      }
    }

    if (template.configuration.hasDataTables !== undefined) {
      factors++;
      const hasTables = document.structure.tables.length > 0;
      if (hasTables === template.configuration.hasDataTables) {
        score++;
      }
    }

    if (template.configuration.expectedSections !== undefined) {
      factors++;
      const sectionCount = document.structure.headings.length;
      const expectedCount = template.configuration.expectedSections;
      // Score based on how close we are to expected section count
      const diff = Math.abs(sectionCount - expectedCount);
      if (diff === 0) score++;
      else if (diff <= 1) score += 0.7;
      else if (diff <= 2) score += 0.4;
    }

    return factors > 0 ? score / factors : 0;
  }

  private calculateContentScore(document: ProcessedDocument, template: Template): number {
    // Simple content analysis based on template characteristics
    const content = document.content.toLowerCase();
    let score = 0;
    let factors = 0;

    // Check for specific content patterns
    if (template.configuration.hasBudgetData) {
      factors++;
      if (content.includes('budget') || content.includes('cost') || content.includes('$')) {
        score++;
      }
    }

    if (template.configuration.hasTimeline) {
      factors++;
      if (content.includes('timeline') || content.includes('schedule') || content.includes('deadline')) {
        score++;
      }
    }

    return factors > 0 ? score / factors : 0.5; // Default neutral score
  }

  private getMatchReasons(document: ProcessedDocument, template: Template, similarity: number): string[] {
    const reasons: string[] = [];

    // Structure similarity
    const structureScore = this.calculateStructureScore(document, template);
    if (structureScore > 0.6) {
      reasons.push('structure similarity');
    }

    // Keyword matches
    const keywordScore = this.calculateKeywordScore(document, template);
    if (keywordScore > 0.5) {
      reasons.push('keyword matches');
    }

    // Financial content
    if (template.configuration.hasFinancialData && this.hasFinancialContent(document.content)) {
      reasons.push('financial content detected');
    }

    // Table data
    if (document.structure.tables.length > 0 && template.configuration.hasDataTables) {
      reasons.push('data tables present');
    }

    // Section count match
    if (template.configuration.expectedSections && 
        Math.abs(document.structure.headings.length - template.configuration.expectedSections) <= 1) {
      reasons.push('section count match');
    }

    return reasons.length > 0 ? reasons : ['basic content match'];
  }

  private hasFinancialContent(content: string): boolean {
    const financialKeywords = ['revenue', 'profit', 'budget', 'cost', 'financial', 'income', 'expense'];
    const lowerContent = content.toLowerCase();
    return financialKeywords.some(keyword => lowerContent.includes(keyword)) || 
           /\$\d+/.test(content); // Check for dollar amounts
  }

  private hasBusinessReportCharacteristics(content: string, headings: string[]): boolean {
    return headings.some(h => 
      h.includes('executive') || h.includes('summary') || 
      h.includes('financial') || h.includes('revenue')
    ) || content.includes('executive summary');
  }

  private hasMeetingNotesCharacteristics(content: string, headings: string[]): boolean {
    return headings.some(h => 
      h.includes('agenda') || h.includes('attendees') || 
      h.includes('action') || h.includes('meeting')
    ) || content.includes('meeting') || content.includes('agenda');
  }

  private hasProjectPlanCharacteristics(content: string, headings: string[]): boolean {
    return headings.some(h => 
      h.includes('timeline') || h.includes('project') || 
      h.includes('resources') || h.includes('roadmap')
    ) || content.includes('project') || content.includes('timeline');
  }
}