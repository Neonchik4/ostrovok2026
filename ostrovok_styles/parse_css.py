#!/usr/bin/env python3
"""Maximal static extraction of ostrovok.ru styles.

Input : ./raw/*.css, ./raw/index.html, ./assets/*, ./js/*.js
Output: colors / typography / tokens(all values) / spacing / breakpoints /
        animations / gradients / assets / inline-styles / summary
"""
from __future__ import annotations

import json
import re
from collections import Counter, OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"
ASSETS = ROOT / "assets"
OUT = ROOT

CSS_FILES = sorted(RAW.glob("*.css"))


def load_css() -> str:
    chunks = []
    for p in CSS_FILES:
        chunks.append(f"/* ==== {p.name} ==== */\n" + p.read_text(encoding="utf-8", errors="replace"))
    return "\n\n".join(chunks)


CSS = load_css()
HTML = (RAW / "index.html").read_text(encoding="utf-8", errors="replace") if (RAW / "index.html").exists() else ""


# ---------------- helpers ----------------
def md_table(rows, headers):
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join(["---"] * len(headers)) + "|"]
    for r in rows:
        out.append("| " + " | ".join(str(c).replace("|", "\\|") for c in r) + " |")
    return "\n".join(out)


HEX_RE = re.compile(r"#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b")
RGB_RE = re.compile(r"rgba?\([^)]*\)", re.I)
HSL_RE = re.compile(r"hsla?\([^)]*\)", re.I)


def norm_hex(h: str) -> str:
    h = h.lower()
    if len(h) in (4, 5):
        return "#" + "".join(c * 2 for c in h[1:])
    return h


def prop_values(prop: str):
    pat = re.compile(r"(?<![\w-])" + re.escape(prop) + r"\s*:\s*([^;}]+)", re.I)
    return [" ".join(v.split()) for v in pat.findall(CSS)]


CUSTOM_PROP_RE = re.compile(r"(--[a-zA-Z0-9_-]+)\s*:\s*([^;}]+)")


def parse_custom_props():
    """name -> ordered list of unique values (all contextual variants preserved)."""
    props: OrderedDict[str, list[str]] = OrderedDict()
    for m in CUSTOM_PROP_RE.finditer(CSS):
        name, val = m.group(1), " ".join(m.group(2).split())
        vals = props.setdefault(name, [])
        if val not in vals:
            vals.append(val)
    return props


def brace_body(text: str, start: int) -> str:
    """Return contents of the first {...} block starting at/after `start`."""
    i = text.find("{", start)
    if i < 0:
        return ""
    depth, j = 0, i
    while j < len(text):
        if text[j] == "{":
            depth += 1
        elif text[j] == "}":
            depth -= 1
            if depth == 0:
                return text[i + 1:j]
        j += 1
    return text[i + 1:]


GRADIENT_RE = re.compile(r"(?:linear|radial|conic)-gradient\((?:[^()]|\([^()]*\))*\)")
URL_RE = re.compile(r"""url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"]*))\s*\)""")
KEYFRAME_NAME_RE = re.compile(r"@keyframes\s+([\w-]+)")


def all_urls(text: str) -> list[str]:
    urls = []
    for m in URL_RE.finditer(text):
        u = next(g for g in m.groups() if g is not None)
        u = u.strip()
        if u and not u.startswith("data:"):
            urls.append(u)
    return urls


