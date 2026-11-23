import { createHash, timingSafeEqual } from 'node:crypto';
import type { ClientCommand } from '../shared/types.js';

const configuredDemoToken = process.env.DEMO_ADMIN_TOKEN?.trim() ?? '';

export const DEMO_ADMIN_TOKEN = configuredDemoToken;
export const demoAdminRequired = configuredDemoToken.length > 0;

export class DemoAuthError extends Error {
  readonly status: 401 | 403;

  constructor(status: 401 | 403, message: string) {
    super(message);
    this.name = 'DemoAuthError';
    this.status = status;
  }
}

export function isProtectedCommand(command: ClientCommand): boolean {
  if (!command || typeof command.type !== 'string') return false;
  switch (command.type) {
    case 'reset':
    case 'portcullis':
    case 'analyze':
    case 'simulate':
      return true;
    default:
      return false;
  }
}

function tokenMatches(supplied: string): boolean {
  const expected = createHash('sha256').update(DEMO_ADMIN_TOKEN).digest();
  const actual = createHash('sha256').update(supplied).digest();
  return timingSafeEqual(expected, actual);
}

export function assertCommandAllowed(command: ClientCommand): void {
  if (!demoAdminRequired || !isProtectedCommand(command)) return;

  const supplied = typeof command.token === 'string' ? command.token.trim() : '';
  if (!supplied) {
    throw new DemoAuthError(401, 'This action needs the demo token. Use the lock icon in the top bar.');
  }
  if (!tokenMatches(supplied)) {
    throw new DemoAuthError(403, 'Demo token was not accepted.');
  }
}
