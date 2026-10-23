# JML Brand Application Contract

**Purpose:** Give this file, together with the included JML logo assets, to an AI agent and ask it to apply JML branding to an existing artifact.

**Typical inputs:** image, screenshot, HTML/CSS, Word document, PDF, slide, report, mockup, landing page, dashboard, infographic, one-pager, proposal, or other visual artifact.

**Core instruction to the agent:**

> Preserve the original content, meaning, functionality, and information architecture unless the user explicitly asks for structural changes. Re-design the artifact so it looks intentionally JML-branded by applying the rules in this file and the supplied official logo assets. Follow the approved color palette, branded header/footer guidance, logo variant/file-format rules, and website-reference rules in this contract. Do not invent brand assets, colors, fonts, or logo variants.

---

## 1. Authority and source of truth

For this kit, the following values are authoritative.

If another file, prior artifact, template, or memory conflicts with these values, **use this kit** unless the user explicitly overrides it.

### Primary colors

#### JML Purple
- HEX: `#4C0099`
- RGB: `76, 0, 153`
- CMYK: `50, 100, 0, 40`

#### JML Lime
- HEX: `#B1EB1E`
- RGB: `177, 235, 30`
- CMYK: `25, 0, 87, 8`

Do not silently replace these with similar purple or lime values.

---

## 6. Color palette compliance

> **Use only colors that are part of the approved JML color palette whenever possible.**
>
> Avoid introducing unrelated, competing, or decorative colors into branded artifacts. If the source artifact contains colors that are necessary for semantic meaning, data visualization, status indication, or functional clarity, preserve them only when removing them would reduce comprehension. In all other cases, replace non-brand colors with the closest appropriate JML-approved color or neutral treatment.

---

## 7. Branded header / footer placement

> **For presentation-oriented and standalone visual artifacts, reserve a dedicated area for JML brand identification.**
>
> Where appropriate, designs such as posters, presentations, social media graphics, one-pagers, reports, and similar artifacts should include a restrained header or footer area for the placement of the official JML logo.
>
> The logo area should be intentionally integrated into the composition and should not compete with the primary content. Avoid adding a header or footer when the format, composition, or context makes it unnecessary.

---

## 8. Logo variant selection

> **Select the official JML logo variant and file format according to the background, visual context, output quality, and available space.**
>
> Official JML logo assets are available in **both SVG and PNG formats**. Use the appropriate format based on the requirements of the artifact:
>
> - For scalable, vector-based, print-ready, or high-resolution artwork, **prefer the official SVG logo files**.
> - For raster-based compositions, image-generation workflows, mockups, or situations where PNG assets are more compatible, **use the official PNG logo files**.
> - For light or white backgrounds, use `JML-Logo-Full-Dark.svg` or the corresponding `JML-Logo-Full-Dark.png`.
> - For dark or visually dark backgrounds, use `JML-Logo-Full-Light.svg` or the corresponding `JML-Logo-Full-Light.png`.
> - Use `JML-Logo-J-Dark.svg` / `JML-Logo-J-Dark.png` or `JML-Logo-J-Light.svg` / `JML-Logo-J-Light.png` when the compact J mark is more appropriate due to limited space, scale, or layout requirements.
> - The choice between the full logo and compact J mark should be based on the artifact's format, available space, visual hierarchy, and brand visibility requirements.
> - **Never recreate, redraw, approximate, or modify the official logo.** Use the provided official PNG or SVG asset.
> - Never use a dark logo on a background where contrast is insufficient, or a light logo where it compromises legibility.
> - Maintain the official logo's proportions, clear space, alignment, and visual integrity regardless of whether the PNG or SVG version is used.

---

## 9. Website as brand reference

> **Official JML website:** `https://jaymarketinglab.com/`
>
> The official JML website may be used as a supplementary visual and contextual reference when applying the brand to an artifact. It can help the AI understand the current brand presentation, visual language, typography, composition, imagery, and digital experience.
>
> However, the website should **not override the authoritative values defined in this contract**. Where the website, an existing artifact, or another reference conflicts with this contract, the values explicitly defined in this document remain the source of truth unless the user explicitly provides an override.

---

## 6. Official logo assets

Use the supplied official logo files in either SVG or PNG format. Prefer SVG for scalable, vector-based, print-ready, or high-resolution artwork, and use PNG for raster-based compositions, image-generation workflows, mockups, or environments where PNG is more compatible. Do not redraw, trace, recolor, stretch, skew, rotate, add effects to, or recreate the logo with text.

### Full logo

#### `logos/JML-Logo-Full-Dark.svg` / `logos/JML-Logo-Full-Dark.png`
Use when the full JML identity has enough space and the background is light or neutral.

Observed logo colors:
- JML Purple `#4C0099`
- JML Lime `#B1EB1E`

#### `logos/JML-Logo-Full-Light.svg` / `logos/JML-Logo-Full-Light.png`
Use when the full JML identity has enough space and the background is dark.

Observed logo colors:
- white
- JML Lime `#B1EB1E`

