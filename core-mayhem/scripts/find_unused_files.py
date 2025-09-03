#!/usr/bin/env python3
"""
Quick and conservative detector for unused source files.

Builds a simple import graph for TS/JS files under src/ and __tests__/,
then reports files not reachable from roots:
  - src/main.ts (app entry)
  - all files under src/__tests__/ (test roots)

Limitations:
  - Only handles static import/export forms (no dynamic import(), require())
  - Resolves only relative paths and .ts/.tsx/.js/.mjs extensions
  - Does not detect unused exports inside used files (symbols)

This is intended as a safe first pass to identify entire files/modules
that are likely unused.
"""
from __future__ import annotations
import os
import re
from pathlib import Path
from collections import defaultdict, deque

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"

IMPORT_RE = re.compile(r"^\s*import\s+(?:[^'\"]+?from\s+)?['\"]([^'\"]+)['\"];?", re.M)
EXPORT_FROM_RE = re.compile(r"^\s*export\s+\*\s+from\s+['\"]([^'\"]+)['\"];?", re.M)

EXTS = (".ts", ".tsx", ".js", ".mjs")

def is_code_file(p: Path) -> bool:
    if not p.is_file():
        return False
    if p.suffix.lower() in EXTS:
        return True
    # include .d.ts in graph but they rarely import others
    return p.suffix.lower() == ".d.ts"

def normalize_module_path(base: Path, spec: str) -> Path | None:
    # Only resolve relative specs like ./foo or ../bar
    if not spec.startswith("."):
        return None
    candidate = (base.parent / spec).resolve()
    # Try with explicit file first
    if candidate.is_file():
        return candidate
    # Try adding extensions
    for ext in EXTS + (".d.ts",):
        p = Path(str(candidate) + ext)
        if p.is_file():
            return p
    # Try index files within folder
    if candidate.is_dir():
        for ext in EXTS + (".d.ts",):
            p = candidate / ("index" + ext)
            if p.is_file():
                return p
    return None

def parse_imports(p: Path) -> set[Path]:
    try:
        text = p.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return set()
    deps: set[Path] = set()
    specs = set()
    specs.update(IMPORT_RE.findall(text))
    specs.update(EXPORT_FROM_RE.findall(text))
    for spec in specs:
        q = normalize_module_path(p, spec)
        if q is not None:
            deps.add(q)
    return deps

def collect_files() -> list[Path]:
    files: list[Path] = []
    for root, _, filenames in os.walk(SRC):
        for name in filenames:
            p = Path(root) / name
            if is_code_file(p):
                files.append(p.resolve())
    return files

def build_graph(files: list[Path]) -> dict[Path, set[Path]]:
    g: dict[Path, set[Path]] = {}
    for f in files:
        g[f] = parse_imports(f)
    return g

def find_roots(files: list[Path]) -> list[Path]:
    roots: list[Path] = []
    main = (SRC / "main.ts").resolve()
    if main.exists():
        roots.append(main)
    # treat tests as roots so helpers used only in tests are retained
    tests_dir = SRC / "__tests__"
    if tests_dir.exists():
        for root, _, filenames in os.walk(tests_dir):
            for name in filenames:
                p = Path(root) / name
                if is_code_file(p):
                    roots.append(p.resolve())
    return roots

def reachable(graph: dict[Path, set[Path]], roots: list[Path]) -> set[Path]:
    seen: set[Path] = set()
    dq: deque[Path] = deque(roots)
    while dq:
        cur = dq.popleft()
        if cur in seen:
            continue
        seen.add(cur)
        for dep in graph.get(cur, ()):  # type: ignore[arg-type]
            if dep not in seen:
                dq.append(dep)
    return seen

def main() -> int:
    files = collect_files()
    graph = build_graph(files)
    roots = find_roots(files)
    keep = reachable(graph, roots)
    unused = sorted(set(files) - keep)

    rel = lambda p: str(p.relative_to(ROOT))

    print("Roots:")
    for r in sorted(roots):
        print("  ", rel(r))
    print()

    print("Reachable (kept):", len(keep))
    print("Unused candidates:", len(unused))
    for u in unused:
        print(rel(u))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

