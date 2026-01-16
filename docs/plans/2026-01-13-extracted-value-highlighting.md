# Extracted Value Highlighting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show extracted field values highlighted on the original document in the dual view (PDF and image support)

**Architecture:** Replace iframe PDF viewer with react-pdf library for annotation support, add canvas overlay layer for highlighting, extend backend to return bounding box coordinates from Docling extraction

**Tech Stack:** react-pdf, pdfjs-dist, HTML5 Canvas API, Docling bounding boxes, TypeScript

---

## Phase 1: Backend - Extract Position Data from Docling

### Task 1: Create Position Data Types

**Files:**
- Create: `document-processor/app/models/position_data.py`
- Test: Validation via Python type hints

**Step 1: Write the position data models**

```python
"""Position and bounding box data models for document highlighting"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class BoundingBox(BaseModel):
    """Bounding box coordinates for a text region"""
    x: float  # Left position (0-1 normalized or pixel)
    y: float  # Top position (0-1 normalized or pixel)
    width: float
    height: float
    page: int = 1
    coordinate_type: str = "normalized"  # "normalized" (0-1) or "pixel"

class TextPosition(BaseModel):
    """Position information for extracted text"""
    text: str
    bbox: Optional[BoundingBox] = None
    page: int = 1
    char_start: Optional[int] = None
    char_end: Optional[int] = None
    confidence: float = 1.0

class FieldLocation(BaseModel):
    """Location data for an extracted field value"""
    field_name: str
    value: str
    positions: List[TextPosition]  # May appear in multiple places
    best_match: Optional[TextPosition] = None  # Most confident match
    source_text: Optional[str] = None

class DocumentPositions(BaseModel):
    """All position data for a document"""
    document_id: Optional[str] = None
    page_count: int = 1
    page_dimensions: List[Dict[str, float]] = []  # [{width, height}, ...]
    field_locations: List[FieldLocation] = []
    raw_bboxes: List[Dict[str, Any]] = []  # Raw Docling output
```

**Step 2: Verify the models work**

```bash
cd document-processor && python -c "from app.models.position_data import BoundingBox, FieldLocation; print('Models loaded successfully')"
```

**Step 3: Export from models __init__**

Edit `document-processor/app/models/__init__.py` to add:
```python
from .position_data import BoundingBox, TextPosition, FieldLocation, DocumentPositions
```

---

### Task 2: Enhance Docling Service to Extract Bounding Boxes

**Files:**
- Modify: `document-processor/app/services/docling_service.py`
- Test: `document-processor/tests/unit/test_docling_bbox.py`

**Step 1: Write the failing test**

Create `document-processor/tests/unit/test_docling_bbox.py`:
```python
"""Test bounding box extraction from Docling"""
import pytest
from pathlib import Path
from app.services.docling_service import DoclingService

class TestDoclingBoundingBoxes:
    @pytest.fixture
    def service(self):
        return DoclingService()

    @pytest.mark.asyncio
    async def test_extract_text_positions_returns_bboxes(self, service):
        """Text positions should include bounding box data when available"""
        # Use a test PDF file
        test_file = Path("tests/fixtures/sample_documents/test_invoice.pdf")
        if not test_file.exists():
            pytest.skip("Test PDF not available")

        result = await service.process_document(
            test_file,
            extract_text=True,
            extract_structure=True
        )

        # Check that bounding boxes were extracted
        content = result.get("content", {})
        layout_info = content.get("layout_info", {})
        bboxes = layout_info.get("bounding_boxes", [])

        # Should have some bounding boxes for PDF
        assert len(bboxes) > 0, "Expected bounding boxes from PDF extraction"

        # Each bbox should have required fields
        for bbox in bboxes:
            assert "element_type" in bbox
            assert "bbox" in bbox or "prov" in bbox
            assert "content_preview" in bbox

    @pytest.mark.asyncio
    async def test_text_search_returns_positions(self, service):
        """Searching for text should return position data"""
        # Test the new method we'll add
        test_file = Path("tests/fixtures/sample_documents/test_invoice.pdf")
        if not test_file.exists():
            pytest.skip("Test PDF not available")

        positions = await service.find_text_positions(
            test_file,
            search_texts=["Invoice", "Total", "$"]
        )

        assert isinstance(positions, list)
        # Each position should have text and location
        for pos in positions:
            assert "text" in pos
            assert "page" in pos
```

