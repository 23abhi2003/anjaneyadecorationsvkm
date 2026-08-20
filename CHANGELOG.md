# Update log — from handwritten notes (Aug 2026)

This pass implements the changes from the notebook pages: "Ceiling's &
Sidewalls", "Flower Section", "Invoice", "Back", "Staff", and "Dashboard".

## Ceiling & sidewalls
- Added a **"+ Type"** pole option (with its own qty field) alongside the
  existing 18/15/12-feet ceiling poles (`lib/catalog.ts` →
  `CEILING_POLE_SIZES`, used automatically in the order wizard's
  "Ceiling & sidewalls" step).

## Flower section
- Replaced the old size-based flower list (18x18, 15x18, 15x15, 12x18,
  12x12, 10x18) with named flower types: **Gerbera/Aster, Daisy,
  Chrysanthemum (Krishnantham), Marigold (Bandhu), Others**
  (`lib/catalog.ts` → `FLOWER_TYPES`). The "Skip / later" button on this
  step was already in place and still works the same way.

## Invoice
- Added a **Skip / later** button to the invoice step in the order
  wizard, matching the other optional steps.
- Fixed low-contrast "Skip" buttons across the wizard (they used a
  transparent/`light` style that blended into the card background) —
  they're now bordered and colored so they're clearly visible.
- Added a **Share on WhatsApp** button on the order detail page. It
  builds a `wa.me` link from the customer's saved phone number
  (assumes a 10-digit number is Indian and prefixes `+91`) with a short
  pre-filled message (order id, program, event date, total/advance/due)
  and opens WhatsApp in a new tab.
- Download Invoice (customer) and Download Staff Report buttons were
  already present and unchanged.

## Back / order steps
- Every wizard step now shows a small **"Step X of Y"** indicator above
  the step title, so it's clear how far along an order is.
- The final review step's item groups (tent sizes, bowls, frames,
  ceiling, ceiling poles, flowers) — plus the customer/program, staff,
  and invoice summaries — each got an **Edit** button that jumps
  straight back to that step instead of clicking Back repeatedly.

## Staff
- Staff cards on `/staff` are now clickable (tap anywhere on the card).
  Tapping opens a table for that person with **Order, Customer name,
  Amount, Date** columns and a **Total** row at the bottom, summing
  everything they've been paid across all assignments.
- Staff assignment records now also store the event date
  (`lib/types.ts` → `StaffAssignmentRecord.date`), captured
  automatically whenever a new order assigns that staff member
  (`app/api/orders/route.ts`).

## Dashboard
- Increased the header logo and "Anjaneya Decorations" title size in
  the site nav bar so it reads better at a glance.
- Added a small stats row — **Collected so far**, **Pending dues**, and
  **Orders in progress** — under the existing Orders/Customers/Staff
  cards, so orders, staff payouts, and invoicing status are visible
  together on one screen.

## Not changed
- The catalog swap for flowers is a data-shape change: any *existing*
  saved orders that used the old size-based flower keys will keep
  showing those old labels (they're just stored strings), and new
  orders will use the new named types going forward.
