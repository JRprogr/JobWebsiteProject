# Accessibility

Goal: WCAG 2.2 level AA as far as a small project can reach it. This is a good-faith effort, not a certification.

On the law: in Germany the Barrierefreiheitsstärkungsgesetz (BFSG, in force since 28 June 2025) covers certain services that
businesses offer to consumers, for example online shops and banking, and exempts micro-enterprises for services. As far as
I can tell a free, non-commercial information site is outside it. That is not legal advice; the practical protection is the
same either way: keep the site usable with a keyboard and a screen reader, and keep the takedown and contact route open.

## What was checked (2026-09-26, desktop and phone width, light and dark theme)

Automated pass with the script below on the overview, statistics, company register, about, Q&A, impressum, privacy and terms
pages: page language and title, landmarks, heading order, duplicate ids, accessible names of every button, link, field and
icon, alt text (logos are decorative, `alt=""` next to the company name), focusable elements inside `aria-hidden`, target
sizes (WCAG 2.5.8, 24 px) and text contrast against the computed background.

Keyboard pass on the overview page: the tab order follows the visual order (skip link, header, filters, list, then the map
and the preview), every stop shows a focus ring, the role dialog is a native `<dialog>` (focus stays inside, Esc closes,
focus returns to the button that opened it), and nothing traps focus.

Fixed in this pass: the search field had no visible focus ring; the multi-select and de-select controls and the footer
links were smaller than 24 px; there was no way past a long list except tabbing through it (desktop skip links to the
region filter and the role preview); the result count and the picked role are now announced to screen readers; and Esc inside the full-listing dialog closed the
dialog but also cleared the selected job, which removed the button that had opened it and left keyboard focus on the page
body (focus now returns to that button).

Also in place from earlier: skip link to the content, `prefers-reduced-motion` honoured, `aria-current` on the navigation,
`aria-pressed` on the toggle buttons, one `h1` per page, no horizontal scrolling at 375 px width.

## Known gaps (for the design batch)

- The country codes drawn on the map are faint: about 3.9:1 (11 px text, needs 4.5:1) in the light theme for the countries
  with roles, far lower for greyed-out ones. They are decoration, the same numbers are in the readout above the map and
  in the country list under Advanced, but they should be readable.
- The country shapes on the map are small click targets (Luxembourg, Malta, Kosovo …). Every country can also be chosen from the
  Advanced country list, which is the equivalent control WCAG 2.5.8 asks for.
- The footer text is 10 px. It passes the contrast check but is small.

## Re-running the automated pass

Open a page, paste the script into the browser console, read the JSON it returns. The contrast check ignores background
images and gradients, so treat a pass as "no flat-colour failures", and look at text on the glass panels by eye.

