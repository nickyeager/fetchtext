/**
 * Types for document highlighting
 *
 * These types support the extracted value highlighting feature,
 * enabling visual feedback when users interact with extracted fields.
 */

/**
 * Bounding box coordinates for highlighting regions in documents
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

/**
 * Represents a single field highlight on a document
 */
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
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Dimensions for a document page
 */
export interface PageDimensions {
  width: number;
  height: number;
  pageNumber: number;
}

/**
 * Props for the highlight overlay component
 */
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

/**
 * State management for document highlights
 */
export interface DocumentHighlightState {
  highlights: FieldHighlight[];
  activeHighlight: string | null;  // field name
  hoveredHighlight: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Color palette for highlights - uses CSS rgba for transparency support
 */
export const HIGHLIGHT_COLORS = {
  default: 'rgba(255, 255, 0, 0.3)',         // Yellow
  active: 'rgba(0, 123, 255, 0.4)',          // Blue
  hover: 'rgba(255, 165, 0, 0.4)',           // Orange
  highConfidence: 'rgba(0, 200, 0, 0.3)',    // Green
  lowConfidence: 'rgba(255, 100, 100, 0.3)', // Red
} as const;

/**
 * Type for highlight color keys
 */
export type HighlightColorKey = keyof typeof HIGHLIGHT_COLORS;

/**
 * Get highlight color based on state and confidence
 *
 * @param highlight - The field highlight
 * @param isHovered - Whether the highlight is currently hovered
 * @param isActive - Whether the highlight is currently active/selected
 * @returns CSS color string for the highlight
 */
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

/**
 * Convert normalized coordinates (0-1) to pixel coordinates
 *
 * @param bbox - Bounding box with normalized coordinates
 * @param pageDimensions - Page dimensions for conversion
 * @returns Bounding box with pixel coordinates
 */
export function normalizedToPixel(
  bbox: BoundingBox,
  pageDimensions: PageDimensions
): BoundingBox {
  if (bbox.coordinateType === 'pixel') return bbox;

  return {
    x: bbox.x * pageDimensions.width,
    y: bbox.y * pageDimensions.height,
    width: bbox.width * pageDimensions.width,
    height: bbox.height * pageDimensions.height,
    coordinateType: 'pixel',
  };
}

/**
 * Convert pixel coordinates to normalized coordinates (0-1)
 *
 * @param bbox - Bounding box with pixel coordinates
 * @param pageDimensions - Page dimensions for conversion
 * @returns Bounding box with normalized coordinates
 */
export function pixelToNormalized(
  bbox: BoundingBox,
  pageDimensions: PageDimensions
): BoundingBox {
  if (bbox.coordinateType === 'normalized') return bbox;

  return {
    x: bbox.x / pageDimensions.width,
    y: bbox.y / pageDimensions.height,
    width: bbox.width / pageDimensions.width,
    height: bbox.height / pageDimensions.height,
    coordinateType: 'normalized',
  };
}

/**
 * Check if a point is within a bounding box
 *
 * @param x - X coordinate of the point
 * @param y - Y coordinate of the point
 * @param bbox - Bounding box to check against
 * @returns True if the point is within the bounding box
 */
export function isPointInBoundingBox(
  x: number,
  y: number,
  bbox: BoundingBox
): boolean {
  return (
    x >= bbox.x &&
    x <= bbox.x + bbox.width &&
    y >= bbox.y &&
    y <= bbox.y + bbox.height
  );
}

/**
 * Create a default field highlight from extraction data
 *
 * @param fieldName - Name of the extracted field
 * @param value - Extracted value
 * @param confidence - Confidence score
 * @param page - Page number (default 1)
 * @param bbox - Optional bounding box
 * @returns FieldHighlight object
 */
export function createFieldHighlight(
  fieldName: string,
  value: string,
  confidence: number,
  page: number = 1,
  bbox: BoundingBox | null = null
): FieldHighlight {
  return {
    fieldName,
    value,
    page,
    bbox,
    color: HIGHLIGHT_COLORS.default,
    isActive: false,
    confidence,
  };
}