**Step 2: Run test to verify it fails**

```bash
cd document-processor && python -m pytest tests/unit/test_docling_bbox.py -v -s
```
Expected: FAIL with "find_text_positions not defined" or similar

**Step 3: Add find_text_positions method to DoclingService**

Add to `document-processor/app/services/docling_service.py` after line 515:

```python
async def find_text_positions(
    self,
    file_path: Path,
    search_texts: List[str]
) -> List[Dict[str, Any]]:
    """
    Find positions of specific text strings in a document.

    Args:
        file_path: Path to the document
        search_texts: List of text strings to find

    Returns:
        List of position data for found texts
    """
    positions = []

    try:
        if not self.use_real_docling or not self.converter:
            logger.warning("Docling not available for position extraction")
            return positions

        # Convert document
        result = self.converter.convert(str(file_path))

        # Extract text with positions from body elements
        if hasattr(result.document, 'body') and result.document.body:
            for item in result.document.body:
                item_text = str(item) if hasattr(item, '__str__') else ''

                # Check if any search text is in this item
                for search_text in search_texts:
                    if search_text.lower() in item_text.lower():
                        # Extract provenance/position data
                        prov = getattr(item, 'prov', None)
                        bbox_data = None
                        page_num = 1

                        if prov:
                            # Docling prov contains bounding box info
                            if hasattr(prov, '__iter__'):
                                for p in prov:
                                    if hasattr(p, 'bbox'):
                                        bbox = p.bbox
                                        bbox_data = {
                                            "x": bbox.l if hasattr(bbox, 'l') else 0,
                                            "y": bbox.t if hasattr(bbox, 't') else 0,
                                            "width": (bbox.r - bbox.l) if hasattr(bbox, 'r') else 0,
                                            "height": (bbox.b - bbox.t) if hasattr(bbox, 'b') else 0,
                                        }
                                    if hasattr(p, 'page_no'):
                                        page_num = p.page_no
                            elif hasattr(prov, 'bbox'):
                                bbox = prov.bbox
                                bbox_data = {
                                    "x": bbox.l if hasattr(bbox, 'l') else 0,
                                    "y": bbox.t if hasattr(bbox, 't') else 0,
                                    "width": (bbox.r - bbox.l) if hasattr(bbox, 'r') else 0,
                                    "height": (bbox.b - bbox.t) if hasattr(bbox, 'b') else 0,
                                }
                                page_num = getattr(prov, 'page_no', 1)

                        positions.append({
                            "text": search_text,
                            "found_in": item_text[:100],
                            "page": page_num,
                            "bbox": bbox_data,
                            "element_type": item.__class__.__name__ if hasattr(item, '__class__') else 'unknown'
                        })

        return positions

    except Exception as e:
        logger.error(f"Error finding text positions: {e}")
        return positions
```

**Step 4: Run test to verify it passes**

```bash
cd document-processor && python -m pytest tests/unit/test_docling_bbox.py -v -s
```

**Step 5: Rebuild container and verify**

```bash
docker compose -p localai up -d --build document-processor
docker compose -p localai logs document-processor --tail=20
```

---

### Task 3: Add Position Data to Smart Field Extractor Response

**Files:**
- Modify: `document-processor/app/services/smart_field_extractor.py`
- Test: `document-processor/tests/unit/test_extractor_positions.py`

**Step 1: Write the failing test**

Create `document-processor/tests/unit/test_extractor_positions.py`:
```python
"""Test that field extraction includes position data"""
import pytest
from app.services.smart_field_extractor import SmartFieldExtractor

class TestExtractorPositions:
    @pytest.fixture
    def extractor(self):
        return SmartFieldExtractor()

    def test_format_extracted_fields_includes_location_structure(self, extractor):
        """Formatted fields should have proper location structure"""
        raw_fields = {
            "invoice_number": {
                "value": "INV-001",
                "confidence": 0.95,
                "reasoning": "Found in header"
            }
        }

        formatted = extractor._format_extracted_fields(raw_fields)

        assert "invoice_number" in formatted
        field = formatted["invoice_number"]

        # Should have location dict structure (even if empty)
        assert "location" in field
        assert isinstance(field["location"], dict)
        assert "page" in field["location"] or field["location"] == {}
```

