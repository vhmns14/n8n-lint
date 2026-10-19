# Security policy

## Supported versions

Only the latest minor release gets fixes while the project is pre-1.0.

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private reporting instead:
**Security → Report a vulnerability** on this repository.

Include the n8n-lint version, the command you ran, and a minimal workflow
JSON that shows the problem. **Replace any real secrets in it first.**

You can expect an acknowledgement within 7 days. Fixes for confirmed issues
ship as a patch release, with credit in the changelog unless you prefer not.

## What counts

- n8n-lint printing, writing, or uploading a secret it found in full (findings
  are supposed to be masked in every output format, including SARIF and JSON).
- `--fix` changing workflow behaviour in a way the docs say it will not.
- Crafted workflow files that make the linter hang, crash, or read files
  outside the paths it was given.

A rule that misses a leak or flags something harmless is a bug, not a
vulnerability; open a normal issue for those (again, with secrets removed).

## If n8n-lint found a real secret in your workflow

Deleting it from the file is not enough: it is still in your git history and
may already be in forks or caches. Rotate the key with the provider first, then
move it into an n8n credential.
