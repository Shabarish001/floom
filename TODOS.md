# TODOs

## Artifact Garbage Collection
- **What:** Delete orphaned artifacts older than 30 days with no linked testRun or automationVersion.
- **Why:** The agent fix loop creates ~5 artifacts per deploy attempt. Without GC, orphaned artifacts accumulate.
- **Context:** The `by_created_at` index on the artifacts table supports efficient querying by age. Implementation: scheduled Convex cron that queries old artifacts, checks for references, deletes orphans.
- **Depends on:** Artifacts table (this PR)
- **Priority:** P2
- **Effort:** S (CC: ~10 min)

## Dependency Caching
- **What:** Hash requirements.txt/pyproject.toml, cache the pip-installed environment in E2B, skip pip install if deps haven't changed.
- **Why:** Pip install is the execution bottleneck (5-30s per run). In the agent fix loop (5 retries), that's over a minute just on dependency installation. Caching eliminates this for unchanged deps.
- **Pros:** Massive perf win for fix loops and production runs.
- **Cons:** E2B environment caching adds complexity; cache invalidation is hard.
- **Context:** The manifest's `python_dependencies` field (or requirements.txt in the zip) can be hashed to create a cache key. E2B may support snapshot/resume for cached environments.
- **Depends on:** Multi-file artifacts (zip-based upload)
- **Priority:** P2
- **Effort:** M (CC: ~20 min)

## Per-Org Storage Limits
- **What:** Add configurable per-org storage quota with a generous default (1GB). Reject artifact uploads that would exceed the quota.
- **Why:** The fix loop creates ~5 artifacts per deploy attempt (5 zips of ~200KB = 1MB per attempt). Without limits, a runaway agent or abuse could fill storage unbounded.
- **Pros:** Prevents abuse and runaway costs. Simple to implement.
- **Cons:** Minimal complexity. Need to track cumulative storage per org.
- **Context:** Query artifacts by orgId, sum totalSize. Reject new uploads if sum + new artifact would exceed quota. Also need orphaned blob cleanup (blobs in file storage with no artifact referencing their storageId).
- **Depends on:** Multi-file artifacts, artifact GC
- **Priority:** P2
- **Effort:** S (CC: ~10 min)
