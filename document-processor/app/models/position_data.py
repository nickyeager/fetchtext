"""Position and bounding box data models for document highlighting.

These models are used to track the location of extracted field values
within documents, enabling visual highlighting on PDF and image previews.
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    """Bounding box coordinates for a text region.

    Coordinates can be either normalized (0-1 range relative to page size)
    or absolute pixel values. The coordinate_type field indicates which.
    """
    x: float = Field(..., description="Left position (0-1 normalized or pixel)")
    y: float = Field(..., description="Top position (0-1 normalized or pixel)")
    width: float = Field(..., description="Width of the bounding box")
    height: float = Field(..., description="Height of the bounding box")
    page: int = Field(default=1, ge=1, description="Page number (1-indexed)")
    coordinate_type: str = Field(
        default="normalized",
        description="Coordinate type: 'normalized' (0-1) or 'pixel'"
    )

    def to_pixel(self, page_width: float, page_height: float) -> "BoundingBox":
        """Convert normalized coordinates to pixel coordinates."""
        if self.coordinate_type == "pixel":
            return self
        return BoundingBox(
            x=self.x * page_width,
            y=self.y * page_height,
            width=self.width * page_width,
            height=self.height * page_height,
            page=self.page,
            coordinate_type="pixel"
        )

    def to_normalized(self, page_width: float, page_height: float) -> "BoundingBox":
        """Convert pixel coordinates to normalized coordinates."""
        if self.coordinate_type == "normalized":
            return self
        if page_width <= 0 or page_height <= 0:
            raise ValueError(f"Page dimensions must be positive (width={page_width}, height={page_height})")
        return BoundingBox(
            x=self.x / page_width,
            y=self.y / page_height,
            width=self.width / page_width,
            height=self.height / page_height,
            page=self.page,
            coordinate_type="normalized"
        )


class TextPosition(BaseModel):
    """Position information for extracted text.

    Contains both the text content and its location within the document,
    including optional character offsets for precise text selection.
    """
    text: str = Field(..., description="The extracted text content")
    bbox: Optional[BoundingBox] = Field(
        default=None,
        description="Bounding box for the text region"
    )
    page: int = Field(default=1, ge=1, description="Page number (1-indexed)")
    char_start: Optional[int] = Field(
        default=None,
        ge=0,
        description="Starting character offset in the document"
    )
    char_end: Optional[int] = Field(
        default=None,
        ge=0,
        description="Ending character offset in the document"
    )
    confidence: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Confidence score for the position match (0-1)"
    )


class FieldLocation(BaseModel):
    """Location data for an extracted field value.

    Tracks where a specific field's value appears in the document,
    potentially across multiple positions if the value is repeated.
    """
    field_name: str = Field(..., description="Name of the extracted field")
    value: str = Field(..., description="The extracted field value")
    positions: List[TextPosition] = Field(
        default_factory=list,
        description="All positions where this value appears"
    )
    best_match: Optional[TextPosition] = Field(
        default=None,
        description="The most confident match position"
    )
    source_text: Optional[str] = Field(
        default=None,
        description="Original source text context around the value"
    )

    def get_best_position(self) -> Optional[TextPosition]:
        """Get the best position, either explicitly set or highest confidence."""
        if self.best_match:
            return self.best_match
        if not self.positions:
            return None
        return max(self.positions, key=lambda p: p.confidence)


class DocumentPositions(BaseModel):
    """All position data for a document.

    Contains comprehensive position information for all extracted fields
    within a processed document, including page dimensions and raw data.
    """
    document_id: Optional[str] = Field(
        default=None,
        description="Unique identifier for the document"
    )
    page_count: int = Field(
        default=1,
        ge=1,
        description="Total number of pages in the document"
    )
    page_dimensions: List[Dict[str, float]] = Field(
        default_factory=list,
        description="Dimensions for each page: [{width, height}, ...]"
    )
    field_locations: List[FieldLocation] = Field(
        default_factory=list,
        description="Position data for all extracted fields"
    )
    raw_bboxes: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Raw bounding box output from document processing (e.g., Docling)"
    )

    def get_field_location(self, field_name: str) -> Optional[FieldLocation]:
        """Get location data for a specific field by name."""
        for loc in self.field_locations:
            if loc.field_name == field_name:
                return loc
        return None

    def get_fields_on_page(self, page: int) -> List[FieldLocation]:
        """Get all field locations that appear on a specific page."""
        result = []
        for loc in self.field_locations:
            page_positions = [p for p in loc.positions if p.page == page]
            if page_positions:
                # Create a copy with only positions on this page
                result.append(FieldLocation(
                    field_name=loc.field_name,
                    value=loc.value,
                    positions=page_positions,
                    best_match=loc.best_match if loc.best_match and loc.best_match.page == page else None,
                    source_text=loc.source_text
                ))
        return result
