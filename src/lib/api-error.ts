export type Issue = { path: string; message: string };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly issues?: Issue[],
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
