# hygiene/missing-metadata

Workflow without a description (or sticky note) or without tags.

- **Category:** hygiene
- **Default severity:** info
- **Autofix:** —

## Why

Tags are how you find workflows on an instance with fifty of them; a description or a sticky note is how the next person (often you) learns what it does and what it needs before touching it.

## How to fix

Add tags in the editor header. Add a description in **Workflow settings**, or a sticky note explaining inputs, outputs, and required credentials.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `requireTags` | `true` | Report workflows without tags. |
| `requireDescription` | `true` | Report workflows without a description or sticky note. |

```json
{ "rules": { "hygiene/missing-metadata": ["info", { "requireTags": true, "requireDescription": true }] } }
```

## Disabling

For one node, add this line to the node's **Notes** (Settings → Notes):

```
n8n-lint-disable hygiene/missing-metadata
```

For the whole project, in `.n8nlintrc.json`:

```json
{ "rules": { "hygiene/missing-metadata": "off" } }
```
