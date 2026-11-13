#!/usr/bin/env python3
"""Print direct Swift dylib dependencies from a thin Mach-O executable."""
import pathlib
import sys

from macho import inspect

metadata = inspect(pathlib.Path(sys.argv[1]).read_bytes())
dependencies = {
    pathlib.PurePosixPath(name).name
    for name in metadata["libraries"]
    if pathlib.PurePosixPath(name).name.startswith("libswift")
    and name.endswith(".dylib")
}
for dependency in sorted(dependencies):
    print(dependency)
