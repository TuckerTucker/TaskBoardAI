# Merge and Aggregate Analysis Findings (No Worktrees)
## Execute these tasks

> Variables: REPO_PATH (default: $(pwd))
> Consolidate all agent findings into unified reports

VERIFY all agents completed:
- FOR each agent in [overview security quality deps]:
  - CHECK exists `${REPO_PATH}/_project/repo-review/reports/$agent/findings.json`
  - IF missing, LOG warning

AGGREGATE JSON findings:
- CD `${REPO_PATH}/_project/repo-review/reports`
- RUN jq aggregation on `agents/*/findings.json`:
  ```jq
  {
    analysis_date: .[0].analysis_date,
    repository: .[0].repository,
    summary: {
      total_issues: [.[] | .findings[].severity] | length,
      critical: [.[] | .findings[] | select(.severity == "critical")] | length,
      high: [.[] | .findings[] | select(.severity == "high")] | length,
      medium: [.[] | .findings[] | select(.severity == "medium")] | length,
      low: [.[] | .findings[] | select(.severity == "low")] | length
    },
    findings_by_agent: [.[] | {(.agent_type): .findings}] | add,
    recommendations: [.[] | .recommendations[]] | unique
  }
  ```
- WRITE output to `consolidated/aggregated-findings.json`

GENERATE executive summary:
- CREATE `${REPO_PATH}/_project/repo-review/reports/consolidated/executive-summary.md`:
  - ADD header with date and repository
  - PARSE `aggregated-findings.json` for key metrics
  - EXTRACT top priority recommendations
  - LINK to individual agent reports in `../agents/*/analysis-report.md`

CONSOLIDATE reports:
- CREATE `${REPO_PATH}/_project/repo-review/reports/consolidated/full-report.md`:
  - INCLUDE executive summary
  - APPEND all agent reports in order: overview, security, a11y, performance, quality, deps
  - ADD table of contents with links

CREATE metrics summary:
- AGGREGATE all `agents/*/metrics.json` files
- WRITE combined metrics to `consolidated/analysis-metrics.json`
- INCLUDE execution times, file counts, and coverage stats

GENERATE artifacts index:
- CREATE `${REPO_PATH}/_project/repo-review/reports/index.md`:
  - LIST all generated reports with descriptions
  - PROVIDE navigation links to all outputs
  - INCLUDE timestamp and configuration used