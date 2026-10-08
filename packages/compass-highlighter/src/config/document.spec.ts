import { expect } from 'chai';
import { parseConfigText, setInConfigText } from './document';

describe('config document helpers', function () {
  it('preserves comments when setting nested values', function () {
    const text = `# top comment
version: 1
activeFeature: a # trailing
features:
  - id: a
    # keep me
    collections:
      - namespace: db.coll
`;
    let next = setInConfigText(
      text,
      ['features', 0, 'collections', 0, 'notes'],
      'hello'
    );
    next = setInConfigText(next, ['activeFeature'], 'b');
    expect(next).to.include('# top comment');
    expect(next).to.include('# keep me');
    expect(next).to.include('activeFeature: b # trailing');
    expect(next).to.include('notes: hello');
    expect(parseConfigText(next)).to.deep.equal({
      version: 1,
      activeFeature: 'b',
      features: [
        { id: 'a', collections: [{ namespace: 'db.coll', notes: 'hello' }] },
      ],
    });
  });

  it('creates intermediate maps for a brand new key path', function () {
    const next = setInConfigText('version: 1\n', ['display', 'listing'], 'all');
    expect(parseConfigText(next)).to.deep.equal({
      version: 1,
      display: { listing: 'all' },
    });
  });

  it('surfaces YAML syntax errors', function () {
    expect(() => parseConfigText('a: b: c\n')).to.throw();
  });
});
