import { expect } from 'chai';
import { isRunnableQuery, parseQueryFilter } from './queries';

describe('query helpers', function () {
  it('parses shell-syntax and extended JSON filters', function () {
    expect(
      parseQueryFilter({ filter: '{ "payment.status": "pending" }' })
    ).to.deep.equal({ 'payment.status': 'pending' });
    const parsed = parseQueryFilter({
      filter: '{ _id: ObjectId("6ac68e800418870342c8d0bd") }',
    });
    expect(String(parsed?._id)).to.equal('6ac68e800418870342c8d0bd');
  });

  it('is not runnable without a namespace or with a broken filter', function () {
    expect(isRunnableQuery({ title: 't', filter: '{ a: 1 }' })).to.equal(false);
    expect(
      isRunnableQuery({ title: 't', namespace: 'db.c', filter: '{ a: ' })
    ).to.equal(false);
    expect(
      isRunnableQuery({ title: 't', namespace: 'db.c', filter: '{ a: 1 }' })
    ).to.equal(true);
  });
});
