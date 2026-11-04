# Almajdoub Dispatch — Website Release Candidate Handoff

## What changed
- This folder is a standalone candidate copy; the root website files remain untouched.
- Rebuilt the public pages around one shared responsive design and the exact public brand name, Almajdoub Dispatch.
- Removed the public carrier intake form. The existing form used GET, while the JavaScript handler targeted different field IDs and could put carrier details into URL parameters or a WhatsApp message.
- Removed simulated submission/success behavior and withheld phone, email, and WhatsApp links pending owner verification. No user-entered details are passed by the website.
- Added Privacy and Accessibility pages, a custom 404 page, and an internal Terms review checklist. No public Terms link is shown while the agreement remains under review.
- Added noindex/nofollow to this candidate until owner, operational, and legal checks are complete.

## Public facts retained
- Brand: Almajdoub Dispatch.
- Initial equipment focus documented in planning: 53-ft Dry Van.
- Reefer remains conditional on owner approval of its operating procedure.
- The site does not book loads, accept documents, show live freight, provide GPS tracking, process payments, or host a carrier account.
- Pricing, trial duration, hours, response times, service availability, data access, and legal classification are not stated as approved facts.

## Owner confirmations required before launch
1. Confirm current phone line and that the voicemail identifies Almajdoub Dispatch.
2. Confirm dispatch@almajdoub.com, domain mail routing, and ability to receive email.
3. Confirm which service tasks are operationally available and whether load-board access is active.
4. Approve the public pricing model, exact fees, billing terms, any trial, pause, and cancellation terms.
5. Approve hours, response expectations, weekend/emergency coverage, and current intake availability.
6. Confirm the final website host, server logs, retention, privacy contact, and any request/deletion process. Update privacy.html accordingly.
7. Obtain transportation counsel review of the actual service conduct, agreement, authorization, and any public legal descriptions. Do not publish a categorical broker/agent classification before then.
8. Obtain owner and counsel review of Terms before writing or publishing a public Terms page.
9. Verify photo licensing and keep image captions that distinguish representative photography from company operations.
10. Remove `noindex, nofollow` only after the final public copy and launch configuration are approved.

## Image and brand notes
- Reused the three truck photographs and supplied SVG logo mark already present in the site assets; no new employee, customer, office, or fleet imagery was invented.
- The brand kit README credits the three reference photos to named Unsplash photographers. Confirm that attribution and license requirements are satisfied for the actual image files and intended commercial use.
- The kit does not include a documented real dispatch office or fuel-stop photograph. See PHOTO_SHOT_LIST.md for the next authentic-photo opportunity.
- The full-color PNG export in the source assets shows visible rendering artifacts when inspected. The candidate uses the supplied SVG mark with a text wordmark instead; replace only after a clean master logo export is approved.

## Legal and privacy status
This is a website implementation handoff, not legal advice or a compliance certification. The privacy page accurately describes this local candidate's lack of a form and connected trackers, but the host and its technical logging need confirmation before publication. The Terms page remains unpublished pending review.

