import { expect } from 'chai';
import { filterConnectionsForHighlighter } from './hooks';
import type { HighlighterListing } from './hooks';

describe('filterConnectionsForHighlighter', function () {
  const connections = [
    {
      connectionStatus: 'connected',
      databases: [
        {
          name: 'shop',
          collections: [
            { name: 'orders' },
            { name: 'customers' },
            { name: 'logs' },
          ],
        },
        { name: 'other', collections: [{ name: 'misc' }] },
      ],
    },
  ];
  const tagsByNamespace: Record<string, string[]> = {
    'shop.orders': ['text-ids', 'async'],
    'shop.customers': ['async'],
  };
  function listing(partial: Partial<HighlighterListing>): HighlighterListing {
    return {
      mode: 'all',
      feature: null,
      tagFilter: new Set(),
      isCollectionInterested: () => true,
      isDatabaseInterested: () => true,
      collectionTags: (ns) => tagsByNamespace[ns] ?? [],
      getCollectionDecoration: () => undefined,
      getDatabaseDecoration: () => undefined,
      ...partial,
    };
  }

  it('returns the input untouched without a feature or tag filter', function () {
    expect(filterConnectionsForHighlighter(connections, listing({}))).to.equal(
      connections
    );
  });

  it('keeps only collections carrying a selected tag and drops empty databases', function () {
    const result = filterConnectionsForHighlighter(
      connections,
      listing({ tagFilter: new Set(['text-ids']) })
    );
    expect(result[0].databases).to.deep.equal([
      { name: 'shop', collections: [{ name: 'orders' }] },
    ]);
    const any = filterConnectionsForHighlighter(
      connections,
      listing({ tagFilter: new Set(['text-ids', 'async']) })
    );
    expect(any[0].databases[0].collections.map((c) => c.name)).to.deep.equal([
      'orders',
      'customers',
    ]);
  });
});
