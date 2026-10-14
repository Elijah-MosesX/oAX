# Python, Java and Go syntax workers

All adapters use the same versioned protocol and Node runtime. Runtime sessions, grants, edits, verification and ordered events remain authoritative. Parser workers return evidence; they cannot authorize operations.

| Language                | Implemented indexing                                                       | Relationship limits                                                                            |
| ----------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| TypeScript / JavaScript | TypeScript compiler, SQLite symbols, local-relative semantic relationships | Existing documented project/module subset; not every build configuration                       |
| Python                  | Python `ast`, functions/classes, imports/calls, UTF-8 to UTF-16 conversion | Unique file-local name matches are heuristic; imports and qualified/ambiguous calls unresolved |
| Go                      | Go `parser`/`ast`, functions/methods/types/interfaces and imports/calls    | Syntax only; no package type checking or generators                                            |
| Java                    | Java 21 compiler tree API, declarations/imports/invocations                | Parse only with annotation processing disabled; no classpath/type resolution                   |

New language workers preserve exact supplied snapshots, including unsaved overlays. Deletion and syntax errors invalidate prior symbols. They do not run repository code, load project plugins, resolve cross-language calls or enable additional-language rename refactoring. Missing configuration produces explicit limitations while file snapshots remain available.

## Windows setup

Run `powershell -File scripts/setup-languages.ps1 -Jdk <absolute-JDK-21-directory>`. It downloads and checksum-verifies Go 1.27.1, compiles the Go/Java workers and copies the Python worker into `.tools/language-workers`. Python 3.12+ must already be installed. Tools remain local to the checkout.

Configure these absolute paths in the environment before launching CLI, desktop, Vim or Neovim:

```powershell
$env:OAX_LANGUAGE_WORKERS = (Resolve-Path .tools/language-workers).Path
$env:OAX_PYTHON = 'C:/path/to/python.exe'
$env:OAX_JAVA = 'C:/path/to/jdk-21/bin/java.exe'
$env:OAX_GO_PARSER = (Resolve-Path .tools/language-workers/go_parser.exe).Path
corepack pnpm test:languages
node dist/cli.cjs query callers path/to/source.py 1 4
```

VS Code exposes application-scoped `oax.languageWorkersDirectory`, `oax.pythonExecutable`, `oax.javaExecutable`, and `oax.goParserExecutable`. Only global user values are read; repositories cannot choose executables through workspace settings. Reconnect after changes. Equivalent process environment paths are supported.

The acceptance command uses all three real parsers and the built stdio runtime. It checks declarations, caller candidates, Unicode ranges, comments, unchanged snapshots, unsaved replacement, syntax failures and deletion. Normal unit tests do not require downloaded toolchains. Output is versioned, bounded and validated; execution has a 20-second deadline, 8 MiB output cap, no shell and a reduced environment. These are process controls, not an OS sandbox.

Python also implements the Jev browser-planning worker; Java implements the compiled JetBrains adapter. JetBrains packaging/live acceptance and broader semantic indexing remain separate gates. GitHub's language chart measures source bytes, not compatibility.
