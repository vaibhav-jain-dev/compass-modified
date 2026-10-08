import { expect } from 'chai';
import { readFileSync } from 'fs';
import path from 'path';
import { EXAMPLE_CONFIG_YAML } from './example-config';
import { parseHighlighterConfig } from './schema';
import { parseDocument } from 'yaml';

describe('example config', function () {
  it('matches extra-features/highlighter.example.yaml', function () {
    const repoExample = readFileSync(
      path.resolve(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        'extra-features',
        'highlighter.example.yaml'
      ),
      'utf8'
    );
    expect(EXAMPLE_CONFIG_YAML).to.equal(repoExample);
  });

  it('is valid against the schema', function () {
    const config = parseHighlighterConfig(
      parseDocument(EXAMPLE_CONFIG_YAML).toJS()
    );
    expect(config.activeFeature).to.equal('order-checkout');
    expect(config.features.map((f) => f.id)).to.deep.equal([
      'order-checkout',
      'user-onboarding',
    ]);
  });
});
