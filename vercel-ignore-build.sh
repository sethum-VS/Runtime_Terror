#!/usr/bin/env bash
# Vercel "Ignored Build Step": exit 0 = skip this deployment, exit 1 = run the build.
# https://vercel.com/docs/project-configuration/git-settings#ignored-build-step
#
# Only the production branch (prod) should produce Vercel builds; all other refs skip.

set -euo pipefail

ref="${VERCEL_GIT_COMMIT_REF:-}"

if [[ "$ref" == "prod" ]]; then
  echo "vercel-ignore-build: branch is prod — proceeding with build."
  exit 1
fi

echo "vercel-ignore-build: branch is '${ref:-<empty>}' (not prod) — skipping build."
exit 0