**Step 2: Run test to verify it fails**

```bash
cd document-processor && python -m pytest tests/unit/test_extractor_positions.py -v -s
```

**Step 3: Update _format_extracted_fields in smart_field_extractor.py**

Modify the `_format_extracted_fields` method around line 456:

```python
def _format_extracted_fields(self, extracted_fields: Dict) -> Dict[str, Dict[str, Any]]:
    """Format extracted fields to standard format with location data"""
    formatted_fields = {}
    for field_name, field_data in extracted_fields.items():
        if isinstance(field_data, dict) and field_data.get('value') is not None:
            value = str(field_data['value']).strip()
            if value and value.lower() not in ['null', 'none', '']:
                formatted_fields[field_name] = {
                    'value': value,
                    'confidence': float(field_data.get('confidence', 0.5)),
                    'source_text': field_data.get('reasoning', 'AI extracted'),
                    'location': {
                        'page': field_data.get('page', 1),
                        'bbox': field_data.get('bbox'),
                        'char_start': field_data.get('char_start'),
                        'char_end': field_data.get('char_end'),
                        'extraction_method': 'llm_intelligent'
                    }
                }
    return formatted_fields
```

**Step 4: Run test to verify it passes**

```bash
cd document-processor && python -m pytest tests/unit/test_extractor_positions.py -v -s
```

---

### Task 4: Create API Endpoint for Position Data

**Files:**
- Modify: `document-processor/app/routers/enhanced_documents.py`
- Test: Manual API test

**Step 1: Add new endpoint for getting field positions**

Add to `document-processor/app/routers/enhanced_documents.py`:

```python
@router.post("/field-positions")
async def get_field_positions(
    file: UploadFile = File(...),
    field_values: str = Form(..., description="JSON array of field values to locate")
):
    """
    Find positions of extracted field values in the document.

    Returns bounding box coordinates for each field value found.
    Used for highlighting extracted values in document preview.
    """
    import json

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    temp_file_path = None
    try:
        # Parse field values
        values_to_find = json.loads(field_values)
        if not isinstance(values_to_find, list):
            raise HTTPException(status_code=400, detail="field_values must be a JSON array")

        # Save file temporarily
        temp_file_path = Path(f"/tmp/{uuid.uuid4()}_{file.filename}")
        content = await file.read()
        with open(temp_file_path, "wb") as f:
            f.write(content)

        # Find positions using docling service
        from app.services.docling_service import docling_service
        positions = await docling_service.find_text_positions(
            temp_file_path,
            search_texts=values_to_find
        )

        return {
            "filename": file.filename,
            "positions": positions,
            "total_found": len(positions)
        }

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")
    except Exception as e:
        logger.error(f"Error getting field positions: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_file_path and temp_file_path.exists():
            temp_file_path.unlink()
```

**Step 2: Rebuild and test**

```bash
docker compose -p localai up -d --build document-processor
curl -X POST "http://localhost:8090/api/enhanced-documents/field-positions" \
  -F "file=@tests/fixtures/sample_documents/test_invoice.pdf" \
  -F 'field_values=["Invoice", "Total"]'
```

---

## Phase 2: Frontend - Install react-pdf and Create Highlight Components

### Task 5: Install react-pdf Library

**Files:**
- Modify: `localai-admin-dashboard/package.json`

**Step 1: Install dependencies**

```bash
cd localai-admin-dashboard && npx pnpm add react-pdf pdfjs-dist
```

**Step 2: Verify installation**

```bash
cd localai-admin-dashboard && npx pnpm build
```

---

### Task 6: Create Highlight Types

**Files:**
- Create: `localai-admin-dashboard/src/types/highlights.ts`

**Step 1: Create the types file**

