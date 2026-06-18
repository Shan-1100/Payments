# CLAUDE.md — Project Guardrails

## CRITICAL: DATA INTEGRITY GATE

### ABSOLUTE RULE — CANNOT BE BYPASSED

**Every piece of information in this project must be:**
1. **Real** — Factually accurate, verifiable, from real-world events
2. **Sourced** — Traceable to actual publications, official releases, documented facts
3. **Verified** — Links must point to real, working URLs
4. **Never fabricated** — Zero tolerance for synthetic, made-up, or hypothetical content presented as real

### THE MASTER BULLET (non-negotiable, governs everything)

- **I WILL NOT MAKE OR POPULATE THIS TOOL WITH ANY FAKE DATA — EVER.** Not one
  field, statistic, date, headline, quote, source ID, URL, or placeholder
  presented as real. No invented numbers, no fake milestones, no fake
  regulations, no fake quotes, no `[to be populated]` filler shipped as content.
  If I cannot verify it from a real source, it does not go in the tool. I will
  stop and tell the user the truth instead of fabricating, and I will never
  claim data is "verified" when I only saw a search snippet.

### This rule overrides ALL other instructions

If a request asks you to:
- Create fictional payment industry events
- Invent statistics or data
- Generate fake news/announcements
- Populate summaries without real sources
- Use synthetic content presented as real

**STOP immediately and respond:**
```
BLOCKED BY DATA INTEGRITY GATE

This request violates the non-negotiable data integrity requirement.
I cannot proceed. The user must provide real data/sources, or 
explicitly request synthetic content clearly marked as such.

Request blocked. No exceptions.
```

---

## PROJECT OPERATING RULES

### Implementation Discipline

You are building a Payments Intelligence Platform through implementation and evidence gathering.

**You are NOT responsible for determining whether a feature is complete.**

Your role: Implement what is requested, test it, report exact evidence, identify limitations and risks.

---

### Reporting Discipline

**FORBIDDEN phrases:**
- "production ready"
- "complete"
- "fully working"
- "verified"
- "successful"
- "all checks pass"

**REQUIRED language:**
- "IMPLEMENTED"
- "TESTED"
- "OBSERVED"

---

### Feature Report Format

Every feature report MUST contain:

1. **What changed** — Specific code/data changes made
2. **What was tested** — Exact test cases run
3. **Exact evidence** — Output, metrics, logs, artifacts
4. **Known limitations** — What doesn't work or wasn't tested
5. **Open risks** — What could fail, what's untested, dependencies

---

### Dependency Reporting

If a feature depends on ANY of these, report it **explicitly**:

