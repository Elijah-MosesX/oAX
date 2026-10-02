import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { realpath } from 'node:fs/promises';
import { workspacePath, redact } from '@oax/context';
import { OaxError, type TextRange } from '@oax/protocol';
export interface HistoryEvidence {
  path: string;
  range: TextRange;
  commits: { sha: string; date: string; subject: string }[];
  blame: string;
  selectedCommits: string[];
  head: string;
  branches: string[];
  status: string;
  diff: string;
  limitations: string[];
}
/** Fixed local read commands; no shell, pager, text conversion, network, or mutations. */
export class GitHistory {
  constructor(private readonly directory: string) {}
  private async read(args: string[]): Promise<string> {
    const root = await realpath(this.directory);
    const env: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
      GIT_TERMINAL_PROMPT: '0',
      GIT_OPTIONAL_LOCKS: '0',
    };
    try {
      const result = await promisify(execFile)(
        'git',
        [
          '--no-pager',
          '-c',
          `safe.directory=${root}`,
          '-c',
          'core.fsmonitor=false',
          ...args,
        ],
        {
          cwd: root,
          env,
          windowsHide: true,
          shell: false,
          timeout: 10000,
          maxBuffer: 131072,
        },
      );
      return result.stdout;
    } catch {
      throw new OaxError(
        'GIT_READ_FAILED',
        'Local Git evidence unavailable; verify Git installation, repository state, and tracked file',
      );
    }
  }
  async history(resource: string, range: TextRange): Promise<HistoryEvidence> {
    await workspacePath(this.directory, resource);
    if (range.start.line < 0 || range.end.line < range.start.line)
      throw new OaxError('INVALID_RANGE', 'Invalid history range');
    const end =
      range.end.column === 0 && range.end.line > range.start.line
        ? range.end.line
        : range.end.line + 1;
    if (end - range.start.line > 200)
      throw new OaxError(
        'HISTORY_LIMIT',
        'Select at most 200 lines for history',
      );
    const head = (await this.read(['rev-parse', '--verify', 'HEAD'])).trim();
    const [log, blame] = await Promise.all([
      this.read([
        'log',
        '--follow',
        '-n',
        '10',
        '--format=%H%x00%cI%x00%s',
        '--',
        resource,
      ]),
      this.read([
        'blame',
        '--no-textconv',
        '--line-porcelain',
        '-L',
        `${range.start.line + 1},${end}`,
        '--',
        resource,
      ]),
    ]);
    const commits = log
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [sha, date, ...subject] = line.split('\0');
        return {
          sha: sha!,
          date: date!,
          subject: redact(subject.join('\0')).text.slice(0, 512),
        };
      });
    if (commits.some((commit) => !/^[a-f0-9]{40,64}$/.test(commit.sha)))
      throw new OaxError('GIT_PROTOCOL', 'Unexpected commit evidence');
    const evidence = {
      path: resource,
      range,
      commits,
      blame: redact(blame).text.slice(0, 12000),
      selectedCommits: [
        ...new Set(
          [...blame.matchAll(/^([a-f0-9]{40,64}) \d+ \d+(?: \d+)?$/gm)].map(
            (match) => match[1]!,
          ),
        ),
      ]
        .filter((sha) => !/^0+$/.test(sha))
        .slice(0, 5),
      head,
      branches: (
        await this.read([
          'for-each-ref',
          '--count=50',
          '--format=%(refname:short)',
          'refs/heads',
          'refs/remotes',
        ])
      )
        .trim()
        .split('\n')
        .filter(Boolean),
      status: redact(
        await this.read([
          'status',
          '--porcelain=v1',
          '--untracked-files=no',
          '--',
          resource,
        ]),
      ).text,
      diff: redact(
        await this.read([
          'diff',
          '--no-ext-diff',
          '--no-textconv',
          '--no-color',
          head,
          '--',
          resource,
        ]),
      ).text.slice(0, 16384),
      limitations: [
        'Evidence concerns saved tracked content. Commit subjects and blame establish changes, not the author’s underlying intent.',
        'Selected commit IDs come from blame for the chosen lines; file history may also include unrelated line changes. At most five selected commits, ten file commits and fifty branches.',
        'Diff is bounded to 16,384 characters and displayed blame to 12,000 characters; history is not proof of intent. Remote evidence requires an explicitly connected GitHub repository.',
      ],
    };
    if ((await this.read(['rev-parse', '--verify', 'HEAD'])).trim() !== head)
      throw new OaxError(
        'GIT_CHANGED',
        'Repository HEAD changed; retry history',
      );
    return evidence;
  }
}
