# Claude Code project entry point

@AGENTS.md

## Claude Code-specific guidance

- The imported `AGENTS.md` is the shared project contract. Keep this adapter
  small and do not duplicate shared project knowledge here.
- Treat paths under `pm_skills/` as repository workflows to read and follow;
  they do not require a separately installed slash command.
- Auto memory is optional, machine-local recall. Do not use it as the source of
  truth for standing rules, decisions, the backlog, or handovers; write durable
  cross-tool knowledge to the repository-owned document instead.
- Use `/context` when you need to verify which memory files loaded in a Claude
  Code session.
