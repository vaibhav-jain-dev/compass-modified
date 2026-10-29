import { expect } from 'chai';
import { sideBySideLineDiff } from './line-diff';
import { findFoldRegions } from './json-folds';

describe('findFoldRegions', function () {
  it('finds the closing row of nested objects and arrays', function () {
    const rows = sideBySideLineDiff(
      ['{', '  "a": {', '    "b": 1', '  },', '  "c": [', '    1', '  ]', '}'],
      ['{', '  "a": {', '    "b": 1', '  },', '  "c": [', '    1', '  ]', '}']
    );
    expect([...findFoldRegions(rows)]).to.deep.equal([
      [0, 7],
      [1, 3],
      [4, 6],
    ]);
  });

  it('ignores single-line values', function () {
    const rows = sideBySideLineDiff(
      ['{', '  "a": []', '}'],
      ['{', '  "a": []', '}']
    );
    expect([...findFoldRegions(rows)]).to.deep.equal([[0, 2]]);
  });

  it('uses the side that has the block when the other side does not', function () {
    const rows = sideBySideLineDiff(['{', '  "a": {', '  }', '}'], ['{', '}']);
    expect(findFoldRegions(rows).get(1)).to.equal(
      rows.findIndex((row) => row.left.text === '  }')
    );
  });
});
