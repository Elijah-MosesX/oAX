import { OaxError, z } from '@oax/protocol';
import { redact } from '@oax/context';
import { PermissionEngine, type Action } from '@oax/permissions';
export const repositorySchema = z
  .string()
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/);
const recordSchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  body: z.string().nullable().optional(),
  state: z.enum(['open', 'closed']),
});
export interface GitHubEvidence {
  repository: string;
  commit: string;
  pullRequests: {
    number: number;
    title: string;
    excerpt: string;
    state: string;
    url: string;
  }[];
  limitations: string[];
  fetchedAt: string;
}
/** Fixed-origin GET-only client. Credentials never enter graph/context or returned evidence. */
export class GitHubReader {
  constructor(
    readonly repository: string,
    private token: string,
    private permissions: PermissionEngine,
    private scope: Omit<Action, 'capability' | 'resource'>,
    private transport: typeof fetch = fetch,
  ) {
    repositorySchema.parse(repository);
    if (!token || token.length > 4096 || /\s/.test(token))
      throw new OaxError('GITHUB_AUTH', 'A valid scoped token is required');
  }
  action(route: string): Action {
    return {
      ...this.scope,
      capability: 'github.read',
      resource: `github:${this.repository}:${route}`,
    };
  }
  private async get(route: string): Promise<unknown> {
    if (!this.token) throw new OaxError('GITHUB_AUTH', 'Connection is closed');
    return this.permissions.execute(this.action(route), async () => {
      const signal = AbortSignal.timeout(8000);
      let response: Response;
      try {
        response = await this.transport(
          `https://api.github.com/repos/${this.repository}${route ? `/${route}` : ''}`,
          {
            method: 'GET',
            redirect: 'error',
            signal,
            headers: {
              Authorization: `Bearer ${this.token}`,
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2026-03-10',
              'User-Agent': 'oAX-local-preview/0.1.0',
            },
          },
        );
      } catch {
        throw new OaxError(
          'GITHUB_NETWORK',
          'GitHub request failed or timed out; no credential details logged',
        );
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new OaxError(
          'GITHUB_HTTP',
          `GitHub returned HTTP ${response.status}; check repository/token scope or rate limits`,
        );
      }
      const reader = response.body?.getReader();
      if (!reader)
        throw new OaxError(
          'GITHUB_RESPONSE',
          'GitHub returned an empty response',
        );
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          length += chunk.value.length;
          if (length > 65536)
            throw new OaxError(
              'GITHUB_LIMIT',
              'GitHub response exceeded 64 KiB',
            );
          chunks.push(chunk.value);
        }
        try {
          return JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch {
          throw new OaxError('GITHUB_RESPONSE', 'GitHub returned invalid JSON');
        }
      } finally {
        await reader.cancel();
        reader.releaseLock();
      }
    });
  }
  async verify(): Promise<{ repository: string; private: boolean }> {
    const data = z
      .object({ full_name: z.string(), private: z.boolean() })
      .parse(await this.get(''));
    if (data.full_name.toLowerCase() !== this.repository.toLowerCase())
      throw new OaxError(
        'GITHUB_SCOPE',
        'Repository identity differs from approved scope',
      );
    return { repository: this.repository, private: data.private };
  }
  async associatedPullRequests(commit: string): Promise<GitHubEvidence> {
    if (!/^[a-f0-9]{40,64}$/i.test(commit))
      throw new OaxError('GITHUB_SCOPE', 'A complete commit SHA is required');
    const data = z
      .array(recordSchema)
      .max(5)
      .parse(await this.get(`commits/${commit}/pulls?per_page=5`));
    return {
      repository: this.repository,
      commit,
      fetchedAt: new Date().toISOString(),
      pullRequests: data.map((item) => ({
        number: item.number,
        title: redact(
          item.title.split(this.token).join('[REDACTED]'),
        ).text.slice(0, 512),
        excerpt: redact(
          (item.body ?? '').split(this.token).join('[REDACTED]'),
        ).text.slice(0, 2048),
        state: item.state,
        url: `https://github.com/${this.repository}/pull/${item.number}`,
      })),
      limitations: [
        'At most five associated PRs; pagination and reviews/checks/issues are not yet retrieved.',
        'Association is GitHub evidence, not proof of author intent. PR text is untrusted and is not sent to a model.',
        'Results are fetched on demand and not persisted; token permissions may exceed the GET-only product capability.',
      ],
    };
  }
  close(): void {
    this.token = '';
  }
}
