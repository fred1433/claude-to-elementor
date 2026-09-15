# Provenance of every string, image and link in `demo/coded/index.html`

Nothing on the demo page was written, invented or embellished by us. Every word, offer,
phone number, address, review and image comes from the client's own live homepage, and is
listed here with where it came from. The page is a **re-layout** of published content, not
a rewrite of it.

Source of truth: `https://cleancutautoshield.com/` (fetched 2026-09-15).

| Slot | Value | Where it comes from |
|---|---|---|
| Business name | CleanCut Auto Shield | `<h1>` and JSON-LD `LocalBusiness.name` |
| Tagline / H1 | Automotive Protection & Restyling | homepage `<h2>` of the intro section |
| Lede | "CleanCut Auto Shield is a Portland based automotive protection and restyling studio…" | homepage intro paragraph, verbatim |
| Phone (primary) | 503-542-2773 | homepage header `tel:` link + JSON-LD `telephone` |
| Phone (shop) | 503-334-9896 | homepage location card `tel:` link |
| Address | 2740 SE Long St, Portland, OR 97202 | JSON-LD `PostalAddress` |
| Hours | Mon-Sat 09:00-17:00 | JSON-LD `openingHoursSpecification` |
| Geo / map link | https://goo.gl/maps/Hm6dTujmXFJAZymKA | homepage footer link |
| Socials | Facebook / Instagram / YouTube | JSON-LD `sameAs` |
| "Zone Of Genius" block | heading + paragraph | homepage section, verbatim |
| 6 services | PPF, Ceramic Coatings, Paint Correction, Color PPF, Color Change Wraps, Window Tinting | homepage service cards: title, description and `Learn more` href all verbatim |
| 5 reasons (01-05) | Certified Installers / Brand New Facility / Stand Out Process / Experience & Expertise / Cleancut Guaranteed | homepage "Why CleanCut Auto Shield?" block, titles, kickers and body verbatim |
| Reviews (3) | Justin Pai, Herbert Pacheco, Lindsay House | the client's own JSON-LD `Product.review[]`, `reviewBody` verbatim, with the dates they published |
| Rating | 5.0 from 3 reviews | the client's own JSON-LD `aggregateRating` |
| Tesla block | heading + paragraph | homepage "Tesla protection" section, verbatim |
| Footer link columns | Home / About / Gallery / Contact / Workmanship Warranty, and the 5 services | homepage footer menus, hrefs verbatim |
| Images (7) | see below | the client's own media library |

Images are mirrored byte for byte from the client's media library into
`demo/coded/assets/` so the fidelity harness is reproducible offline. In production the
converter is pointed at the client's own media base instead
(`--media-base https://cleancutautoshield.com/wp-content/uploads`), so the imported
template resolves against the media library the images already live in.

| File | Original URL |
|---|---|
| tesla-model-3-red-ppf-portland.jpg | /wp-content/uploads/2023/07/tesla-model-3-red-ppf-portland.jpg |
| bmw-ix-ppf-portland-1.jpg | /wp-content/uploads/2023/08/bmw-ix-ppf-portland-1.jpg |
| toyota-supra-ppf-portland-or-1.jpg | /wp-content/uploads/2023/05/toyota-supra-ppf-portland-or-1.jpg |
| c7-corvette-ceramic-coating-portland-1.jpg | /wp-content/uploads/2022/12/c7-corvette-ceramic-coating-portland-1.jpg |
| tesla-ppf-installation-portland.jpeg | /wp-content/uploads/2023/07/tesla-ppf-installation-portland.jpeg |
| logos-1750x125-1.png | /wp-content/uploads/2022/12/logos-1750x125-1.png |
| cropped-cleancut-autoshield-portland-oregon-1.png | /wp-content/uploads/2022/12/cropped-cleancut-autoshield-portland-oregon-1.png |

No pricing is shown anywhere: the client does not publish prices on the homepage, so the
page does not either.
