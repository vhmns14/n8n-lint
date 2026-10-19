# Examples

- `bad-workflow.json` is a deliberately broken lead-capture workflow that trips every
  rule category: a hardcoded OpenAI key, `eval` and `child_process` in a Code node,
  an unauthenticated webhook, plain-HTTP calls, an inlined Telegram token, duplicate
  and default node names, a disabled node, an orphan node, an oversized Code node,
  pinned customer data, and no error workflow. Every secret in it is invented.
- `good-workflow.json` is the same idea done properly. It lints clean.
- `n8nlintrc.example.json` is a sample config. Copy it to `.n8nlintrc.json` in your repo.

```sh
npx n8n-lint examples/bad-workflow.json
npx n8n-lint examples/good-workflow.json
```

Regenerate both workflows with `python3 scripts/make-examples.py`.
