# Contributing

This is a personal, self-hosted project — there's no formal contribution process, but if
you're sending a PR (including future-me, picking this back up later), here's what's
expected.

## Before opening a PR

```
npm run lint && npm run typecheck && npm run test && npm run build
cd backend && ruff check . && pytest
```

All of the above also run in CI (`.github/workflows/ci.yml`) on every push and PR, including
a Docker build check — but running them locally first is faster than waiting on a CI failure.

If your change touches a user-facing flow, run the relevant Playwright suite in `e2e/`
against a scratch copy of a real database (never your real one — see `e2e/README.md`)
before merging. CI doesn't do this for you (deliberately — see `docs/developer-guide.md`).

## Conventions

See [docs/developer-guide.md](docs/developer-guide.md) for the actual architectural
conventions (layering, schema conventions, testing approach, etc.) — this file is just the
process, that one's the substance.

A few things worth calling out explicitly:

- **Write a test alongside the change**, not after, and especially when you find a real bug
  while building something — the regression test should explain *why* the bug happened, not
  just assert the fix.
- **Database migrations**: test the upgrade/downgrade round-trip against a scratch copy of
  the real database before it touches anything that actually has data in it.
- **Don't add abstractions for hypothetical future needs.** This codebase consistently
  favors three similar lines over a premature shared helper — if you're adding a config
  option, a feature flag, or an interface with one implementation "for flexibility," that's
  usually a sign to simplify rather than generalize.

## Commit messages

Describe *why*, not just what changed — the diff already shows what changed. No required
format (this project doesn't use Conventional Commits or automated changelog generation —
versioning is manual, see the root README's "Release a new version"), but a commit message
that only restates the diff in prose isn't pulling its weight.

## Reporting a bug

Open an issue with: what you expected, what happened instead, and how to reproduce it
against a scratch database if it's data-dependent. If you've already found the root cause,
saying so saves a round trip.
