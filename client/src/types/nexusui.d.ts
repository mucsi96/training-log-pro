declare module 'nexusui' {
  export interface DialOptions {
    size?: [number, number];
    interaction?: 'radial' | 'vertical' | 'horizontal';
    mode?: 'absolute' | 'relative';
    min?: number;
    max?: number;
    step?: number;
    value?: number;
  }

  export class Dial {
    constructor(target: string | HTMLElement, options?: DialOptions);
    value: number;
    min: number;
    max: number;
    step: number;
    mode: 'absolute' | 'relative';
    colors: { accent: string; fill: string; light: string; dark: string; mediumLight: string; mediumDark: string };
    on(event: 'change', handler: (value: number) => void): void;
    colorize(type: 'accent' | 'fill' | 'light' | 'dark' | 'mediumLight' | 'mediumDark', color: string): void;
    resize(width: number, height: number): void;
    destroy(): void;
  }

  const Nexus: { Dial: typeof Dial };
  export default Nexus;
}
