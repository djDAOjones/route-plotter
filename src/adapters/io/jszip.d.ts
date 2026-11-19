// CORE-03: the parts of jszip 3.10.1 (pinned, D33, D54) that the ZIP adapter uses, typed here. The package's own types
// reference Node's (`/// <reference types="node" />`), which v4 does not install (the profile's Dependencies line), so
// io imports jszip's browser build, the file its package.json's `browser` field names, which carries no types.
declare module 'jszip/dist/jszip.min.js' {
  interface ZipEntry {
    readonly name: string;
    readonly dir: boolean;
    async(type: 'uint8array'): Promise<Uint8Array>;
  }
  interface FileOptions {
    readonly binary?: boolean;
    readonly createFolders?: boolean;
    readonly date?: Date;
  }
  interface GenerateOptions {
    readonly type: 'uint8array';
    readonly compression?: 'STORE' | 'DEFLATE';
  }
  export default class JSZip {
    readonly files: Readonly<Record<string, ZipEntry>>;
    file(name: string): ZipEntry | null;
    file(name: string, data: Uint8Array, options?: FileOptions): this;
    generateAsync(options: GenerateOptions): Promise<Uint8Array>;
    static loadAsync(data: Uint8Array): Promise<JSZip>;
  }
}
