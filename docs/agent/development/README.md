# Development Documentation

Index of maintainer policies, plans and acceptance records. It does not duplicate development rules or execution steps, and is not the entry point for ordinary library consumers.

## Current Policies and Workflow

| Document | Responsibility |
| --- | --- |
| [Seven Development Principles](development-principles.md) | Required rules: what every change must preserve. Single source, required by root `AGENTS.md`. |
| [Development Guide](../development-guide.md) | How to implement and verify a change; scenario/source map and quality gates. |
| [Roadmap](roadmap.md) | Release status and iteration overview. |
| [Release SOP](release-sop.md) | Author-only release procedure. |
| [Playground Policy](playground-plan.md) | Demo ownership, shared page requirements and promo asset maintenance; the live catalog stays in `playground/playground.mjs`. |

Current policies use English. Chinese guidance is in [the companion Development Guide](../zh-CN/development-guide.md); historical records may retain their original language.

## Iteration Records

- [20](iteration-20.md): production-readiness contracts.
- [21](iteration-21.md): consumer and runtime footprint gates.
- [22](iteration-22.md): Agent adoption and benchmarks.
- [23](iteration-23.md): first-run usability and output reliability.
- [24](iteration-24.md): shape-aware connector routing.
- [25](iteration-25.md): predictable editing and delivery.
- [26](iteration-26.md): incremental Flow construction.
- [27](iteration-27.md): incremental Board construction and shared Agent-driven workflow.

Earlier iteration plans are linked from the Roadmap. An implemented plan is not proof of publication; read its status and evidence.

## Historical records

Iteration files describe their own scope and acceptance evidence, not necessarily a published release. They are not current installation or release instructions. For the current public contract, use the [Agent Guide](../README.md), [Quickstart](../quickstart.md), and [Runtime Contract](../runtime-contract.md).

- [2.0.0 release readiness](2.0-release-readiness.md): original release decision and deferred checks.
