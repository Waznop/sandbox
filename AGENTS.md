# AGENTS.md

Rules for AI agents working in this repository:

1. **Always create PRs for code changes** - Never commit directly to main. Create a branch, make changes, then create a PR.
2. **Show the PR to the user** - After creating a PR, share the link and wait for feedback/merge.
3. **Include test results in PR description** - Run tests and paste the output in the PR body.
4. **Keep PRs focused** - One feature/fix per PR.
5. **Rebase on main** - Before creating a PR, rebase onto the latest main.

Example workflow:
```bash
git checkout -b feature/my-feature
# make changes
git add .
git commit -m "feat: my feature"
git push origin feature/my-feature
gh pr create --base main --head feature/my-feature --title "feat: my feature" --body "..."
```
