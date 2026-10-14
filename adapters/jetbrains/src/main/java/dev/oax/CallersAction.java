package dev.oax;

import com.google.gson.*;
import com.intellij.openapi.actionSystem.*;
import com.intellij.openapi.application.ApplicationManager;
import com.intellij.openapi.editor.Editor;
import com.intellij.openapi.fileEditor.FileDocumentManager;
import com.intellij.openapi.progress.*;
import com.intellij.openapi.project.*;
import com.intellij.openapi.ui.Messages;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Instant;
import java.util.UUID;
import org.jetbrains.annotations.NotNull;

/** Read-only prototype: editor APIs stay here; protocol/runtime stay in the companion. */
public final class CallersAction extends DumbAwareAction {
    @Override public void actionPerformed(@NotNull AnActionEvent event) {
        Project project = event.getProject();
        Editor editor = event.getData(CommonDataKeys.EDITOR);
        if (project == null || editor == null || project.getBasePath() == null) return;
        var file = FileDocumentManager.getInstance().getFile(editor.getDocument());
        String cli = System.getProperty("oax.cli", "");
        String node = System.getProperty("oax.node", "node");
        if (file == null || !Path.of(cli).isAbsolute() || !Files.isRegularFile(Path.of(cli))) {
            Messages.showErrorDialog(project, "Configure the absolute built CLI path through -Doax.cli and optional -Doax.node in IDE VM options.", "oAX setup"); return;
        }
        Path root = Path.of(project.getBasePath()).toAbsolutePath().normalize();
        Path resource = Path.of(file.getPath()).toAbsolutePath().normalize();
        if (!resource.startsWith(root)) return;
        JsonObject observation = new JsonObject();
        observation.addProperty("path", root.relativize(resource).toString().replace('\\', '/'));
        observation.addProperty("uri", resource.toUri().toString());
        observation.addProperty("text", editor.getDocument().getText());
        observation.addProperty("documentVersion", Math.max(1, editor.getDocument().getModificationStamp()));
        observation.addProperty("dirty", FileDocumentManager.getInstance().isDocumentUnsaved(editor.getDocument()));
        observation.add("cursor", position(editor, editor.getCaretModel().getOffset()));
        JsonObject range = new JsonObject();
        range.add("start", position(editor, editor.getSelectionModel().getSelectionStart()));
        range.add("end", position(editor, editor.getSelectionModel().getSelectionEnd()));
        observation.add("selection", range);
        observation.add("visibleRanges", new JsonArray()); // Explicit prototype limitation.
        JsonArray open = new JsonArray(); open.add(observation.get("path").getAsString());
        observation.add("openFiles", open); // Current text tab only in this prototype.
        new Task.Backgroundable(project, "oAX: structural callers", true) {
            @Override public void run(@NotNull ProgressIndicator indicator) {
                Process child = null;
                try {
                    child = new ProcessBuilder(node, cli, "editor-bridge", root.toString()).redirectError(ProcessBuilder.Redirect.DISCARD).start();
                    final Process owned = child;
                    // Deadline/cancellation closes only this owned companion and descendants.
                    Thread watchdog = new Thread(() -> {
                        long deadline = System.nanoTime() + 60_000_000_000L;
                        while (owned.isAlive() && !indicator.isCanceled() && System.nanoTime() < deadline) {
                            try { Thread.sleep(100); } catch (InterruptedException ignored) { return; }
                        }
                        if (owned.isAlive()) { owned.descendants().forEach(ProcessHandle::destroy); owned.destroy(); }
                    }, "oax-deadline"); watchdog.setDaemon(true); watchdog.start();
                    BufferedReader reader = new BufferedReader(new InputStreamReader(child.getInputStream(), StandardCharsets.UTF_8));
                    JsonObject ready = parse(frame(reader));
                    JsonObject identity = ready.getAsJsonObject("payload");
                    if (!"adapter-bootstrap".equals(ready.get("correlationId").getAsString()) || !ready.get("ok").getAsBoolean() || !"editor-read-only.v1".equals(identity.get("contract").getAsString())) throw new IOException("Invalid bootstrap");
                    JsonObject request = new JsonObject();
                    String id = UUID.randomUUID().toString();
                    request.addProperty("id", id); request.addProperty("version", "0.1"); request.addProperty("type", "request");
                    request.addProperty("timestamp", Instant.now().toString());
                    request.add("workspaceId", identity.get("workspaceId")); request.add("sessionId", identity.get("sessionId"));
                    request.addProperty("method", "graph.query");
                    JsonObject payload = new JsonObject(); payload.add("observation", observation); payload.addProperty("relationship", "callers"); request.add("payload", payload);
                    child.getOutputStream().write((request + "\n").getBytes(StandardCharsets.UTF_8)); child.getOutputStream().flush();
                    JsonObject response = parse(frame(reader));
                    // Protocol 0.1 responses correlate to a request on this session-owned connection.
                    if (!id.equals(response.get("correlationId").getAsString()) || !request.get("workspaceId").equals(response.get("workspaceId"))) throw new IOException("Response scope mismatch");
                    String output = new GsonBuilder().setPrettyPrinting().create().toJson(response);
                    ApplicationManager.getApplication().invokeLater(() -> { if (!project.isDisposed()) Messages.showInfoMessage(project, output, "oAX callers evidence"); });
                } catch (Exception error) {
                    ApplicationManager.getApplication().invokeLater(() -> { if (!project.isDisposed()) Messages.showErrorDialog(project, "Read-only adapter failed; check configured Node/CLI and workspace. No edits were requested.", "oAX"); });
                } finally { if (child != null) { child.descendants().forEach(ProcessHandle::destroy); child.destroy(); } }
            }
        }.queue();
    }
    private static String frame(Reader reader) throws IOException {
        StringBuilder line = new StringBuilder();
        int value;
        while ((value = reader.read()) != -1) {
            if (value == '\n') return line.toString();
            if (line.length() >= 262144) throw new IOException("Frame exceeds limit");
            line.append((char) value);
        }
        throw new IOException("Truncated or closed transport");
    }
    private static JsonObject parse(String line) throws IOException {
        if (line == null || line.getBytes(StandardCharsets.UTF_8).length > 262144) throw new IOException("Invalid frame");
        JsonObject message = JsonParser.parseString(line).getAsJsonObject();
        if (!"0.1".equals(message.get("version").getAsString()) || !"response".equals(message.get("type").getAsString())) throw new IOException("Invalid protocol response");
        return message;
    }
    private static JsonObject position(Editor editor, int offset) {
        int line = editor.getDocument().getLineNumber(offset);
        JsonObject point = new JsonObject(); point.addProperty("line", line); point.addProperty("column", offset - editor.getDocument().getLineStartOffset(line)); return point;
    }
}
