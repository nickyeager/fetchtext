/**
 * Framer Navbar Integration
 * 
 * This component wraps the Framer-exported navbar and adapts it for use
 * in our React application with proper TypeScript support.
 */

import React from 'react';
import FramerNavbarComponent from '../../../framer/navbar/navbar.jsx';

interface FramerNavbarProps {
  variant?: 'Desktop Light' | 'Desktop Dark' | 'Tablet Open Light' | 'Tablet Close Light' | 'Tablet Close Dark' | 'Tablet Open Dark' | 'Mobile Close Light' | 'Mobile Open Light' | 'Mobile Close Dark' | 'Mobile Open Dark';
  className?: string;
  style?: React.CSSProperties;
}

export function FramerNavbar({ 
  variant = 'Desktop Light',
  className,
  style 
}: FramerNavbarProps) {
  return (
    <FramerNavbarComponent
      variant={variant}
      className={className}
      style={style}
    />
  );
}

export default FramerNavbar;