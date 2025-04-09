declare module 'node-fetch' {
  // Re-export the Response, Request and Headers types
  export * from 'node-fetch';
  
  // Export the fetch function as default
  export default function fetch(
    url: string | Request,
    init?: RequestInit
  ): Promise<Response>;
  
  // Define Response interface
  export interface Response {
    ok: boolean;
    status: number;
    statusText: string;
    headers: Headers;
    json(): Promise<any>;
    text(): Promise<string>;
    buffer(): Promise<Buffer>;
    // Add other methods as needed
  }
  
  // Define RequestInit interface
  export interface RequestInit {
    method?: string;
    headers?: HeadersInit;
    body?: BodyInit;
    // Add other properties as needed
  }
  
  // Other required types
  export type HeadersInit = Headers | Record<string, string> | [string, string][];
  export type BodyInit = string | Buffer | ReadableStream;
} 