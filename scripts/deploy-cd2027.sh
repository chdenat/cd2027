#!/usr/bin/env bash
# ******************************************************************************
# This file is part of the CD2027 project.
#
# File: scripts/deploy-cd2027.sh
#
# Author: Christian Denat
# Email: christian.denat@orange.fr
#
# Created on: 2026-10-02
# Last modified: 2026-10-06
#
# Copyright © 2026 Christian Denat
# ******************************************************************************

# Dispatches the repository's main-branch workflow; local uncommitted files are not uploaded.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKFLOW=".github/workflows/deploy-cd2027.yml"

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
printf 'Déploiement CD2027 demandé sur main. Suivi : https://github.com/%s/actions/workflows/deploy-cd2027.yml\n' "$repository"
