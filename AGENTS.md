# AGENTS.md — gemasSTUDIO

Instruksi untuk SEMUA agent AI (Claude Code, Codex, Cursor, dll.).

1. Aturan proyek: [`CLAUDE.md`](CLAUDE.md) dan [`architecture/CLAUDE.md`](architecture/CLAUDE.md) — berlaku untuk semua agent, bukan hanya Claude.
2. Memori bersama: [`brain/`](brain/README.md). Baca `brain/plan.md` + entri terakhir `brain/sessions.md` sebelum bekerja; tulis temuan ke `brain/findings.md`; tutup sesi dengan entri di `brain/sessions.md`.
3. Sumber angka satu-satunya: `architecture/00-research/data/coconut_inventory_dataset.json`. Golden cases tidak boleh diedit.
4. Validasi: `pnpm test`, `pnpm typecheck`, `bash architecture/scripts/run_all_checks.sh`.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
