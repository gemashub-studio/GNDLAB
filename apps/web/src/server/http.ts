import 'server-only';
import { InvalidMoistureError, MissingInputError, OverrideOutOfRangeError } from '@gemas/calc-engine';
import { DatasetError } from '@gemas/dataset';
import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';

/** Error API dengan status HTTP (ARD §9). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (msg: string) => new ApiError(404, 'NOT_FOUND', msg);
export const unauthorized = () => new ApiError(401, 'UNAUTHORIZED', 'Masuk (login) dulu ya untuk aksi ini');

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, 'BAD_JSON', 'Body bukan JSON yang valid');
  }
  return schema.parse(json);
}

/** Petakan error domain → respons JSON konsisten `{error:{code,message,details?}}`. */
export function toResponse(e: unknown): NextResponse {
  const body = (status: number, code: string, message: string, details?: unknown) =>
    NextResponse.json({ error: { code, message, ...(details !== undefined && { details }) } }, { status });

  if (e instanceof ApiError) return body(e.status, e.code, e.message, e.details);
  if (e instanceof ZodError) return body(422, 'VALIDATION', 'Input tidak valid', e.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  if (e instanceof OverrideOutOfRangeError) return body(422, e.code, e.message, { key: e.key, accepted: e.accepted });
  if (e instanceof InvalidMoistureError) return body(422, e.code, e.message);
  if (e instanceof MissingInputError) return body(422, e.code, e.message);
  if (e instanceof DatasetError) return body(422, 'DATASET', e.message);
  if (e instanceof RangeError) return body(422, 'RANGE', e.message);
  console.error('[api] error tak terduga', e);
  return body(500, 'INTERNAL', 'Terjadi kesalahan di server');
}

export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      return toResponse(e);
    }
  };
}
