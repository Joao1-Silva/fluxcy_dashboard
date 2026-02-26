import type { DetailedHTMLProps, HTMLAttributes } from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        src: string;
        alt?: string;
        'camera-controls'?: boolean;
        'auto-rotate'?: boolean;
        loading?: 'auto' | 'lazy' | 'eager';
        reveal?: 'auto' | 'interaction' | 'manual';
        'shadow-intensity'?: string;
        'interaction-prompt'?: 'auto' | 'when-focused' | 'none';
      };
    }
  }
}
