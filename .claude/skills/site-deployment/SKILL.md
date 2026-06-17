---
name: site-deployment
description: How the Payments Intelligence site is built and deployed, and the gotchas that have actually broken it. Use when changes aren't showing on the live site, when editing index.html/app.js/styles.css, or when working with the build and GitHub Pages deploy. Covers the /Payments/ base href requirement, the build step, the main-branch deploy, and verification.
---

# Site Deployment — Build, Deploy, and Gotchas

## Live URL and hosting
- Public site: **https://shan-1100.github.io/Payments/**
- Hosted on **GitHub Pages**, deployed by `.github/workflows` "Publish to GitHub
  Pages" which runs on **push to `main`**, executes `node scripts/build-public-site.js`,
  and uploads `./dist`.
- Repo scope for this project: `shan-1100/payments`.

## CRITICAL gotcha #1 — base href must be /Payments/
The site is served from a **subdirectory** (`/Payments/`), not the domain root.
Without a base tag, relative paths like `data/daily_summaries_archive.json`
resolve to `shan-1100.github.io/data/...` and **all data fails to load** (the
"header updates but summaries are blank" symptom).

`index.html` `<head>` MUST contain:
```html
<base href="/Payments/">
```
If data isn't loading on the live site, check this FIRST.

## CRITICAL gotcha #2 — work happens on a branch, Pages deploys from main
Development branch for this work: `claude/cloud-code-context-limit-gzurzh`.
GitHub Pages deploys from **`main`**. Pushing only to the feature branch will
NOT update the live site. To publish, the changes must reach `main` (merge or
fast-forward), then push `main`. Confirm with the user before merging to main if
that wasn't already authorized for this task.

## CRITICAL gotcha #3 — the build copies into dist/
The app reads from `dist/` on the live site. After ANY change to `index.html`,
`app.js`, `styles.css`, or `data/*.json`, run:
```bash
npm run build-public   # = node scripts/build-public-site.js, writes ./dist
```
Then commit BOTH the source and the regenerated `dist/`.

## Standard deploy sequence
```bash
# 1. edit source files (index.html, app.js, styles.css, data/*.json)
npm run build-public                 # 2. regenerate dist/
node -e "require('./data/<changed>.json')"  # 3. validate JSON parses
git add -A
git commit -m "<change> — with source attribution if data changed"
# 4. push to the working branch
git push -u origin claude/cloud-code-context-limit-gzurzh
# 5. to publish: bring changes to main, then:
git push origin main
```

## Site identity (do not regress)
- Page title + nav brand + hero title: **"Instant Payments Intelligence Aggregator"**
  (NOT "Executive Intelligence" — that was rejected as meaningless).
- Sections: Executive Intelligence (daily/weekly/monthly tabs), Deep Dives,
  Expert Commentary, Reference Library, Partner Inputs. Don't delete sections
  when adding features — add alongside.
- Empty data renders a graceful "No summaries available" — that's intended and is
  preferable to fake data.

## Verify a deploy
1. `ls dist/data/` — confirm the changed JSON is present and current.
2. `grep '<base' dist/index.html` — confirm `/Payments/` base href survived build.
3. Wait 1–2 min for the Pages action, then hard-refresh (Ctrl/Cmd+Shift+R).
4. If still stale: confirm the commit landed on `main`, not just the branch.

## Honesty rule for "is it live?"
Do not tell the user something deployed/works unless I've confirmed the commit is
on `main`, the build emitted the file into `dist/`, and the base href is intact.
If I can't fetch the live URL (it may 403 the fetch tool), say I verified the
build artifacts and ask the user to confirm the rendered page — don't assert it
looks right when I haven't seen it.
