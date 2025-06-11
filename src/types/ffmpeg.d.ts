declare module '@ffmpeg/ffmpeg' {
  export class FFmpeg {
    load(options?: { coreURL?: string; wasmURL?: string }): Promise<void>;
    exec(args: string[]): Promise<void>;
    writeFile(name: string, data: Uint8Array | string): Promise<void>;
    readFile(name: string): Promise<Uint8Array>;
    deleteFile(name: string): Promise<void>;
    on(event: string, callback: (data: { message: string }) => void): void;
    off(event: string, callback?: (data: { message: string }) => void): void;
    loaded: boolean;
  }
}

declare module '@ffmpeg/util' {
  export function fetchFile(file: string | Blob | URL): Promise<Uint8Array>;
} 