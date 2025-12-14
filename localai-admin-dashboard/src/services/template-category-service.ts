/**
 * Template Category Service
 * Centralized service for managing template categories from the database
 */

import { supabase } from '@/lib/supabase';
import { requireAuthentication } from '@/lib/supabase-auth-utils';

export interface TemplateCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  created_at: string;
}

export class TemplateCategoryService {
  private static categoriesCache: TemplateCategory[] | null = null;
  private static cacheTimestamp: number = 0;
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get all template categories from the database
   * Uses caching to avoid excessive database calls
   */
  static async getCategories(): Promise<TemplateCategory[]> {
    try {
      // Check cache validity
      const now = Date.now();
      if (this.categoriesCache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
        return this.categoriesCache;
      }

      const { data, error } = await supabase
        .from('template_categories')
        .select('*')
        .order('name');

      if (error) {
        console.error('Failed to fetch template categories:', error);
        throw new Error(`Failed to fetch categories: ${error.message}`);
      }

      // Update cache
      this.categoriesCache = data || [];
      this.cacheTimestamp = now;

      return this.categoriesCache;
    } catch (error) {
      console.error('Error fetching template categories:', error);
      
      // Return cached data if available, even if expired
      if (this.categoriesCache) {
        console.warn('Returning stale category cache due to error');
        return this.categoriesCache;
      }
      
      // Ultimate fallback - return general category only
      return [{
        id: 'fallback-general',
        name: 'general',
        description: 'General purpose templates',
        icon: 'file-text',
        created_at: new Date().toISOString()
      }];
    }
  }

  /**
   * Get category names only (for validation)
   */
  static async getCategoryNames(): Promise<string[]> {
    const categories = await this.getCategories();
    return categories.map(cat => cat.name);
  }

  /**
   * Check if a category is valid
   */
  static async isValidCategory(categoryName: string): Promise<boolean> {
    const validCategories = await this.getCategoryNames();
    return validCategories.includes(categoryName);
  }

  /**
   * Get a single category by name
   */
  static async getCategoryByName(name: string): Promise<TemplateCategory | null> {
    const categories = await this.getCategories();
    return categories.find(cat => cat.name === name) || null;
  }

  /**
   * Clear the cache (useful after updates)
   */
  static clearCache(): void {
    this.categoriesCache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Create a new category (requires authentication)
   */
  static async createCategory(category: Omit<TemplateCategory, 'id' | 'created_at'>): Promise<TemplateCategory> {
    try {
      await requireAuthentication();

      const { data, error } = await supabase
        .from('template_categories')
        .insert(category)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create category: ${error.message}`);
      }

      // Clear cache to force refresh
      this.clearCache();

      return data;
    } catch (error) {
      console.error('Failed to create category:', error);
      throw error;
    }
  }

  /**
   * Update a category (requires authentication)
   */
  static async updateCategory(name: string, updates: Partial<Omit<TemplateCategory, 'id' | 'name' | 'created_at'>>): Promise<TemplateCategory> {
    try {
      await requireAuthentication();

      const { data, error } = await supabase
        .from('template_categories')
        .update(updates)
        .eq('name', name)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update category: ${error.message}`);
      }

      // Clear cache to force refresh
      this.clearCache();

      return data;
    } catch (error) {
      console.error('Failed to update category:', error);
      throw error;
    }
  }

  /**
   * Get category statistics
   */
  static async getCategoryStats(): Promise<Record<string, number>> {
    try {
      // Get template counts per category
      const { data: templateStats, error: templateError } = await supabase
        .from('templates')
        .select('category')
        .not('category', 'is', null);

      const { data: smartTemplateStats, error: smartError } = await supabase
        .from('smart_templates')
        .select('category')
        .not('category', 'is', null);

      if (templateError || smartError) {
        throw new Error('Failed to fetch category statistics');
      }

      // Count templates per category
      const stats: Record<string, number> = {};
      
      (templateStats || []).forEach(t => {
        stats[t.category] = (stats[t.category] || 0) + 1;
      });
      
      (smartTemplateStats || []).forEach(t => {
        stats[t.category] = (stats[t.category] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Failed to get category stats:', error);
      return {};
    }
  }
}