# ---------------- writers ----------------
def write_colors(props):
    hexes = [norm_hex(h) for h in HEX_RE.findall(CSS)]
    rgbs = [" ".join(x.split()).rstrip() for x in RGB_RE.findall(CSS)]
    hsls = [" ".join(x.split()).rstrip() for x in HSL_RE.findall(CSS)]
    L = ["# Colors — ostrovok.ru", "", "All colors found in scraped CSS (external + inline).", ""]
    L.append(f"Unique HEX: {len(set(hexes))} | Unique rgb/rgba: {len(set(rgbs))} | Unique hsl/hsla: {len(set(hsls))}")
    L += ["", "## HEX palette (by frequency)", "", md_table(Counter(hexes).most_common(), ["HEX", "count"])]
    L += ["", "## rgb / rgba (by frequency)", "", md_table(Counter(rgbs).most_common(), ["rgb/rgba", "count"])]
    if hsls:
        L += ["", "## hsl / hsla", "", md_table(Counter(hsls).most_common(), ["hsl/hsla", "count"])]
    L += ["", "## Color CSS variables (all values)", ""]
    rows = [(n, " · ".join(vals)) for n, vals in props.items()
            if any(HEX_RE.search(v) or RGB_RE.search(v) or HSL_RE.search(v) for v in vals)]
    L += [md_table(rows, ["variable", "value(s)"]), ""]
    (OUT / "colors.md").write_text("\n".join(L), encoding="utf-8")


def write_typography(props, faces):
    L = ["# Typography — ostrovok.ru", "", "## @font-face declarations", ""]
    for d in faces:
        L.append(f"- **{d.get('font-family','?')}** — weight {d.get('font-weight','?')}, "
                 f"style {d.get('font-style','normal')}"
                 + (f", `{d['font-feature-settings']}`" if d.get("font-feature-settings") else ""))
        for u in all_urls(d.get("src", "")):
            L.append(f"  - {u}")
    L += ["", "## font-family usage", ""] + [f"- `{v}`" for v in sorted(set(prop_values("font-family")))]
    for prop in ["font-size", "font-weight", "line-height", "letter-spacing", "font-style"]:
        L += ["", f"## {prop} values (by frequency)", "", md_table(Counter(prop_values(prop)).most_common(), [prop, "count"])]
    L += ["", "## Typographic CSS variables (all values)", ""]
    rows = [(n, " · ".join(vals)) for n, vals in props.items()
            if re.search(r"font|line-height|letter|typo|text|icon", n, re.I)]
    L += [md_table(rows, ["variable", "value(s)"]), ""]
    (OUT / "typography.md").write_text("\n".join(L), encoding="utf-8")


def write_tokens(props):
    groups: OrderedDict[str, list] = OrderedDict()
    for n, vals in props.items():
        groups.setdefault(n.lstrip("-").split("-")[0], []).append((n, vals))
    L = ["# Design tokens (CSS custom properties) — ostrovok.ru", "",
         f"Total unique custom properties: {len(props)}", ""]
    for prefix in sorted(groups):
        items = groups[prefix]
        L += [f"## `--{prefix}-*` ({len(items)})", "",
              md_table([(n, " · ".join(vals)) for n, vals in items], ["variable", "value(s)"]), ""]
    (OUT / "design-tokens.md").write_text("\n".join(L), encoding="utf-8")
    (OUT / "css-variables.css").write_text(
        ":root {\n  " + "\n  ".join(f"{n}: {vals[0]};" for n, vals in props.items()) + "\n}\n",
        encoding="utf-8")
    variants = {n: vals for n, vals in props.items() if len(vals) > 1}
    L = ["# Token value variants (contextual redefinitions) — ostrovok.ru", "",
         f"{len(variants)} variables have more than one distinct value across scopes/media.", ""]
    for n, vals in variants.items():
        L += [f"### `{n}`", "", "\n".join(f"- `{v}`" for v in vals), ""]
    (OUT / "token-variants.md").write_text("\n".join(L), encoding="utf-8")


