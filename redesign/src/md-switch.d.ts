import type { DOMAttributes } from 'react';
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'md-switch': DOMAttributes<HTMLElement> & {
        selected?: boolean;
        disabled?: boolean;
        class?: string;
        className?: string;
        style?: any;
        'aria-label'?: string;
        'data-tour-id'?: string;
      };
    }
  }
}
