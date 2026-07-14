export declare const Kontakte: {
  renderList(root: HTMLElement): Promise<void>;
  openForm(id?: number | string | null, defaultTyp?: string, firmaId?: number | string | null, onSaved?: (id: number) => void): Promise<void>;
  openDetail(k: any): Promise<void>;
  openKategorien(): Promise<void>;
};
