# Chrome and Vimium

oAX's Manifest V3 extension is a narrow workbench launcher. It opens only an
explicitly entered single-use `http://127.0.0.1:PORT/#TOKEN` link and stores nothing.
It has no host permissions, content scripts, browsing-history or storage access.
It does not scrape pages or expose runtime writes/model execution.

Build the ZIP with `pnpm package:chrome`. Extract it, open `chrome://extensions`,
enable Developer mode and select **Load unpacked** with the extracted directory.
This is a local extension package, not a Chrome Web Store publication. The current
automation connection cannot control your personal Chrome profile; the dedicated
development installation below is separate.

## Dedicated development browser

```powershell
pnpm setup:editors
# Requires the previously installed pinned Chrome for Testing:
pnpm test:browser-addons
node scripts/browser-addons.mjs
```

The installer pins official Vimium 2.4.2 at
`eb737abdd65b070c05ef06d39f1d78751aa7f738`, verifies its archive and every extracted
upstream file, and loads it alongside oAX into `.oax/browser-addons-profile`.
This profile has no personal account, bookmarks or history. Vimium requests
`<all_urls>`, tabs, bookmarks, history and other navigation permissions in this
dedicated profile. It is not an oAX agent tool or an authorization to execute
browser actions. Normal desktop oAX keeps extensions disabled.

Registration acceptance checks actual Chrome's profile records for both enabled
extensions. It does not prove every Vimium command or personal-profile installation.
Keyboard navigation should be checked on your intended application before adoption.

For personal Chrome installation use the official Vimium listing linked from
https://github.com/philc/vimium, inspect its permissions and install through Chrome's
own interface. This repository does not alter Chrome enterprise policy, sync an
account or bypass Web Store controls. Unpacked developer extensions need to be
loaded again with the supplied launcher when using the dedicated profile.
