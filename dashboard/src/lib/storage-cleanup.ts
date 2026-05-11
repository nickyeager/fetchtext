import { supabase } from '@/lib/supabase';

/**
 * Utility functions for storage cleanup and maintenance
 */

interface OrphanedFile {
  name: string;
  size: number;
  created_at: string;
  updated_at: string;
}

interface CleanupResult {
  orphanedFiles: OrphanedFile[];
  totalSize: number;
  deletedCount: number;
  errors: string[];
}

/**
 * Find orphaned files in storage that don't have corresponding database records
 * This should be run periodically to clean up failed deletions
 */
export async function findOrphanedFiles(): Promise<CleanupResult> {
  const result: CleanupResult = {
    orphanedFiles: [],
    totalSize: 0,
    deletedCount: 0,
    errors: []
  };

  try {
    // Get all files from storage
    const { data: storageFiles, error: storageError } = await supabase.storage
      .from('documents')
      .list('', {
        limit: 1000,
        offset: 0
      });

    if (storageError) {
      result.errors.push(`Failed to list storage files: ${storageError.message}`);
      return result;
    }

    if (!storageFiles || storageFiles.length === 0) {
      return result;
    }

    // Get all file paths from database
    const { data: dbDocuments, error: dbError } = await supabase
      .from('documents')
      .select('file_path');

    if (dbError) {
      result.errors.push(`Failed to fetch database records: ${dbError.message}`);
      return result;
    }

    // Create a set of valid file paths for quick lookup
    const validFilePaths = new Set(
      dbDocuments?.map(doc => doc.file_path).filter(Boolean) || []
    );

    // Find orphaned files
    for (const file of storageFiles) {
      if (!validFilePaths.has(file.name)) {
        result.orphanedFiles.push({
          name: file.name,
          size: file.metadata?.size || 0,
          created_at: file.created_at || '',
          updated_at: file.updated_at || ''
        });
        result.totalSize += file.metadata?.size || 0;
      }
    }

    return result;
  } catch (error) {
    result.errors.push(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

/**
 * Delete orphaned files from storage
 * @param dryRun - If true, only report what would be deleted without actually deleting
 */
export async function cleanupOrphanedFiles(dryRun = true): Promise<CleanupResult> {
  const findResult = await findOrphanedFiles();
  
  if (findResult.errors.length > 0 || dryRun) {
    return findResult;
  }

  // Delete orphaned files in batches
  const batchSize = 10;
  const filesToDelete = findResult.orphanedFiles.map(f => f.name);
  
  for (let i = 0; i < filesToDelete.length; i += batchSize) {
    const batch = filesToDelete.slice(i, i + batchSize);
    
    try {
      const { error } = await supabase.storage
        .from('documents')
        .remove(batch);

      if (error) {
        findResult.errors.push(`Failed to delete batch ${i / batchSize + 1}: ${error.message}`);
      } else {
        findResult.deletedCount += batch.length;
      }
    } catch (error) {
      findResult.errors.push(`Error deleting batch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return findResult;
}

/**
 * Log orphaned file information for manual cleanup or monitoring
 */
export async function logOrphanedFiles(): Promise<void> {
  const result = await findOrphanedFiles();
  
  if (result.orphanedFiles.length > 0) {
    console.warn('=== Orphaned Files Report ===');
    console.warn(`Found ${result.orphanedFiles.length} orphaned files`);
    console.warn(`Total size: ${formatFileSize(result.totalSize)}`);
    console.warn('Files:', result.orphanedFiles);
    
    // You could also log this to a monitoring service or database table
    // for tracking and alerting
  }
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}