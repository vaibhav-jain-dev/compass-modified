import { expect } from 'chai';
import { linePaths } from './json-paths';

describe('linePaths', function () {
  it('gives every key the dotted path of its parents', function () {
    const paths = linePaths([
      '{',
      '  "_id": {',
      '    "$oid": "1"',
      '  },',
      '  "address": {',
      '    "city": "Pune"',
      '  }',
      '}',
    ]).map((field) => field.path);
    expect(paths).to.deep.equal([
      '',
      '_id',
      '_id.$oid',
      '',
      'address',
      'address.city',
      '',
      '',
    ]);
  });

  it('skips array indexes, like the highlighter does', function () {
    const paths = linePaths([
      '{',
      '  "items": [',
      '    {',
      '      "sku": "A"',
      '    }',
      '  ]',
      '}',
    ]).map((field) => field.path);
    expect(paths[3]).to.equal('items.sku');
  });

  it('reports the key on lines that have one', function () {
    const [, line] = linePaths(['{', '  "status": "open"', '}']);
    expect(line).to.deep.equal({ path: 'status', key: 'status' });
  });
});