```typescript
/**
 * Types for document highlighting
 */

export interface BoundingBox {
  /** Left position (0-1 normalized or pixels) */
  x: number;
  /** Top position (0-1 normalized or pixels) */
  y: number;
  /** Width */
  width: number;
  /** Height */
  height: number;
  /** Coordinate type */
  coordinateType: 'normalized' | 'pixel';
}

export interface FieldHighlight {
  /** Field name being highlighted */
  fieldName: string;
  /** Extracted value */
  value: string;
  /** Page number (1-indexed) */
  page: number;
  /** Bounding box for the highlight */
  bbox: BoundingBox | null;
  /** Highlight color (CSS color string) */
  color: string;
  /** Whether this highlight is currently active/selected */
  isActive: boolean;
  /** Confidence score */
  confidence: number;
}

export interface PageDimensions {
  width: number;
  height: number;
  pageNumber: number;
}

export interface HighlightOverlayProps {
  /** Highlights to render */
  highlights: FieldHighlight[];
  /** Current page number */
  currentPage: number;
  /** Page dimensions for coordinate mapping */
  pageDimensions: PageDimensions | null;
  /** Callback when highlight is clicked */
  onHighlightClick?: (highlight: FieldHighlight) => void;
  /** Callback when highlight is hovered */
  onHighlightHover?: (highlight: FieldHighlight | null) => void;
}

export interface DocumentHighlightState {
  highlights: FieldHighlight[];
  activeHighlight: string | null;  // field name
  hoveredHighlight: string | null;
  isLoading: boolean;
  error: string | null;
}

/** Color palette for highlights */
export const HIGHLIGHT_COLORS = {
  default: 'rgba(255, 255, 0, 0.3)',      // Yellow
  active: 'rgba(0, 123, 255, 0.4)',        // Blue
  hover: 'rgba(255, 165, 0, 0.4)',         // Orange
  highConfidence: 'rgba(0, 200, 0, 0.3)',  // Green
  lowConfidence: 'rgba(255, 100, 100, 0.3)', // Red
} as const;

/** Get highlight color based on state and confidence */
export function getHighlightColor(
  highlight: FieldHighlight,
  isHovered: boolean,
  isActive: boolean
): string {
  if (isActive) return HIGHLIGHT_COLORS.active;
  if (isHovered) return HIGHLIGHT_COLORS.hover;
  if (highlight.confidence >= 0.9) return HIGHLIGHT_COLORS.highConfidence;
  if (highlight.confidence < 0.6) return HIGHLIGHT_COLORS.lowConfidence;
  return highlight.color || HIGHLIGHT_COLORS.default;
}
```

**Step 2: Export from types index**

Add to `localai-admin-dashboard/src/types/index.ts` (create if not exists):
```typescript
export * from './highlights';
```

---

### Task 7: Create HighlightOverlay Component

**Files:**
- Create: `localai-admin-dashboard/src/components/documents/HighlightOverlay.tsx`

**Step 1: Create the overlay component**

```typescript
/**
 * HighlightOverlay - Renders highlight rectangles over document content
 */
import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  FieldHighlight,
  PageDimensions,
  getHighlightColor,
} from '@/types/highlights';

interface HighlightOverlayProps {
  highlights: FieldHighlight[];
  currentPage: number;
  pageDimensions: PageDimensions | null;
  activeHighlight: string | null;
  hoveredHighlight: string | null;
  onHighlightClick?: (highlight: FieldHighlight) => void;
  onHighlightHover?: (highlight: FieldHighlight | null) => void;
  className?: string;
}

export function HighlightOverlay({
  highlights,
  currentPage,
  pageDimensions,
  activeHighlight,
  hoveredHighlight,
  onHighlightClick,
  onHighlightHover,
  className,
}: HighlightOverlayProps) {
  // Filter highlights for current page
  const pageHighlights = useMemo(
    () => highlights.filter((h) => h.page === currentPage && h.bbox),
    [highlights, currentPage]
  );

  if (!pageDimensions || pageHighlights.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute inset-0 pointer-events-none',
        className
      )}
      style={{
        width: pageDimensions.width,
        height: pageDimensions.height,
      }}
    >
      {pageHighlights.map((highlight, index) => {
        if (!highlight.bbox) return null;

        const isActive = activeHighlight === highlight.fieldName;
        const isHovered = hoveredHighlight === highlight.fieldName;
        const color = getHighlightColor(highlight, isHovered, isActive);

        // Convert normalized coordinates to pixels if needed
        const { x, y, width, height, coordinateType } = highlight.bbox;
        const pixelX = coordinateType === 'normalized'
          ? x * pageDimensions.width
          : x;
        const pixelY = coordinateType === 'normalized'
          ? y * pageDimensions.height
          : y;
        const pixelWidth = coordinateType === 'normalized'
          ? width * pageDimensions.width
          : width;
        const pixelHeight = coordinateType === 'normalized'
          ? height * pageDimensions.height
          : height;

        return (
          <div
            key={`${highlight.fieldName}-${index}`}
            className={cn(
              'absolute rounded-sm transition-all duration-150',
              'pointer-events-auto cursor-pointer',
              isActive && 'ring-2 ring-blue-500 ring-offset-1',
              isHovered && 'ring-1 ring-orange-400'
            )}
            style={{
              left: pixelX,
              top: pixelY,
              width: pixelWidth,
              height: pixelHeight,
              backgroundColor: color,
              zIndex: isActive ? 20 : isHovered ? 15 : 10,
            }}
            onClick={() => onHighlightClick?.(highlight)}
            onMouseEnter={() => onHighlightHover?.(highlight)}
            onMouseLeave={() => onHighlightHover?.(null)}
            title={`${highlight.fieldName}: ${highlight.value} (${Math.round(highlight.confidence * 100)}%)`}
          />
        );
      })}
    </div>
  );
}
```

