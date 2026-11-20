# Coordination

| Task | Status | Session | Scope |
|---|---|---|---|
| Site audit and final integration | needs review | dd5c2b23 | COORDINATION.md, README.md, flagged-for-review.html, tools/check-site.py |

## Session dd5c2b23 — 2026-11-20

- GitHub Pages API: public project site, `main` at `/`, latest build `built` at `ad2ea0a19b75252627c1fe80ca6ca5545f3a339f`. A successful static build is not a functional test. [Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).
- [Uploaded tree](https://github.com/snapquast73-boop/POSTSSNALRT/tree/ad2ea0a19b75252627c1fe80ca6ca5545f3a339f): no `assets/` or `docs/`. Local git history and unreachable-object check did not yield those files. GitHub returned 404 for the documented upstream and the suspected source `POSTSEASONMLBALERTS`; public repository searches yielded no matching recovery source. The original Pages feed could not be retrieved. No substitute implementation was represented as original.
- `python3 tools/check-site.py`: 31 unresolved local references (26 HTML references and five README references). External links and runtime behavior are outside this check. `node --check server.mjs`: passed syntax check only.
- [Flagged for Review](flagged-for-review.html) records what could be checked directly against the official GitHub and MLB sources. Historical feature and measurement claims are not signed off. Exact client behavior remains unverified.
- **Release decision:** no merge or deployment of this branch; missing required assets fail the release gate independently of nonblocking editorial flags. No remote publishing settings changed.
