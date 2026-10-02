import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { realpath } from 'node:fs/promises';
import { workspacePath } from '@oax/context';
import { OaxError, type TextRange } from '@oax/protocol';
export interface HistoryEvidence {
  path: string;
  range: TextRange;
  commits: { sha: string; date: string; subject: string }[];
  blame: string;
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
        return { sha: sha!, date: date!, subject: subject.join('\0') };
      });
    if (commits.some((commit) => !/^[a-f0-9]{40,64}$/.test(commit.sha)))
      throw new OaxError('GIT_PROTOCOL', 'Unexpected commit evidence');
    return {
      path: resource,
      range,
      commits,
      blame,
      limitations: [
        'Evidence concerns saved tracked content. Commit subjects and blame establish changes, not the author’s underlying intent.',
        'Pull request and issue evidence is not connected yet.',
      ],
    };
  }
}
