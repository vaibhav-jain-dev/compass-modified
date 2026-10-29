import { expect } from 'chai';
import { sideBySideLineDiff } from './line-diff';

describe('sideBySideLineDiff', function () {
  it('marks every line as the same when the texts are equal', function () {
    const rows = sideBySideLineDiff(
      ['{', '  "a": 1', '}'],
      ['{', '  "a": 1', '}']
    );
    expect(
      rows.every((row) => row.left.kind === 'same' && row.right.kind === 'same')
    ).to.equal(true);
    expect(rows).to.have.length(3);
  });

  it('pairs a changed line on the same row', function () {
    const rows = sideBySideLineDiff(
      ['{', '  "a": 1', '}'],
      ['{', '  "a": 2', '}']
    );
    expect(rows).to.deep.equal([
      { left: { text: '{', kind: 'same' }, right: { text: '{', kind: 'same' } },
      {
        left: { text: '  "a": 1', kind: 'removed' },
        right: { text: '  "a": 2', kind: 'added' },
      },
      { left: { text: '}', kind: 'same' }, right: { text: '}', kind: 'same' } },
    ]);
  });

  it('leaves an empty cell on the side that has no line', function () {
    const rows = sideBySideLineDiff(['a', 'b', 'c'], ['a', 'c']);
    expect(rows).to.deep.equal([
      { left: { text: 'a', kind: 'same' }, right: { text: 'a', kind: 'same' } },
      {
        left: { text: 'b', kind: 'removed' },
        right: { text: '', kind: 'empty' },
      },
      { left: { text: 'c', kind: 'same' }, right: { text: 'c', kind: 'same' } },
    ]);
  });

  it('shows all lines as added when the left side is empty', function () {
    const rows = sideBySideLineDiff([], ['x', 'y']);
    expect(rows.map((row) => row.right)).to.deep.equal([
      { text: 'x', kind: 'added' },
      { text: 'y', kind: 'added' },
    ]);
    expect(rows.every((row) => row.left.kind === 'empty')).to.equal(true);
  });

  it('keeps both columns the same length', function () {
    const rows = sideBySideLineDiff(
      ['1', '2', '3', '4'],
      ['1', 'x', '4', '5', '6']
    );
    // 1 (same), 2 -> x and 3 removed (2 rows), 4 (same), 5 and 6 added (2 rows)
    expect(rows).to.have.length(6);
    expect(rows.filter((row) => row.left.kind === 'empty')).to.have.length(2);
  });
});
