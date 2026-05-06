# Alliance Story Authority

The Alliance Story documents are the narrative authority for Alliance Hub scoping.

## Rule

When a build, plan, automation, route, data model, or user-facing explanation changes the Alliance Hub vision, ratify the idea against these sources before treating it as aligned:

1. `The alliance Hub`
2. `The Alliance Structure`
3. `The Alliance Rhythm`
4. `The Alliance Leadership`
5. `The Alliance Members`
6. `The Alliance Gifts`
7. `alliance_invisible_app_architecture.md`

The derived Scoping plan is useful for app buildout, but the raw story documents remain the source authority. If the Scoping plan and a story document disagree, update the Scoping plan from the story document.

## Remote Alliance Location

On the Alliance Zo computer, synced authority files live under:

```text
/home/workspace/Projects/Alliance-Hub/alliance/factory/story/
```

Expected files:

- `authority.md`
- `source/The alliance Hub`
- `source/The Alliance Structure`
- `source/The Alliance Rhythm`
- `source/The Alliance Leadership`
- `source/The Alliance Members`
- `source/The Alliance Gifts`
- `source/alliance_invisible_app_architecture.md`
- `alliance-scoping-plan-latest.json`
- `alliance-scoping-plan-latest.md`
- `alliance-vocabulary-latest.json`
- `alliance-vocabulary-latest.md`

## Build Use

- Use raw story documents to judge whether a new feature belongs in the Alliance Hub.
- Use the Scoping plan to convert that feature into app programs, records, workflows, and automations.
- Use the Alliance vocabulary to route ordinary user language through Script Factory intake before selecting a capability or build lane.
- Use `site-manifest.json` and generated app source as the current implementation state.
- Use Supabase Edge Functions for private persistent records.
