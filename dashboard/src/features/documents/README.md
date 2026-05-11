# Document Detail View Feature

## Overview

The Document Detail View feature provides a comprehensive interface for viewing, analyzing, and managing processed documents within the LocalAI Admin Dashboard. This feature allows users to examine document processing results, extracted fields, AI analysis insights, and quality metrics in a detailed, user-friendly interface.

## Architecture

### Components

#### 1. DocumentDetailView Component
**Location**: `src/features/documents/components/DocumentDetailView.tsx`

The main component that displays detailed information about a processed document.

**Key Features**:
- Tabbed interface with Overview, Extracted Fields, Content, and AI Analysis sections
- Real-time data loading with loading states and error handling
- Export functionality for multiple formats (JSON, TXT, CSV)
- Copy-to-clipboard functionality for extracted data
- Confidence score visualization with color-coded indicators
- AI enhancement details and quality assessments
- Responsive design with mobile support

**Props**:
```typescript
interface DocumentDetailViewProps {
  documentId: string;           // Required: Document ID to display
  onBack?: () => void;          // Optional: Back navigation handler
  onDownload?: (format: 'json' | 'txt' | 'csv') => Promise<void>; // Optional: Download handler
  showDebugInfo?: boolean;      // Optional: Show debug information
}
```

#### 2. Route Handler
**Location**: `src/routes/_authenticated/documents/$documentId.tsx`

TanStack Router route handler that manages the document detail page.

**Features**:
- Route parameter validation
- Search parameter handling for tabs and debug mode
- Error boundaries and 404 handling
- Navigation integration

**URL Structure**:
```
/documents/{documentId}?tab=overview&debug=false
```

### Services

#### Document Services

Document processing is now handled by the `UnifiedDocumentService` located at `/src/services/unified-document-service.ts`. This service provides centralized document lifecycle management across all upload paths.

##### Core Methods
- `getDocumentById(id: string)` - Fetch document details
- `getUserDocuments()` - Get all documents for user
- `createDocumentRecord()` - Create new document record
- `updateDocumentStatus()` - Update document processing status
- `finalizeDocument()` - Complete document processing
- `markDocumentFailed()` - Handle processing failures

## Data Models

### DocumentRecord Interface
```typescript
interface ProcessedDocument {
  id: string;
  uuid: string;
  name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  content_text?: string;
  metadata: any;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  template_id?: number;
  template_name?: string;
  processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
  extracted_fields?: Record<string, ExtractedField>;
  processing_method?: 'template_guided' | 'generic' | 'progressive';
}
```

### ExtractedField Interface
```typescript
interface ExtractedField {
  value: any;
  confidence: number;
  sourceText?: string;
  location?: {
    page?: number;
    position?: number;
  };
}
```

## User Interface Design

### Tab Structure

#### 1. Overview Tab
- **Document Information Card**: File details, processing method, template used
- **Extraction Summary**: Statistics with confidence distribution
- **Content Preview**: Scrollable preview of extracted content

#### 2. Extracted Fields Tab
- **Field Cards**: Individual cards for each extracted field
  - Field name and value
  - Confidence score with color coding (High: Green, Medium: Yellow, Low: Red)
  - Source text highlighting
  - Location information (page/position)
  - Copy-to-clipboard functionality

#### 3. Content Tab
- **Full Content Display**: Complete extracted text content
- **Copy All Button**: Copy entire content to clipboard
- **Scrollable Container**: Efficient handling of large documents

#### 4. AI Analysis Tab (Conditional)
- **AI Classification**: Document category and confidence
- **Quality Assessment**: Completeness, readability, structure scores
- **Quality Insights**: AI-generated recommendations
- **Processing Time**: AI enhancement duration

### Visual Design Principles

#### Color Coding
- **Green (Success)**: High confidence (≥80%), completed status, good quality
- **Yellow (Warning)**: Medium confidence (60-79%), processing status
- **Red (Error)**: Low confidence (<60%), failed status, poor quality
- **Blue (Info)**: Processing status, AI enhancement indicators
- **Gray (Neutral)**: Default states, metadata

