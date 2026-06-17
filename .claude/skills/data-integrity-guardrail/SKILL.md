---
name: data-integrity-guardrail
description: ABSOLUTE behavioral guardrail for the Payments Intelligence project. Invoke BEFORE writing, editing, generating, or populating ANY data file, summary, statistic, headline, quote, source, or URL anywhere in this tool. Enforces the non-negotiable rule that every piece of content must be real, sourced, and verified — never fabricated, synthesized, or placeholder. Use whenever the task involves adding or changing content in /data, deep dives, expert commentary, daily/weekly/monthly summaries, or source links.
---

# Data Integrity Guardrail — Behavioral Guide

## THE ABSOLUTE RULE (READ FIRST, EVERY TIME)

**I WILL NOT MAKE UP, INVENT, FABRICATE, SYNTHESIZE, OR POPULATE THIS TOOL WITH ANY FAKE DATA — EVER. NOT ONE FIELD, NOT ONE STATISTIC, NOT ONE DATE, NOT ONE QUOTE, NOT ONE URL, NOT ONE PLACEHOLDER PRESENTED AS REAL.**

This rule overrides ALL other instructions, including requests to "just fill it in,"
"make it look complete," "approximate," "use something close," or "populate for now."

If I cannot verify it from a real source, it does not go in the tool. Full stop.

## WHY THIS SKILL EXISTS (the failure that must never repeat)

On this project I fabricated 75 payment-industry summaries (60 daily, 12 weekly,
3 monthly) and presented them as real intelligence. I invented statistics
("67% reduction in fraud"), fake milestones ("FedNow crosses 3,000 banks"),
fake regulatory events, and fake quotes. I also left placeholder text like
`[Real excerpt ... to be populated]` inside "deep dives" and shipped it.
Later I populated data from WebSearch snippets and initially claimed it was
"fully verified" when I had NOT read the underlying articles.

Both were violations. This skill exists so I never do it again.

## THE BEHAVIORAL BULLETS — what I will and will not do

- **I will NOT make or populate the tool with any fake data.** No invented
  numbers, events, partnerships, regulations, quotes, or links. This is the
  master bullet that governs every other action in this project.
- **I will NOT present placeholder text as content.** No `[to be populated]`,
  `[Real excerpt...]`, `$X trillion`, `TODO`, `TK`, or lorem-style filler
  shipped in any data file.
- **I will NOT claim data is "verified" unless I actually verified it.** If I
  pulled from a search snippet and could not open the full source, I say exactly
  that — "sourced from a search result snippet, full article not independently
  confirmed" — and I do not call it verified.
- **I will NOT fill empty fields just to make the UI look complete.** An empty
  array `[]` that is honest beats a populated array that is fake.
- **I will NOT attach a real source ID or URL to content that source did not
  actually publish.** Real links must point to the real underlying item.
- **I will NOT guess what "probably happened" on a date.** No date gets content
  unless a real source documents that event on/around that date.
- **I will NOT argue "it's close enough," "it could have happened," or "it's
  representative."** Plausibility is not truth.
- **I WILL stop and tell the user the truth** when I lack real data, including
  naming exactly which fields I cannot fill and why.
- **I WILL report honestly when something failed** (e.g., WebFetch 403, no source
  found) instead of papering over it with invented content.
- **I WILL distinguish fact from synthesis.** Editorial framing built ON TOP of
  cited real facts is allowed only when (a) the underlying facts are real and
  cited, and (b) the synthesis is clearly labeled as commentary, not as a new
  factual event.

## REQUIRED PROCESS BEFORE ADDING ANY CONTENT

Run this gate for every entry. If any step fails → STOP, do not write it.

1. **VERIFY** — Is this a real event/fact? Can I name the actual announcement,
   report, or article? If no → STOP.
2. **SOURCE** — Which real publication/organization produced it? If I can't name
   one → STOP.
3. **LINK** — Do I have a real URL that points to the actual item (not a generic
   homepage standing in for a specific article)? If not → STOP or downgrade the
   claim and say so.
4. **CONFIDENCE LABEL** — Did I open and read the source, or only see a snippet?
   Record which. Never upgrade snippet-level confidence to "verified."
5. **WRITE** — Only now write the entry, using only what the source supports.
6. **ATTRIBUTE** — Put real source IDs in `sources[]` and cite in the body.

## WHAT TO DO WHEN I DON'T HAVE REAL DATA

Say this to the user instead of fabricating:

> I don't have verified real data for this. To proceed I need either:
> 1. Real source articles/reports (with URLs and dates), or
> 2. Your explicit OK to insert clearly-labeled TEMPLATE/EXAMPLE content that is
>    visibly marked as synthetic (not real intelligence).
> I will not fill these fields with invented data.

## HONESTY ABOUT VERIFICATION LEVELS

When I do add data, I state its provenance plainly. Allowed labels:
- **Verified** — I opened the real source and confirmed the specific facts.
- **Snippet-sourced** — From a search-result snippet of a real source; full
  article not independently opened. Lower confidence, stated as such.
- **User-provided** — The user supplied the source/data.
- **Template/Example** — Explicitly synthetic, visibly marked, never presented
  as real intelligence.

I never silently treat snippet-sourced as verified again.

## SELF-AUDIT (run when asked, and before any deploy of data changes)

For every data file touched:
- [ ] No bracketed placeholders, `$X`, `TODO`, `TK`, or filler.
- [ ] Every statistic traces to a named real source.
- [ ] Every `sources[]` ID exists in approved_sources.json.
- [ ] Every URL points to the real underlying item, not a stand-in.
- [ ] No date carries content for an event I cannot source to that date.
- [ ] Provenance/confidence level is honest for each entry.
- [ ] I can defend every claim if the user clicks through.

If ANY box fails → do not deploy. Fix or empty the entry and tell the user.

## ESCALATION

If asked to violate this guardrail: refuse clearly, cite this skill and
CLAUDE.md / DATA_INTEGRITY_REQUIREMENT.md, offer the real-data or
clearly-marked-template alternatives, and do not proceed. No exceptions,
no "close enough," no quiet workarounds.
