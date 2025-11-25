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
}

export const LordIcon = ({
  src,
  trigger = 'hover',
  size = 32,
  colors,
  delay,
  className,
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
      style={{ width: size, height: size }}
      class={className}
    />
  );
};

// Add type definition for lord-icon element
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'lord-icon': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        trigger?: string;
        colors?: string;
        delay?: number;
        class?: string;
      };
    }
  }
}