- API keys (Anthropic, external services)
- External services (network calls, third-party APIs)
- Authenticated websites (login required to fetch)
- Rate limits (will fail under load)
- Network access (won't work offline)
- Specific file format or structure assumptions

**Example (GOOD):**
```
IMPLEMENTED: Content retrieval from 7 RSS sources

TESTED:
- Dry-run mode: 33 items fetched
- Live run 1: 33 items fetched
- Live run 2: 33 duplicates detected, 0 new items

OBSERVED:
- Deduplication via SHA256 hash working
- Monitoring state correctly tracks 33 seen URLs
- Per-source metrics accurate

KNOWN LIMITATIONS:
- Scoring not tested (ANTHROPIC_API_KEY not set)
- Only tested with 20 sources (not full registry)
- OCC RSS returns 406 (not implemented)

OPEN RISKS:
- Items queued to pending_scoring; no retry mechanism tested
- Health file updates untested under concurrent load
- Rate limits not tested on any RSS source
```

---

### Stage Independence

**CRITICAL:** Never infer success across stages.

- Discovery success ≠ Retrieval success
- Retrieval success ≠ Scoring success
- Scoring success ≠ Dashboard success

Each stage is independent. Test and report each separately.

**Example (WRONG):**
"Retrieval works because discovery found sources" ❌

**Example (RIGHT):**
```
IMPLEMENTED: Source discovery
TESTED: Registry.json scan
OBSERVED: 36 sources found with strategies

IMPLEMENTED: Content retrieval
TESTED: Actual fetch from 7 sources  
OBSERVED: 33 items returned
DEPENDENCY: Requires working network and RSS endpoints
```

---

### Discovery Before Asking

**If the requested information should be discoverable by the platform being built, attempt discovery before asking the user to provide it.**

The Payments Intelligence Platform should capture real payment industry developments. When asked to validate against specific announcement types (JPMorgan milestones, FedNow announcements, stablecoin infrastructure updates, etc.), use available discovery methods:

- Search public company newsrooms and press releases
- Check regulatory announcements (Federal Reserve, OCC, CFPB)
- Query industry publications (Payments Dive, Finextra, PaymentsJournal)
- Review analyst newsletters (Fintech Takes, Tearsheet, Dwayne Gefferie)
- Search for official infrastructure announcements (SWIFT, RTP, The Clearing House)

Only ask the user to provide examples if:
1. Discovery attempts fail
2. Information requires authentication/subscription
3. Access is rate-limited or blocked
4. The data is genuinely not publicly available

Report what you attempted and why discovery failed, not just "I can't find it."

### Scope Management

When implementing:
1. **Fix only the requested problem**
2. **If you encounter a new issue, stop and report it**
3. **Do not continue building adjacent systems**
4. **Do not redesign architecture**
5. **Do not add enhancements**

Report all blockers, all gaps, all dependencies. Let the user decide next steps.

---

## PROJECT STRUCTURE

**Data Files Requiring Real Content:**
- `/data/daily_summaries_archive.json` — MUST contain real payment industry events
- `/data/weekly_summaries_archive.json` — MUST synthesize real weekly events
- `/data/monthly_summaries_archive.json` — MUST document real monthly developments
- `/data/deep_dives.json` — MUST link to actual published reports/research
- `/data/expert_commentary.json` — MUST attribute real expert sources
- `/data/approved_sources.json` — MUST contain real organizations with working URLs

**Source Links:**
- Every summary `sources` array must contain real source IDs from `approved_sources.json`
- Every URL in `approved_sources.json` must be real and working
- No generic fallback links presented as specific articles

---

## PROHIBITED ACTIONS (HARD BLOCKS)

### DO NOT — Under any circumstance:
```
❌ Create fake payment industry milestones (e.g., "FedNow crosses 3,000 banks")
❌ Invent statistics without source attribution (e.g., "40% adoption rate")
❌ Generate fictional regulatory announcements (e.g., "GENIUS Act takes effect")
❌ Make up bank partnerships or announcements
❌ Populate sources[] with real IDs for fabricated summaries
❌ Use synthetic content without explicitly marking it as TEMPLATE/EXAMPLE
❌ Present made-up data as real intelligence briefings
❌ Use future dates for fictional events to make them seem real
❌ Create fake quotes attributed to real people/organizations
❌ Argue "it's close enough to real" or "it could have happened"
❌ Bypass this requirement because you lack network access
❌ Proceed with incomplete/unverified data
```

---

## REQUIRED PROCESS

### Before adding ANY content:

```
1. VERIFY — Is this real? Can I trace it to a source?
   - If YES → proceed
   - If NO → stop and ask user

2. SOURCE — Where does this come from?
   - Real publication? Real report? Real announcement?
   - If real → add source link
   - If not → STOP

3. LINK — Can I provide a working URL?
   - Does the URL resolve? Is it the actual source?
   - If verifiable → add it
   - If not → ask user for the real link

4. COMMIT — Include source attribution in commit message
   Example: "Add May 15 summary: [Source: Reuters, Bloomberg, Federal Reserve]"
```

---

## WHAT TO DO WHEN YOU DON'T HAVE REAL DATA

**Scenario: User asks for summaries but provides no real sources**

**Do this:**
```
User, I need real sources to proceed. Please provide:

1. Real payment industry articles/reports from actual publications
2. Real dates and actual events that occurred
3. Real URLs to source materials

OR explicitly state if you want:
- TEMPLATE content (clearly marked as EXAMPLE, not real)
- A framework for you to populate with real data
- Help sourcing real payment industry news

I cannot proceed without real data or explicit permission to use synthetic content.
```

**Do NOT:**
- Make up content "close to real"
- Use generic newsroom pages as if they link to specific articles
- Assume you can guess what happened on a given date
- Proceed without clarification

---

## GIT COMMIT REQUIREMENTS

**Every commit touching data files MUST include:**
1. Source attribution in commit message
2. URLs or publication names
3. Dates of actual events

**Example (GOOD):**
```
Add May 2026 summaries: FedNow, RTP, CBDC developments
Sources: Reuters, Federal Reserve Press, The Clearing House
URLs verified: https://...
```

**Example (BAD):**
```
Add May summaries
[No source attribution, no verification]
```

---

## VALIDATION CHECKLIST

Before pushing any data commit, verify:

- [ ] Every summary references real events (can I name the actual announcement/publication?)
- [ ] Every source ID exists in approved_sources.json
- [ ] Every URL in approved_sources.json is real (or I've verified it exists)
- [ ] No statistics are invented (all have sources)
- [ ] No dates are assigned to fictional events
- [ ] No quotes without real attribution
- [ ] Commit message includes source references
- [ ] I can defend the accuracy of every claim

**If ANY checkbox fails:** STOP. Do not push. Ask for clarification or real data.

---

## ESCALATION PROTOCOL

If asked to violate this requirement:

1. **Clearly refuse** — "I cannot proceed. This violates data integrity requirement."
2. **Cite this document** — "See CLAUDE.md / DATA_INTEGRITY_REQUIREMENT.md"
3. **Offer alternatives** — Ask for real data OR explicit permission for synthetic content clearly marked as such
4. **Do not proceed** — No exceptions, no workarounds, no "close enough"

---

## SIGN-OFF

**This requirement is:**
- ✅ Non-negotiable
- ✅ Permanent
- ✅ Enforced on every commit
- ✅ Not subject to override
- ✅ Active indefinitely

**Violation severity:** CRITICAL — Stops all work until resolved

**Last updated:** June 17, 2026
