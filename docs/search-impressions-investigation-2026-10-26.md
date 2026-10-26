# October 11 search-impression decline: investigation

Investigation date: October 26, 2026. Baseline: `49d0bbda305086c41a650cbddb8628ccf7643eed`.

## Conclusion and confidence

The historical cause is **not established**. The reported daily decline from roughly
200–240 to 2–7 impressions comes from [PR #12](https://github.com/radoslav1992/world-radio-stations/pull/12),
not a new authenticated Performance export. Current public checks cannot establish
Google's historical or current index state.

There is no evidence of a current site-wide robots/noindex/canonical error on the
sampled pages. There is a reproducible upstream-error handling defect on `/listen/`
and an HTTP-to-HTTPS redirect gap for static assets. Neither is proven to have
triggered the October 11 decline. Do not label this a manual action or reverse the
October redesign without further evidence.

## Repository and build timeline

Dates below are UTC; they are build-check completion times, not a complete
Cloudflare deployment or configuration audit.

| Main revision | Change | Successful Cloudflare Workers build |
| --- | --- | --- |
| `f4de228` | PR #9 | July 6, 11:20:10 |
| `55fac58` | PR #10 | October 12, 19:36:44 |
| `cd81b5f` | PR #11 | October 13, 14:56:01 |
| `49d0bbd` | PR #12 | October 21, 20:04:20 |

No main-branch commits occur between July 6 and October 12. The GitHub Actions
workflow collection is empty; deployment checks come from Cloudflare Workers
Builds. Dashboard-only changes, manual redeploys, DNS/security rules and dependency
outages are not ruled out by this history.

The July 6 code already used the correct HTTPS site/canonical origin and the same
robots rules. A failed station API lookup redirected `/listen/…` to `/404` then;
PR #11 changed this to a direct 404. The underlying failure/absence conflation
therefore predates the reported decline, although an October 10–11 upstream outage
has not been demonstrated.

## Live checks

GET requests on October 26, approximately 07:27–07:32 UTC, using curl's default
client identity. Sitemap counts are a snapshot of changing external data.

| Resource | Observed result |
| --- | --- |
| `/robots.txt` | 200; `Allow: /`; only `/favorites` and `/history` disallowed; correct sitemap URL |
| `/sitemap-index.xml` | 200; valid XML referencing the three child maps |
| `/sitemap-0.xml` | 200; valid XML; 99 unique URLs |
| `/sitemap-countries.xml` | 200; valid XML; 155 unique URLs |
| `/sitemap-listen.xml` | 200; valid XML; 1,500 unique URLs |
| `/`, `/stations/talksport`, `/country/gb`, `/blog/best-internet-radio-stations` | 200; `index, follow`; self-referencing HTTPS/non-www canonical; no X-Robots-Tag observed |
| Two sampled existing `/listen/` pages | 200; indexable; correct self canonical |
| Random nonexistent URL | Real 404; not a 200 soft error |
| `/stations/talksport?utm_source=audit` | 200; canonical excludes the query |
| `/stations/talksport/` | 307 to `/stations/talksport` |
| HTTP `/` and HTTP `/stations/talksport` | **200 instead of redirect**, with HTTPS canonical |
| HTTP `/country/gb` | 301 to the HTTPS equivalent |
| HTTPS www host | Inconclusive: audit proxy returned an upstream connection failure; no target response was established |

All three child maps were parsed, not just fetched. Sample checks do not validate
all 1,754 listed pages or prove Google has accepted the sitemaps.

A separate Python urllib client received Cloudflare 403/error 1010, including on
robots and sitemap URLs. curl and the public search fetcher could fetch content.
Cloudflare documents 1010 as a browser-signature block. This establishes selective
client blocking, **not Googlebot blocking**. No attempt was made to impersonate
verified Googlebot. A successful arbitrary Googlebot User-Agent request would not
prove verified crawler access either.

## Verified repository fix

`src/pages/listen/[uuid].astro` treated HTTP errors, thrown network errors, malformed
JSON and missing stations identically. The route regression test reproduced 404s
for six temporary-failure cases before the fix.

The fix returns 503, `Retry-After: 600`, and `Cache-Control: no-store` for lookup
failures; bounds the lookup to 10 seconds; avoids `noindex` on that temporary
response; and tells visitors to retry. Invalid identifiers and successful empty
directory lookups remain 404. Successful station pages retain their existing
canonical and cache behavior. Persistent upstream outages still require repair;
503 is not a long-term indexing solution.

Validation: `node --test tests/listen-status.test.mjs` exercises the actual Astro
route with isolated server-side API fixtures (9 passing cases). `npm run build`
produces the Cloudflare bundle. These are local tests, not a production deployment
or a historical-outage reproduction. Revert the fix commit to roll back.

## Checks requiring authenticated access

Search Console and Cloudflare both presented signed-out pages in this session.

1. **Confirm the decline with comparable data.** Use the domain property, Web
   search, all devices/countries, no query/page/appearance filters, and complete
   days. Compare October 4–10 against October 11–17, then daily September 20–October
   24. Export clicks, impressions, CTR and position by day and compare pages and
   queries. Check whether the original export was a URL-prefix property; compare
   HTTP/HTTPS and www/non-www to detect canonical attribution changes. Do not
   equate a change in low-position impressions with the same loss of actual visits.
2. **Inspect affected URLs.** Inspect `/`, `/stations/talksport`, `/country/gb`,
   and the `/listen/` pages that lost impressions. Record indexed verdict, last
   crawl, fetch result, indexing allowed, user-declared and Google-selected
   canonical. Compare the indexed result with a live test. The live test alone
   does not establish inclusion in the index.
3. **Indexing and enforcement.** Check Manual actions, Security issues, Removals,
   and Page indexing around October 10–11. Export examples for 404, noindex,
   server errors, blocked requests, duplicate canonical, and crawled/discovered
   but not indexed. Distinguish intentionally excluded utility/ad pages from
   formerly productive content. Verify Sitemaps' last read and errors.
4. **Crawling and infrastructure.** Compare Crawl stats host availability,
   robots/DNS/server failures and response codes with Cloudflare request logs,
   Security Events and audit history for October 9–13. Check verified Googlebot
   traffic, rule IDs, challenges/403s, worker exceptions, upstream fetch failures,
   Workers limits, routing, DNS, TLS and cache changes. Historical logs may no
   longer be retained; absence of records is not evidence of no incident.
5. **Redirect configuration.** The static asset layer bypasses Astro middleware.
   Enable/verify a zone-level HTTP-to-HTTPS redirect and an intended www-to-apex
   redirect, after confirming DNS/TLS and path/query preservation. A code comment
   promising canonicalization does not make these static responses redirect.

Interpretation: falling indexed-page counts plus fetch/indexing errors support a
technical explanation; stable indexing with sustained losses for the same queries
supports a ranking explanation; a drop isolated to one property/filter with
preserved domain totals supports attribution/reporting differences. These require
data, not inference from the shape of the impressions graph alone.

## Google-wide context

Google's published data-anomaly page lists no October 10–11 Search performance
incident as of this audit. The status dashboard lists no recent widespread crawl
or indexing incident. The September 2026 spam update ran September 24–October 8,
near but before the reported cliff. This is a ranking hypothesis to test, not
evidence that this particular site was affected or received a manual action.

- [Google: debugging Search traffic drops](https://developers.google.com/search/docs/monitor-debug/debugging-search-traffic-drops)
- [Search Console data anomalies](https://support.google.com/webmasters/answer/6211453)
- [Google Search status history](https://status.search.google.com/summary)
- [September 2026 spam update](https://status.search.google.com/incidents/XhUDXP7A67iHCD2kmbVu)
- [Cloudflare error 1010](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1010/)
