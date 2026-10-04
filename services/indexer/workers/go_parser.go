// Parse captured Go source without loading modules, invoking generators or compiling it.
package main

import (
	"bufio"
	"encoding/base64"
	"encoding/json"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"strconv"
	"strings"
	"unicode/utf16"
)

type Node struct {
	Name  string `json:"name"`
	Kind  string `json:"kind"`
	Start int    `json:"start"`
	End   int    `json:"end"`
}
type Ref struct {
	Owner        int    `json:"owner"`
	Name         string `json:"name"`
	Relationship string `json:"relationship"`
	Start        int    `json:"start"`
	End          int    `json:"end"`
}
type Result struct {
	Version int      `json:"version"`
	Path    string   `json:"path"`
	Nodes   []Node   `json:"nodes"`
	Refs    []Ref    `json:"refs"`
	Errors  []string `json:"errors"`
}
type Visitor struct {
	result *Result
	files  *token.FileSet
	text   string
	owner  int
}

func (v Visitor) offset(p token.Pos) int {
	n := v.files.Position(p).Offset
	if n < 0 || n > len(v.text) {
		return 0
	}
	return len(utf16.Encode([]rune(v.text[:n])))
}
func (v Visitor) Visit(n ast.Node) ast.Visitor {
	if n == nil {
		return nil
	}
	switch x := n.(type) {
	case *ast.FuncDecl:
		kind := "function"
		if x.Recv != nil {
			kind = "method"
		}
		v.owner = len(v.result.Nodes)
		v.result.Nodes = append(v.result.Nodes, Node{x.Name.Name, kind, v.offset(x.Pos()), v.offset(x.End())})
	case *ast.TypeSpec:
		kind := "type"
		if _, ok := x.Type.(*ast.InterfaceType); ok {
			kind = "interface"
		}
		v.result.Nodes = append(v.result.Nodes, Node{x.Name.Name, kind, v.offset(x.Pos()), v.offset(x.End())})
	case *ast.ImportSpec:
		name, err := strconv.Unquote(x.Path.Value)
		if err == nil {
			v.result.Refs = append(v.result.Refs, Ref{-1, name, "imports", v.offset(x.Pos()), v.offset(x.End())})
		}
	case *ast.CallExpr:
		name := ""
		switch f := x.Fun.(type) {
		case *ast.Ident:
			name = f.Name
		case *ast.SelectorExpr:
			if a, ok := f.X.(*ast.Ident); ok {
				name = a.Name + "." + f.Sel.Name
			}
		}
		if name != "" {
			v.result.Refs = append(v.result.Refs, Ref{v.owner, name, "calls", v.offset(x.Fun.Pos()), v.offset(x.Fun.End())})
		}
	}
	return v
}
func main() {
	scanner := bufio.NewScanner(os.Stdin)
	scanner.Buffer(make([]byte, 4096), 400000)
	out := json.NewEncoder(os.Stdout)
	for scanner.Scan() {
		parts := strings.Split(scanner.Text(), "\t")
		if len(parts) != 2 {
			os.Exit(2)
		}
		p, err := base64.StdEncoding.DecodeString(parts[0])
		if err != nil {
			os.Exit(2)
		}
		text, err := base64.StdEncoding.DecodeString(parts[1])
		if err != nil {
			os.Exit(2)
		}
		result := Result{1, string(p), []Node{}, []Ref{}, []string{}}
		files := token.NewFileSet()
		tree, err := parser.ParseFile(files, string(p), text, parser.SkipObjectResolution)
		if err != nil {
			result.Errors = append(result.Errors, "Go syntax could not be parsed")
		} else {
			ast.Walk(Visitor{&result, files, string(text), -1}, tree)
		}
		if out.Encode(result) != nil {
			os.Exit(2)
		}
	}
	if scanner.Err() != nil {
		os.Exit(2)
	}
}
