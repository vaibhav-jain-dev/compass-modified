import { expect } from 'chai';
import { matchFieldPath, normalizeFieldPath, PathIndex } from './paths';

describe('field path matching', function () {
  it('matches exact paths and ignores array markers', function () {
    expect(
      matchFieldPath('items.sku', normalizeFieldPath('items[].sku'))
    ).to.equal(true);
    expect(matchFieldPath('items.sku', 'items')).to.equal(false);
  });

  it('matches one dynamic segment with *', function () {
    expect(
      matchFieldPath(
        'occurrences.*.buckets.field_ids',
        'occurrences.6a96a4a1.buckets.field_ids'
      )
    ).to.equal(true);
    expect(matchFieldPath('occurrences.*', 'occurrences.6a96a4a1')).to.equal(
      true
    );
    expect(
      matchFieldPath('occurrences.*', 'occurrences.6a96a4a1.max_count')
    ).to.equal(false);
  });

  it('matches any depth with **', function () {
    expect(
      matchFieldPath(
        '**.field_id',
        'sections.groups.lines.fields.variables.field_id'
      )
    ).to.equal(true);
    expect(matchFieldPath('**.field_id', 'field_id')).to.equal(true);
    expect(matchFieldPath('sections.**', 'sections')).to.equal(true);
    expect(matchFieldPath('a.**.z', 'a.b.c.z')).to.equal(true);
    expect(matchFieldPath('a.**.z', 'a.b.c')).to.equal(false);
  });

  it('prefers exact entries over wildcard entries in the index', function () {
    const index = new PathIndex<string>();
    index.add('occurrences.*.max_count', 'generic');
    index.add('occurrences.special.max_count', 'specific');
    expect(index.get('occurrences.special.max_count')).to.deep.equal([
      'specific',
    ]);
    expect(index.get('occurrences.other.max_count')).to.deep.equal(['generic']);
    expect(index.get('nope')).to.deep.equal([]);
  });
});
