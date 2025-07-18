import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LottieAnimation } from '../lottie';

// Mock lottie-react
vi.mock('lottie-react', () => ({
  default: vi.fn(({ animationData, className, loop, autoplay, style, onComplete, onLoopComplete, onError, onLoad, ...props }) => (
    <div 
      data-testid="lottie-animation"
      className={className}
      style={style}
      data-animation-data={JSON.stringify(animationData)}
      data-loop={loop}
      data-autoplay={autoplay}
      {...props}
    />
  )),
}));

describe('LottieAnimation', () => {
  const mockAnimationData = {
    v: "5.7.4",
    fr: 30,
    ip: 0,
    op: 90,
    w: 200,
    h: 200,
    nm: "Test Animation",
    ddd: 0,
    assets: [],
    layers: [],
    markers: []
  };

  it('renders with default props', () => {
    render(
      <LottieAnimation 
        animationData={mockAnimationData}
        data-testid="test-lottie"
      />
    );

    const lottieElement = screen.getByTestId('test-lottie');
    expect(lottieElement).toBeInTheDocument();
    expect(lottieElement).toHaveAttribute('data-loop', 'true');
    expect(lottieElement).toHaveAttribute('data-autoplay', 'true');
  });

  it('renders with custom props', () => {
    const onComplete = vi.fn();
    const onError = vi.fn();

    render(
      <LottieAnimation 
        animationData={mockAnimationData}
        loop={false}
        autoplay={false}
        className="custom-class"
        style={{ width: '100px', height: '100px' }}
        onComplete={onComplete}
        onError={onError}
        data-testid="test-lottie"
      />
    );

    const lottieElement = screen.getByTestId('test-lottie');
    expect(lottieElement).toBeInTheDocument();
    expect(lottieElement).toHaveAttribute('data-loop', 'false');
    expect(lottieElement).toHaveAttribute('data-autoplay', 'false');
    expect(lottieElement).toHaveClass('custom-class');
    expect(lottieElement).toHaveStyle({ width: '100px', height: '100px' });
  });

  it('applies default className with cn utility', () => {
    render(
      <LottieAnimation 
        animationData={mockAnimationData}
        data-testid="test-lottie"
      />
    );

    const lottieElement = screen.getByTestId('test-lottie');
    expect(lottieElement).toHaveClass('w-full h-full');
  });

  it('combines custom className with default className', () => {
    render(
      <LottieAnimation 
        animationData={mockAnimationData}
        className="custom-class"
        data-testid="test-lottie"
      />
    );

    const lottieElement = screen.getByTestId('test-lottie');
    expect(lottieElement).toHaveClass('w-full h-full custom-class');
  });
}); 