#!/usr/bin/env python3
"""Finalize ostrovok.ru style extraction: theme.css, tokens.json, js-derived.md."""
from __future__ import annotations

import json
import re
from collections import Counter, OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"
JS = ROOT / "js"

CSS = "\n".join(
    p.read_text(encoding="utf-8", errors="replace") for p in sorted(RAW.glob("*.css"))
)
JS_TEXT = "\n".join(p.read_text(encoding="utf-8", errors="replace") for p in sorted(JS.glob("*.js")))
CUSTOM_PROP_RE = re.compile(r"(--[a-zA-Z0-9_-]+)\s*:\s*([^;}]+)")


def all_props():
    props = OrderedDict()
    for m in CUSTOM_PROP_RE.finditer(CSS):
        props.setdefault(m.group(1), " ".join(m.group(2).split()))
    return props


def all_props_multi():
    """name -> ordered list of unique values across all scopes."""
    props: OrderedDict[str, list] = OrderedDict()
    for m in CUSTOM_PROP_RE.finditer(CSS):
        vals = props.setdefault(m.group(1), [])
        v = " ".join(m.group(2).split())
        if v not in vals:
            vals.append(v)
    return props


def write_theme_css(props):
    # group: palette/theme (body inline) vs mpf
    lines = [
        "/* Theme tokens reconstructed from ostrovok.ru CSS.",
        " * Contains both the inline `body{}` design tokens and the `:root` mpf-* tokens.",
        " * Do not commit raw third-party CSS; this is a derived summary. */",
        "",
        ":root {",
    ]
    for name, val in props.items():
        lines.append(f"  {name}: {val};")
    lines.append("}")
    lines.append("")
    lines.append("body {")
    lines.append('  font-family: "PT Root UI Web", Helvetica, Arial, sans-serif;')
    lines.append("  color: var(--text);")
    lines.append("  background: var(--palette-white);")
    lines.append("}")
    lines.append("")
    (ROOT / "theme.css").write_text("\n".join(lines), encoding="utf-8")


def write_tokens_json(props):
    # semantic split for convenience
    data = {
        "source": "https://ostrovok.ru/",
        "fonts": {
            "body": '"PT Root UI Web", Helvetica, Arial, sans-serif',
            "display": "Spoof, sans-serif",
            "faces": [
                {"family": "PT Root UI Web", "weight": 300, "file": "fonts/PT-Root-UI-Web-Light.974865d0.woff2"},
                {"family": "PT Root UI Web", "weight": 400, "file": "fonts/PT-Root-UI-Web-Regular.fa37ad7a.woff2"},
                {"family": "PT Root UI Web", "weight": 500, "file": "fonts/PT-Root-UI-Web-Medium.4b7fa55b.woff2"},
                {"family": "PT Root UI Web", "weight": 700, "file": "fonts/PT-Root-UI-Web-Bold.853746a2.woff2"},
                {"family": "Spoof", "weight": 500, "file": "fonts/Spoof-Medium.a41d118c.woff2"},
            ],
        },
        "palette": {
            "black": "#2d3137",
            "dark": "#868686",
            "gray": "#c8c8c8",
            "light": "#e5e5e5",
            "ulight": "#f4f4f4",
            "white": "#ffffff",
            "disabled": "#afafaf",
            "main": "#0E41D2",
            "sec": "#E3EBFD",
            "border": "#e5e5e5",
        },
        "status": {
            "alert": "#CE2121",
            "alert-bg": "#FAE9E9",
            "warning": "#E77D00",
            "warning-bg": "#FAE5CC",
            "success": "#53AF24",
            "success-bg": "#DDEFD3",
            "highlight-bg": "#fff8e6",
        },
        "radius": {"2xs": "4px", "xs": "6px", "sm": "8px", "md": "12px", "lg": "20px"},
        "compsize": {"2xs": "32px", "xs": "36px", "sm": "40px", "md": "48px", "lg": "56px", "xl": "60px"},
        "spacing": {"2xs": "2px", "xs": "4px", "sm": "8px", "md": "12px", "lg": "16px", "xl": "20px", "2xl": "24px"},
        "fontsize": {"xs": "12px", "sm": "14px", "md": "16px", "lg": "20px"},
        "layout": {
            "page-max-width": "1380px",
            "page-padding-desktop": "30px",
            "page-padding-tablet": "32px",
            "page-padding-mobile": "16px",
        },
        "breakpoints": {"mobile-max": "680px", "tablet": "681px-1074px", "desktop-min": "1075px"},
        "variables": props,
        "variableValues": all_props_multi(),
        "raw_hex_frequency": dict(Counter(h.lower() for h in re.findall(r"#[0-9a-fA-F]{6}\b", CSS))),
    }
    (ROOT / "tokens.json").write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def write_js_derived():
    hexes = re.findall(r"#[0-9a-fA-F]{6}\b", JS_TEXT)
    counter = Counter(h.upper() for h in hexes)
    # Only report the notable non-UI / icon artwork colors that are hardcoded in JS.
    notable = {
        "#231F20": "SVG icon stroke (dark ink)",
        "#EFEE0E": "SVG artwork fill (yellow)",
        "#3741CF": "SVG icon fill (brand blue variant)",
        "#E6000D": "SVG icon fill (red)",
        "#FDC514": "SVG icon fill (amber)",
        "#FFE15A": "SVG icon fill (yellow)",
        "#FAB446": "SVG icon fill (orange)",
        "#F5F5F5": "SVG icon fill (light grey)",
        "#464A4F": "SVG icon fill (Fidelity segment black)",
        "#C8414B": "SVG icon fill (red)",
        "#3CA100": "SVG icon fill (green)",
    }
    lines = [
        "# JS-derived findings — ostrovok.ru",
        "",
        "The Next.js runtime references the same CSS custom properties as the stylesheets",
        "(e.g. `--palette-black`, `--field-bg`, `--text-secondary`). Hardcoded colors found in",
        "the JS bundles come from inline React SVG icon/artwork `fill`/`stroke` props, not from",
        "the UI theme. They are listed for completeness.",
        "",
        "## Var names referenced from JS",
        "",
        "```",
        *sorted(set(re.findall(r"--[a-zA-Z][a-zA-Z0-9-]+", JS_TEXT))),
        "```",
        "",
        "## Hardcoded SVG artwork colors in JS (by frequency)",
        "",
        "| HEX | count | likely role |",
        "|---|---|---|",
    ]
    for h, n in counter.most_common(60):
        lines.append(f"| {h} | {n} | {notable.get(h, 'SVG artwork')} |")
    lines.append("")
    (ROOT / "js-derived.md").write_text("\n".join(lines), encoding="utf-8")


def main():
    props = all_props()
    write_theme_css(props)
    write_tokens_json(props)
    write_js_derived()
    print(f"theme.css: {len(props)} variables")
    print("tokens.json (incl. all value variants), js-derived.md written")


if __name__ == "__main__":
    main()