~~~js
(() => {
  const out = { url: location.pathname + location.search, theme: document.documentElement.dataset.theme, issues: [] };
  const add = (kind, detail) => out.issues.push({ kind, detail });

  // ---- document level
  if (!document.documentElement.lang) add("lang", "html has no lang");
  if (!document.title) add("title", "no <title>");
  const mains = document.querySelectorAll("main, [role=main]").length;
  if (mains !== 1) add("landmark", `main landmarks: ${mains}`);
  if (!document.querySelector("header, [role=banner]")) add("landmark", "no banner/header");
  if (!document.querySelector("nav, [role=navigation]")) add("landmark", "no nav");
  const h1 = document.querySelectorAll("h1").length;
  if (h1 !== 1) add("heading", `h1 count: ${h1}`);
  let last = 0;
  for (const h of document.querySelectorAll("h1,h2,h3,h4,h5,h6")) {
    const level = Number(h.tagName[1]);
    if (last && level > last + 1) add("heading", `level jumps h${last} -> h${level}: "${h.textContent.trim().slice(0, 40)}"`);
    last = level;
  }

  // ---- ids
  const seen = new Map();
  for (const el of document.querySelectorAll("[id]")) seen.set(el.id, (seen.get(el.id) || 0) + 1);
  for (const [id, n] of seen) if (n > 1) add("duplicate-id", `${id} x${n}`);

  // ---- visibility helper
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0;
  };

  // ---- accessible names
  const nameOf = (el) => {
    const labelledby = el.getAttribute("aria-labelledby");
    if (labelledby) {
      const t = labelledby.split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim() || "").join(" ").trim();
      if (t) return t;
    }
    const aria = el.getAttribute("aria-label")?.trim();
    if (aria) return aria;
    if (el.labels && el.labels.length) return [...el.labels].map((l) => l.textContent.trim()).join(" ");
    const alt = el.querySelector("img[alt]:not([alt=''])")?.getAttribute("alt");
    const txt = (el.innerText || el.textContent || "").trim();
    if (txt) return txt;
    if (alt) return alt;
    if (el.getAttribute("title")) return el.getAttribute("title");
    if (el.getAttribute("placeholder")) return el.getAttribute("placeholder");
    return "";
  };
  const interactive = [...document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=switch], [role=tab], [role=checkbox], [role=link], [tabindex]:not([tabindex='-1'])")].filter(visible);
  for (const el of interactive) {
    if (!nameOf(el)) add("no-name", `${el.tagName.toLowerCase()} ${(el.className || "").toString().slice(0, 50)} ${el.outerHTML.slice(0, 90)}`);
    if (Number(el.getAttribute("tabindex")) > 0) add("tabindex", `positive tabindex on ${el.tagName}`);
  }
  for (const el of document.querySelectorAll("input:not([type=hidden]), select, textarea")) {
    if (visible(el) && !nameOf(el)) add("unlabelled-field", el.outerHTML.slice(0, 100));
  }

  // ---- images and svg
  for (const img of document.querySelectorAll("img")) if (!img.hasAttribute("alt")) add("img-no-alt", img.src.slice(-40));
  for (const svg of document.querySelectorAll("svg")) {
    if (!visible(svg)) continue;
    const hidden = svg.closest("[aria-hidden=true]") || svg.getAttribute("aria-hidden") === "true";
    const labelled = svg.getAttribute("aria-label") || svg.getAttribute("role") === "img" || svg.querySelector("title");
    const inButtonWithName = svg.closest("button, a")?.textContent?.trim() || svg.closest("button, a")?.getAttribute("aria-label");
    if (!hidden && !labelled && !inButtonWithName && svg.getBoundingClientRect().width > 40) add("svg-unnamed", `svg ${Math.round(svg.getBoundingClientRect().width)}px ${svg.outerHTML.slice(0, 60)}`);
  }
  // focusable inside aria-hidden
  for (const el of document.querySelectorAll("[aria-hidden=true]")) {
    if (el.querySelector("a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])")) add("hidden-focusable", el.outerHTML.slice(0, 80));
  }

  // ---- target size (WCAG 2.2 AA minimum 24 CSS px)
  for (const el of interactive) {
    const r = el.getBoundingClientRect();
    if ((r.width < 24 || r.height < 24) && el.tagName !== "A") add("small-target", `${Math.round(r.width)}x${Math.round(r.height)} ${el.outerHTML.slice(0, 70)}`);
  }

  // ---- contrast
  const cv = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const toRgba = (css) => {
    cv.clearRect(0, 0, 1, 1);
    cv.fillStyle = "#000";
    cv.fillStyle = css;
    cv.fillRect(0, 0, 1, 1);
    const d = cv.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const over = (top, bottom) => {
    const a = top[3] + bottom[3] * (1 - top[3]);
    if (a === 0) return [0, 0, 0, 0];
    return [0, 1, 2].map((i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a).concat(a);
  };
  const lum = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const pageBg = toRgba(getComputedStyle(document.body).backgroundColor);
  const rootBg = pageBg[3] > 0 ? pageBg : toRgba(getComputedStyle(document.documentElement).backgroundColor);
  const base = rootBg[3] > 0 ? rootBg : [255, 255, 255, 1];
  const failures = new Map();
  let checked = 0, gradient = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const done = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || done.has(el) || !n.textContent.trim() || !visible(el)) continue;
    if (el.closest("script,style,noscript,[aria-hidden=true]")) continue;
    done.add(el);
    const s = getComputedStyle(el);
    let fg = toRgba(s.color);
    // background: composite ancestors' colours
    let layers = [], hasImage = false;
    for (let a = el; a; a = a.parentElement) {
      const as = getComputedStyle(a);
      if (as.backgroundImage !== "none") hasImage = true;
      const c = toRgba(as.backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] >= 0.999) break;
    }
    let bg = base;
    for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg);
    if (bg[3] < 1) bg = over(bg, base);
    fg = over(fg, bg);
    const size = parseFloat(s.fontSize);
    const bold = Number(s.fontWeight) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    const r = ratio(fg, bg);
    checked++;
    if (hasImage) gradient++;
    if (r < need) {
      const key = `${s.color} on ${Math.round(bg[0])},${Math.round(bg[1])},${Math.round(bg[2])} need ${need}`;
      const entry = failures.get(key) || { ratio: r.toFixed(2), count: 0, sample: n.textContent.trim().slice(0, 40), size: size + "px", hasImage };
      entry.count++;
      failures.set(key, entry);
    }
  }
  out.contrast = { checkedTextElements: checked, withBackgroundImage: gradient, failures: [...failures.entries()].map(([k, v]) => ({ k, ...v })).sort((a, b) => b.count - a.count).slice(0, 14) };
  out.summary = out.issues.reduce((m, i) => ((m[i.kind] = (m[i.kind] || 0) + 1), m), {});
  out.issues = out.issues.slice(0, 25);
  return JSON.stringify(out);
})()
~~~
