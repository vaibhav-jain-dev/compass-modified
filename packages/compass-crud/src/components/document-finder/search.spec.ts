import { expect } from 'chai';
import HadronDocument from 'hadron-document';
import {
  buildFinderEntries,
  searchFinderEntries,
  suggestFinderPaths,
} from './search';
import { revealElement } from './reveal';

const loanDocument = () =>
  new HadronDocument({
    sections: [
      {
        groups: [
          {
            lines: [{ label: 'Title Company Name' }, { label: 'Lender' }],
          },
        ],
      },
    ],
  });

describe('document finder search', function () {
  describe('buildFinderEntries', function () {
    it('uses the same indexed path format as "Copy path & value"', function () {
      const entries = buildFinderEntries([loanDocument()]);
      const paths = entries.map((entry) => entry.path);

      expect(paths).to.include('sections');
      expect(paths).to.include('sections[0].groups');
      expect(paths).to.include('sections[0].groups[0].lines[1].label');
    });

    it('records the document index of each entry', function () {
      const entries = buildFinderEntries([
        new HadronDocument({ a: 1 }),
        new HadronDocument({ b: 2 }),
      ]);

      expect(entries.find((entry) => entry.path === 'b')?.docIndex).to.equal(1);
    });
  });

  describe('searchFinderEntries', function () {
    it('finds a field by its full path with array indexes', function () {
      const entries = buildFinderEntries([loanDocument()]);
      const matches = searchFinderEntries(
        entries,
        'sections[0].groups[0].lines[0].label'
      );

      expect(matches).to.have.length(1);
      expect(matches[0].kind).to.equal('key');
      expect(matches[0].entry.path).to.equal(
        'sections[0].groups[0].lines[0].label'
      );
    });

    it('finds a parent path together with the fields under it', function () {
      const entries = buildFinderEntries([loanDocument()]);
      const paths = searchFinderEntries(entries, 'sections[0].groups').map(
        (match) => match.entry.path
      );

      expect(paths).to.deep.equal([
        'sections[0].groups',
        'sections[0].groups[0]',
        'sections[0].groups[0].lines',
        'sections[0].groups[0].lines[0]',
        'sections[0].groups[0].lines[0].label',
        'sections[0].groups[0].lines[1]',
        'sections[0].groups[0].lines[1].label',
      ]);
    });

    it('finds leaf values, case-insensitively', function () {
      const entries = buildFinderEntries([loanDocument()]);
      const matches = searchFinderEntries(entries, 'title company');

      expect(matches).to.have.length(1);
      expect(matches[0].kind).to.equal('value');
      expect(matches[0].entry.path).to.equal(
        'sections[0].groups[0].lines[0].label'
      );
    });

    it('returns no matches for a blank query', function () {
      const entries = buildFinderEntries([loanDocument()]);

      expect(searchFinderEntries(entries, '   ')).to.deep.equal([]);
    });
  });

  describe('suggestFinderPaths', function () {
    it('lists paths starting with the query first and never the exact query', function () {
      const entries = buildFinderEntries([loanDocument()]);
      const suggestions = suggestFinderPaths(
        entries,
        'sections[0].groups[0].lines[0]'
      );

      expect(suggestions[0]).to.equal('sections[0].groups[0].lines[0].label');
      expect(suggestions).to.not.include('sections[0].groups[0].lines[0]');
    });

    it('offers each path once even when it occurs in several documents', function () {
      const entries = buildFinderEntries([loanDocument(), loanDocument()]);
      const suggestions = suggestFinderPaths(entries, 'lines');

      expect(new Set(suggestions).size).to.equal(suggestions.length);
    });

    it('returns no suggestions for a blank query', function () {
      const entries = buildFinderEntries([loanDocument()]);

      expect(suggestFinderPaths(entries, '')).to.deep.equal([]);
    });
  });

  describe('revealElement', function () {
    it('expands the ancestors and shows enough children to render a deep match', function () {
      const fields = Object.fromEntries(
        Array.from({ length: 30 }, (_, index) => [`field${index}`, index])
      );
      const doc = new HadronDocument({ wrapper: { ...fields, target: 'x' } });
      const target = doc.get('wrapper')!.get('target')!;
      const wrapper = doc.get('wrapper')!;

      expect(wrapper.getVisibleElements()).to.not.include(target);

      revealElement(target);

      expect(wrapper.expanded).to.equal(true);
      expect(wrapper.getVisibleElements()).to.include(target);
    });
  });
});
