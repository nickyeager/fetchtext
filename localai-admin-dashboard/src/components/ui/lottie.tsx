import React from 'react';
import Lottie from 'lottie-react';
import { cn } from '@/lib/utils';

interface LottieAnimationProps {
  animationData: any;
  className?: string;
  loop?: boolean;
  autoplay?: boolean;
  style?: React.CSSProperties;
  onComplete?: () => void;
  onLoopComplete?: () => void;
  onError?: (error: any) => void;
  onLoad?: () => void;
}

export function LottieAnimation({
  animationData,
  className,
  loop = true,
  autoplay = true,
  style,
  onComplete,
  onLoopComplete,
  onError,
  onLoad,
  ...props
}: LottieAnimationProps) {
  return (
    <Lottie
      animationData={animationData}
      className={cn('w-full h-full', className)}
      loop={loop}
      autoplay={autoplay}
      style={style}
      onComplete={onComplete}
      onLoopComplete={onLoopComplete}
      onError={onError}
      onLoad={onLoad}
      {...props}
    />
  );
} 