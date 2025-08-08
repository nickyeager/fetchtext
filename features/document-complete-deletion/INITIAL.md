# Complete Document Deletion Feature

## Problem
The current document deletion functionality only removes the database record from the `documents` table but leaves the physical file in Supabase Storage. This creates several issues:

- **Storage bloat**: Deleted documents continue consuming storage space
- **Data inconsistency**: Database shows document as deleted but file still exists
- **Privacy concerns**: "Deleted" files remain accessible via direct storage URLs
- **Cost implications**: Unnecessary storage costs for files that should be removed
- **Compliance issues**: GDPR and data retention policies require complete data removal

## Requirements
Implement complete document deletion that removes both database records and physical files atomically.

### Functional Requirements
- [ ] **Database deletion**: Remove document record from `documents` table (currently implemented)
- [ ] **File deletion**: Remove physical file from Supabase Storage `documents` bucket
- [ ] **Atomic operation**: Ensure both operations succeed or fail together
- [ ] **Error handling**: Graceful fallback if file deletion fails after database deletion
- [ ] **Storage cleanup**: Handle orphaned files from previous incomplete deletions
- [ ] **Related data cleanup**: Remove associated processing jobs, outputs, and metadata

### Technical Requirements  
- [ ] **Supabase Storage API**: Use Supabase client to delete files from storage
- [ ] **Transaction safety**: Implement proper error handling and rollback mechanisms
- [ ] **Permissions**: Leverage existing RLS policies for storage deletion
- [ ] **Progress indication**: Show deletion progress for large files
- [ ] **Batch operations**: Support for deleting multiple documents efficiently

### User Experience Requirements
- [ ] **Clear feedback**: User knows when both database and file are deleted
- [ ] **Error messaging**: Specific error messages for different failure scenarios
- [ ] **Confirmation dialog**: Enhanced confirmation showing file size and storage impact
- [ ] **Immediate UI updates**: Document disappears from gallery immediately
- [ ] **Undo prevention**: Clear messaging that deletion is permanent and irreversible

## Benefits
1. **Storage efficiency**: Reduces storage costs and prevents storage bloat
2. **Data consistency**: Ensures database and storage are synchronized
3. **Privacy compliance**: Meets data deletion requirements for privacy regulations
4. **User confidence**: Users trust that deleted documents are completely removed
5. **System cleanliness**: Prevents accumulation of orphaned files
6. **Cost optimization**: Eliminates ongoing costs for unused storage

## Current State Analysis

### Database Schema (documents table)
```sql
CREATE TABLE documents (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL, -- Path in Supabase Storage ← KEY FIELD
    file_type TEXT NOT NULL,
    file_size INTEGER,
    content_text TEXT,
    metadata JSONB DEFAULT '{}',
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Current Delete Implementation
```typescript
const deleteMutation = useMutation({
  mutationFn: async (documentId: string) => {
    // ❌ ONLY deletes database record
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;
    
    return documentId;
  },
  // ... success/error handlers
});
```

### Storage Configuration
- **Bucket**: `documents`
- **Policies**: RLS enabled with user-based access control
- **File paths**: Organized by user ID for security

## Proposed Solution

### Enhanced Delete Function
```typescript
const deleteMutation = useMutation({
  mutationFn: async (documentId: string) => {
    // 1. Get document info including file_path
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('file_path, name')
      .eq('id', documentId)
      .single();

    if (fetchError) throw fetchError;

    // 2. Delete file from storage first
    const { error: storageError } = await supabase.storage
      .from('documents')
      .remove([document.file_path]);

    if (storageError) throw new Error(`Failed to delete file: ${storageError.message}`);

    // 3. Delete database record
    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (dbError) {
      // File deleted but DB deletion failed - log for cleanup
      console.error('Database deletion failed after file deletion:', dbError);
      throw new Error(`File deleted but database cleanup failed: ${dbError.message}`);
    }
    
    return { documentId, deletedFile: document.file_path };
  },
  // ... enhanced success/error handlers
});
```

## Error Handling Scenarios

### 1. File Deletion Fails
- **Cause**: Network issues, permissions, file not found
- **Action**: Fail entire operation, keep database record intact
- **User message**: "Unable to delete document file. Please try again."

### 2. Database Deletion Fails After File Deletion  
- **Cause**: Database connection issues, constraint violations
- **Action**: Log orphaned file info for cleanup, show specific error
- **User message**: "Document file deleted but database cleanup failed. Contact support."

### 3. Document Not Found
- **Cause**: Document already deleted or doesn't exist
- **Action**: Check if file exists in storage and clean up if needed
- **User message**: "Document not found or already deleted."

### 4. Permission Errors
- **Cause**: User doesn't own document, RLS policy blocks deletion
- **Action**: Fail gracefully without exposing security details  
- **User message**: "You don't have permission to delete this document."

## Implementation Tasks

### Phase 1: Core Functionality
- [ ] Update `deleteMutation` to include storage deletion
- [ ] Add proper error handling for storage operations
- [ ] Enhance confirmation dialog with file size information
- [ ] Update success/error messaging

### Phase 2: Enhanced Features  
- [ ] Add deletion progress indicator for large files
- [ ] Implement batch deletion for multiple documents
- [ ] Add storage cleanup utility for orphaned files
- [ ] Create deletion audit log

### Phase 3: Monitoring & Maintenance
- [ ] Add metrics for deletion success/failure rates
- [ ] Implement automated cleanup for orphaned files  
- [ ] Add deletion confirmation with estimated storage savings
- [ ] Create admin tools for bulk cleanup operations

## Testing Strategy

### Unit Tests
- [ ] Mock Supabase storage deletion
- [ ] Test error scenarios (file not found, permission denied)
- [ ] Test atomic operation rollback
- [ ] Test batch deletion logic

### Integration Tests
- [ ] End-to-end deletion with real files
- [ ] Test with various file sizes and types
- [ ] Test deletion permissions and RLS policies
- [ ] Test cleanup of related data

### User Acceptance Tests
- [ ] Verify files are completely removed from storage
- [ ] Test error messages are clear and actionable
- [ ] Verify immediate UI updates
- [ ] Test deletion confirmation flow

## Success Criteria
- [ ] **Complete deletion**: Both database record and physical file removed in 99.9% of cases
- [ ] **Error recovery**: Failed deletions handled gracefully with clear user feedback  
- [ ] **Performance**: Deletion completes within 5 seconds for files up to 100MB
- [ ] **Storage efficiency**: No orphaned files accumulate over time
- [ ] **User experience**: Deletion feels instant with appropriate confirmation
- [ ] **Compliance**: Meets data deletion requirements for privacy regulations

---

**Category**: Backend Enhancement  
**Priority**: HIGH  
**Estimated Effort**: 2-3 days  
**Dependencies**: Supabase Storage API, existing document gallery  
**Created**: 2025-08-06