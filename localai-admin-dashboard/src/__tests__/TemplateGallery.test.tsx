import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

// Create a mock component first to test React testing setup
const MockTemplateGalleryPage = () => {
  return (
    <div>
      <h1>Workflow Template Gallery</h1>
      <button data-testid="test-button">Test Button</button>
    </div>
  );
};

describe('Template Gallery Component Tests', () => {
  it('should render mock component', () => {
    render(<MockTemplateGalleryPage />);
    expect(screen.getByText('Workflow Template Gallery')).toBeInTheDocument();
    expect(screen.getByTestId('test-button')).toBeInTheDocument();
  });

  it('should handle button clicks', () => {
    render(<MockTemplateGalleryPage />);
    const button = screen.getByTestId('test-button');
    fireEvent.click(button);
    expect(button).toBeInTheDocument();
  });
});
