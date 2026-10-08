import { expect } from 'chai';
import { ObjectId } from 'bson';
import { buildLinkFilter } from './link-filter';

describe('buildLinkFilter', function () {
  const hex = '6ac68f49b9a176a2f747899a';

  it('matches both id shapes by default', function () {
    const filter = buildLinkFilter('_id', new ObjectId(hex)) as {
      _id: { $in: unknown[] };
    };
    expect(filter._id.$in).to.have.length(2);
    expect(String(filter._id.$in[0])).to.equal(hex);
    expect(filter._id.$in[1]).to.equal(hex);
    const fromText = buildLinkFilter('_id', hex) as { _id: { $in: unknown[] } };
    expect(fromText._id.$in[0]).to.equal(hex);
    expect(fromText._id.$in[1]).to.be.instanceOf(ObjectId);
  });

  it('respects an explicit shape', function () {
    expect(buildLinkFilter('_id', hex, 'string')).to.deep.equal({ _id: hex });
    const asOid = buildLinkFilter('_id', hex, 'objectId') as { _id: ObjectId };
    expect(asOid._id).to.be.instanceOf(ObjectId);
  });

  it('matches any element of an array value', function () {
    const filter = buildLinkFilter(
      '_id',
      [hex, '6ac68fffb9a176a2f74789c6'],
      'string'
    ) as {
      _id: { $in: unknown[] };
    };
    expect(filter._id.$in).to.deep.equal([hex, '6ac68fffb9a176a2f74789c6']);
  });

  it('passes plain values through', function () {
    expect(buildLinkFilter('code', 'ABC')).to.deep.equal({ code: 'ABC' });
    expect(buildLinkFilter('n', 5)).to.deep.equal({ n: 5 });
  });
});
