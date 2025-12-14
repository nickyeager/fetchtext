import { render, screen, waitFor } from '../../../test/test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queryClient } from '../../../test/test-utils';
import { CreateTemplateModal } from '../components/CreateTemplateModal';
import { DocumentTemplateService } from '../services/template-service';

describe('CreateTemplateModal', () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    // Reset mocks before each test
    onOpenChange.mockClear();
    queryClient.clear();

    // Mock the createTemplate service
    vi.spyOn(DocumentTemplateService, 'createTemplate').mockResolvedValue({
      id: 'new-id-123',
      name: 'Test Template',
      description: 'A test description',
      category: 'testing',
      template_content: 'Test content',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: 'mock-user-id',
      template_type: 'text',
    } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should call createTemplate service and close the modal on successful submission', async () => {
    const user = userEvent.setup();

    render(
      <CreateTemplateModal open={true} onOpenChange={onOpenChange} />,
      { route: '/' } // Basic route, not essential for this test
    );

    // 1. Verify the modal is open
    const dialogTitle = await screen.findByRole('heading', { name: /create new template/i });
    expect(dialogTitle).toBeInTheDocument();

    // 2. Fill out the form
    await user.type(screen.getByLabelText(/name/i), 'Test Template');
    await user.type(screen.getByLabelText(/description/i), 'A test description.');
    await user.type(screen.getByLabelText(/category/i), 'unit-testing');
    await user.type(screen.getByLabelText(/template content/i), 'This is the content for the unit test.');

    // 3. Click the "Save Template" button
    const saveButton = screen.getByRole('button', { name: /save template/i });
    await user.click(saveButton);

    // Advance timers to process the mutation
    await vi.runAllTimersAsync();

    // 4. Assert that the createTemplate service was called with the correct data
    await waitFor(() => {
      expect(DocumentTemplateService.createTemplate).toHaveBeenCalledWith({
        name: 'Test Template',
        description: 'A test description.',
        category: 'unit-testing',
        template_content: 'This is the content for the unit test.',
      });
    });

    // 5. Assert that the modal was closed
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
