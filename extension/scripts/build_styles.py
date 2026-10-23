import os

def build_styles():
    ext_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    styles_dir = os.path.join(ext_dir, "styles")
    out_file = os.path.join(ext_dir, "styles.css")

    order = [
        "ghost.css",
        "action-bar.css",
        "thought-log.css",
        "injected.css",
    ]

    combined = [
        "/* Consolidated Styles for Ostrovok Muse Copilot (Self-Contained) */",
        ":host {",
        "  all: initial;",
        '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;',
        "  box-sizing: border-box;",
        "}",
        "*, *::before, *::after {",
        "  box-sizing: inherit;",
        "}",
        "",
    ]

    for fname in order:
        fpath = os.path.join(styles_dir, fname)
        if os.path.exists(fpath):
            with open(fpath, "r", encoding="utf-8") as f:
                combined.append(f"/* === {fname} === */")
                combined.append(f.read().strip())
                combined.append("")

    with open(out_file, "w", encoding="utf-8") as f:
        f.write("\n".join(combined))

    print(f"Compiled self-contained {out_file} ({os.path.getsize(out_file)} bytes)")

if __name__ == "__main__":
    build_styles()
