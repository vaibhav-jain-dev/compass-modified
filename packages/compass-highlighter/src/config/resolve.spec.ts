import { expect } from 'chai';
import { normalizeFieldPath } from './paths';
import { resolveFeature } from './resolve';
import { parseHighlighterConfig } from './schema';

describe('highlighter config', function () {
  describe('normalizeFieldPath', function () {
    it('drops array markers so paths match what Compass reports', function () {
      expect(normalizeFieldPath('items[].sku')).to.equal('items.sku');
      expect(normalizeFieldPath('a.b[].c[].d')).to.equal('a.b.c.d');
      expect(normalizeFieldPath('payment.status')).to.equal('payment.status');
    });
  });

  describe('resolveFeature', function () {
    const config = parseHighlighterConfig({
      activeFeature: 'checkout',
      display: { listing: 'all' },
      styles: { hot: { color: 'red', icon: 'Bulb' } },
      features: [
        {
          id: 'checkout',
          display: { listing: 'only-interested' },
          collections: [
            {
              namespace: 'shop.orders',
              style: 'hot',
              fields: [
                {
                  path: 'items[].sku',
                  relatedTo: [{ namespace: 'shop.products', path: 'sku' }],
                },
                { path: 'total', style: 'nope' },
              ],
            },
            { namespace: 'shop.customers' },
          ],
        },
      ],
    });

    it('returns null for an unknown or empty feature id', function () {
      expect(resolveFeature(config, null)).to.equal(null);
      expect(resolveFeature(config, 'missing')).to.equal(null);
    });

    it('merges display options with feature overrides winning', function () {
      const feature = resolveFeature(config, 'checkout');
      expect(feature?.display).to.deep.equal({
        listing: 'only-interested',
        highlightFields: true,
        showTooltips: true,
        showBadges: true,
      });
    });

    it('indexes collections, databases and normalised field paths', function () {
      const feature = resolveFeature(config, 'checkout');
      expect([...feature!.databases]).to.deep.equal(['shop']);
      const orders = feature!.collectionsByNamespace.get('shop.orders')!;
      expect(orders.style).to.include({ name: 'hot', color: 'red' });
      expect(orders.fieldsByPath.get('items.sku')[0]?.relatedTo).to.deep.equal([
        { namespace: 'shop.products', path: 'sku' },
      ]);
    });

    it('falls back to a built-in style for unknown style names', function () {
      const feature = resolveFeature(config, 'checkout');
      const orders = feature!.collectionsByNamespace.get('shop.orders')!;
      expect(orders.fieldsByPath.get('total')[0]?.style.name).to.equal('nope');
      expect(orders.fieldsByPath.get('total')[0]?.style.color).to.be.a(
        'string'
      );
      // Fields without a style inherit the collection style.
      expect(orders.fieldsByPath.get('items.sku')[0]?.style.name).to.equal(
        'hot'
      );
    });
  });
});

describe('resolveFeature extras', function () {
  const config = parseHighlighterConfig({
    activeFeature: 'mig',
    codeBaseUrl: 'https://example.com/blob/abc/',
    features: [
      {
        id: 'mig',
        status: 'in session',
        collections: [
          {
            namespace: 'db.a',
            role: 'changes',
            fields: [{ path: 'x', label: 'family key' }],
          },
          { namespace: 'db.b', role: 'untouched' },
          { namespace: 'db.c', role: 'linked', style: 'relation' },
        ],
        queries: [{ title: 'q', namespace: 'db.a', filter: '{ x: 1 }' }],
        code: [{ path: 'svc/a.py', line: 12 }],
        checks: [{ text: 'do it' }, { text: 'done it', done: true }],
      },
    ],
  });

  it('derives styles from roles unless a style is given', function () {
    const feature = resolveFeature(config, 'mig')!;
    expect(feature.collectionsByNamespace.get('db.a')?.style.name).to.equal(
      'primary'
    );
    expect(feature.collectionsByNamespace.get('db.b')?.style.name).to.equal(
      'muted'
    );
    expect(feature.collectionsByNamespace.get('db.c')?.style.name).to.equal(
      'relation'
    );
    expect(
      feature.collectionsByNamespace.get('db.a')?.fieldsByPath.get('x')[0]
        ?.label
    ).to.equal('family key');
  });

  it('exposes status, queries, code, checks and the code base url', function () {
    const feature = resolveFeature(config, 'mig')!;
    expect(feature.status).to.equal('in session');
    expect(feature.queries).to.have.length(1);
    expect(feature.code[0]).to.include({ path: 'svc/a.py', line: 12 });
    expect(feature.codeBaseUrl).to.equal('https://example.com/blob/abc/');
    expect(feature.checks.map((c) => !!c.done)).to.deep.equal([false, true]);
  });
});