---

### Task 8: Create PDF Viewer with Highlights

**Files:**
- Create: `localai-admin-dashboard/src/components/documents/PDFViewerWithHighlights.tsx`

**Step 1: Create the PDF viewer component**

```typescript
/**
 * PDFViewerWithHighlights - PDF viewer using react-pdf with highlight overlay
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { HighlightOverlay } from './HighlightOverlay';
import { FieldHighlight, PageDimensions } from '@/types/highlights';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PDFViewerWithHighlightsProps {
  /** PDF file URL or blob */
  file: string | Blob;
  /** Highlights to display */
  highlights: FieldHighlight[];
  /** Active field name */
  activeHighlight: string | null;
  /** Callback when highlight is clicked */
  onHighlightClick?: (highlight: FieldHighlight) => void;
  /** Callback for page change */
  onPageChange?: (page: number) => void;
  /** Custom class name */
  className?: string;
}

export function PDFViewerWithHighlights({
  file,
  highlights,
  activeHighlight,
  onHighlightClick,
  onPageChange,
  className,
}: PDFViewerWithHighlightsProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [pageDimensions, setPageDimensions] = useState<PageDimensions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredHighlight, setHoveredHighlight] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback((err: Error) => {
    setError(err.message);
    setIsLoading(false);
  }, []);

  const onPageLoadSuccess = useCallback((page: { width: number; height: number }) => {
    setPageDimensions({
      width: page.width * scale,
      height: page.height * scale,
      pageNumber: currentPage,
    });
  }, [currentPage, scale]);

  const goToPage = useCallback((page: number) => {
    const newPage = Math.max(1, Math.min(page, numPages));
    setCurrentPage(newPage);
    onPageChange?.(newPage);
  }, [numPages, onPageChange]);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  }, []);

  // Navigate to page with active highlight
  useEffect(() => {
    if (activeHighlight) {
      const highlight = highlights.find((h) => h.fieldName === activeHighlight);
      if (highlight && highlight.page !== currentPage) {
        goToPage(highlight.page);
      }
    }
  }, [activeHighlight, highlights, currentPage, goToPage]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {currentPage} of {numPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm w-16 text-center">{Math.round(scale * 100)}%</span>
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Document container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-muted/30 p-4"
      >
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full text-destructive">
            <p>Error loading PDF: {error}</p>
          </div>
        )}

        <div className="relative inline-block mx-auto">
          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={null}
          >
            <Page
              pageNumber={currentPage}
              scale={scale}
              onLoadSuccess={onPageLoadSuccess}
              renderTextLayer={true}
              renderAnnotationLayer={true}
            />
          </Document>

          {/* Highlight overlay */}
          <HighlightOverlay
            highlights={highlights}
            currentPage={currentPage}
            pageDimensions={pageDimensions}
            activeHighlight={activeHighlight}
            hoveredHighlight={hoveredHighlight}
            onHighlightClick={onHighlightClick}
            onHighlightHover={(h) => setHoveredHighlight(h?.fieldName ?? null)}
          />
        </div>
      </div>
    </div>
  );
}
```

