$ErrorActionPreference = "Stop"

function Require-CleanTree {
  $status = git status --porcelain
  if ($status) {
    Write-Error "Working tree is not clean. Commit or stash changes first."
  }
}

function Create-BranchFrom($BaseBranch, $NewBranch) {
  git checkout $BaseBranch
  $exists = git show-ref --verify --quiet "refs/heads/$NewBranch"
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Branch already exists locally: $NewBranch"
  } else {
    git checkout -b $NewBranch
  }
  git push -u origin $NewBranch
}

Require-CleanTree

git checkout main
git push -u origin main

Create-BranchFrom "main" "develop"
Create-BranchFrom "develop" "feature/miguel-ui-extension"
Create-BranchFrom "develop" "feature/agent-planner-api"
Create-BranchFrom "develop" "experiment/lab-click-flows"
Create-BranchFrom "main" "archive/v0-scaffold"

git checkout develop
Write-Host "Branches created and pushed. Current branch: develop"
