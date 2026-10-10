import {
  digest,
  type CodeGraph,
  type GraphEdge,
  type GraphNode,
  type SourceSnapshot,
} from '@oax/codegraph';
import { offset, type ContextSlice } from '@oax/context';

type Kind = 'caller' | 'dependency' | 'import' | 'test';

/** Bounded, deterministic relevance rules. Objective text never grants authority. */
export function contextEvidence(
  graph: CodeGraph,
  focused: GraphNode,
  snapshots: ReadonlyMap<string, SourceSnapshot>,
  objective: string,
  budget: number,
): {
  related: NonNullable<ContextSlice['related']>;
  truncated: boolean;
  limitations: string[];
} {
  const nodes = new Map(graph.nodes().map((node) => [node.id, node]));
  const candidates: { kind: Kind; edge: GraphEdge; id: string | null }[] = [];
  for (const edge of graph.edges()) {
    if (edge.relationship === 'calls' && edge.target === focused.id)
      candidates.push({ kind: 'caller', edge, id: edge.source });
    if (edge.relationship === 'calls' && edge.source === focused.id)
      candidates.push({ kind: 'dependency', edge, id: edge.target });
    if (
      edge.relationship === 'imports' &&
      edge.source === `file:${focused.path}`
    )
      candidates.push({ kind: 'import', edge, id: edge.target });
    if (
      edge.relationship === 'tested_by' &&
      edge.source === `file:${focused.path}`
    )
      candidates.push({ kind: 'test', edge, id: edge.target });
  }
  const priority: Kind[] = /\b(test|tests|testing|coverage|failing)\b/i.test(
    objective,
  )
    ? ['test', 'dependency', 'caller', 'import']
    : /\b(dependency|dependencies|imports?|callees|slow|performance)\b/i.test(
          objective,
        )
      ? ['dependency', 'import', 'caller', 'test']
      : ['caller', 'dependency', 'test', 'import'];
  candidates.sort(
    (a, b) =>
      priority.indexOf(a.kind) - priority.indexOf(b.kind) ||
      (a.id ?? '').localeCompare(b.id ?? '') ||
      a.edge.id.localeCompare(b.edge.id),
  );
  const related: NonNullable<ContextSlice['related']> = [];
  const seen = new Set<string>([focused.id]);
  let remaining = Math.max(0, budget);
  let omitted = 0;
  let shortened = 0;
  let unresolved = 0;
  for (const candidate of candidates) {
    if (!candidate.id) {
      unresolved++;
      continue;
    }
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    if (related.length >= 6 || remaining <= 0) {
      omitted++;
      continue;
    }
    const node = nodes.get(candidate.id);
    const snapshot = node && snapshots.get(node.path);
    if (!node || !snapshot || digest(snapshot.text) !== node.hash) {
      omitted++;
      continue;
    }
    const text = snapshot.text.slice(
      offset(snapshot.text, node.range.start),
      offset(snapshot.text, node.range.end),
    );
    const excerpt = text.slice(0, Math.min(1024, remaining));
    if (excerpt.length < text.length) shortened++;
    remaining -= excerpt.length;
    related.push({
      path: node.path,
      range: node.range,
      hash: node.hash,
      excerpt,
      reason: `${candidate.kind} relationship; ${candidate.edge.resolution} evidence; objective priority ${priority.indexOf(candidate.kind) + 1}`,
      resolution: candidate.edge.resolution,
    });
  }
  return {
    related,
    truncated: omitted > 0 || shortened > 0,
    limitations: [
      `Context uses deterministic objective-keyword priorities: ${priority.join(', ')}; at most six related excerpts. This is not semantic intent understanding.`,
      `${omitted} related items omitted by budget or missing/stale snapshots; ${shortened} excerpts shortened; ${unresolved} unresolved relationships excluded.`,
      'Git/GitHub history and persistent memory are not included in this context slice; inspect their separate evidence views.',
    ],
  };
}
