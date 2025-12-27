/*
Agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DocumentsPage from '@/features/documents';

// Mock the TemplateGallery child component to prevent side effects.
vi.mock('@/features/documents/components/TemplateGallery', () => ({
  TemplateGallery: () => <div data-testid="mock-template-gallery" />,
}));

// Mock the router hooks as the component uses `useNavigate`.
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

describe('DocumentsPage Component Test', () => {
  it('should render layout and switch tabs correctly', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <DocumentsPage />
      </QueryClientProvider>
    );

    // 1. Check for the static content of the DocumentsPage.
    expect(screen.getByText('Document Automation')).toBeInTheDocument();
    expect(screen.getByText('Create intelligent documents using AI-powered templates')).toBeInTheDocument();

    // 2. Check that our mocked component is rendered inside the default active tab.
    expect(screen.getByTestId('mock-template-gallery')).toBeInTheDocument();

    // 3. The content of the inactive tab should not be visible.
    // `queryByText` returns null if not found, which is what we expect.
    expect(screen.queryByText('Project Proposal')).not.toBeInTheDocument();

    // 4. Find and click the "Generated Documents" tab.
    const generatedDocsTab = screen.getByText('Generated Documents');
    await user.click(generatedDocsTab);

    // 5. After clicking, wait for the content of the second tab to appear.
    await waitFor(() => {
      expect(screen.getByText('Project Proposal')).toBeInTheDocument();
    });
  });
});
