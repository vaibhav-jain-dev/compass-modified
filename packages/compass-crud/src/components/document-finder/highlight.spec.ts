import { expect } from 'chai';
import { findTextRanges } from './highlight';

describe('document finder highlight', function () {
  describe('findTextRanges', function () {
    it('finds every case-insensitive occurrence in the text', function () {
      const root = document.createElement('div');
      root.innerHTML = '<span>Groups</span><span>lines of groups</span>';

      const ranges = findTextRanges(root, 'groups');

      expect(ranges.map((range) => range.toString())).to.deep.equal([
        'Groups',
        'groups',
      ]);
    });

    it('returns nothing for an empty term', function () {
      const root = document.createElement('div');
      root.textContent = 'label';

      expect(findTextRanges(root, '')).to.deep.equal([]);
    });

    it('does not match text that is split across elements', function () {
      const root = document.createElement('div');
      root.innerHTML = '<span>Title</span><span>Company</span>';

      expect(findTextRanges(root, 'title company')).to.deep.equal([]);
    });
  });
});
