# MVP Architecture

## Goal

Build an outbound system that helps you find local businesses with weak digital presence, qualify them fast, contact them with a strong offer, and move them toward a booked sales call.

## Primary conversion objective

For the first version, the main success event is:

`booked sales call`

Everything else should support that one outcome.

## Core funnel

1. Focus selection
   Pick one city, one niche, one service offer.
2. Lead sourcing
   Add businesses from manual research or future connectors.
3. Qualification
   Score the lead based on website quality, digital presence, and pain points.
4. Outreach
   Send first touch by WhatsApp, email, or cold call.
5. Booking
   Move interested leads into a scheduled call.
6. Demo prep
   Prepare a quick AI-assisted visual demo only for engaged prospects.
7. Proposal
   Send a PDF-ready summary before or after the call.
8. Close
   Turn the project into paid delivery and upsell additional services.

## Funnel states for the dashboard

- `sourced`
- `qualified`
- `contacted`
- `booked`
- `demo`
- `proposal`
- `closed`

## Qualified lead definition

A lead is qualified when most of these are true:

- it matches the chosen city and niche
- the business has no website, an outdated website, or weak conversion UX
- digital presence is low or inconsistent
- there is a reachable contact method
- the business looks active enough to benefit from a redesign, landing page, or automation

## MVP data model

Each lead should store at least:

- `id`
- `businessName`
- `city`
- `niche`
- `phone`
- `email`
- `source`
- `websiteStatus`
- `digitalPresence`
- `painPoints`
- `offerType`
- `stage`
- `notes`
- `lastTouch`

## Opportunity scoring

The first scoring pass is heuristic, not AI:

- no website = highest opportunity
- weak or outdated website = strong opportunity
- low digital presence = strong opportunity
- more pain points = higher opportunity
- reachable phone / email = easier to act on

This score helps you decide who deserves manual energy first.

## Why this MVP is manual-first

The risk in a lead-gen system is building too much automation before proving the sales loop.

Manual-first gives you:

- faster iteration on the offer
- cleaner feedback from real conversations
- better understanding of objections
- less engineering waste before the pitch is validated

## Planned integrations after MVP

### Phase 2

- business source ingestion by city + niche
- CSV import/export
- screenshot-based audit workflow
- richer scoring rules

### Phase 3

- proposal templates per service type
- outbound message logging
- follow-up reminders
- CRM or Airtable sync

### Phase 4

- automated website critique
- draft landing page / redesign demo generation
- booked-call reminders and no-show recovery

## Offer strategy

The recommended offer is:

`I prepared a quick demo / proposal of how your digital presence could convert better. If you like it, we build it properly. If not, no pressure.`

That keeps the sales angle strong without promising completed work before it exists.

## Biggest risks

- spending too much time on free demos for low-intent leads
- collecting too many leads without follow-up discipline
- using too many service offers at once without a clear niche
- treating a reply as success instead of a booked call

## Success metrics for the next version

- leads added per week
- leads qualified per batch
- first-touch response rate
- booked calls
- demos created for booked calls
- close rate after call
