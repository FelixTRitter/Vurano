export declare const showFatal: (msg: string) => void;
export declare const API: {
  get(url: string): Promise<any>;
  post(url: string, body?: any): Promise<any>;
  put(url: string, body?: any): Promise<any>;
  del(url: string): Promise<any>;
  upload(url: string, formData: FormData): Promise<any>;
};
export declare const fmt: Record<string, (...args: any[]) => string>;
export declare const fmtMonat: (s: string) => string;
export declare const fmtSize: (bytes: number) => string;
export declare const LAENDER: string[];
export declare const laenderOptions: (selected?: string) => string;
export declare const vcardEscape: (s: unknown) => string;
export declare const buildVCard: (k: any) => string;
export declare const qrSvgFor: (text: string) => string;
export declare const el: (html: string) => HTMLElement;
export declare const Modal: {
  open(title: string, body: string | HTMLElement, opts?: Record<string, any>): void;
  close(): void;
};
export declare const fieldVals: (scope: ParentNode) => Record<string, any>;
export declare const Sorter: { init(table: Element | null, opts?: Record<string, any>): void };
/** Hängt die Adress-Autovervollständigung an das Strassenfeld eines Formulars
 *  (füllt Strasse/PLZ/Ort und Land bzw. Ländercode). */
export declare const bindAdressSuche: (body: ParentNode) => void;
