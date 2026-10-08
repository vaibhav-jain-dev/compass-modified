import { expect } from 'chai';
import { indexMappings, parseMappingsFile } from './mappings';

describe('mappings', function () {
  it('indexes by namespace and normalized path', function () {
    const file = parseMappingsFile({
      database: 'devlms',
      mappings: [
        { from: 'fields.product_id', to: 'products._id', label: 'Product' },
        { from: 'fields.instance_fields[]', to: 'fields._id', as: 'objectId' },
        {
          from: 'templates.sections.groups.lines.fields.variables.field_id',
          to: 'fields',
        },
      ],
    });
    const index = indexMappings(file);
    expect(index.get('devlms.fields')?.get('product_id')).to.deep.equal([
      {
        namespace: 'devlms.products',
        path: '_id',
        label: 'Product',
        as: 'auto',
        use: 'value',
        notes: undefined,
      },
    ]);
    expect(index.get('devlms.fields')?.get('instance_fields')?.[0]).to.include({
      namespace: 'devlms.fields',
      as: 'objectId',
    });
    expect(
      index
        .get('devlms.templates')
        ?.get('sections.groups.lines.fields.variables.field_id')?.[0]
    ).to.include({ namespace: 'devlms.fields', path: '_id' });
  });

  it('supports wildcards and key-based links', function () {
    const index = indexMappings(
      parseMappingsFile({
        database: 'devlms',
        mappings: [
          {
            from: 'loan_field_occurrences.occurrences.*',
            to: 'fields._id',
            use: 'key',
          },
          {
            from: 'loan_field_occurrences.occurrences.*.buckets.field_ids[]',
            to: 'fields._id',
          },
        ],
      })
    );
    const byPath = index.get('devlms.loan_field_occurrences')!;
    expect(byPath.get('occurrences.6a96a4a1')?.[0]).to.include({ use: 'key' });
    expect(
      byPath.get('occurrences.6a96a4a1.buckets.field_ids')?.[0]
    ).to.include({ use: 'value' });
    expect(byPath.get('occurrences.6a96a4a1.max_count')).to.deep.equal([]);
  });
});
