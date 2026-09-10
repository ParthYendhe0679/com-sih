"""Remove obvious test/junk cases and FIRs before a demo.

Junk is anything a person clearly typed while testing: placeholder titles like
"abctest", titles that are a bare UUID, and empty "Untitled" records. Real
seeded demo cases (MUM-/THN-/NAV- prefixes, Operation ... titles) are never
touched.

Run a dry run first (default), then re-run with --apply to actually delete:

    py -3.14 scripts/clean_demo_junk.py
    py -3.14 scripts/clean_demo_junk.py --apply
"""

import asyncio
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select, delete  # noqa: E402
from app.db.session import AsyncSessionLocal  # noqa: E402
from app.models.case import Case  # noqa: E402
from app.models.fir import FIR  # noqa: E402

UUID_RE = re.compile(
    r"[0-9a-f]{8}[\s-][0-9a-f]{4}[\s-][0-9a-f]{4}[\s-][0-9a-f]{4}[\s-][0-9a-f]{12}",
    re.IGNORECASE,
)

JUNK_WORDS = {
    "abctest", "abc test", "test", "testing", "asdf", "qwerty", "demo test",
    "sample test", "xyz", "aaa", "untitled", "string",
}


def is_junk(title: str | None) -> str | None:
    """Return the reason a title is junk, or None if it looks legitimate."""
    if not title or not title.strip():
        return "empty title"
    t = title.strip()
    bare = re.sub(r"^(Investigation|Case|FIR)\s*[:\-]\s*", "", t, flags=re.IGNORECASE).strip()
    if UUID_RE.search(bare):
        return "title is a raw UUID"
    low = bare.lower().strip(" .-_")
    if low in JUNK_WORDS:
        return f"placeholder title ({bare!r})"
    if len(low) <= 3 and not low.isdigit():
        return f"title too short ({bare!r})"
    return None


async def main(apply: bool) -> None:
    async with AsyncSessionLocal() as db:
        cases = (await db.execute(select(Case))).scalars().all()
        firs = (await db.execute(select(FIR))).scalars().all()

        bad_cases = [(c, r) for c in cases if (r := is_junk(c.title))]
        bad_firs = [(f, r) for f in firs if (r := is_junk(f.title))]

        print(f"Scanned {len(cases)} cases and {len(firs)} FIRs.\n")

        if not bad_cases and not bad_firs:
            print("Nothing to clean. Database is already tidy.")
            return

        if bad_cases:
            print(f"CASES to remove ({len(bad_cases)}):")
            for c, reason in bad_cases:
                print(f"  {c.case_number:<22} {str(c.title)[:52]:<54} <- {reason}")
        if bad_firs:
            print(f"\nFIRs to remove ({len(bad_firs)}):")
            for f, reason in bad_firs:
                print(f"  {f.fir_number:<22} {str(f.title)[:52]:<54} <- {reason}")

        if not apply:
            print("\nDRY RUN - nothing deleted.")
            print("Re-run with --apply to delete these records.")
            return

        for c, _ in bad_cases:
            await db.execute(delete(Case).where(Case.id == c.id))
        for f, _ in bad_firs:
            await db.execute(delete(FIR).where(FIR.id == f.id))
        await db.commit()
        print(f"\nDeleted {len(bad_cases)} cases and {len(bad_firs)} FIRs.")


if __name__ == "__main__":
    asyncio.run(main(apply="--apply" in sys.argv))
