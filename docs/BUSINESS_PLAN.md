# Business plan — path to £10,000/month net profit

> All figures are **planning estimates**, not guarantees. They come from the same model as the admin forecast calculator (`src/lib/finance.ts`, unit-tested) and exclude VAT. Confirm tax treatment with your accountant.

## Offer

| Plan | Setup | Monthly | For |
|---|---:|---:|---|
| Starter | £499 | £299 | One automation that fixes the biggest leak (e.g. web lead capture + basic chatbot) |
| Growth | £999 | £799 | Lead-to-booking system: chatbot, CRM, booking, follow-ups (the default recommendation) |
| Premium | £1,999 | £1,499 | Full front office incl. AI receptionist where telephony allows |
| Enterprise | quoted | quoted | Multi-site, high volume, custom SLAs |

Usage-heavy items (call minutes, SMS, high AI volumes) are priced with allowances and transparent overage so margins don't erode as clients grow. Initial 3-month term covers setup and optimisation; then monthly.

## Unit economics (default assumptions)

Average subscription £799/month · setup £999 · 2 new clients/month · AI/telephony £40 per client · per-client software £25 · fixed software £250 · marketing £1,000 · other £200 · card fees 1.5% + 20p · churn 3%/month.

- Gross margin per Growth client ≈ **90%** (≈ £720/month contribution)
- Customer lifetime value at 3% monthly churn ≈ **£24,000** of gross margin
- Corporation tax: 19% to £50k profit, marginal relief to £250k, 25% above

## Scenarios

### Solo founder (no salary costs)

| Customers | Revenue | Gross profit | Operating profit | Profit after tax / mo | Profit after tax / yr |
|---:|---:|---:|---:|---:|---:|
| 5 | £5,993 | £5,577 | £4,127 | £3,343 | £40,112 |
| 10 | £9,988 | £9,186 | £7,736 | £5,998 | £71,980 |
| 15 | £13,983 | £12,795 | £11,345 | £8,651 | £103,812 |
| 20 | £17,978 | £16,404 | £14,954 | £11,304 | £135,644 |
| 30 | £25,968 | £23,622 | £22,172 | £16,629 | £199,549 |

**≈18 Growth-equivalent clients** reach £10,000/month profit after corporation tax.

### With £3.5k/month salary and £1k/month contractors

| Customers | Revenue | Gross profit | Operating profit | Profit after tax / mo | Profit after tax / yr |
|---:|---:|---:|---:|---:|---:|
| 5 | £5,993 | £4,577 | −£373 | −£373 | −£4,480 |
| 10 | £9,988 | £8,186 | £3,236 | £2,621 | £31,452 |
| 15 | £13,983 | £11,795 | £6,845 | £5,343 | £64,122 |
| 20 | £17,978 | £15,404 | £10,454 | £7,996 | £95,954 |
| 30 | £25,968 | £22,622 | £17,672 | £13,301 | £159,618 |

**≈24 clients** once you pay yourself a salary and use a contractor. "Profit after tax" is company-level; dividends and personal tax are not modelled. VAT registration becomes compulsory when taxable turnover passes £90,000 in a rolling 12 months (≈ month 9–11 at 10+ clients) — price ex-VAT from day one.

Every assumption can be changed live in **Admin → Finance & forecast**, which pre-fills from your real MRR, churn and recorded expenses.

## Acquisition plan (to ~20 clients in 12 months)

Target: **2 new clients/month**. Working backwards with conservative conversion rates (to be replaced by your real data in the pipeline):

| Stage | Monthly volume needed | Assumed conversion |
|---|---:|---:|
| Consultations held | 8 | 25% → client |
| Qualified conversations | 16 | 50% → consultation |
| Outreach touches (email + phone + LinkedIn) | 300–400 | 4–5% → conversation |

Channels, in order of expected cost-efficiency:
1. **Niche focus** — pick 1–2 industries first (roofing/construction and estate agents have high job values and acute missed-call pain). Industry pages and templates are built in.
2. **Compliant outbound** — research ~20 relevant Ltd/LLP businesses per day in a target town, approve them in **Prospects**, run personalised campaigns (25/day cap), follow with TPS-screened calls using the scripts. LinkedIn messages are sent manually.
3. **Partnerships** — web designers, IT support firms, accountants and trade associations serving your niche; offer a referral fee.
4. **Proof flywheel** — after month 2–3, turn your first results into permissioned case studies (Admin → Content). The site shows them automatically.
5. **Content** — short videos of the workflow demo for each industry; a "missed-call cost calculator" post per sector.
6. **Paid search** (later) — "missed call answering service [town]"-style terms once you know your consultation→client rate.

## Delivery capacity

A Growth client needs roughly 10–15 hours of setup and 2–3 hours/month of monitoring and optimisation once live. One person can sustainably run ~20–25 clients with good templates; the platform's onboarding checklist, test log and approval gate exist to keep quality consistent as you scale and add contractors.

## Key risks and mitigations

| Risk | Mitigation |
|---|---|
| AI says something wrong to a client's customer | Approved-knowledge-only prompts, escalation rules, recorded tests, client approval gate, monitoring |
| Usage costs spike | Allowances + overage in proposals; OpenAI hard limits; per-client cost tracking in expenses |
| Churn after setup | 3-month initial term; monthly reporting in the portal showing leads/bookings captured |
| Platform dependency (OpenAI, Twilio, n8n) | Modular integrations and a single event API make providers swappable |
| Compliance (GDPR/PECR) | Enforced in software — see `COMPLIANCE.md` |
