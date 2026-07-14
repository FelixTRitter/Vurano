export declare const Router: {
  register(name: string, renderFn: (root: HTMLElement) => void | Promise<void>): void;
  navigate(hash: string): void;
  go(name: string): void;
  init(): void;
};
export declare const Shell: {
  toggleNav(): void;
  setCollapsed(v: boolean): void;
  enterDetail(node: string | HTMLElement): void;
  enterDetail2(spineLabel: string, onSpineClick: (() => void) | null, node: string | HTMLElement, spineSub?: string): void;
  exitDetail(): void;
};