#### Typography
- **Headers**: Bold, hierarchical sizing (h1-h4)
- **Body Text**: Regular weight, readable line height
- **Monospace**: Code, IDs, technical data
- **Emphasis**: Italic for source text quotes

#### Spacing
- **Consistent Grid**: 4px base unit (gap-2, gap-4, gap-6)
- **Card Padding**: Standard p-4, p-6 for headers
- **Section Spacing**: space-y-4, space-y-6 between major sections

## Functionality Details

### Data Loading
- **React Query Integration**: Automatic caching, refetching, and error handling
- **Loading States**: Skeleton placeholders during data fetch
- **Error Boundaries**: Graceful error handling with user-friendly messages

### Export Functionality
Three export formats supported:

#### JSON Export
```typescript
// Complete document data structure
{
  "id": "doc-123",
  "name": "document.pdf",
  "extracted_fields": {...},
  "metadata": {...},
  // ... full document object
}
```

#### TXT Export
```
Document: document.pdf
Processed: January 15, 2024 at 10:30:00 AM
Template: Invoice Template

Content:
[Full extracted content]

Extracted Fields:
invoice_number: INV-2024-001 (95% confidence)
total_amount: $1,250.00 (88% confidence)
```

#### CSV Export
```csv
Field,Value,Confidence,Source Text
invoice_number,INV-2024-001,95,"Invoice Number: INV-2024-001"
total_amount,$1250.00,88,"Total: $1,250.00"
```

### Copy-to-Clipboard
- **Individual Fields**: Copy button for each extracted field
- **Full Content**: Copy entire document content
- **Success Feedback**: Temporary notification showing copy success
- **Error Handling**: Graceful fallback for clipboard API failures

## Testing Strategy

### Component Tests
**Location**: `src/features/documents/components/__tests__/DocumentDetailView.test.tsx`

**Coverage Areas**:
- Component rendering and layout
- Tab navigation and content switching
- Data display and formatting
- User interactions (clicks, navigation)
- Copy-to-clipboard functionality
- Export functionality
- Error states and loading states
- Accessibility compliance

### Service Tests
**Location**: `src/features/documents/services/__tests__/processed-documents-service.detail.test.ts`

**Coverage Areas**:
- Document fetching and transformation
- Processing history generation
- Quality metrics calculation
- Search functionality with filters
- Error handling and edge cases
- Authentication requirements

### Test Utilities
```typescript
// Custom render wrapper with React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};
```

## Performance Considerations

### Optimization Strategies
1. **React Query Caching**: Documents cached for 5 minutes, reducing API calls
2. **Lazy Loading**: Large content areas use scroll containers
3. **Memoization**: Complex calculations memoized with useMemo
4. **Code Splitting**: Route-level code splitting for bundle optimization

### Memory Management
- **Blob Cleanup**: URL.revokeObjectURL() called after downloads
- **Event Listener Cleanup**: useEffect cleanup functions
- **Query Invalidation**: Proper cache invalidation on data changes

## Error Handling

### Error Types and Handling
1. **Network Errors**: Display retry options with user-friendly messages
2. **Authentication Errors**: Redirect to login or show auth error
3. **Document Not Found**: Custom 404 page with navigation options
4. **Permission Errors**: Clear messaging about access restrictions

### Error Boundaries
```tsx
// Route-level error boundary
errorComponent: ({ error }) => (
  <div className="container mx-auto p-6">
    <div className="text-center py-12">
      <h1 className="text-2xl font-bold text-red-600 mb-4">
        Error Loading Document
      </h1>
      <p className="text-gray-600 mb-4">{error.message}</p>
      <button onClick={() => window.location.href = '/documents'}>
        Back to Documents
      </button>
    </div>
  </div>
)
```

## Accessibility Features

### WCAG 2.1 Compliance
- **Keyboard Navigation**: Full keyboard accessibility for all interactive elements
- **Screen Reader Support**: Proper ARIA labels and semantic HTML
- **Color Contrast**: Meets AA contrast requirements for all text
- **Focus Management**: Visible focus indicators and logical tab order

