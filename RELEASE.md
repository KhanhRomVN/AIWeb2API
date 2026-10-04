# AIWeb2API v2.0.3

## What's New

### ✨ Feat: Conditional update warning in CLI
- `welcome.ts` now performs a real version check against the GitHub Releases API on startup
- Update warning (`⚠ UPDATE REQUIRED`) is only shown when the running binary is behind the latest release tag
- Version comparison uses semver (`vX.Y.Z`) — patch, minor and major are all handled correctly
- GitHub API request is cached per process (fires once, does not block the port prompt)

### ✨ Feat: Version field in health endpoint
- `GET /v1/health` now returns `"version": "v2.0.3"` alongside `status` and `timestamp`
- Allows clients (e.g. Zen) to detect outdated backends without a separate API call

---

## Downloads

| Platform | File |
|----------|------|
| Windows x64 | `AIWeb2API-v2.0.3-win-x64.zip` |
| Linux x64 | `AIWeb2API-v2.0.3-linux-x64.zip` |
| Linux arm64 | `AIWeb2API-v2.0.3-linux-arm64.zip` |

Each ZIP contains:
- `RUNME.exe` / `RUNME` — run directly, no Node.js required
- `better_sqlite3.node` — required native addon
- `resources/` — WASM and supporting files
- `README.md` — documentation