---

### Task 9: Create Image Viewer with Highlights

**Files:**
- Create: `localai-admin-dashboard/src/components/documents/ImageViewerWithHighlights.tsx`

**Step 1: Create the image viewer component**

```typescript
/**
 * ImageViewerWithHighlights - Image viewer with canvas-based highlight overlay
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Loader2, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { HighlightOverlay } from './HighlightOverlay';
import { FieldHighlight, PageDimensions } from '@/types/highlights';

interface ImageViewerWithHighlightsProps {
  /** Image URL */
  src: string;
  /** Alt text */
  alt: string;
  /** Highlights to display */
  highlights: FieldHighlight[];
  /** Active field name */
  activeHighlight: string | null;
  /** Callback when highlight is clicked */
  onHighlightClick?: (highlight: FieldHighlight) => void;
  /** Custom class name */
  className?: string;
}

export function ImageViewerWithHighlights({
  src,
  alt,
  highlights,
  activeHighlight,
  onHighlightClick,
  className,
}: ImageViewerWithHighlightsProps) {
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<PageDimensions | null>(null);
  const [hoveredHighlight, setHoveredHighlight] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
    if (imageRef.current) {
      setDimensions({
        width: imageRef.current.naturalWidth * scale,
        height: imageRef.current.naturalHeight * scale,
        pageNumber: 1,
      });
    }
  }, [scale]);

  const handleImageError = useCallback(() => {
    setError('Failed to load image');
    setIsLoading(false);
  }, []);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.25, 0.25));
  }, []);

  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  // Update dimensions when scale changes
  useEffect(() => {
    if (imageRef.current && !isLoading) {
      setDimensions({
        width: imageRef.current.naturalWidth * scale,
        height: imageRef.current.naturalHeight * scale,
        pageNumber: 1,
      });
    }
  }, [scale, isLoading]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/50">
        <span className="text-sm text-muted-foreground">{alt}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm w-16 text-center">{Math.round(scale * 100)}%</span>
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleRotate}>
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Image container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-muted/30 p-4 flex items-center justify-center"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full text-destructive">
            <p>{error}</p>
          </div>
        )}

        <div
          className="relative inline-block"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: 'transform 0.3s ease',
          }}
        >
          <img
            ref={imageRef}
            src={src}
            alt={alt}
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{
              width: dimensions?.width ?? 'auto',
              height: dimensions?.height ?? 'auto',
              maxWidth: 'none',
            }}
            className="block"
          />

          {/* Highlight overlay */}
          {dimensions && (
            <HighlightOverlay
              highlights={highlights}
              currentPage={1}
              pageDimensions={dimensions}
              activeHighlight={activeHighlight}
              hoveredHighlight={hoveredHighlight}
              onHighlightClick={onHighlightClick}
              onHighlightHover={(h) => setHoveredHighlight(h?.fieldName ?? null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

---

### Task 10: Update DocumentPreviewPanel to Use New Viewers

**Files:**
- Modify: `localai-admin-dashboard/src/features/documents/components/DocumentPreviewPanel.tsx`

**Step 1: Read the existing file**

Already read above.

**Step 2: Replace the component with highlights support**

Replace the entire content of `DocumentPreviewPanel.tsx`:

```typescript
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, Image, ExternalLink, AlertCircle, Highlighter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PDFViewerWithHighlights } from '@/components/documents/PDFViewerWithHighlights';
import { ImageViewerWithHighlights } from '@/components/documents/ImageViewerWithHighlights';
import { FieldHighlight, HIGHLIGHT_COLORS } from '@/types/highlights';

interface DocumentPreviewPanelProps {
  fileUrl: string | null;
  fileName: string;
  fileType: string;
  fileSize?: number;
  className?: string;
  /** Extracted field values with position data for highlighting */
  extractedFields?: Record<string, {
    value: unknown;
    confidence?: number;
    location?: {
      page?: number;
      bbox?: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    };
  }>;
  /** Active field to highlight */
  activeField?: string | null;
  /** Callback when a highlight is clicked */
  onHighlightClick?: (fieldName: string) => void;
  /** Whether to show highlights */
  showHighlights?: boolean;
}

