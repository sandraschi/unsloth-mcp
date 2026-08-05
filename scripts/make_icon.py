"""Generate assets/icon.png (256x256) with stdlib only - no PIL needed.

Dark zinc background, amber ring, dark 'U' letterform (unsloth)."""

import struct
import zlib
from pathlib import Path

SIZE = 256


def pixel(x: int, y: int) -> tuple[int, int, int]:
    cx, cy = SIZE / 2, SIZE / 2
    r = SIZE / 2 - 6
    dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
    if r - 14 <= dist <= r:
        return (245, 158, 11)  # amber ring
    if dist < r - 14:
        # U letterform: dark on amber field
        ux = x - cx
        uy = y - cy
        width = r * 0.62
        stroke = r * 0.16
        left = -width / 2
        right = width / 2
        bottom = r - 14 - 8
        top = -bottom
        in_left_col = left - stroke / 2 <= ux <= left + stroke / 2
        in_right_col = right - stroke / 2 <= ux <= right + stroke / 2
        in_base = abs(uy - bottom) <= stroke / 2 and left - stroke / 2 <= ux <= right + stroke / 2
        in_v = in_left_col or in_right_col or in_base
        in_u_zone = -top >= uy >= top - stroke / 2 and uy >= 0  # lower half only
        if in_v and in_u_zone:
            return (9, 9, 11)  # dark 'U'
        return (9, 9, 11) if dist < r - 14 else (245, 158, 11)
    return (9, 9, 11)  # outside: dark zinc


def main() -> None:
    rows = []
    for y in range(SIZE):
        row = bytearray([0])
        for x in range(SIZE):
            row += bytes(pixel(x, y))
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")

    out = Path(__file__).resolve().parents[1] / "assets" / "icon.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(png)
    print(f"wrote {out} ({len(png)} bytes)")


if __name__ == "__main__":
    main()
