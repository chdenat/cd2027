#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKFLOW=".github/workflows/deploy-staging.yml"

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required. Install it and run 'gh auth login'." >&2
  exit 1
fi

if [[ ! -f "$ROOT/$WORKFLOW" ]]; then
  echo "Workflow file not found: $ROOT/$WORKFLOW" >&2
  exit 1
fi

gh auth status >/dev/null
cd "$ROOT"
gh workflow run "$WORKFLOW" --ref main

repository="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
printf 'Déploiement de test demandé sur main. Suivi : https://github.com/%s/actions/workflows/deploy-staging.yml\n' "$repository"
