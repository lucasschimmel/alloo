# Development and releases

The default branch is develop. Start short-lived feature/fix branches from its current tip and open pull requests back into develop. Required CI checks must pass before merging; preserve coherent commits for substantial work. Delete a temporary branch only after its commits are integrated.

Main contains release history. Promote through a pull request from develop with a release: <version> title. The same full CI, release policy, production configuration/readiness and packaging must pass. The release checklist records real provider/device, recovery and public-information validation. A green unit suite alone is not a production sign-off. Tag a release version only after this process succeeds.

Protected branches forbid direct pushes, force pushes and deletion, including for administrators. No second-account review is required for this solo repository; PR history, required checks and explicit release evidence remain mandatory. Repository protection settings are configured on GitHub and must be verified after changes.

Run bun install --frozen-lockfile, then bun run verify before opening a PR. The connected browser and mutation checks also run in GitHub Actions. See specs/operations.md for production requirements and specs/monorepo.md for workspace ownership.

The archived V1 development tip is preserved as archive/v1-develop-20261016. It is a recovery tag, not a certified production release. The local external V1 backup also contains uncommitted/ignored files and must not be uploaded wholesale.