def write_metrics(props):
    L = ["# Spacing / Radius / Shadow / Motion — ostrovok.ru", ""]
    for prop in ["gap", "padding", "margin", "border-radius", "box-shadow",
                 "transition", "transition-duration", "z-index", "max-width", "min-height"]:
        vals = prop_values(prop)
        if vals:
            L += [f"## {prop} (by frequency)", "", md_table(Counter(vals).most_common(40), [prop, "count"]), ""]
    L += ["## Radius / spacing / size / shadow / z-index variables (all values)", "",
          md_table([(n, " · ".join(v)) for n, v in props.items()
                    if re.search(r"radius|spacing|compsize|z-index|shadow|size|opacity", n, re.I)],
                   ["variable", "value(s)"]), ""]
    (OUT / "spacing-radius-shadow.md").write_text("\n".join(L), encoding="utf-8")


def write_breakpoints():
    media = Counter(" ".join(m.split()) for m in re.findall(r"@media\s*([^{]+)\{", CSS))
    widths = sorted({int(x) for q in media for x in re.findall(r"(\d+)px", q)})
    L = ["# Responsive breakpoints — ostrovok.ru", "", "## @media queries (by frequency)", "",
         md_table(media.most_common(), ["query", "count"]), "",
         "## Pixel values", "", ", ".join(f"`{w}px`" for w in widths), ""]
    (OUT / "breakpoints.md").write_text("\n".join(L), encoding="utf-8")
    return media


def write_animations():
    names = KEYFRAME_NAME_RE.findall(CSS)
    L = ["# Animations & transitions — ostrovok.ru", "", "## @keyframes", ""]
    for m in KEYFRAME_NAME_RE.finditer(CSS):
        body = " ".join(brace_body(CSS, m.start()).split())
        L += [f"### {m.group(1)}", "", "```css", body[:600] + ("..." if len(body) > 600 else ""), "```", ""]
    L += ["## animation / transition values", ""]
    for prop in ["transition", "transition-duration", "transition-timing-function", "animation"]:
        vals = prop_values(prop)
        if vals:
            L += [f"### {prop}", "", md_table(Counter(vals).most_common(30), [prop, "count"]), ""]
    (OUT / "animations.md").write_text("\n".join(L), encoding="utf-8")
    return names


def write_gradients():
    grads = [" ".join(g.split()) for g in GRADIENT_RE.findall(CSS)]
    L = ["# Gradients — ostrovok.ru", "", md_table(Counter(grads).most_common(), ["gradient", "count"]), ""]
    (OUT / "gradients.md").write_text("\n".join(L), encoding="utf-8")
    return grads


def write_assets(props):
    css_urls = Counter(all_urls(CSS))
    html_urls = Counter(all_urls(HTML))
    fonts = [u for u in css_urls if re.search(r"\.(woff2?|ttf|otf|eot)(\?|$)", u)]
    images = [u for u in css_urls if re.search(r"\.(svg|png|jpe?g|webp|gif|avif)(\?|$)", u)]
    logo_vars = {n: v for n, v in props.items() if "logo" in n.lower() or "image" in n.lower()}
    L = ["# Assets referenced in CSS/HTML — ostrovok.ru", "",
         "## Font files", "", "\n".join(f"- {u} ({css_urls[u]}x)" for u in fonts) or "- none", "",
         "## Images (CSS url())", "", md_table([(u, css_urls[u]) for u in images][:200], ["url", "count"]), ""]
    if html_urls:
        L += ["## URLs in HTML", "", md_table([(u, html_urls[u]) for u in sorted(html_urls)][:200], ["url", "count"]), ""]
    L += ["## CSS variables holding a url() (all values)", "",
          md_table([(n, " · ".join(v)) for n, v in logo_vars.items()], ["variable", "value(s)"]), ""]
    (OUT / "assets.md").write_text("\n".join(L), encoding="utf-8")
    return fonts, images


