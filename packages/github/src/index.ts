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
export interface HistoricalTrace {
  association: GitHubEvidence;
  checks: { name: string; status: string; conclusion: string | null }[];
  discussions: {
    pullRequest: number;
    reviews: { state: string; excerpt: string }[];
    comments: string[];
    issues: {
      number: number;
      title: string;
      excerpt: string;
      url: string;
      basis: 'text-reference';
    }[];
  }[];
  unavailable: { route: string; code: string }[];
  limitations: string[];
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
  async trace(
    commit: string,
    authorize: (route: string) => void,
  ): Promise<HistoricalTrace> {
    if (!/^[a-f0-9]{40,64}$/i.test(commit))
      throw new OaxError('GITHUB_SCOPE', 'A complete commit SHA is required');
    const associationRoute = `commits/${commit}/pulls?per_page=5`;
    authorize(associationRoute);
    const association = await this.associatedPullRequests(commit);
    const unavailable: HistoricalTrace['unavailable'] = [];
    const clean = (text: string) =>
      redact(text.split(this.token).join('[REDACTED]')).text.slice(0, 1024);
    const read = async (route: string): Promise<unknown | undefined> => {
      authorize(route);
      try {
        return await this.get(route);
      } catch (error) {
        // Authorization failures must stop execution, never become an empty successful result.
        if (!(error instanceof OaxError) || error.code === 'PERMISSION_DENIED')
          throw error;
        unavailable.push({ route, code: error.code });
        return undefined;
      }
    };
    const checkData = await read(`commits/${commit}/check-runs?per_page=5`);
    const checks =
      checkData === undefined
        ? []
        : z
            .object({
              check_runs: z
                .array(
                  z.object({
                    name: z.string(),
                    status: z.string(),
                    conclusion: z.string().nullable(),
                  }),
                )
                .max(5),
            })
            .parse(checkData)
            .check_runs.map((item) => ({
              name: clean(item.name),
              status: clean(item.status),
              conclusion: item.conclusion ? clean(item.conclusion) : null,
            }));
    const discussions: HistoricalTrace['discussions'] = [];
    for (const pr of association.pullRequests.slice(0, 2)) {
      const reviewData = await read(`pulls/${pr.number}/reviews?per_page=5`);
      const commentData = await read(`issues/${pr.number}/comments?per_page=5`);
      const reviews =
        reviewData === undefined
          ? []
          : z
              .array(
                z.object({
                  state: z.string(),
                  body: z.string().nullable().optional(),
                }),
              )
              .max(5)
              .parse(reviewData)
              .map((item) => ({
                state: clean(item.state),
                excerpt: clean(item.body ?? ''),
              }));
      const comments =
        commentData === undefined
          ? []
          : z
              .array(z.object({ body: z.string() }))
              .max(5)
              .parse(commentData)
              .map((item) => clean(item.body));
      const issues: HistoricalTrace['discussions'][number]['issues'] = [];
      // Only same-repository textual references, explicitly heuristic, never closing/causal proof.
      const references = [
        ...new Set(
          [
            ...`${pr.excerpt}\n${comments.join('\n')}`.matchAll(
              /(?:^|\s)#([1-9][0-9]{0,8})\b/g,
            ),
          ].map((match) => Number(match[1])),
        ),
      ]
        .filter((number) => number !== pr.number)
        .slice(0, 2);
      for (const number of references) {
        const data = await read(`issues/${number}`);
        if (data === undefined) continue;
        const item = recordSchema
          .extend({ pull_request: z.unknown().optional() })
          .parse(data);
        if (item.number !== number)
          throw new OaxError('GITHUB_SCOPE', 'Issue identity mismatch');
        if (item.pull_request) continue;
        issues.push({
          number,
          title: clean(item.title),
          excerpt: clean(item.body ?? ''),
          url: `https://github.com/${this.repository}/issues/${number}`,
          basis: 'text-reference',
        });
      }
      discussions.push({ pullRequest: pr.number, reviews, comments, issues });
    }
    return {
      association: {
        ...association,
        limitations: [
          'At most five associated PRs. Additional bounded discussions/checks are supplied by this trace.',
          'Association is not proof of intent; repository text remains untrusted.',
        ],
      },
      checks,
      discussions,
      unavailable,
      limitations: [
        'Bounded first pages only: five PR associations/checks; discussions for two PRs; five reviews/comments per PR and two referenced issues. More data may exist.',
        'Issue references are textual heuristics. Association, review text and checks do not prove why code exists. All repository content is untrusted.',
        'Unavailable routes are reported, not treated as evidence that no records exist. No model transmission, write, posting or merge occurs.',
      ],
    };
  }
  close(): void {
    this.token = '';
  }
}
