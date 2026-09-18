# Release SOP — @taylorwong/ichartjs (AUTHOR ONLY)

> **Scope / Permissions:** Release actions (npm publish + develop→master merge + git tag push)
> are **exclusively for the package author**. Requires:
> - GitHub write access to `wanghetommy/ichartjs` (master + develop + tags)
> - npm login session as `taylorwong` (2FA or PAT with bypass-2fa enabled)
> - No contributor / secondary account should run these steps.
>
> **Agent Policy:** An Agent MUST NOT initiate any step in this SOP on its own.
> It MAY execute the sequence **only when explicitly instructed** by the author
> (e.g. "publish vX.Y.Z", "commit and release patch", or equivalent intent).

## 0. Preconditions (MUST ALL be green)

0.  `git status -sb` → on `develop`, working tree clean
1.  `npm run check` → exit 0
2.  `npm test` → exit 0 (all current tests pass)
3.  `npm run docs:check` → exit 0
4.  `npm run agent:check` → exit 0
5.  `npm whoami` → output = `taylorwong`
6.  `npm config get registry` → output = `https://registry.npmjs.org/`

## 1. Develop bump & commit

7.  Edit `package.json` version → semver:
    - **patch** (x.y.Z): pure bug fix w/o API change
    - **minor** (x.Y.0): backward-compatible new feature(s)
    - **major** (X.0.0): breaking API change
8.  `git add -A`
9.  `git commit -m "<prefix>: <one short English sentence>"`
    - allowed `<prefix>`: `fix | feat | chore | docs | refactor | perf | test`
    - ❌ no Chinese, ❌ no multi-line body, ❌ no long run-on sentences

## 2. Tag + push develop

10. `git tag vX.Y.Z` matching `package.json#version` exactly
11. `git push origin develop --tags`

## 3. NPM publish

12. `npm publish` (package.json already declares `publishConfig.access=public` + npmjs registry)
    - If 2FA challenged: `npm publish --otp=<6-digit OTP or PAT>`
    - Successful stdout MUST include: `+ @taylorwong/ichartjs@X.Y.Z`
13. Verify availability (CDN may take 1–2 min; failure to query immediately is OK as long as publish exited 0):
    ```bash
    npm view @taylorwong/ichartjs versions --json   # should include X.Y.Z within ~2 min
    curl -sfI https://unpkg.com/@taylorwong/ichartjs@X.Y.Z/src/index.mjs   # HTTP 200
    ```

## 4. Merge develop → master

14. `git checkout master && git pull --rebase origin master`
15. `git merge --no-ff develop -m "Merge develop into master (vX.Y.Z: <one short English summary>)"`
    - MUST use `--no-ff` so release rollback can target a single merge commit
16. `git push origin master`

## 5. Final state

17. `git status -sb` → `## master...origin/master` clean, no ahead/behind
18. `git branch -a` → `master` and `develop` both present; if desired, `git checkout develop` to resume default branch

## MUST NOT

- ❌ Never publish **before** pushing tag / develop commit (npm version is immutable)
- ❌ Never use `git merge --ff-only develop` into `master` (lose merge commit)
- ❌ Never commit release with Chinese text, emoji, or commit message body > 1 line
- ❌ Never initiate publishing without the author's explicit instruction (Agent rule)

## Rollback (if required)

- Within 72h of publish: `npm unpublish @taylorwong/ichartjs@X.Y.Z` (follow npm ToS)
- After 72h: `npm deprecate @taylorwong/ichartjs@X.Y.Z "message"` and release next patch
- Git: `git revert <merge-commit-hash>` on master, then push; **do not force-push master**