def write_inline_styles():
    attrs = re.findall(r'style="([^"]*)"', HTML)
    color_attrs = [a for a in attrs if HEX_RE.search(a) or RGB_RE.search(a)]
    metas = re.findall(r"<meta[^>]*>", HTML, re.I)
    theme_metas = [m for m in metas if re.search(r"theme-color|color-scheme|msapplication", m, re.I)]
    L = ["# Inline styles & meta — ostrovok.ru", "",
         f"`style=` attributes in HTML: {len(attrs)} (with colors: {len(color_attrs)})", ""]
    if color_attrs:
        L += ["## Inline style attributes containing colors", "", "\n".join(f"- `{a}`" for a in sorted(set(color_attrs))), ""]
    else:
        L += ["No inline color styles in the SSR HTML (colors live in stylesheets/vars).", ""]
    L += ["## Color-related <meta>", "", "\n".join(f"- `{m}`" for m in theme_metas) or "- none", ""]
    (OUT / "inline-styles.md").write_text("\n".join(L), encoding="utf-8")
    return attrs, theme_metas


def write_brand():
    L = ["# Brand assets & third-party widget — ostrovok.ru", ""]
    logo = next(iter(ASSETS.glob("brand_logo-*.svg")), None)
    if logo:
        svg = logo.read_text(encoding="utf-8", errors="replace")
        cols = Counter(norm_hex(h) for h in HEX_RE.findall(svg))
        L += [f"## Brand logo (`{logo.name}`)", "", f"- viewBox/size attrs: `{re.search(r'width=.130px', svg) and '130x40'}`",
              f"- declared classes: `{'; '.join(sorted(set(re.findall(r'\.fil0[^}]*', svg))))}`", ""]
        L += ["### Colors in logo SVG", "", md_table(cols.most_common(), ["HEX", "count"]), ""]
    edna = ASSETS / "edna_widget.js"
    if edna.exists():
        txt = edna.read_text(encoding="utf-8", errors="replace")
        cols = Counter(norm_hex(h) for h in HEX_RE.findall(txt))
        fams = sorted(set(re.findall(r"font-family\s*:\s*([^;,\"'}]+)", txt)))
        L += ["## Third-party: Ostrovok Edna chat widget (`ostrovok.edna.ru/widget/latest.js`)", "",
              "Not part of the Ostrovok design system; separate styles.",
              f"- font-family values: {', '.join(f'`{f.strip()}`' for f in fams) or 'none'}",
              "", "### Top colors in widget", "", md_table(cols.most_common(20), ["HEX", "count"]), ""]
    (OUT / "brand.md").write_text("\n".join(L), encoding="utf-8")


def main():
    props = parse_custom_props()
    faces = []
    for body in re.findall(r"@font-face\s*\{([^}]*)\}", CSS, re.I | re.S):
        d = {m.group(1).strip().lower(): " ".join(m.group(2).split())
             for m in re.finditer(r"([a-zA-Z-]+)\s*:\s*([^;}]+)", body)}
        faces.append(d)

    write_colors(props)
    write_typography(props, faces)
    write_tokens(props)
    write_metrics(props)
    media = write_breakpoints()
    kf = write_animations()
    grads = write_gradients()
    fonts, images = write_assets(props)
    attrs, metas = write_inline_styles()
    write_brand()

    summary = {
        "source": "https://ostrovok.ru/",
        "css_files": [p.name for p in CSS_FILES],
        "fonts": faces,
        "font_files": sorted(set(fonts)),
        "unique_hex": len({norm_hex(h) for h in HEX_RE.findall(CSS)}),
        "unique_rgb": len(set(RGB_RE.findall(CSS))),
        "unique_hsl": len(set(HSL_RE.findall(CSS))),
        "unique_custom_properties": len(props),
        "custom_properties_with_variants": sum(1 for v in props.values() if len(v) > 1),
        "keyframes": kf,
        "gradients": len(set(grads)),
        "media_queries": dict(media),
        "image_urls_in_css": len(set(images)),
    }
    (OUT / "summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: summary[k] for k in
                      ["unique_hex", "unique_rgb", "unique_custom_properties",
                       "custom_properties_with_variants", "gradients", "image_urls_in_css", "keyframes"]},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
