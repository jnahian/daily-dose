import { useRef } from 'react';
import lottie from 'lottie-web';
import { defineElement } from '@lordicon/element';

// Initialize Lordicon element
try {
  // @ts-ignore
  defineElement(lottie.loadAnimation);
} catch (e) {
  // Already defined
}

interface LordIconProps {
  src: string;
  trigger?: 'hover' | 'click' | 'loop' | 'morph';
  size?: number;
  colors?: string;
  delay?: number;
  className?: string;
  target?: string;
}

export const LordIcon = ({
  src,
  trigger = 'hover',
  size = 32,
  colors,
  delay,
  className,
  target,
}: LordIconProps) => {
  const iconRef = useRef<HTMLElement>(null);

  return (
    // @ts-ignore
    <lord-icon
      ref={iconRef}
      src={src}
      trigger={trigger}
      colors={colors}
      delay={delay}
      target={target}
      style={{ width: size, height: size }}
      class={className}
    />
  );
};


