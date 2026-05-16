import re
from typing import List


def smart_chunk(inputs: List[dict], max_chars: int = 2000) -> List[List[dict]]:
    """Split dialogue inputs into chunks of <= max_chars total text.

    Splits at dialogue turn boundaries first; only splits a single turn
    at sentence boundaries when it alone exceeds the limit. NEVER splits
    mid-sentence or mid-word.
    """
    if not inputs:
        return []

    total = sum(len(inp["text"]) for inp in inputs)
    if total <= max_chars:
        return [inputs]

    chunks: List[List[dict]] = []
    current: List[dict] = []
    current_size = 0

    for inp in inputs:
        text_len = len(inp["text"])

        # Single turn exceeds limit -> split at sentence boundaries
        if text_len > max_chars:
            if current:
                chunks.append(current)
                current = []
                current_size = 0
            for sentence_group in _split_at_sentences(inp["text"], max_chars):
                chunks.append([{"voice_id": inp["voice_id"], "text": sentence_group}])
            continue

        if current_size + text_len > max_chars and current:
            chunks.append(current)
            current = []
            current_size = 0

        current.append(inp)
        current_size += text_len

    if current:
        chunks.append(current)

    return chunks


def _split_at_sentences(text: str, max_chars: int) -> List[str]:
    """Split text at sentence boundaries (. ! ?) to fit max_chars per chunk."""
    sentences = re.split(r"(?<=[.!?])\s+", text)
    groups: List[str] = []
    current = ""

    for sentence in sentences:
        if not sentence.strip():
            continue
        candidate = f"{current} {sentence}".strip() if current else sentence
        if len(candidate) > max_chars and current:
            groups.append(current.strip())
            current = sentence
        else:
            current = candidate

    if current.strip():
        groups.append(current.strip())

    # If a single sentence is still too long, hard-split
    final: List[str] = []
    for g in groups:
        if len(g) <= max_chars:
            final.append(g)
        else:
            for i in range(0, len(g), max_chars):
                final.append(g[i:i + max_chars])

    return final
