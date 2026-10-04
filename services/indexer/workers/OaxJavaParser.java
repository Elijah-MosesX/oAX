import com.sun.source.tree.*;
import com.sun.source.util.*;
import javax.tools.*;
import java.io.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Parse memory snapshots only: no project classes, processors, builds or code execution. */
public class OaxJavaParser {
  static String quote(String s) {
    StringBuilder b=new StringBuilder("\"");
    for(char c:s.toCharArray()) { if(c=='"'||c=='\\') b.append('\\').append(c); else if(c<32) b.append(String.format("\\u%04x",(int)c)); else b.append(c); }
    return b.append('"').toString();
  }
  public static void main(String[] args) throws Exception {
    var in=new BufferedReader(new InputStreamReader(System.in,StandardCharsets.UTF_8));
    var out=new PrintWriter(new OutputStreamWriter(System.out,StandardCharsets.UTF_8),true);
    String line;
    while((line=in.readLine())!=null) {
      if(line.length()>400000) throw new IOException("Input budget exceeded");
      var parts=line.split("\\t",-1); if(parts.length!=2) throw new IOException("Invalid frame");
      String path=new String(Base64.getDecoder().decode(parts[0]),StandardCharsets.UTF_8);
      String text=new String(Base64.getDecoder().decode(parts[1]),StandardCharsets.UTF_8);
      List<String> nodes=new ArrayList<>(),refs=new ArrayList<>();
      var diagnostic=new DiagnosticCollector<JavaFileObject>();
      JavaCompiler compiler=ToolProvider.getSystemJavaCompiler();
      if(compiler==null) throw new IOException("A JDK is required");
      try(var manager=compiler.getStandardFileManager(diagnostic,null,StandardCharsets.UTF_8)) {
        var source=new SimpleJavaFileObject(URI.create("string:///Snapshot.java"),JavaFileObject.Kind.SOURCE){ public CharSequence getCharContent(boolean ignored){return text;} };
        var task=(JavacTask)compiler.getTask(null,manager,diagnostic,List.of("-proc:none","--release","21"),null,List.of(source));
        var units=task.parse(); var positions=Trees.instance(task).getSourcePositions();
        for(var unit:units) new TreeScanner<Void,Void>() {
          int owner=-1;
          String span(Tree n){return "\"start\":"+positions.getStartPosition(unit,n)+",\"end\":"+positions.getEndPosition(unit,n);}
          void declaration(Tree n,String name,String kind){nodes.add("{\"name\":"+quote(name)+",\"kind\":"+quote(kind)+","+span(n)+"}");}
          public Void visitClass(ClassTree n,Void p){if(!n.getSimpleName().toString().isEmpty()) declaration(n,n.getSimpleName().toString(),n.getKind()==Tree.Kind.INTERFACE?"interface":"class");return super.visitClass(n,p);}
          public Void visitMethod(MethodTree n,Void p){int old=owner;owner=nodes.size();declaration(n,n.getName().toString(),"method");super.visitMethod(n,p);owner=old;return null;}
          public Void visitImport(ImportTree n,Void p){refs.add("{\"owner\":-1,\"name\":"+quote(n.getQualifiedIdentifier().toString())+",\"relationship\":\"imports\","+span(n)+"}");return super.visitImport(n,p);}
          public Void visitMethodInvocation(MethodInvocationTree n,Void p){refs.add("{\"owner\":"+owner+",\"name\":"+quote(n.getMethodSelect().toString())+",\"relationship\":\"calls\","+span(n.getMethodSelect())+"}");return super.visitMethodInvocation(n,p);}
        }.scan(unit,null);
      }
      boolean invalid=diagnostic.getDiagnostics().stream().anyMatch(d->d.getKind()==Diagnostic.Kind.ERROR);
      if(invalid){nodes.clear();refs.clear();}
      out.println("{\"version\":1,\"path\":"+quote(path)+",\"nodes\":["+String.join(",",nodes)+"],\"refs\":["+String.join(",",refs)+"],\"errors\":"+(invalid?"[\"Java syntax could not be parsed\"]":"[]")+"}");
    }
  }
}
