# Implementation Request: Complete Document Deletion

**Priority**: HIGH  
**Methodology**: Context Engineering  
**Generated**: 2025-08-06T08:15:30.000Z

---

## Problem-Requirements-Benefits (PRB)

### **Problem**
The current document deletion functionality is incomplete and creates significant data management issues:

1. **Incomplete Deletion**: Only removes database records, leaving physical files in Supabase Storage
2. **Storage Bloat**: Deleted documents continue consuming storage space indefinitely  
3. **Data Inconsistency**: Database shows document as deleted but file remains accessible
4. **Privacy Concerns**: "Deleted" files violate user expectations and privacy regulations
5. **Cost Implications**: Unnecessary ongoing storage costs for files that should be removed
6. **Compliance Issues**: GDPR and data retention policies require complete data removal

### **Requirements**
Implement atomic document deletion that removes both database records and physical files:

#### **Functional Requirements**
- Complete file deletion from Supabase Storage `documents` bucket
- Atomic operations ensuring both database and storage deletion succeed together
- Robust error handling with rollback capabilities for partial failures
- Related data cleanup (processing jobs, outputs, collaboration events)
- Batch deletion support for multiple documents
- Storage cleanup utilities for orphaned files from previous incomplete deletions

#### **Technical Requirements**  
- Enhanced `deleteMutation` using Supabase Storage API
- Proper transaction safety with detailed error reporting
- Leverage existing RLS policies for secure storage operations
- Progress indication for large file deletions
- Comprehensive logging and monitoring for deletion operations
- Backward compatibility with existing gallery interface

#### **User Experience Requirements**
- Clear confirmation dialog showing file size and storage impact
- Specific error messages for different failure scenarios  
- Immediate UI updates with appropriate loading states
- Enhanced success messaging confirming complete removal
- Permanent deletion warnings with no undo capability

### **Benefits**
1. **Storage Efficiency**: Eliminates storage bloat and reduces ongoing costs
2. **Data Consistency**: Ensures database and file system remain synchronized
3. **Privacy Compliance**: Meets GDPR and data deletion regulatory requirements
4. **User Trust**: Users confident that deleted documents are completely removed
5. **System Cleanliness**: Prevents accumulation of orphaned files over time
6. **Cost Optimization**: Reduces storage costs for unused files
7. **Operational Excellence**: Improves system maintainability and monitoring

---

## Task Overview

I need to implement **complete document deletion** for the FetchText document processing platform. This addresses a critical gap where document deletion only removes database records while leaving physical files in storage.

## Context Files

The following context files contain all necessary information for implementation:

### 1. Global Project Context
- **File**: `CLAUDE.md`
- **Purpose**: Project architecture, conventions, and global rules
- **Status**: ✅ Available

### 2. Feature-Specific Requirements  
- **File**: `features/document-complete-deletion/INITIAL.md`
- **Purpose**: Detailed feature requirements and success criteria
- **Status**: ✅ Available (just created)

### 3. Current Implementation Analysis
- **Files**: 
  - `localai-admin-dashboard/src/hooks/use-document-gallery.ts` (lines 378-410)
  - `supabase/migrations/001_document_templating_system.sql` (storage configuration)
- **Purpose**: Understanding current delete implementation and database schema
- **Status**: ✅ Analyzed

### 4. Related Components
- **Files**:
  - `localai-admin-dashboard/src/components/documents/DocumentGallery.tsx`
  - `localai-admin-dashboard/src/components/documents/DocumentCard.tsx`
- **Purpose**: UI components that trigger deletion
- **Status**: ✅ Recently enhanced

## Implementation Guidance

### Complexity Level: MODERATE-HIGH

This is a moderate-high complexity feature requiring:
- **Storage API Integration**: Supabase Storage operations with error handling
- **Atomic Operations**: Ensuring data consistency across database and storage
- **Error Recovery**: Handling partial failures and cleanup scenarios
- **Security Considerations**: Proper permissions and RLS policy compliance
- **Performance Optimization**: Efficient deletion for large files and batches

### Critical Implementation Points

1. **Order of Operations**: Delete storage file BEFORE database record for better error recovery
2. **Error Handling**: Distinguish between recoverable and non-recoverable failures
3. **Atomic Transactions**: Use proper transaction boundaries where possible
4. **Progress Feedback**: Show user progress for large file deletions
5. **Logging**: Comprehensive error logging for debugging and monitoring

### Key Files to Modify

1. **Primary**: `localai-admin-dashboard/src/hooks/use-document-gallery.ts`
   - Enhance `deleteMutation` function
   - Add storage deletion logic
   - Improve error handling

2. **Secondary**: `localai-admin-dashboard/src/components/documents/DocumentGallery.tsx`
   - Enhance confirmation dialog
   - Update error messaging
   - Add progress indicators

3. **Testing**: Create comprehensive tests for deletion scenarios

## Success Validation

After implementation, verify:
- [ ] Files completely removed from Supabase Storage
- [ ] Database records properly deleted
- [ ] Error scenarios handled gracefully
- [ ] UI provides clear feedback for all states
- [ ] No orphaned files accumulate
- [ ] Deletion completes within performance targets
- [ ] Privacy and compliance requirements met

---

## Instructions for Implementation

1. **Analyze Current State**: Review existing deletion implementation and identify integration points
2. **Implement Core Logic**: Update `deleteMutation` with storage deletion capability
3. **Add Error Handling**: Implement robust error recovery and user feedback
4. **Enhance UI**: Update confirmation dialogs and progress indicators
5. **Test Thoroughly**: Create comprehensive test suite for all scenarios
6. **Monitor Performance**: Ensure deletion completes within acceptable timeframes

**Remember**: This is a critical data management feature that affects user trust and regulatory compliance. Implementation must be robust, well-tested, and provide clear feedback to users about the permanent nature of deletion operations.