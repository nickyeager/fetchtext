// Stub Template Migration Service
// Provides minimal shapes to satisfy migration script imports.

export interface MigrationStatus {
  standardTemplatesCount: number;
  smartTemplatesCount: number;
  potentialMigrations: number;
  alreadyMigrated: number;
}

export interface MigrationOptions {
  dryRun?: boolean;
  overwriteExisting?: boolean;
  preserveOriginals?: boolean;
}

export interface MigrationDetail {
  templateName: string;
  action: 'migrated' | 'skipped' | 'error';
  reason?: string;
  error?: string;
}

export interface MigrationResult {
  success: boolean;
  migratedCount: number;
  skippedCount: number;
  errorCount: number;
  details: MigrationDetail[];
  errors: { templateName: string; error: string }[];
}

class TemplateMigrationService {
  async getMigrationStatus(): Promise<MigrationStatus> {
    return {
      standardTemplatesCount: 0,
      smartTemplatesCount: 0,
      potentialMigrations: 0,
      alreadyMigrated: 0,
    };
  }

  async migrateAllTemplates(_options: MigrationOptions): Promise<MigrationResult> {
    return {
      success: true,
      migratedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      details: [],
      errors: [],
    };
  }
}

export const templateMigrationService = new TemplateMigrationService();
