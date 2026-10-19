# security/pin-data

Pinned test data left in the export.

- **Category:** security
- **Default severity:** warning
- **Autofix:** `--fix`

## Why

Pinned data is a copy of real node output saved for testing: customer emails, chat messages, API responses, sometimes tokens. It ships inside the exported JSON and is easy to forget.

## How to fix

Unpin the data in the editor before exporting, or run `n8n-lint --fix`, which removes `pinData`.

## Disabling

For one node, add this line to the node's **Notes** (Settings → Notes):

```
n8n-lint-disable security/pin-data
```

For the whole project, in `.n8nlintrc.json`:

```json
{ "rules": { "security/pin-data": "off" } }
```
