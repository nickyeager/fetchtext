import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LandingPage } from '../index';

// Mock the auth context
vi.mock('@/context/auth-context', () => ({
  useAuth: vi.fn(() => ({
    user: null,
  })),
}));

// Mock the router
vi.mock('@tanstack/react-router', () => ({
  Link: vi.fn(({ children, ...props }) => <a {...props}>{children}</a>),
  useNavigate: vi.fn(() => vi.fn()),
}));

// Mock the Lottie component
vi.mock('@/components/ui/lottie', () => ({
  LottieAnimation: vi.fn(({ animationData, className, ...props }) => (
    <div 
      data-testid="lottie-animation"
      className={className}
      data-animation-name={animationData?.nm || 'unknown'}
      {...props}
    />
  )),
}));

// Mock the lottie animations
vi.mock('@/lib/lottie-animations', () => ({
  getLottieAnimation: vi.fn((name) => ({ nm: name })),
  animationConfigs: {
    hero: { loop: true, autoplay: true },
    card: { loop: true, autoplay: true },
  },
}));

describe('LandingPage', () => {
  it('renders the landing page with hero animation', () => {
    render(<LandingPage />);

    // Check for main content
    expect(screen.getByText('Welcome to FetchText')).toBeInTheDocument();
    expect(screen.getByText('Extract, process, and manage your documents with AI-powered automation')).toBeInTheDocument();

    // Check for Lottie animations
    const lottieAnimations = screen.getAllByTestId('lottie-animation');
    expect(lottieAnimations.length).toBeGreaterThan(0);

    // Check for hero animation
    const heroAnimation = lottieAnimations.find(el => 
      el.getAttribute('data-animation-name') === 'hero'
    );
    expect(heroAnimation).toBeInTheDocument();
  });

  it('renders feature cards with animations', () => {
    render(<LandingPage />);

    // Check for feature cards
    expect(screen.getByText('Document Processing')).toBeInTheDocument();
    expect(screen.getByText('Workflow Management')).toBeInTheDocument();
    expect(screen.getByText('AI Integration')).toBeInTheDocument();

    // Check for feature descriptions
    expect(screen.getByText('Process and manage documents with AI-powered extraction and templating')).toBeInTheDocument();
    expect(screen.getByText('Create and manage automated workflows with N8N integration')).toBeInTheDocument();
    expect(screen.getByText('Leverage local AI models with Ollama and other AI services')).toBeInTheDocument();
  });

  it('renders navigation elements', () => {
    render(<LandingPage />);

    // Check for navigation links
    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(screen.getByText('Sign Up')).toBeInTheDocument();
    expect(screen.getByText('Get Started')).toBeInTheDocument();
  });

  it('renders the brand logo and name', () => {
    render(<LandingPage />);

    expect(screen.getByText('FetchText')).toBeInTheDocument();
  });

  it('has proper accessibility structure', () => {
    render(<LandingPage />);

    // Check for proper heading structure
    const mainHeading = screen.getByRole('heading', { level: 1 });
    expect(mainHeading).toHaveTextContent('Welcome to FetchText');

    // Check for navigation
    const navigation = screen.getByRole('navigation');
    expect(navigation).toBeInTheDocument();
  });
}); 