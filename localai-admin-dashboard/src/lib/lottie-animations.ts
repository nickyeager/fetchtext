// Import Lottie animation data
import documentProcessingAnimation from '@/assets/lottie/document-processing.json';
import workflowAutomationAnimation from '@/assets/lottie/workflow-automation.json';
import aiIntegrationAnimation from '@/assets/lottie/ai-integration.json';
import heroAnimation from '@/assets/lottie/hero-animation.json';

// Export animation data for use in components
export const lottieAnimations = {
  documentProcessing: documentProcessingAnimation,
  workflowAutomation: workflowAutomationAnimation,
  aiIntegration: aiIntegrationAnimation,
  hero: heroAnimation,
} as const;

// Type for animation names
export type LottieAnimationName = keyof typeof lottieAnimations;

// Helper function to get animation data by name
export function getLottieAnimation(name: LottieAnimationName) {
  return lottieAnimations[name];
}

// Animation configurations for different use cases
export const animationConfigs = {
  hero: {
    loop: true,
    autoplay: true,
    style: { width: '100%', height: '300px' },
  },
  feature: {
    loop: true,
    autoplay: true,
    style: { width: '100%', height: '120px' },
  },
  card: {
    loop: true,
    autoplay: true,
    style: { width: '100%', height: '80px' },
  },
} as const; 