#!/usr/bin/env bash
set -euo pipefail

require_clean_tree() {
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "Working tree is not clean. Commit or stash changes first."
    exit 1
  fi
}

create_branch_from() {
  local base_branch="$1"
  local new_branch="$2"

  git checkout "$base_branch"
  if git show-ref --verify --quiet "refs/heads/$new_branch"; then
    echo "Branch already exists locally: $new_branch"
  else
    git checkout -b "$new_branch"
  fi
  git push -u origin "$new_branch"
}

require_clean_tree

git checkout main
git push -u origin main

create_branch_from main develop
create_branch_from develop feature/miguel-ui-extension
create_branch_from develop feature/agent-planner-api
create_branch_from develop experiment/lab-click-flows
create_branch_from main archive/v0-scaffold

git checkout develop

echo "Branches created and pushed. Current branch: develop"
