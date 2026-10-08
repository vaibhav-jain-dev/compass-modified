// Generated from extra-features/highlighter.example.yaml. Keep the two in
// sync: `example-config.spec.ts` fails when they drift. Regenerate with
// `npm run sync-example -w @mongodb-js/compass-highlighter`.
export const EXAMPLE_CONFIG_YAML = `# Highlighter configuration for Compass (fork extra feature).
#
# Compass loads this file on start and reloads it whenever it changes on disk,
# so an agent (or you) can edit it while Compass is running.
#
# Default location (visible on purpose, so agents can find it without setup):
#   Linux / WSL:  ~/compass-highlighter/highlighter.yaml
#   Windows:      %USERPROFILE%\\compass-highlighter\\highlighter.yaml
# Override:       Settings > Highlighter > "Config file path", only if you want
#                 the file somewhere else (e.g. inside a project repo).
#
# Everything is optional except \`version\` and \`features\`. Unknown keys are
# ignored so the file can carry extra metadata for agents.

version: 1

# Which feature label is currently selected in the dropdown. The UI writes this
# back when you pick another feature, so the file is the single source of truth.
activeFeature: order-checkout

# Optional. Prefix for \`code:\` references so they become links, e.g.
# https://github.com/org/repo/blob/<commit>/ . Without it they are shown as text.
codeBaseUrl: https://github.com/example/shop/blob/main/

# Global display settings. Each can be overridden per feature.
display:
  # How the sidebar lists databases and collections while a feature is active:
  #   all            - show everything, just decorate highlighted ones
  #   dim-others     - show everything, fade out non-highlighted ones
  #   only-interested - hide every database/collection the feature doesn't mention
  listing: dim-others
  # Highlight fields inside documents (list, JSON and table views).
  highlightFields: true
  # Show the notes/relations tooltip when hovering a highlighted field.
  showTooltips: true
  # Show a small badge with the style icon next to highlighted collections.
  showBadges: true

# Named tags with colours. Collections and fields reference them with
# \`tags: [name, ...]\`. The sidebar shows an (i) icon next to tagged collections
# with a tooltip listing them; field tooltips list them too. Tags without a
# definition still work and get a stable colour.
tags:
  text-ids:
    color: '#B91C1C'
    background: '#FEE2E2'
    description: ids stored as text, match on the hex string
  async:
    color: '#7C3AED'
    background: '#EDE9FE'

# Reusable named styles. A collection or field refers to one by name.
# \`color\` is used for text/border, \`background\` for the fill, \`icon\` is a
# LeafyGreen glyph name (https://www.mongodb.design/component/icon/live-example/).
styles:
  primary:
    color: '#00684A'
    background: '#E3FCF7'
    icon: Favorite
    bold: true
  focus:
    color: '#B45309'
    background: '#FEF3C7'
    icon: Bulb
  relation:
    color: '#1D4ED8'
    background: '#DBEAFE'
    icon: Link
  muted:
    color: '#6B7280'
    background: 'transparent'
    strikethrough: false

# A feature is a named set of highlights. One feature = one entry in the
# dropdown. Features never merge; switching features swaps everything.
features:
  - id: order-checkout # stable identifier, lowercase-kebab, used by the agent
    label: Order checkout flow # what the dropdown shows
    description: Everything involved when a customer places an order.
    status: in progress # free-form, shown as a badge (e.g. "in session", "proposed")
    tags: [backend, payments] # free-form, used only for grouping/filtering
    # Per-feature overrides of the global \`display\` block.
    display:
      listing: only-interested
    # Feature-level notes. Markdown. Rendered in the Highlighter tab.
    notes: |
      Entry point is \`POST /orders\`. The order document is written first,
      then the inventory reservation runs as a separate step.
    # Attachments shown next to the notes. \`url\` can be anything a browser
    # opens, including claude.ai artifact links or local file paths.
    artifacts:
      - title: Checkout sequence diagram
        url: https://claude.ai/artifact/abc123
        kind: diagram # free-form label: diagram | doc | ticket | link | file
      - title: Design doc
        url: file:///home/vaibhav/projects/shop/docs/checkout.md
        kind: doc

    # Collections ("models") this feature cares about. Namespace is db.collection.
    # Anything not listed here is treated as "not interested" for this feature.
    #
    # \`role\` says how the feature relates to the collection and picks a default
    # style when none is given:
    #   changes   - the feature writes/migrates it        (style primary)
    #   linked    - read or referenced by the same flows  (style focus)
    #   untouched - listed on purpose to say "not touched" (style muted)
    collections:
      - namespace: shop.orders
        role: changes
        style: primary # how the collection appears in the sidebar
        alias: Order # friendlier name shown in badges/tooltips (optional)
        tags: [async] # see \`tags:\` at the top
        notes: |
          Main concentration. One document per order; status transitions
          live in \`history[]\`.
        fields:
          - path: _id
            style: primary
            label: family key # short meaning shown as a chip next to the path
            notes: Referenced as \`orderId\` by inventory and payments.
          - path: customerId
            style: relation
            notes: Owner of the order.
            relatedTo:
              - namespace: shop.customers
                path: _id
          - path: items[].sku # \`[]\` means "each array element"
            style: relation
            tags: [text-ids]
            relatedTo:
              - namespace: shop.products
                path: sku
          - path: payment.status
            style: focus
            notes: 'Enum: pending | authorized | captured | failed'
          - path: history[].at
            style: muted

      - namespace: shop.customers
        role: linked
        fields:
          - path: _id
            style: relation
            relatedTo:
              - namespace: shop.orders
                path: customerId
          - path: email
            style: focus

      - namespace: shop.products
        style: focus
        fields:
          - path: sku
            style: relation
            relatedTo:
              - namespace: shop.orders
                path: items[].sku
          - path: stock.reserved
            style: focus
            notes: Decremented by the inventory worker, not by the API.

    # Optional free-form relations that are not tied to a single field.
    # Rendered in the Highlighter tab as a relations list.
    relations:
      - from: shop.orders
        to: shop.inventory_reservations
        via: orderId
        notes: One reservation per order line; created async.

    # Queries worth keeping next to the feature. With \`namespace\` + \`filter\`
    # (shell syntax or extended JSON) the tab offers "Open with filter", which
    # opens the collection with that filter in the query bar. \`shell\` is for
    # anything else (aggregations, counts, scripts): shown as code to copy.
    queries:
      - title: Orders still pending payment
        namespace: shop.orders
        filter: '{ "payment.status": "pending" }'
        project: '{ _id: 1, customerId: 1, "payment.status": 1 }'
        sort: '{ createdAt: -1 }'
        expect: A handful of rows; anything older than a day is a stuck order.
      - title: Orders per payment status
        shell: |
          db.orders.aggregate([{ $group: { _id: "$payment.status", n: { $sum: 1 } } }])
        notes: Run in mongosh; the Highlighter tab only opens plain finds.

    # Where in the code these models are written. Rendered as links when
    # \`codeBaseUrl\` is set at the top of the file.
    code:
      - path: services/orders.py
        line: 120
        notes: create_order, writes the order document and the first history row
      - path: workers/inventory.py
        line: 44
        notes: reserve_items, decrements stock.reserved

    # Things still to verify. The checkbox in the tab writes \`done\` back here.
    checks:
      - text: Place an order with two line items and confirm two reservations
        done: false
      - text: Fail a payment and confirm the order stays pending
        done: true

  - id: user-onboarding
    label: User onboarding
    description: Sign-up, email verification, first login.
    collections:
      - namespace: shop.customers
        style: primary
        fields:
          - path: email
            style: primary
          - path: verification.token
            style: focus
            notes: Expires after 24h. Compared in constant time.
      - namespace: shop.sessions
        style: focus
        fields:
          - path: customerId
            style: relation
            relatedTo:
              - namespace: shop.customers
                path: _id
`;
