import { redactSecrets, sanitizeHeaders } from './secrets.js';

export interface HttpErrorInit {
  method: string;
  url: string;
  status: number;
  statusText: string;
  requestHeaders?: HeadersInit;
  responseBody?: string;
  secretValues?: unknown;
  bodyLimit?: number;
}

export interface HttpErrorDiagnostics {
  method: string;
  name: string;
  requestHeaders: Record<string, string>;
  responseBody: string;
  status: number;
  statusText: string;
  url: string;
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}...[truncated]`;
}

function buildMessage(init: HttpErrorInit): string {
  const method = String(init.method || 'GET').toUpperCase();
  const url = redactSecrets(init.url, init.secretValues);
  const status = `${init.status}${init.statusText ? ` ${init.statusText}` : ''}`;
  const responseBody = truncate(
    redactSecrets(init.responseBody || '', init.secretValues),
    Math.max(0, init.bodyLimit ?? 800)
  );
  return responseBody
    ? `${method} ${url} failed: ${status} - ${responseBody}`
    : `${method} ${url} failed: ${status}`;
}

export class HttpError extends Error {
  readonly method: string;
  readonly url: string;
  readonly status: number;
  readonly statusText: string;
  readonly requestHeaders: HeadersInit | undefined;
  readonly responseBody: string;
  readonly secretValues: unknown;

  constructor(init: HttpErrorInit) {
    super(buildMessage(init));
    this.name = 'HttpError';
    this.method = String(init.method || 'GET').toUpperCase();
    this.url = init.url;
    this.status = init.status;
    this.statusText = init.statusText;
    this.requestHeaders = init.requestHeaders;
    this.responseBody = init.responseBody || '';
    this.secretValues = init.secretValues;
  }

  static async fromResponse(
    response: Response,
    init: Omit<HttpErrorInit, 'status' | 'statusText' | 'responseBody'> & {
      responseBody?: string;
    }
  ): Promise<HttpError> {
    const responseBody =
      init.responseBody ?? (await response.text().catch(() => ''));

    return new HttpError({
      ...init,
      status: response.status,
      statusText: response.statusText,
      responseBody
    });
  }

  toJSON(): HttpErrorDiagnostics {
    return {
      method: this.method,
      name: this.name,
      requestHeaders: sanitizeHeaders(this.requestHeaders, this.secretValues),
      responseBody: redactSecrets(this.responseBody, this.secretValues),
      status: this.status,
      statusText: this.statusText,
      url: redactSecrets(this.url, this.secretValues)
    };
  }
}
