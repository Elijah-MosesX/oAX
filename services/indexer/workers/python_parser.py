"""Parse bounded captured source on stdin; never import or execute repository code."""
import ast
import base64
import json
import sys

sys.stdin.reconfigure(encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8')
for record in sys.stdin:
    path64, source64 = record.rstrip('\n').split('\t')
    path = base64.b64decode(path64).decode('utf-8')
    source = base64.b64decode(source64).decode('utf-8')
    lines = source.splitlines(keepends=True)
    starts, total = [], 0
    for line in lines:
        starts.append(total)
        total += len(line.encode('utf-16-le')) // 2
    def offset(line, byte):
        return starts[line-1] + len(lines[line-1].encode('utf-8')[:byte].decode('utf-8').encode('utf-16-le')) // 2
    def span(node):
        return {'start': offset(node.lineno, node.col_offset), 'end': offset(node.end_lineno, node.end_col_offset)}
    result = {'version': 1, 'path': path, 'nodes': [], 'refs': [], 'errors': []}
    class Visitor(ast.NodeVisitor):
        owner = -1
        def declaration(self, node, kind):
            previous = self.owner
            self.owner = len(result['nodes'])
            result['nodes'].append({'name': node.name, 'kind': kind, **span(node)})
            self.generic_visit(node)
            self.owner = previous
        def visit_FunctionDef(self, node):
            self.declaration(node, 'function')
        visit_AsyncFunctionDef = visit_FunctionDef
        def visit_ClassDef(self, node):
            self.declaration(node, 'class')
        def visit_Call(self, node):
            result['refs'].append({'owner': self.owner, 'name': ast.unparse(node.func)[:300], 'relationship': 'calls', **span(node.func)})
            self.generic_visit(node)
        def visit_Import(self, node):
            for item in node.names:
                result['refs'].append({'owner': -1, 'name': item.name, 'relationship': 'imports', **span(node)})
        def visit_ImportFrom(self, node):
            result['refs'].append({'owner': -1, 'name': '.' * node.level + (node.module or ''), 'relationship': 'imports', **span(node)})
    try:
        Visitor().visit(ast.parse(source, filename=path))
    except (SyntaxError, ValueError, RecursionError):
        result['nodes'], result['refs'] = [], []
        result['errors'] = ['Python syntax could not be parsed']
    print(json.dumps(result, ensure_ascii=True))
