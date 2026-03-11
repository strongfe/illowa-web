# Deploy QA Checklist

Last verified: 2026-03-10 (Asia/Seoul)
Project: `web` (Next.js 16)

## 1) Locale page rendering
- [x] All locale routes return HTTP 200:
  - `/ko` `/en` `/ja` `/zh` `/ru` `/es` `/fr` `/pt` `/id` `/hi`
- [x] Major sections exist per locale page:
  - `#about` `#rooms` `#rates` `#amenities` `#gallery` `#contact`

## 2) Locale switcher navigation
- [x] Locale switcher exposes all 10 locales on every locale page.
- [x] Locale links resolve to locale-prefixed routes.

## 3) Booking/phone links
- [x] Header phone link exists: `tel:0503-5051-6355`
- [x] Mobile menu phone link exists: `tel:0503-5051-6355`
- [x] Booking CTA links exist:
  - `https://www.yanolja.com`
  - `https://www.yeogi.com`

## 4) SEO metadata
- [x] `canonical` is locale-specific (`https://illowa-hotel.com/{locale}`)
- [x] `hreflang` alternates include all 10 locales + `x-default` (11 total)
- [x] `og:title`, `og:description`, `og:url`, `og:locale` present
- [x] `twitter:title`, `twitter:description` present
- [x] `<html lang>` is locale-specific (`ko-KR`, `en-US`, ...)

## 5) Mobile menu & responsive layout
- [x] Mobile menu toggle exists (`md:hidden`, localized `aria-label`)
- [x] Desktop/mobile split patterns are present across key sections (`md:*`, `lg:*`, `sm:*`)
- [x] Hero/Rooms/Gallery/Contact layouts contain responsive breakpoints

## 6) Accessibility baseline
- [x] Core interactive controls include labels/roles:
  - Menu button: `aria-label`, `aria-expanded`
  - Room tabs: `role="tab"`, `aria-selected`
  - Modal: `role="dialog"`, `aria-modal`, `aria-labelledby`
- [x] Image `alt` attributes are present in rendered HTML sample checks
- [x] External links with `target="_blank"` use `rel="noreferrer"`

## 7) Localization consistency (OTT policy)
- [x] Short UI labels keep `OTT`
- [x] Detailed descriptions use locale-appropriate explanatory form when needed
  - `ru`: first mention includes explanation
  - `hi`: first mention includes explanation
  - `id`: first mention includes explanation

## 8) Build/quality gates
- [x] `npx tsc --noEmit` passes
- [x] `npm run build` passes
- [x] Translation key parity check (`ko` baseline) passes for all locale message files
- [x] No missing translation markers detected (`MISSING_MESSAGE`, `MISSING_TRANSLATION`, `IntlError`, `TODO`)

## Release decision
- Status: **RELEASE-READY**
- No blocking issues detected in this QA run.
