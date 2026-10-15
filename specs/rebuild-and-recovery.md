# Rebuild and recovery

## Reset performed on 2026-10-15

- Original branch: `develop`.
- Original committed HEAD: `c91222a`.
- New branch: `codex/v2-rebuild`, created from that HEAD; history was not rewritten.
- Full previous working-tree contents were moved, without reading secrets, into the sibling directory `C:/Users/osiri/Develop/Projects/alloo-v1-backup-20261015`.
- `.git` remains in the original repository. The backup contains old source, untracked hardening/tests/reports, ignored local configuration, dependencies and generated artifacts. It is a local filesystem backup, not an independent Git clone or remote backup.
- The active working tree now contains only V2 specifications and minimal repository documentation/hygiene.
- No remote Convex data, provider settings or deployed service was deleted. No push or deployment was performed.

## Important distinction

The original branch preserves committed V1. The external directory preserves **uncommitted changes and ignored files**. Checking out `develop` alone does not restore those working changes. The previous hardening was unfinished and must not be described as a validated release.

The reset and new documents are left uncommitted for review. Switching branches with these changes still present is not a recovery procedure; Git can carry working-tree changes across branches.

## Safe recovery

For isolated inspection, create a separate worktree at `c91222a` or inspect the local backup directly. Recover specific source/assets by copying selected files into the intended location. Do not copy dependency directories into the V2 scaffold or blindly restore old generated API files.

For a full V1 restoration, first preserve any new V2 work, use a separate clean checkout/worktree on the V1 commit, then copy the backup working files into it while keeping its `.git` metadata intact. Reinstall dependencies if moved paths make local tooling unusable. Restore local configuration only into the appropriate ignored locations; never add it to Git.

Verify the restored source and test state before use. Do not delete the backup until all V2 requirements and visual references are verified. Do not upload the backup wholesale: it may contain private local configuration.
