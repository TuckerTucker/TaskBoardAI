CREATE shared config:
- WRITE to `${REPO_PATH}/_project/repo-review/reports/analysis.config.json`:
  ```json
  {
    "repo_path": "${REPO_PATH}",
    "analysis_date": "$(date -u +%Y-%m-%d)",
    "output_format": "markdown+json",
    "report_sections": ["executive_summary", "findings", "recommendations", "metrics"],
    "agents": ["overview", "security", "quality", "deps"]
  }


  # Execute Parallel Repository Analysis (No Worktrees)
## Execute these tasks in parallel

> Variables: REPO_PATH (default: $(pwd)), TARGET_REPO (default: ${REPO_PATH}), MAX_DEPTH (default: 3)
> Execute all agent tasks concurrently for maximum efficiency
> All agents work on the same repository without creating copies

TASK 1 - Overview Analysis:
AGENT_NAME="overview"
- READ `${REPO_PATH}_project/repo-review/agents/${AGENT_NAME}-agent.md`
- ANALYZE repository at `${TARGET_REPO}` with depth `${MAX_DEPTH}`
- WRITE outputs to `${REPO_PATH}/_project/repo-review/reports/${AGENT_NAME}/`:
  - `analysis-report.md` (human-readable findings)
  - `findings.json` (structured data)
  - `metrics.json` (analysis metrics)

TASK 2 - Security Analysis:
AGENT_NAME="security"
- READ `${REPO_PATH}_project/repo-review/agents/${AGENT_NAME}-agent.md`
- ANALYZE repository at `${TARGET_REPO}` with depth `${MAX_DEPTH}`
- WRITE outputs to `${REPO_PATH}/_project/repo-review/reports/${AGENT_NAME}/`:
  - `analysis-report.md` (human-readable findings)
  - `findings.json` (structured data)
  - `metrics.json` (analysis metrics)

TASK 3 - Quality Analysis:
AGENT_NAME="quality"
- READ `${REPO_PATH}_project/repo-review/agents/${AGENT_NAME}-agent.md`
- ANALYZE repository at `${TARGET_REPO}` with depth `${MAX_DEPTH}`
- WRITE outputs to `${REPO_PATH}/_project/repo-review/reports/${AGENT_NAME}/`:
  - `analysis-report.md` (human-readable findings)
  - `findings.json` (structured data)
  - `metrics.json` (analysis metrics)

TASK 4 - Dependencies Analysis:
AGENT_NAME="deps"
- READ `${REPO_PATH}_project/repo-review/agents/${AGENT_NAME}-agent.md`
- ANALYZE repository at `${TARGET_REPO}` with depth `${MAX_DEPTH}`
- WRITE outputs to `${REPO_PATH}/_project/repo-review/reports/${AGENT_NAME}/`:
  - `analysis-report.md` (human-readable findings)
  - `findings.json` (structured data)
  - `metrics.json` (analysis metrics)


MONITOR progress:
- TRACK completion of each task
- LOG timestamps to `${REPO_PATH}/_project/repo-review/reports/execution-metrics.json`


- ENSURE all agents complete their analysis before proceeding to merge phase
