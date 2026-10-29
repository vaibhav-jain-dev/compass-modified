import React from 'react';
import { expect } from 'chai';
import sinon from 'sinon';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from '@mongodb-js/testing-library-compass';
import HadronDocument from 'hadron-document';
import { DocumentList } from '@mongodb-js/compass-components';
import { QueryCompareView } from './query-compare-view';
import { COMPARE_LIMITS } from './limits';

const doc = (fields: Record<string, unknown>) => new HadronDocument(fields);

describe('QueryCompareView', function () {
  const renderView = (
    overrides: Partial<React.ComponentProps<typeof QueryCompareView>> = {},
    wrap: (element: React.ReactElement) => React.ReactElement = (element) =>
      element
  ) => {
    const props = {
      ns: 'app.orders',
      docs: [
        doc({ _id: 1, status: 'open' }),
        doc({ _id: 2, status: 'closed' }),
      ],
      query: {},
      isFetching: false,
      listComparableDatabases: sinon.stub().resolves(['audit', 'config']),
      fetchComparisonDocuments: sinon
        .stub()
        .resolves([
          doc({ _id: 1, status: 'shipped' }),
          doc({ _id: 3, status: 'open' }),
        ]),
      onClose: sinon.spy(),
      decorateNamespace: (_namespace: string, children: React.ReactNode) =>
        children,
      ...overrides,
    };
    const { rerender } = render(wrap(<QueryCompareView {...props} />));
    return {
      props,
      rerender: (next: Partial<typeof props>) =>
        rerender(wrap(<QueryCompareView {...props} {...next} />)),
    };
  };

  const pickDatabase = async (name: string) => {
    userEvent.click(screen.getByRole('button', { name: 'Compare with' }));
    userEvent.click(await screen.findByRole('option', { name }));
  };

  it('asks for a database before anything is compared', async function () {
    renderView();

    expect(await screen.findByText(/pick a database on this connection/i)).to
      .exist;
  });

  it('lists databases, not collections, in the picker', async function () {
    renderView();

    userEvent.click(screen.getByRole('button', { name: 'Compare with' }));

    expect(await screen.findByRole('option', { name: 'audit' })).to.exist;
    expect(screen.getByRole('option', { name: 'config' })).to.exist;
  });

  it('runs the query on the same collection in the picked database and marks what changed', async function () {
    const { props } = renderView();

    await pickDatabase('audit');

    await waitFor(() => {
      expect(props.fetchComparisonDocuments).to.have.been.calledWith(
        'audit.orders'
      );
    });
    const documents = await screen.findAllByTestId('query-compare-document');
    expect(documents).to.have.length(3);

    const changed = within(documents[0]);
    expect(changed.getByText('changed')).to.exist;
    expect(changed.getByText('"status": "open"')).to.exist;
    expect(changed.getByText('"status": "shipped"')).to.exist;

    expect(within(documents[1]).getByText('only in app.orders')).to.exist;
    expect(within(documents[2]).getByText('only in audit.orders')).to.exist;
  });

  it('waits for the current collection to finish refreshing before diffing', async function () {
    const { rerender } = renderView({ isFetching: true });

    await pickDatabase('audit');

    expect(await screen.findByText('Running the query on audit.orders…')).to
      .exist;
    expect(screen.queryAllByTestId('query-compare-document')).to.have.length(0);

    rerender({ isFetching: false });

    expect(
      await screen.findAllByTestId('query-compare-document')
    ).to.have.length(3);
  });

  it('shows only the first documents and says how many were left out', async function () {
    const docs = Array.from(
      { length: COMPARE_LIMITS.maxDocuments + 5 },
      (_, i) => doc({ _id: i })
    );
    renderView({ docs, fetchComparisonDocuments: sinon.stub().resolves(docs) });

    await pickDatabase('audit');

    expect(
      await screen.findByText(
        `Showing the first ${COMPARE_LIMITS.maxDocuments} of ${docs.length} documents.`
      )
    ).to.exist;
    expect(screen.getAllByTestId('query-compare-document')).to.have.length(
      COMPARE_LIMITS.maxDocuments
    );
  });

  it('cuts off the rows of a very large document', async function () {
    const lines = COMPARE_LIMITS.maxRowsPerDocument + 100;
    const big = doc({
      _id: 1,
      values: Array.from({ length: lines }, (_, i) => i),
    });
    renderView({
      docs: [big],
      fetchComparisonDocuments: sinon.stub().resolves([big]),
    });

    await pickDatabase('audit');

    const [block] = await screen.findAllByTestId('query-compare-document');
    expect(within(block).getByText(/more lines not shown/)).to.exist;
  });

  it('shows the highlighter decoration of a field on both sides of the diff', async function () {
    const nested = doc({ _id: 1, address: { city: 'Pune' } });
    const decorations = {
      getFieldDecoration: (path: string) =>
        path === 'address.city' ? { chip: 'city of record' } : undefined,
    };
    const wrap = (element: React.ReactElement) => (
      <DocumentList.FieldDecorationsProvider value={decorations}>
        {element}
      </DocumentList.FieldDecorationsProvider>
    );
    renderView(
      {
        docs: [nested],
        fetchComparisonDocuments: sinon.stub().resolves([nested]),
        decorateNamespace: (_namespace: string, children: React.ReactNode) =>
          children,
      },
      wrap
    );

    await pickDatabase('audit');

    const [block] = await screen.findAllByTestId('query-compare-document');
    expect(within(block).getAllByText('city of record')).to.have.length(2);
  });

  it('collapses and expands an object in the diff', async function () {
    const nested = doc({ _id: 1, address: { city: 'Pune', zip: '411001' } });
    renderView({
      docs: [nested],
      fetchComparisonDocuments: sinon.stub().resolves([nested]),
    });

    await pickDatabase('audit');

    const [block] = await screen.findAllByTestId('query-compare-document');
    expect(within(block).getAllByText('"city": "Pune",')).to.have.length(2);

    userEvent.click(
      within(block).getAllByRole('button', { name: 'Collapse' })[1]
    );

    expect(within(block).queryAllByText('"city": "Pune",')).to.have.length(0);
    expect(within(block).getByText(/lines collapsed/)).to.exist;

    userEvent.click(within(block).getByRole('button', { name: 'Expand' }));

    expect(within(block).getAllByText('"city": "Pune",')).to.have.length(2);
  });

  it('shows the error when the comparison query fails', async function () {
    renderView({
      fetchComparisonDocuments: sinon.stub().rejects(new Error('not allowed')),
    });

    await pickDatabase('audit');

    expect(await screen.findByTestId('query-compare-error')).to.have.text(
      'not allowed'
    );
  });
});
