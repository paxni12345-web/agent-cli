/**
 * Type declarations for validation libraries
 */

declare module 'zod' {
  export class ZodError extends Error {
    errors: Array<{
      path: (string | number)[];
      message: string;
      code: string;
    }>;
  }

  export interface ZodSchema<T = any> {
    parse(data: unknown): T;
    optional(): ZodSchema<T | undefined>;
  }

  export const z: {
    string(): ZodSchema<string>;
    number(): ZodSchema<number>;
    boolean(): ZodSchema<boolean>;
    array<T>(schema: ZodSchema<T>): ZodSchema<T[]>;
    object<T extends Record<string, ZodSchema>>(shape: T): ZodSchema<{
      [K in keyof T]: T[K] extends ZodSchema<infer U> ? U : never;
    }>;
    record<T>(schema: ZodSchema<T>): ZodSchema<Record<string, T>>;
    any(): ZodSchema<any>;
    enum<T extends [string, ...string[]]>(values: T): ZodSchema<T[number]>;
  };

  export interface ZodString extends ZodSchema<string> {
    min(length: number): ZodString;
    max(length: number): ZodString;
    regex(pattern: RegExp): ZodString;
    email(): ZodString;
    url(): ZodString;
    uuid(): ZodString;
  }

  export interface ZodNumber extends ZodSchema<number> {
    min(value: number): ZodNumber;
    max(value: number): ZodNumber;
  }

  export interface ZodArray<T> extends ZodSchema<T[]> {
    min(length: number): ZodArray<T>;
    max(length: number): ZodArray<T>;
  }
}

declare module 'validator' {
  export function isEmail(str: string): boolean;
  export function isURL(str: string, options?: {
    protocols?: string[];
    require_protocol?: boolean;
  }): boolean;
  export function isMobilePhone(str: string, locale: string | string[], options?: {
    strictMode?: boolean;
  }): boolean;
  export function isUUID(str: string, version?: string | number): boolean;
  export function isIP(str: string, version?: string | number): boolean;
  export function isISO8601(str: string, options?: any): boolean;

  export default {
    isEmail,
    isURL,
    isMobilePhone,
    isUUID,
    isIP,
    isISO8601,
  };
}

declare module 'xss' {
  export interface IWhiteList {
    [tag: string]: string[];
  }

  export interface IFilterXSSOptions {
    whiteList?: IWhiteList;
    stripIgnoreTag?: boolean;
    stripIgnoreTagBody?: string[];
  }

  export default function xss(html: string, options?: IFilterXSSOptions): string;
}
