# Thriftly

Thriftly helps shoppers compare physical thrift and resale shops, then get directions. Public coverage is the independent registry in `data/stores-us.json` intersected with confirmed identities in `data/google-place-ids.json`. A listing must represent public retail rather than an office, warehouse, or donation-only stop. Ambiguous matches are held for review. Temporary provider failures preserve confirmed identities.

The San Diego independent-store pilot adds a small curated selection of local operators, including nonprofits. Local operators may run more than one regional shop. National brands remain separate filter options. The pilot is not a complete directory of the city.

“Verified online” means a deliberate review of the operator's website for retail shopping, address, and local operation, recorded with source links and a check timestamp. It does not mean a visit, phone confirmation, verified stock, or guaranteed current hours. Imports and refreshes must preserve the original review date.

Search results, street addresses, and directions work independently of the map. Department filters use sourced statements about merchandise categories, never a promise of current inventory. Corrections enter a private moderation queue and cannot directly change public listings.

The Visit score blends neighborhood Census measures, historical walkability data, and live Google ratings. Google contributes up to 50%, attenuated by n/(n+50); walkability contributes 5% when available. The remainder is the neighborhood baseline. Missing ratings produce a partial score; a missing neighborhood baseline leaves the composite unscored. Original Google stars and counts remain visible and attributed. The weighting is a documented heuristic, not an inventory or value prediction. There are no first-party shopper reviews or visit reports.

Google is the live source for matched names, addresses, positions, hours, status, phone, website, and ratings. Live responses remain in active-page memory only. Census and EPA calculations use independently sourced coordinates. Each screen has one Google map, and ratings load independently of the map library. Contractual compatibility of the blended formula remains unconfirmed.

## Interface

Extend the established Geist typography, neutral light and dark surfaces, green primary actions, and simple list rows. Prioritize store identity, rating, score, and directions on small screens; keep chain and independent filters distinguishable. Put source dates, verification scope, and detailed evidence in hover, focus, and tap disclosures. Google attribution stays visible. Every live score opens a breakdown. The pilot inherits the existing interface rather than creating a new visual identity.
