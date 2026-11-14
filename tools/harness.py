"""Shared helpers for testing Mirrorfold in headless Chrome.

The page is index.html plus the modules in js/. Tests work by writing a temporary copy of index.html with one
extra script that runs once the app has started. That script runs inside `with(window.MF)`, and MF holds every
internal name of every module (readable, and settable where the app itself can change it), so test code can
name internal variables and functions directly, as it could when the app was one closure.

Requires: google-chrome (or chromium) on PATH. Pillow is only needed for contact sheets.
"""
import os, re, shutil, subprocess, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, "index.html")
WORLDS_JS = os.path.join(ROOT, "js", "worlds.js")  # where render.py reads the world ids from
# The tag that loads the app. Test code is added just before it.
MAIN = '<script type="module" src="js/main.js"></script>'


def chrome():
    for name in ("google-chrome", "chromium", "chromium-browser", "chrome"):
        path = shutil.which(name)
        if path:
            return path
    raise SystemExit("No Chrome or Chromium found on PATH.")


FLAGS = [
    "--headless=new", "--no-sandbox", "--disable-gpu-sandbox", "--use-gl=angle",
    "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
    "--hide-scrollbars", "--autoplay-policy=no-user-gesture-required",
    "--allow-file-access-from-files",  # the modules are loaded from file://
]


def make_page(inject="", hide_ui=False, quality=None):
    """Write a test copy of index.html and return its path.

    inject   JavaScript run once the app has started, with every internal name in reach.
    hide_ui  hide the start card and the controls (for clean screenshots).
    quality  "sharp", "fast" or None (auto). Software rendering is slow: use "fast" for motion tests.
    """
    src = open(INDEX, encoding="utf-8").read()
    assert src.count(MAIN) == 1 and src.count("<head>") == 1, "index.html no longer loads the app the way the harness expects"
    first = {"sharp": "setDetail(1);", "fast": "setDetail(2);"}.get(quality, "")
    # Relative addresses resolve against the repository, and any uncaught error lands in the page title, where dump() reads it.
    head = '<head><base href="file://' + ROOT + '/">' + \
           '<script>window.onerror=function(m,u,l){document.title="ERR "+m+" @"+String(u).split("/").pop()+":"+l};</script>'
    if hide_ui:
        head += "<style>#hud,#start{display:none !important}</style>"
    src = src.replace("<head>", head, 1)
    src = src.replace(MAIN, '<script>window.addEventListener("mf-ready",function(){with(window.MF){' + first + "\n" + inject + "\n}});</script>" + MAIN, 1)
    fd, path = tempfile.mkstemp(suffix=".html", prefix="mirrorfold-test-")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(src)
    return path


_pad = None


def _band(path):
    """How many rows at the bottom of a screenshot are the bare page and not the picture (0 without Pillow)."""
    try:
        from PIL import Image
    except ImportError:
        return 0
    im = Image.open(path).convert("RGB")
    w, h = im.size
    bare = lambda y: all(max(abs(c - d) for c, d in zip(im.getpixel((x, y)), (5, 3, 11))) <= 3 for x in range(0, w, max(1, w // 40)))
    n = 0
    while n < h and bare(h - 1 - n):
        n += 1
    return n if n < h else 0


def _shot(page, out, size, budget_ms, hash_):
    subprocess.run([chrome()] + FLAGS + [
        f"--window-size={size[0]},{size[1]}", f"--virtual-time-budget={budget_ms}",
        f"--screenshot={out}", f"file://{page}#{hash_}"], capture_output=True, timeout=240)


def screenshot(out, inject="", hash_="lattice", size=(420, 700), budget_ms=2500, hide_ui=True, quality="sharp"):
    """Render the page to a PNG. budget_ms is virtual time; software frames are slow, so only
    a few dozen frames run in that time. Feedback effects need a larger budget and quality="fast".

    Some Chrome builds count the window's frame in --window-size, so the page is shorter than asked for and the
    bottom of the screenshot is bare. The first shot measures that; if there is any, every shot is taken that much
    taller and cut back to size (this needs Pillow; without it the shot is left as Chrome made it)."""
    global _pad
    page = make_page(inject, hide_ui=hide_ui, quality=quality)
    try:
        if _pad is None:
            _shot(page, out, size, 1500, hash_)
            _pad = _band(out)
        _shot(page, out, (size[0], size[1] + _pad), budget_ms, hash_)
        if _pad:
            from PIL import Image
            Image.open(out).crop((0, 0, size[0], size[1])).save(out)
    finally:
        os.unlink(page)
    return out


def dump(inject="", hash_="lattice", size=(420, 760), budget_ms=4000):
    """Run the page and return (title, error box text, text of an element with id="dbg").

    Injected code can create the dbg element and write results into it:
        var dbgEl=document.createElement("i");dbgEl.id="dbg";document.body.appendChild(dbgEl);

    Note: virtual time only advances while timers are pending, so drive long tests with
    setTimeout steps. A requestAnimationFrame loop alone will stall after a frame or two."""
    page = make_page(inject)
    try:
        out = subprocess.run([chrome()] + FLAGS + [
            f"--window-size={size[0]},{size[1]}", f"--virtual-time-budget={budget_ms}",
            "--dump-dom", f"file://{page}#{hash_}"], capture_output=True, text=True, timeout=240).stdout
    finally:
        os.unlink(page)
    def grab(pattern):
        m = re.search(pattern, out, re.S)
        return m.group(1) if m else ""
    return grab(r"<title>(.*?)</title>"), grab(r'<div id="err">(.*?)</div>'), grab(r'id="dbg">(.*?)<').replace("&quot;", '"').replace("&gt;", ">")
