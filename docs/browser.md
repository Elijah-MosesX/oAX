# Optional browser runtime intelligence

This preview pins official Chrome DevTools MCP **1.10.1**, MCP SDK **1.31.0**, and the official Chrome for Testing installer **3.2.3**. It does not use the attached source archive as executable code.

From the built checkout:

```powershell
pnpm setup:browser
pnpm build
node dist/browser.cjs inspect http://localhost:3000/
# Review the exact origin, URL, operations and disclosure; then approve:
node dist/browser.cjs inspect http://localhost:3000/ --approve <preview-hash>
pnpm test:browser
```

Setup downloads a compatible dedicated Chrome for Testing into ignored `.oax/browser-cache`. The verified build is 154.0.8037.92. Inspection starts a temporary headless profile and only exposes navigation to the approved origin, accessibility snapshot, console messages and network messages for owned page IDs. No input, JavaScript evaluation, screenshots, personal profile access or arbitrary MCP methods are exposed. Usage statistics, update checks and CrUX queries are disabled explicitly. The preview hash is consent for the disclosed fixed operations; data is printed locally and not transmitted to a model.

A controlled loopback acceptance test checks real navigation/snapshot, denied ungranted actions, file-output rejection, and blocked cross-origin navigation, redirects and subresources. It does not prove application correctness, source-map linking, all browser network isolation, or OS sandboxing. Application scripts can still perform actions at the approved origin; use an authorized development application. Redaction is conservative and output is bounded.

Browser observations currently remain a separate CLI workflow. Connecting evidence to code, source maps, approved fixes and subsequent browser verification is planned.

## Jev observation projection

The optional inspect-jev command uses the same browser preview approval and observer tools, then runs the installed Python Jev action-space builder on supported observed accessibility elements. This is local inspection, without browser input or provider transmission. Browser permissions now persist metadata in the source-free audit journal. See [Jev integration](jev.md).