### Compact J mark

#### `logos/JML-Logo-J-Dark.svg` / `logos/JML-Logo-J-Dark.png`
Use the compact J mark where the full logo is too large or visually heavy, especially on light backgrounds.

#### `logos/JML-Logo-J-Light.svg` / `logos/JML-Logo-J-Light.png`
Use the compact J mark where the full logo is too large or visually heavy, especially on dark backgrounds.

### Logo selection rule

Use the **full logo by default** when it fits without crowding the layout.

Use the **compact J mark** for:
- small cards
- app chrome
- favicon-like placements
- tight headers
- small social/graphic placements
- compact document footers
- areas where the full logo would be visually dominant

Never use both full logo and compact J mark redundantly in the same small visual region.

### Logo treatment

- Preserve aspect ratio.
- Keep clear space around the logo.
- Do not place it on a visually noisy area that reduces legibility.
- Do not add drop shadows, bevels, glows, outlines, gradients, or decorative effects.
- Do not use unofficial text-only approximations.
- Do not crop through the logo.
- Do not recolor official SVG or PNG assets.
- Never recreate, redraw, approximate, or modify the official logo.
- Maintain the official logo's proportions, clear space, alignment, and visual integrity regardless of whether the SVG or PNG version is used.

---

## 7. Typography

Use the following JML typography system when the target format supports it.

### Primary digital typography

**Display / major headings**
- `DM Serif Display`

**Body / UI / supporting copy**
- `DM Sans`

**Technical labels, prices, small metadata, code-like accents**
- `JetBrains Mono`

### Print / email compatibility

When the output environment cannot reliably use the primary web fonts:
- use `Georgia Pro` for editorial/display contexts where available
- use `Arial` for broad compatibility in body text and email/office contexts

### Font handling rules

- Do not distribute or embed font files from this kit.
- If the required font is not available in the target environment, use the best available fallback and explicitly report the fallback.
- Preserve hierarchy even when fallback fonts are used.
- Do not mix many unrelated font families.
- Avoid decorative fonts not defined here.

---

## 8. JML visual character

JML should feel:

- expert
- precise
- editorial
- modern
- technically credible
- calm rather than noisy
- confident without looking aggressive
- intentionally designed rather than template-generated

The visual system should communicate:

> sophisticated technical capability with clear business communication.

Avoid making JML look like a generic AI startup, generic SaaS dashboard, or mass-market template.

---

## 9. Color application

### Purple

Use JML Purple as the main brand anchor for:
- major backgrounds
- important headings
- navigation
- strong structural areas
- key brand surfaces
- selected buttons or active states when contrast is sufficient

### Lime

Use JML Lime selectively for:
- accents
- highlights
- active states
- key metrics
- small emphasis areas
- important graphical markers
- selected CTA treatment

Lime is an accent, not a reason to make the entire artifact fluorescent.

### Neutral space

Use white, near-white, and dark neutral space where necessary to create hierarchy and readability.

Do not introduce a competing saturated brand color unless the source artifact requires it for semantic meaning and removing it would damage comprehension.

### Accessibility

Do not assume a brand color is readable simply because it is approved.

Check contrast for:
- body text
- small labels
- buttons
- form states
- charts
- captions

If lime text is not readable against a light background, do not force it. Use a higher-contrast treatment while retaining lime as an accent.

---

## 10. Brand voice

JML voice should be:

- editorial
- quiet confidence
- peer-to-peer
- direct
- intelligent
- plain English
- specific rather than inflated

The reader should feel:

> I am in expert hands.

### Copy rules

Prefer:
- numbers over vague adjectives
- specific claims over hype
- clear verbs
- compact explanations
- clear hierarchy
- first-person CTAs when a CTA is needed

Avoid:
- exaggerated marketing language
- generic AI buzzwords
- filler
- unnecessary exclamation marks
- vague claims such as "revolutionary," "world-class," or "game-changing" unless objectively supported
- overlong corporate prose

Where practical, avoid em dashes and en dashes in JML marketing copy.

---

## 11. Layout and composition

When re-branding an artifact:

1. Preserve the user's information.
2. Establish clear visual hierarchy.
3. Reduce clutter before adding decoration.
4. Give important content more visual weight.
5. Use whitespace deliberately.
6. Keep alignment disciplined.
7. Use consistent spacing.
8. Avoid making every card, block, or section visually equal.
9. Use lime as focus, not wallpaper.
10. Use the JML logo with restraint.

JML output should feel designed by a deliberate human system, not generated from a default component library.

---

## 12. UI and digital-product treatment

For HTML, web pages, dashboards, or application UI:

- preserve working behavior unless explicitly asked to change it
- retain functional states
- preserve accessibility semantics
- do not replace real UI with a static mockup
- keep responsive behavior intact
- apply JML color and typography through reusable tokens/variables where possible
- preserve usable contrast
- avoid excessive rounded cards, gradients, glowing elements, and decorative animation
- use motion only when it improves orientation, feedback, or continuity
- keep interaction states visually coherent with the brand

