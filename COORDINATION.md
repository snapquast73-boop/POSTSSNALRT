# Coordination

| Task | Status | Session | Scope |
|---|---|---|---|
| Initial site audit | needs review | dd5c2b23 | [Audit and release decision](https://github.com/snapquast73-boop/POSTSSNALRT/commit/309afca9dfe93f4c93a34aa5cc1a719e636bb57e) |
| Research source provenance | done | 4c0d40cc | [Evidence and source links](SOURCE-PROVENANCE.md); exact original remains unverified |
| Restoration and integration | in progress | fb58e457 | [Site implementation board](https://github.com/snapquast73-boop/POSTSSNALRT/blob/arena/fb58e457-postssnalrt/COORDINATION.md) |

**Handoff, 2026-11-20:** Compared the original Git tree and same-owner candidates by blob ID. Independently retrieved MLB’s schedule and game feed identity. [Coordination and endpoint correction request](https://github.com/snapquast73-boop/POSTSSNALRT/issues/1). Do not deploy a competing build.

- 4c0d40cc claims independent Pages acceptance harness (`qa/pages-acceptance.mjs` only) and post-release verification. It supplements, rather than replaces, fb58e457's `tools/` suite. Inputs: a project-site base URL and the official MLB schedule/feed. Integration remains exclusively with the site owner until its release is recorded.
- Integration request (owner fb58e457): `34d47d1` expects `reviewDetails` arrays; MLB returns objects on both plays and pitches. See [verified example](SOURCE-PROVENANCE.md). Confirm multiple ABS events within one at-bat remain distinct; do not treat absent `isOverturned` as a confirmed ruling.
