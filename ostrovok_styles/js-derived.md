# JS-derived findings — ostrovok.ru

The Next.js runtime references the same CSS custom properties as the stylesheets
(e.g. `--palette-black`, `--field-bg`, `--text-secondary`). Hardcoded colors found in
the JS bundles come from inline React SVG icon/artwork `fill`/`stroke` props, not from
the UI theme. They are listed for completeness.

## Var names referenced from JS

```
--after-open
--alert
--banner-img
--before-close
--eO
--field-active-border
--field-bg
--field-border
--field-hover-border
--focus-outline
--has-value
--is-disabled
--is-focused
--is-multi
--is-rtl
--is-selected
--link
--loading
--menu-is-open
--nR
--no-options
--open
--palette-black
--palette-gray
--palette-ulight
--r4
--sD
--shadow
--star-size
--success
--text
--text-alt
--text-secondary
--this
--warning
```

## Hardcoded SVG artwork colors in JS (by frequency)

| HEX | count | likely role |
|---|---|---|
| #231F20 | 101 | SVG icon stroke (dark ink) |
| #EFEE0E | 96 | SVG artwork fill (yellow) |
| #F5F5F5 | 19 | SVG icon fill (light grey) |
| #E6000D | 17 | SVG icon fill (red) |
| #E5E5E5 | 13 | SVG artwork |
| #3741CF | 13 | SVG icon fill (brand blue variant) |
| #FDC514 | 12 | SVG icon fill (amber) |
| #464A4F | 11 | SVG icon fill (Fidelity segment black) |
| #FFE15A | 11 | SVG icon fill (yellow) |
| #FAB446 | 10 | SVG icon fill (orange) |
| #2D3137 | 9 | SVG artwork |
| #FFFFFF | 7 | SVG artwork |
| #C8414B | 7 | SVG icon fill (red) |
| #000000 | 6 | SVG artwork |
| #333333 | 5 | SVG artwork |
| #3CA100 | 5 | SVG icon fill (green) |
| #FFBE50 | 5 | SVG artwork |
| #FFD250 | 4 | SVG artwork |
| #464655 | 3 | SVG artwork |
| #5064AA | 3 | SVG artwork |
| #2684FF | 2 | SVG artwork |
| #4C9AFF | 2 | SVG artwork |
| #B2D4FF | 2 | SVG artwork |
| #DEEBFF | 2 | SVG artwork |
| #DE350B | 2 | SVG artwork |
| #FFBDAD | 2 | SVG artwork |
| #868686 | 2 | SVG artwork |
| #0D41D2 | 2 | SVG artwork |
| #0A4FEC | 2 | SVG artwork |
| #D84D4D | 2 | SVG artwork |
| #C8102E | 2 | SVG artwork |
| #FFB441 | 2 | SVG artwork |
| #FFD350 | 2 | SVG artwork |
| #ED1D24 | 2 | SVG artwork |
| #00AEC8 | 2 | SVG artwork |
| #FFC900 | 2 | SVG artwork |
| #2B2F84 | 2 | SVG artwork |
| #FFAF00 | 1 | SVG artwork |
| #F29006 | 1 | SVG artwork |
| #ACEF81 | 1 | SVG artwork |
| #4F4F4F | 1 | SVG artwork |
| #FE7C00 | 1 | SVG artwork |
| #4C6C91 | 1 | SVG artwork |
| #4285F4 | 1 | SVG artwork |
| #34A853 | 1 | SVG artwork |
| #FBBC05 | 1 | SVG artwork |
| #EA4335 | 1 | SVG artwork |
| #1877F2 | 1 | SVG artwork |
| #2936F3 | 1 | SVG artwork |
| #471AFA | 1 | SVG artwork |
| #00E0FF | 1 | SVG artwork |
| #0F5DE4 | 1 | SVG artwork |
| #4086E4 | 1 | SVG artwork |
| #E04242 | 1 | SVG artwork |
| #012169 | 1 | SVG artwork |
| #FFA0D2 | 1 | SVG artwork |
| #A54B50 | 1 | SVG artwork |
| #D7141A | 1 | SVG artwork |
| #11457E | 1 | SVG artwork |
| #23632F | 1 | SVG artwork |
