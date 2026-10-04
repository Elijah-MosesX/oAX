import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CodeGraph } from '@oax/codegraph';
import { Indexer } from '@oax/indexer';
import { PolyglotParser } from '../../services/indexer/src/polyglot.js';
import { RuntimeClient } from '../../packages/runtime/src/client.js';
async function main() {
  for (const key of [
    'OAX_LANGUAGE_WORKERS',
    'OAX_PYTHON',
    'OAX_JAVA',
    'OAX_GO_PARSER',
  ])
    if (!process.env[key])
      throw new Error(`Configure ${key} before actual language acceptance`);
  const root = await mkdtemp(path.join(tmpdir(), 'oax-languages-'));
  const graph = new CodeGraph();
  try {
    const fixtures = [
      {
        path: 'sample.py',
        text: '# def fake(): pass\ndef leaf():\n    return 1\ndef caller():\n    label = "🌍"; return leaf()\n',
        callee: 'leaf',
        caller: 'caller',
      },
      {
        path: 'sample.go',
        text: 'package sample\n// func Fake() {}\nfunc Leaf() int { return 1 }\nfunc Caller() int { _ = "🌍"; return Leaf() }\n',
        callee: 'Leaf',
        caller: 'Caller',
      },
      {
        path: 'Sample.java',
        text: 'class Sample {\n// void fake() {}\nint leaf() { return 1; }\nint caller() { String s = "🌍"; return leaf(); }\n}\n',
        callee: 'leaf',
        caller: 'caller',
      },
    ];
    for (const f of fixtures) await writeFile(path.join(root, f.path), f.text);
    const indexer = new Indexer(root, graph, new PolyglotParser());
    const initial = await indexer.refresh();
    assert.equal(initial.files, 3);
    for (const f of fixtures) {
      const leaf = graph
        .nodes()
        .find((n) => n.path === f.path && n.name === f.callee)!;
      assert.ok(leaf, `${f.path} parsed a declaration`);
      assert.equal(graph.focused(f.path, leaf.range.start)?.id, leaf.id);
      const callers = graph.related(leaf.id, 'callers');
      assert.ok(
        callers.relationships.some(
          (r) => r.node?.name === f.caller && r.edge.resolution === 'heuristic',
        ),
      );
      const edge = callers.relationships[0]!.edge;
      assert.equal(
        f.text
          .split('\n')
          [
            edge.evidence.range.start.line
          ]!.slice(edge.evidence.range.start.column, edge.evidence.range.end.column),
        f.callee,
      );
      assert.ok(
        !graph
          .nodes()
          .some((n) => n.path === f.path && n.name.toLowerCase() === 'fake'),
      );
    }
    assert.equal((await indexer.refresh()).changed, 0);
    const client = await RuntimeClient.connect(
      path.resolve('dist/cli.cjs'),
      root,
    );
    try {
      const { sessionId } = (await client.call('session.open', {})) as {
        sessionId: string;
      };
      for (const f of fixtures) {
        const leaf = graph
          .nodes()
          .find((n) => n.path === f.path && n.name === f.callee)!;
        const result = (await client.call(
          'graph.query',
          {
            observation: {
              path: f.path,
              uri: pathToFileURL(path.join(root, f.path)).href,
              text: f.text,
              documentVersion: 1,
              dirty: false,
              cursor: leaf.range.start,
              selection: leaf.range,
              visibleRanges: [],
              openFiles: [f.path],
            },
            relationship: 'callers',
          },
          sessionId,
        )) as { node?: { name: string }; relationships: unknown[] };
        assert.equal(result.node?.name, f.callee);
        assert.ok(result.relationships.length > 0);
      }
      const result = (await client.call('index.status', {}, sessionId)) as {
        files: number;
      };
      assert.equal(
        result.files,
        3,
        'All three languages flow through the actual stdio runtime',
      );
      await client.call('session.close', {}, sessionId);
    } finally {
      client.dispose();
    }
    await indexer.refresh([
      {
        path: 'sample.py',
        text: 'def fresh():\n    return 2\n',
        version: 2,
        dirty: true,
      },
    ]);
    assert.ok(graph.nodes().some((n) => n.name === 'fresh'));
    assert.ok(
      !graph.nodes().some((n) => n.path === 'sample.py' && n.name === 'leaf'),
    );
    await writeFile(path.join(root, 'sample.py'), 'def broken(:');
    await indexer.refresh();
    assert.ok(graph.limitations.some((x) => x.includes('Python syntax')));
    assert.equal(
      graph.nodes().filter((n) => n.path === 'sample.py' && n.kind !== 'file')
        .length,
      0,
    );
    await rm(path.join(root, 'sample.go'));
    assert.equal((await indexer.refresh()).files, 2);
    assert.ok(!graph.nodes().some((n) => n.path === 'sample.go'));
    assert.ok(!graph.edges().some((e) => e.evidence.path === 'sample.go'));
    console.log(
      'Actual Python, Go and Java parsers passed: declarations, heuristic callers, UTF-16 emoji positions, comments, cache, unsaved replacement, syntax failure and deletion.',
    );
  } finally {
    graph.close();
    await rm(root, { recursive: true, force: true });
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
