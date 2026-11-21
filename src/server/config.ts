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
      return true;
    case 'analyze':
      return Boolean(command.forceAi);
    case 'simulate':
      return command.action === 'portcullis' || command.action === 'novel';
    default:
      return false;
  }
}

export function assertCommandAllowed(command: ClientCommand): void {
  if (!demoAdminRequired || !isProtectedCommand(command)) return;

  const supplied = typeof command.token === 'string' ? command.token.trim() : '';
  if (!supplied) {
    throw new DemoAuthError(401, 'This action needs the demo token. Use the lock icon in the top bar.');
  }
  if (supplied !== DEMO_ADMIN_TOKEN) {
    throw new DemoAuthError(403, 'Demo token was not accepted.');
  }
}