Suggested CSS tokens:

```css
:root {
  --jml-purple: #4C0099;
  --jml-lime: #B1EB1E;

  --jml-font-display: "DM Serif Display", Georgia, serif;
  --jml-font-body: "DM Sans", Arial, sans-serif;
  --jml-font-mono: "JetBrains Mono", monospace;
}
```

These are tokens, not a complete UI theme. Adapt the artifact intelligently.

---

## 13. Documents, Word files, PDFs, and reports

For document-style artifacts:

- preserve the document's factual content and logical order unless asked otherwise
- establish JML cover/title treatment
- use strong heading hierarchy
- use the full logo when space allows
- use the compact J mark in restrained headers/footers if appropriate
- use purple for structure and lime for controlled emphasis
- keep tables readable and professional
- avoid turning every page into a marketing poster
- retain page numbers, footnotes, citations, and required legal/technical material
- maintain print readability

Do not rasterize editable text unless the requested output format requires it.

---

## 14. Images, posters, social graphics, and visual assets

For image-based redesign:

- use real supplied JML logo assets
- preserve the original message
- improve hierarchy, crop, spacing, typography, and brand coherence
- do not fake product UI
- do not distort people, products, or factual visual evidence
- avoid generic stock-tech aesthetics unless the user explicitly wants them
- use purple as structural identity and lime as controlled emphasis

When the source image is low resolution, do not pretend reconstructed text or details are exact. Flag uncertainty.

---

## 15. What must remain unchanged unless explicitly requested

Do not silently change:
- factual claims
- numbers
- prices
- dates
- legal language
- product behavior
- workflow logic
- citations
- names
- contact information
- chart values
- UI states
- source meaning

Brand transformation is not permission to rewrite content.

If content itself needs improvement, separate that as a recommendation or ask for permission.

---

## 16. Required AI workflow

When an AI agent receives this kit plus an artifact, it should:

### Step 1: Inspect
Identify:
- artifact type
- current hierarchy
- current colors/fonts
- logo placement
- functional constraints
- content that must not change

### Step 2: Plan
Decide:
- which official logo variant and file format to use (SVG or PNG)
- whether a restrained branded header/footer area is appropriate
- where Purple and Lime belong
- typography mapping
- structural cleanup needed
- what must be preserved

### Step 3: Apply
Re-design using this contract.

### Step 4: Validate
Check:
- exact primary colors
- official logo asset
- correct light/dark logo variant
- undistorted logo
- typography
- readability
- contrast
- preserved content
- preserved functionality
- consistent spacing
- no accidental generic AI visual style

### Step 5: Report
Provide a concise summary of:
- what changed
- what was preserved
- any font fallback
- any uncertainty
- any element intentionally left unchanged

---

## 17. Acceptance checklist

A JML-branded output is acceptable only if:

- [ ] Purple is exactly `#4C0099` where the JML primary purple is used.
- [ ] Lime is exactly `#B1EB1E` where the JML primary lime is used.
- [ ] An official supplied JML logo asset is used (SVG or PNG as appropriate).
- [ ] Correct light/dark logo variant is selected for the background.
- [ ] SVG is preferred for scalable/vector/print/high-resolution output; PNG is used where raster compatibility is more appropriate.
- [ ] A restrained branded header/footer area is included when appropriate for the artifact format.
- [ ] Header/footer placement does not compete with the primary content.
- [ ] Logo proportions are unchanged.
- [ ] Full logo vs compact J is chosen intentionally.
- [ ] Typography follows the JML hierarchy or a declared fallback.
- [ ] Content meaning is preserved.
- [ ] Functional behavior is preserved for interactive artifacts.
- [ ] Visual hierarchy is clear.
- [ ] Lime is used intentionally rather than excessively.
- [ ] Output does not look like a generic AI/SaaS template.
- [ ] Contrast and readability are checked.
- [ ] No unsupported brand elements were invented.
- [ ] The final artifact is presentation-ready.

---

## 18. Minimal prompt to use with this kit

Give the AI agent:
1. the artifact to transform
2. this Markdown file
3. the included `logos/` folder containing the official SVG and PNG logo assets

Then use:

> Read `JML-BRAND-APPLICATION-CONTRACT.md` completely and apply it to the attached artifact. Preserve the artifact's content, meaning, and functionality unless I explicitly ask for changes. Use only the supplied official JML logo assets and the exact authoritative brand values in the contract. Return the finished JML-branded artifact and a short validation summary.

---

## 19. Current authoritative brand assets in this package

```text
logos/
├── JML-Logo-Full-Dark.svg
├── JML-Logo-Full-Dark.png
├── JML-Logo-Full-Light.svg
├── JML-Logo-Full-Light.png
├── JML-Logo-J-Dark.svg
├── JML-Logo-J-Dark.png
├── JML-Logo-J-Light.svg
└── JML-Logo-J-Light.png
```

This contract is intentionally format-agnostic. The same brand authority should be applied whether the target is HTML, an image, a Word document, a PDF, a presentation, or another visual artifact.
