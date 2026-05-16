import json
import re
from typing import Any


def strip_json_fences(text: str) -> str:
    """Remove markdown code fences if the model wrapped JSON."""
    text = (text or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```\s*$", "", text)
    return text.strip()


def parse_llm_json(text: str) -> dict[str, Any]:
    """Parse JSON from LLM output with light repair for truncated responses."""
    cleaned = strip_json_fences(text)
    if not cleaned:
        raise json.JSONDecodeError("Empty response", cleaned, 0)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Attempt to close truncated JSON (common when max_output_tokens cut off mid-object)
    repaired = _repair_truncated_json(cleaned)
    return json.loads(repaired)


def _repair_truncated_json(text: str) -> str:
    """Close open strings/arrays/objects heuristically for truncated JSON."""
    in_string = False
    escape = False
    stack: list[str] = []

    for ch in text:
        if escape:
            escape = False
            continue
        if ch == "\\" and in_string:
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch in "{[":
            stack.append("}" if ch == "{" else "]")
        elif ch == "}" and stack and stack[-1] == "}":
            stack.pop()
        elif ch == "]" and stack and stack[-1] == "]":
            stack.pop()

    suffix = ""
    if in_string:
        suffix += '"'
    suffix += "".join(reversed(stack))
    return text + suffix
