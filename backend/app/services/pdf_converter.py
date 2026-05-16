import os
import tempfile
import asyncio

import pymupdf4llm


def _convert_pdf_sync(path: str) -> str:
    """Sync PDF → markdown. Layout ML is disabled to avoid ONNX int32/int64 errors on Windows."""
    pymupdf4llm.use_layout(False)
    return pymupdf4llm.to_markdown(path) or ""


async def convert_pdf_to_markdown(file_bytes: bytes, filename: str = "story.pdf") -> str:
    """Convert uploaded PDF bytes to markdown text using pymupdf4llm.

    pymupdf4llm.to_markdown is sync, so we run it in a thread to avoid
    blocking the event loop.
    """
    suffix = ".pdf" if filename.lower().endswith(".pdf") else ".pdf"
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        tmp.write(file_bytes)
        tmp.flush()
        tmp.close()
        md_text = await asyncio.to_thread(_convert_pdf_sync, tmp.name)
        return md_text or ""
    finally:
        try:
            os.unlink(tmp.name)
        except Exception:
            pass
