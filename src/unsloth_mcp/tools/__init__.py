"""Tool registration - portmanteau imports ensure registration at boot time.

FastMCP registers tools AT IMPORT TIME via @mcp.tool decorator.
No import = no tool.
"""

from unsloth_mcp.tools import prefab_cards, unsloth_ops  # noqa: F401

__all__ = ["unsloth_ops", "prefab_cards"]