export function DocumentPreviewPanel({
  fileUrl,
  fileName,
  fileType,
  fileSize,
  className,
  extractedFields,
  activeField,
  onHighlightClick,
  showHighlights = true,
}: DocumentPreviewPanelProps) {
  const [highlightsEnabled, setHighlightsEnabled] = useState(showHighlights);
  const [hasError, setHasError] = useState(false);

  const isPdf = fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
  const isImage = fileType.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|tiff?)$/i.test(fileName);

  // Convert extracted fields to highlights
  const highlights: FieldHighlight[] = useMemo(() => {
    if (!extractedFields || !highlightsEnabled) return [];

    return Object.entries(extractedFields)
      .filter(([_, field]) => field.location?.bbox)
      .map(([name, field]) => ({
        fieldName: name,
        value: String(field.value ?? ''),
        page: field.location?.page ?? 1,
        bbox: field.location?.bbox ? {
          x: field.location.bbox.x,
          y: field.location.bbox.y,
          width: field.location.bbox.width,
          height: field.location.bbox.height,
          coordinateType: 'normalized' as const,
        } : null,
        color: HIGHLIGHT_COLORS.default,
        isActive: name === activeField,
        confidence: field.confidence ?? 0.5,
      }));
  }, [extractedFields, highlightsEnabled, activeField]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = async () => {
    if (!fileUrl) return;
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const downloadName = isPdf && !fileName.toLowerCase().endsWith('.pdf')
        ? `${fileName}.pdf`
        : fileName;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleOpenInNewTab = () => {
    if (fileUrl) {
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleHighlightClick = (highlight: FieldHighlight) => {
    onHighlightClick?.(highlight.fieldName);
  };

  const hasHighlightData = highlights.length > 0;

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {isPdf ? <FileText className="h-5 w-5" /> : <Image className="h-5 w-5" />}
            Original Document
          </CardTitle>
          <div className="flex gap-2">
            {hasHighlightData && (
              <Button
                variant={highlightsEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={() => setHighlightsEnabled(!highlightsEnabled)}
                title={highlightsEnabled ? 'Hide highlights' : 'Show highlights'}
              >
                <Highlighter className="h-4 w-4 mr-1" />
                {highlightsEnabled ? 'Highlights On' : 'Highlights Off'}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenInNewTab}
              disabled={!fileUrl}
              title="Open in new tab"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Open
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleDownload}
              disabled={!fileUrl}
              title="Download document"
            >
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {fileName}
          {fileSize && ` • ${formatFileSize(fileSize)}`}
          {hasHighlightData && highlightsEnabled && ` • ${highlights.length} fields highlighted`}
        </p>
      </CardHeader>
      <CardContent className="flex-1 min-h-[400px]">
        {!fileUrl ? (
          <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/30 rounded-lg">
            <div className="text-center p-8">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No document file available</p>
              <p className="text-sm mt-1">The document file could not be loaded</p>
            </div>
          </div>
        ) : hasError ? (
          <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/30 rounded-lg">
            <div className="text-center p-8">
              <AlertCircle className="h-16 w-16 mx-auto mb-4 opacity-30 text-destructive" />
              <p className="font-medium">Unable to preview document</p>
              <p className="text-sm mt-1 mb-4">The preview could not be loaded</p>
              <Button variant="outline" size="sm" onClick={handleOpenInNewTab}>
                <ExternalLink className="h-4 w-4 mr-1" />
                Open in new tab
              </Button>
            </div>
          </div>
        ) : isPdf ? (
          <PDFViewerWithHighlights
            file={fileUrl}
            highlights={highlights}
            activeHighlight={activeField ?? null}
            onHighlightClick={handleHighlightClick}
            className="h-full"
          />
        ) : isImage ? (
          <ImageViewerWithHighlights
            src={fileUrl}
            alt={fileName}
            highlights={highlights}
            activeHighlight={activeField ?? null}
            onHighlightClick={handleHighlightClick}
            className="h-full"
          />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center p-8">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium">Preview not available</p>
              <p className="text-sm mt-1 mb-4">This file type cannot be previewed</p>
              <Button variant="default" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1" />
                Download to view
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

### Task 11: Update DualDocumentView to Pass Highlight Data

**Files:**
- Modify: `localai-admin-dashboard/src/features/documents/components/DualDocumentView.tsx`

**Step 1: Update the component to pass extracted fields**

Update the `DualDocumentView` component to pass extractedFields with location data to DocumentPreviewPanel. Add these props and pass them through:

```typescript
// Add to DualDocumentViewProps interface:
/** Active field being edited/viewed */
activeField?: string | null;
/** Callback when a highlighted field is clicked */
onFieldHighlightClick?: (fieldName: string) => void;

// Update DocumentPreviewPanel usage:
<DocumentPreviewPanel
  fileUrl={fileUrl}
  fileName={fileName}
  fileType={fileType}
  fileSize={fileSize}
  className="h-full"
  extractedFields={extractedFields}
  activeField={activeField}
  onHighlightClick={onFieldHighlightClick}
/>
```

---

### Task 12: Build and Test Frontend

**Step 1: Build the frontend**

```bash
cd localai-admin-dashboard && npx pnpm build
```

**Step 2: Fix any TypeScript errors**

Review and fix any compilation errors.

**Step 3: Start the development server for testing**

```bash
cd localai-admin-dashboard && npx pnpm dev
```

---

## Phase 3: Integration Testing

### Task 13: Create Integration Test

**Files:**
- Create: `localai-admin-dashboard/src/__tests__/integration/document-highlighting.test.ts`

**Step 1: Write integration test**

```typescript
/**
 * Integration tests for document highlighting feature
 */
import { describe, it, expect, beforeAll } from 'vitest';

const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost:8090';

describe('Document Highlighting Integration', () => {
  beforeAll(async () => {
    // Verify backend is available
    const response = await fetch(`${BACKEND_URL}/health`);
    if (!response.ok) {
      throw new Error('Backend not available - cannot run integration test');
    }
  });

  it('should return field positions from backend', async () => {
    // Create a test file
    const testContent = 'Invoice Number: INV-001\nTotal: $100.00';
    const blob = new Blob([testContent], { type: 'text/plain' });
    const formData = new FormData();
    formData.append('file', blob, 'test.txt');
    formData.append('field_values', JSON.stringify(['Invoice Number', 'Total']));

    const response = await fetch(`${BACKEND_URL}/api/enhanced-documents/field-positions`, {
      method: 'POST',
      body: formData,
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.positions).toBeDefined();
    expect(Array.isArray(data.positions)).toBe(true);
  });

  it('should include location data in extraction response', async () => {
    const testContent = 'Invoice Number: INV-001\nTotal: $100.00';
    const blob = new Blob([testContent], { type: 'text/plain' });
    const formData = new FormData();
    formData.append('file', blob, 'test.txt');
    formData.append('template_data', JSON.stringify({
      smart_variables: [
        { name: 'invoice_number', type: 'text', description: 'Invoice number' },
        { name: 'total', type: 'currency', description: 'Total amount' },
      ],
    }));

    const response = await fetch(`${BACKEND_URL}/api/enhanced-documents/process-with-ai`, {
      method: 'POST',
      body: formData,
    });

    expect(response.ok).toBe(true);
    const data = await response.json();

    // Check that extracted fields have location structure
    const extractedData = data.extracted_data?.extracted_values;
    if (extractedData) {
      Object.values(extractedData).forEach((field: any) => {
        expect(field).toHaveProperty('location');
      });
    }
  });
});
```

**Step 2: Run the integration test**

```bash
cd localai-admin-dashboard && npx vitest run src/__tests__/integration/document-highlighting.test.ts
```

---

## Summary

This implementation plan covers:

1. **Backend (Phase 1):**
   - Position data models
   - Docling bounding box extraction
   - Field position API endpoint
   - Enhanced extraction response with location data

2. **Frontend (Phase 2):**
   - react-pdf integration for PDF viewing with overlays
   - Highlight types and utilities
   - HighlightOverlay component for rendering highlights
   - PDFViewerWithHighlights for PDF documents
   - ImageViewerWithHighlights for images
   - Updated DocumentPreviewPanel with highlight support
   - DualDocumentView integration

3. **Testing (Phase 3):**
   - Unit tests for position extraction
   - Integration tests for full workflow

**Estimated Total Tasks:** 13 tasks
**Key Dependencies:** react-pdf, pdfjs-dist, Docling bounding box support
