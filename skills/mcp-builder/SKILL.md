---
name: mcp-builder
description: Rapid scaffolding and authoring of custom Model Context Protocol (MCP) servers using FastMCP (Python) or TypeScript SDK. Curated from anthropics/skills.
---

# MCP Builder (On-Demand FastMCP Server Generator)

Curated from **`anthropics/skills`**, this skill empowers agents to scaffold typed, production-ready **Model Context Protocol (MCP)** servers in under 60 seconds whenever a project requires a novel API integration, hardware interface, or external data engine.

---

## [WHEN TO USE]

- When a hackathon domain lacks an existing MCP server (e.g., custom IoT hardware, proprietary bioinformatics tools, niche fintech APIs).
- When ad-hoc Python/curl shell scripts would violate the Gravitas Prime Directive or pollute the environment.
- When multi-agent swarms require a strictly typed, auditable JSON-RPC contract for external operations.

---

## [FASTMCP PYTHON SCAFFOLD (60-SECOND BOOTSTRAP)]

```python
# server.py
from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field

mcp = FastMCP("CustomDomainEngine")

class OperationInput(BaseModel):
    query: str = Field(description="Search parameter or identifier")
    limit: int = Field(default=10, description="Max results")

@mcp.tool()
def search_domain_records(params: OperationInput) -> dict:
    """Search domain database with strictly typed parameters."""
    # Deterministic implementation
    return {"results": [], "count": 0, "status": "success"}

if __name__ == "__main__":
    mcp.run()
```

---

## [INTEGRATION IN SPRINT SYSTEM v2.0]

- **Phase 1 (Discover)**: Identifies if the project's unique technical moat requires a custom tool bridge.
- **Phase 2 (Backend)**: FastMCP server is initialized and registered into Antigravity `mcp_config.json`, providing typed agent tools for the rest of the sprint.
- **Phase 5 (Audit)**: Validates that all custom tools declare strict Pydantic/JSON-Schema boundaries with zero wildcard permissions.
