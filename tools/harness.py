"""Shared helpers for testing Mirrorfold in headless Chrome.

The page is one self-contained index.html whose script is a single closure, so tests work by
writing a temporary copy with extra JavaScript appended inside that closure (it can see every
internal variable and function) and loading it in headless Chrome with software WebGL.

Requires: google-chrome (or chromium) on PATH. Pillow is only needed for contact sheets.
"""
import os, re, shutil, subprocess, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, "index.html")
# The last two lines of the page's script. Injected test code goes between them.
TAIL = "requestAnimationFrame(frame);\n})();"
HEAD = "<script>\n(function(){"


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
]


def make_page(inject="", hide_ui=False, quality=None):
    """Write a test copy of index.html and return its path.

    inject   JavaScript run inside the page's closure after the frame loop starts.
    hide_ui  hide the start card and the controls (for clean screenshots).
    quality  "sharp", "fast" or None (auto). Software rendering is slow: use "fast" for motion tests.
    """
    src = open(INDEX, encoding="utf-8").read()
    assert src.count(TAIL) == 1 and src.count(HEAD) == 1, "index.html no longer ends the way the harness expects"
    # Any uncaught error lands in the page title, where dump() reads it.
    src = src.replace(HEAD, '<script>\nwindow.onerror=function(m,u,l){document.title="ERR "+m+" @"+l};\n(function(){', 1)
    src = src.replace(TAIL, "requestAnimationFrame(frame);\n" + inject + "\n})();", 1)
    if hide_ui:
        src = src.replace("</style>", "#hud,#start{display:none}</style>", 1)
    if quality == "sharp":
        src = src.replace("di=0,q=0.85", "di=1,q=1", 1)
    elif quality == "fast":
        src = src.replace("di=0,q=0.85", "di=2,q=0.5", 1)
    fd, path = tempfile.mkstemp(suffix=".html", prefix="mirrorfold-test-")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(src)
    return path


def screenshot(out, inject="", hash_="lattice", size=(420, 700), budget_ms=2500, hide_ui=True, quality="sharp"):
    """Render the page to a PNG. budget_ms is virtual time; software frames are slow, so only
    a few dozen frames run in that time. Feedback effects need a larger budget and quality="fast"."""
    page = make_page(inject, hide_ui=hide_ui, quality=quality)
    try:
        subprocess.run([chrome()] + FLAGS + [
            f"--window-size={size[0]},{size[1]}", f"--virtual-time-budget={budget_ms}",
            f"--screenshot={out}", f"file://{page}#{hash_}"], capture_output=True, timeout=240)
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
