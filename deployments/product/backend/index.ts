import { parseEvidence } from '../shared/validate';
import { error, json, router } from '@appdeploy/sdk';

const sample = {
  format: 'oax-evidence.v1',
  method: 'context.preview',
  capturedAt: '2026-10-04T12:00:00.000Z',
  result: {
    context: {
      objective: 'Explain authenticateUser',
      path: 'src/auth.ts',
      range: {
        start: { line: 0, column: 0 },
        end: { line: 2, column: 1 },
      },
      documentVersion: 3,
      dirty: false,
      excerpt: 'export function authenticateUser() {\n  return login();\n}\n',
      truncated: false,
      provenance: 'editor-buffer',
      trust: 'untrusted',
      focusedSymbol: {
        id: 'fn:authenticateUser',
        name: 'authenticateUser',
        path: 'src/auth.ts',
        hash: 'sample-auth',
        range: {
          start: { line: 0, column: 0 },
          end: { line: 2, column: 1 },
        },
      },
      related: [
        {
          path: 'src/controller.ts',
          excerpt: 'AuthController.login()',
          hash: 'sample-login',
          reason: 'calls',
          resolution: 'semantic',
          range: {
            start: { line: 4, column: 2 },
            end: { line: 4, column: 22 },
          },
        },
      ],
      limitations: [
        'This cloud view reads an export. It does not index a private repository or approve a change.',
      ],
      redactions: 0,
    },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function inspectSource(input: string) {
  const { capturedAt, context } = parseEvidence(input);
  return {
    ...context,
    capturedAt,
    redactions: context.redactions ?? 0,
    focused: context.focusedSymbol
      ? { name: context.focusedSymbol.name, path: context.focusedSymbol.path }
      : { name: context.path, path: context.path },
    related: context.related ?? [],
    historical: context.historical ?? [],
    memory: context.memory ?? [],
    limitations: [
      ...(context.limitations ?? []),
      'Imported snapshot: current source freshness and historical intent are not independently verified. Reviewed notes remain untrusted claims.',
    ],
  };
}

export const handler = router({
  'GET /api/_healthcheck': [async () => json({ message: 'Success' })],
  'POST /api/inspect': [
    async ({ body }) => {
      const request = isRecord(body) ? body : {};
      const raw =
        request.sample === true ? JSON.stringify(sample) : request.source;
      if (typeof raw !== 'string' || raw.trim().length === 0) {
        return error(
          'Paste an oax-evidence.v1 export or inspect the public sample.',
          400,
        );
      }
      try {
        return json(inspectSource(raw));
      } catch {
        return error('This is not an oax-evidence.v1 export.', 400);
      }
    },
  ],
});