### Accessibility Implementation
```tsx
// Example: Accessible tab navigation
<TabsList className="grid w-full grid-cols-4">
  <TabsTrigger value="overview" aria-label="Document overview">
    Overview
  </TabsTrigger>
  <TabsTrigger value="extracted-fields" aria-label="Extracted fields">
    Extracted Fields
  </TabsTrigger>
</TabsList>
```

## Integration Points

### Database Integration
- **Supabase**: Direct integration with documents table
- **Row Level Security**: User-scoped data access
- **Real-time Updates**: Subscription to document changes

### AI Services Integration
- **Document Processor**: Enhanced Docling service integration
- **Quality Assessment**: AI-powered quality metrics
- **Classification**: Automatic document categorization

### Template System Integration
- **Template Matching**: Integration with template service
- **Field Extraction**: Template-guided field extraction
- **Confidence Scoring**: Template-specific confidence calculations

## Development Workflow

### Adding New Features
1. **Update Interfaces**: Modify TypeScript interfaces
2. **Enhance Services**: Add new service methods
3. **Update Components**: Add UI components
4. **Write Tests**: Comprehensive test coverage
5. **Update Documentation**: Keep docs current

### Code Standards
- **TypeScript Strict Mode**: All code uses strict TypeScript
- **ESLint Configuration**: Enforced code style and best practices
- **Prettier Formatting**: Consistent code formatting
- **Component Documentation**: JSDoc comments for all public APIs

## Future Enhancements

### Planned Features
1. **Document Comparison**: Side-by-side comparison of processing results
2. **Annotation System**: User annotations and comments on extracted fields
3. **Version History**: Track multiple processing attempts
4. **Collaborative Review**: Multi-user review and approval workflow
5. **Advanced Analytics**: Usage patterns and processing insights

### Technical Improvements
1. **Virtual Scrolling**: Handle very large documents efficiently
2. **Progressive Loading**: Load document sections on demand
3. **Offline Support**: Cache documents for offline viewing
4. **Real-time Collaboration**: Live updates during document review

## Deployment and Monitoring

### Production Considerations
- **Environment Variables**: Proper configuration management
- **Error Tracking**: Integration with error monitoring services
- **Performance Monitoring**: Track component render times and API calls
- **User Analytics**: Track feature usage and user flows

### Monitoring Metrics
- **Page Load Time**: Time to first meaningful paint
- **API Response Time**: Document fetching performance
- **Error Rate**: Component and service error rates
- **User Engagement**: Tab usage and export frequency

## Security Considerations

### Data Protection
- **User Authentication**: Required for all document access
- **Data Encryption**: Sensitive data encrypted in transit and at rest
- **Access Control**: User-scoped document access
- **Audit Logging**: Track document access and modifications

### XSS Prevention
- **Input Sanitization**: All user input properly sanitized
- **Content Security Policy**: Strict CSP headers
- **Safe Rendering**: Use of safe React rendering practices

---

## Quick Start Guide

### For Developers

1. **Install Dependencies**:
   ```bash
   cd dashboard
   pnpm install
   ```

2. **Run Tests**:
   ```bash
   pnpm test src/features/documents/components/__tests__/DocumentDetailView.test.tsx
   pnpm test src/features/documents/services/__tests__/processed-documents-service.detail.test.ts
   ```

3. **Start Development Server**:
   ```bash
   pnpm dev
   ```

4. **Navigate to Document Detail**:
   ```
   http://localhost:3000/documents/[documentId]
   ```

### For Users

1. **Access Documents**: Navigate to Documents → Generated Documents tab
2. **View Details**: Click the eye icon (👁️) next to any completed document
3. **Explore Tabs**: Switch between Overview, Extracted Fields, Content, and AI Analysis
4. **Export Data**: Use the download buttons (TXT, CSV, JSON) to export document data
5. **Copy Data**: Use copy buttons to copy individual fields or full content

---

This documentation provides a comprehensive overview of the Document Detail View feature, including technical implementation details, user interface design, testing strategy, and future enhancement plans.