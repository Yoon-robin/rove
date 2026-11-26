# Builds the setup window's font: Pretendard (SIL OFL 1.1, github.com/orioncactus/pretendard)
# as three static weights (450, 550, 650: the V5 weights), cut down to the characters
# Setup.cs shows. WPF reads neither woff2 nor variable fonts, hence static TrueType.
#
#   python setup/font.py [folder of PretendardVariable.subset.N.woff2, default ui/fonts/woff2-dynamic-subset]
#
# Run again when the texts in Setup.cs or setup.xaml change; it writes setup/fonts/RoveSetup-<w>.ttf.
# Needs fontTools and brotli (pip install fonttools brotli).
import sys
from pathlib import Path

from fontTools.merge import Merger
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

HERE = Path(__file__).parent
FAMILY = "Rove Setup Sans"
WEIGHTS = (450, 550, 650)

src = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parent / "ui" / "fonts" / "woff2-dynamic-subset"
text = "".join((HERE / n).read_text(encoding="utf-8") for n in ("Setup.cs", "setup.xaml"))
chars = {chr(c) for c in range(0x20, 0x7F)} | set("…·→—’“”%")
chars |= {ch for ch in text if ord(ch) > 0x7F}
want = {ord(c) for c in chars if not c.isspace() or c == " "}

slices = sorted(src.glob("PretendardVariable.subset.*.woff2"), key=lambda p: int(p.stem.split(".")[-1]))
if not slices:
    sys.exit(f"no PretendardVariable.subset.*.woff2 in {src}")

out = HERE / "fonts"
out.mkdir(exist_ok=True)
tmp = out / "tmp"
tmp.mkdir(exist_ok=True)
for w in WEIGHTS:
    parts = []
    left = set(want)
    for p in slices:
        f = TTFont(p)
        have = left & set(f.getBestCmap() or {})
        if not have:
            continue
        left -= have
        opts = Options()
        opts.layout_features = []
        opts.drop_tables += ["GSUB", "GPOS", "GDEF", "STAT"]
        opts.name_IDs = ["*"]
        opts.notdef_outline = True
        s = Subsetter(opts)
        s.populate(unicodes=have)
        s.subset(f)
        f = instantiateVariableFont(f, {"wght": w})
        f.flavor = None
        part = tmp / f"{w}-{p.stem.split('.')[-1]}.ttf"
        f.save(part)
        parts.append(str(part))
    missing = "".join(sorted(chr(c) for c in left))
    if missing.strip():
        sys.exit(f"Pretendard has no glyph for: {missing!r}")
    font = Merger().merge(parts)
    name = font["name"]
    style = f"W{w}"
    for nid, val in ((1, f"{FAMILY} {style}"), (2, "Regular"), (3, f"{FAMILY}-{style}"), (4, f"{FAMILY} {style}"),
                     (6, f"RoveSetupSans-{style}"), (16, FAMILY), (17, style)):
        name.setName(val, nid, 3, 1, 0x409)
    font["OS/2"].usWeightClass = w
    font.save(out / f"RoveSetup-{w}.ttf")
    print(w, len(parts), "slices,", len(want), "characters")
for p in tmp.iterdir():
    p.unlink()
tmp.rmdir()
