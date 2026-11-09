# Releasing AuraPDF

Everything here is free except the optional code-signing certificate.

---

## 0. Before every release

```powershell
cd D:\Projects\AuraPDF_Figma
pnpm typecheck          # must print nothing
pnpm test:rs            # must be all green
pnpm test:selection     # 10 checks
pnpm build
pnpm tauri build        # produces the installers
```

If any of those fails, stop.

---

## 1. Version

Three files must agree — `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`.

```powershell
# example: 0.9.0 -> 0.9.1
(Get-Content package.json) -replace '"version": "0.9.0"', '"version": "0.9.1"' | Set-Content package.json
(Get-Content src-tauri/tauri.conf.json) -replace '"version": "0.9.0"', '"version": "0.9.1"' | Set-Content src-tauri/tauri.conf.json
(Get-Content src-tauri/Cargo.toml) -replace '^version = "0.9.0"', 'version = "0.9.1"' | Set-Content src-tauri/Cargo.toml
```

Then rebuild — the installer filename carries the version.

---

## 2. Checksum and scan (required while unsigned)

```powershell
Get-FileHash .\src-tauri\target\release\bundle\nsis\AuraPDF_0.9.0_x64-setup.exe -Algorithm SHA256
```

Upload the `.exe` to <https://www.virustotal.com>, publish the report link in the release
notes. Expect one or two heuristic hits on the bundled Tesseract DLLs; say so in the notes
before someone else does.

---

## 3. Commit and tag

Only the application files. The working tree usually contains unrelated edits.

```powershell
git add src src-tauri package.json pnpm-lock.yaml index.html THIRD_PARTY_NOTICES.md docs tests
git status --porcelain          # read this before committing
git commit -m "Release 0.9.0"
git tag v0.9.0
git push origin main --tags
```

---

## 4. Publish the GitHub release

Attach the installer from `src-tauri/target/release/bundle/nsis/`, then use this body:

```markdown
**This build is not code-signed.** Windows may show "Windows protected your PC".
Click **More info → Run anyway**. It is a one-time prompt.

- SHA-256: `<paste hash>`
- VirusTotal: <paste link>
- Built from `<commit sha>` with `pnpm tauri build`

### What's in this release
- <bullet list>

### Known limitations
- Password-protected PDFs are detected but cannot be opened yet.
- Handwriting and maths/formula recognition are not supported.
```

---

## 5. Clean-machine test (do this before every public release)

On a machine that has never run AuraPDF, with no developer tools installed:

1. Install and launch.
2. Open a **scanned** PDF with small print. Select text, copy, paste into Notepad. **Does it
   match the page?**
3. Open a **born-digital** PDF. Select and copy text — it should be exact, with no OCR
   involvement.
4. Open a **password-protected** PDF. It must say so clearly.
5. Highlight something, quit, reopen — is the highlight there?
6. ⋯ → **Export annotated copy**, open the result in Edge or Acrobat — are the highlights
   really in the file?
7. ⋯ → **Print…** — does the sheet appear with a preview, and does Print produce a correct page?
8. Drag a sticky note, reload, confirm it stayed.
9. Erase a stroke.
10. `%LOCALAPPDATA%\com.aurapdf.desktop\logs\aurapdf.log` exists and has lines.
11. `%APPDATA%\com.aurapdf.desktop\aurapdf.db.bak` exists.
12. Uninstall — does it remove the app cleanly? (The library database is meant to survive.)

---

## 6. Auto-update (free, do this before the second release)

Generating the keypair costs nothing — it is unrelated to a Windows code-signing
certificate.

```powershell
pnpm tauri signer generate --write-keys "$env:USERPROFILE\.tauri\aurapdf.key"
```

- Public key → `tauri.conf.json` → `plugins.updater.pubkey`
- Private key + password → CI secrets `TAURI_SIGNING_PRIVATE_KEY` and
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- **Back the private key up offline.** If it is lost, every installed copy can only be
  updated by manual reinstall.
- Set `bundle.createUpdaterArtifacts` to `true` once the key exists, otherwise builds fail.

The repository already contains the updater config block with the endpoint pointed at
`releases/latest/download/latest.json`, disabled until a key is supplied.

---

## 7. Code signing (optional, paid)

Only if downloads justify it.

- **SignPath Foundation** — free for open-source projects with a public repo. Apply, and if
  approved, sign in CI. Start here, it costs nothing.
- **Azure Trusted Signing** — ~$10/month, needs verifiable business or individual identity.
- **OV / EV certificate** — $200–700/year. EV clears SmartScreen immediately.

Configure under `bundle.windows` in `tauri.conf.json` — see the comments in that file.

---

## Troubleshooting

**Build fails with an empty `pubkey`** — set `createUpdaterArtifacts` to `false` until a key
exists.

**Installer size jumped** — check `du -sh src-tauri/bin`; the OCR runtime is ~47 MB and is
the floor.

**SmartScreen suddenly harsher** — a new unsigned binary starts with zero reputation.
Nothing changed except the hash.
