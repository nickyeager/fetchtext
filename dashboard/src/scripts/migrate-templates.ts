/**
 * Template Migration Script
 * Run this script to migrate all existing templates to smart templates
 */
import { templateMigrationService } from '@/services/template-migration-service';

async function runMigration() {
  console.log('🚀 Starting template migration process...');
  
  try {
    // First, get the current migration status
    console.log('📊 Checking migration status...');
    const status = await templateMigrationService.getMigrationStatus();
    
    console.log('Current Status:');
    console.log(`- Standard Templates: ${status.standardTemplatesCount}`);
    console.log(`- Smart Templates: ${status.smartTemplatesCount}`);
    console.log(`- Can Migrate: ${status.potentialMigrations}`);
    console.log(`- Already Migrated: ${status.alreadyMigrated}`);
    
    if (status.potentialMigrations === 0) {
      console.log('✅ No templates need migration. All done!');
      return;
    }
    
    // Run a dry run first to preview what will happen
    console.log('\n🔍 Running dry run to preview migration...');
    const dryRunResult = await templateMigrationService.migrateAllTemplates({
      dryRun: true,
      overwriteExisting: false,
      preserveOriginals: true
    });
    
    console.log('\nDry Run Results:');
    console.log(`- Would migrate: ${dryRunResult.migratedCount}`);
    console.log(`- Would skip: ${dryRunResult.skippedCount}`);
    console.log(`- Would have errors: ${dryRunResult.errorCount}`);
    
    if (dryRunResult.errorCount > 0) {
      console.log('\n❌ Errors found in dry run:');
      dryRunResult.errors.forEach(error => {
        console.log(`  - ${error.templateName}: ${error.error}`);
      });
      console.log('\nPlease fix these errors before running the actual migration.');
      return;
    }
    
    // If dry run looks good, ask for confirmation (in a real scenario)
    console.log('\n✅ Dry run completed successfully!');
    console.log('🔄 Running actual migration...');
    
    // Run the actual migration
    const migrationResult = await templateMigrationService.migrateAllTemplates({
      dryRun: false,
      overwriteExisting: false,
      preserveOriginals: true
    });
    
    console.log('\n🎉 Migration Results:');
    console.log(`- Successfully migrated: ${migrationResult.migratedCount}`);
    console.log(`- Skipped: ${migrationResult.skippedCount}`);
    console.log(`- Errors: ${migrationResult.errorCount}`);
    
    if (migrationResult.details.length > 0) {
      console.log('\nDetailed Results:');
      migrationResult.details.forEach(detail => {
        const icon = detail.action === 'migrated' ? '✅' : 
                    detail.action === 'skipped' ? '⏭️' : '❌';
        console.log(`  ${icon} ${detail.templateName}: ${detail.reason}`);
      });
    }
    
    if (migrationResult.errors.length > 0) {
      console.log('\n❌ Migration Errors:');
      migrationResult.errors.forEach(error => {
        console.log(`  - ${error.templateName}: ${error.error}`);
      });
    }
    
    // Show final status
    console.log('\n📊 Final Status:');
    const finalStatus = await templateMigrationService.getMigrationStatus();
    console.log(`- Standard Templates: ${finalStatus.standardTemplatesCount}`);
    console.log(`- Smart Templates: ${finalStatus.smartTemplatesCount}`);
    console.log(`- Remaining to migrate: ${finalStatus.potentialMigrations}`);
    
    if (migrationResult.success) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('Your templates have been upgraded with AI-powered extraction capabilities.');
    } else {
      console.log('\n⚠️ Migration completed with some issues. Please review the errors above.');
    }
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    throw error;
  }
}

// Export for use in other contexts
export { runMigration };

// If running directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}