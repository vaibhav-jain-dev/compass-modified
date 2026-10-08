import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import HadronDocument from 'hadron-document';
import { EJSON } from 'bson';
import {
  Banner,
  Body,
  Button,
  DocumentList,
  IconButton,
  Icon,
  InlineCode,
  KeylineCard,
  SpinLoaderWithLabel,
  css,
  cx,
  palette,
  spacing,
  useDarkMode,
} from '@mongodb-js/compass-components';
import { useConnectionInfo } from '@mongodb-js/compass-connections/provider';
import { useOpenWorkspace } from '@mongodb-js/compass-workspaces/provider';
import { useHighlighterDispatch } from '../stores/context';
import { fetchRelatedDocuments, RELATED_DOCUMENTS_LIMIT } from '../stores';

/** Where a link was followed from, shown in the panel so panels can be told apart. */
export type RelatedOrigin = {
  namespace: string;
  /** concrete path of the clicked field, e.g. occurrences.6a96….buckets.field_ids */
  path: string;
  /** the id or key the link was built from, as text */
  subject: string;
};

export type RelatedFrame = {
  namespace: string;
  filter: Record<string, unknown>;
  title: string;
  origin: RelatedOrigin;
  /** Other targets the same field maps to, offered as buttons in the panel */
  alternatives?: Array<Omit<RelatedFrame, 'alternatives' | 'origin'>>;
};

type Panel = RelatedFrame & {
  id: number;
  x: number;
  y: number;
  z: number;
};

type RelatedNavigation = {
  /** Open a new panel; `fromPanel` cascades it next to its parent panel. */
  push(frame: RelatedFrame): void;
};

const RelatedNavigationContext = createContext<RelatedNavigation | null>(null);
/** Id of the panel a nested decorations provider renders inside, if any */
const PanelContext = createContext<number | null>(null);

export function useRelatedNavigation(): RelatedNavigation | null {
  return useContext(RelatedNavigationContext);
}

const PANEL_WIDTH = 760;
const CASCADE = 36;
const BASE_Z = 10_100;

const panelStyles = css({
  position: 'fixed',
  width: `min(${PANEL_WIDTH}px, 92vw)`,
  maxHeight: '75vh',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: spacing[300],
  boxShadow: '0 12px 40px rgba(0, 30, 43, 0.35)',
  border: `1px solid ${palette.gray.light2}`,
  background: palette.white,
  overflow: 'hidden',
});

const panelDarkStyles = css({
  background: palette.black,
  border: `1px solid ${palette.gray.dark2}`,
});

const headerStyles = css({
  display: 'flex',
  alignItems: 'stretch',
  gap: spacing[200],
  padding: `${spacing[200]}px ${spacing[300]}px ${spacing[200]}px ${spacing[200]}px`,
  borderBottom: `1px solid ${palette.gray.light2}`,
  background: palette.gray.light3,
});

const headerDarkStyles = css({
  borderBottomColor: palette.gray.dark2,
  background: palette.gray.dark4,
});

// Only the grip drags, so the rest of the header stays selectable for copying.
const gripStyles = css({
  display: 'flex',
  alignItems: 'center',
  padding: `0 ${spacing[100]}px`,
  borderRadius: spacing[100],
  cursor: 'grab',
  userSelect: 'none',
  color: palette.gray.base,
  '&:hover': { background: palette.gray.light2, color: palette.gray.dark1 },
  '&:active': { cursor: 'grabbing' },
});

const headerTextStyles = css({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[100],
  userSelect: 'text',
  cursor: 'text',
});

// `origin → target(id)` in a monospace line that wraps instead of hiding,
// so it can be read and copied whole.
const breadcrumbStyles = css({
  fontFamily: 'Source Code Pro, Menlo, Consolas, monospace',
  fontSize: '13px',
  lineHeight: '20px',
  fontWeight: 600,
  wordBreak: 'break-all',
  color: palette.gray.dark3,
});

const breadcrumbDarkStyles = css({
  color: palette.gray.light2,
});

const breadcrumbArrowStyles = css({
  margin: `0 ${spacing[150]}px`,
  fontWeight: 400,
  color: palette.green.dark2,
});

const detailStyles = css({
  fontSize: '12px',
  lineHeight: '16px',
  wordBreak: 'break-all',
  color: palette.gray.dark1,
});

const detailDarkStyles = css({
  color: palette.gray.light1,
});

const headerActionsStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[100],
  flexShrink: 0,
});

const bodyStyles = css({
  overflow: 'auto',
  padding: spacing[300],
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[300],
});

const docCardStyles = css({
  padding: spacing[200],
});

const altRowStyles = css({
  display: 'flex',
  gap: spacing[200],
  flexWrap: 'wrap',
  alignItems: 'center',
});

function filterToShell(filter: Record<string, unknown>): string {
  return EJSON.stringify(filter, { relaxed: false });
}

function collectionName(namespace: string): string {
  const dot = namespace.indexOf('.');
  return dot === -1 ? namespace : namespace.slice(dot + 1);
}

function useDrag(
  panel: Panel,
  onMove: (id: number, x: number, y: number) => void,
  onFocus: (id: number) => void
) {
  const onMouseDown = useCallback(
    (evt: React.MouseEvent<HTMLDivElement>) => {
      // buttons inside the header keep their own click behaviour
      if (evt.button !== 0 || (evt.target as HTMLElement).closest('button')) {
        return;
      }
      evt.preventDefault();
      onFocus(panel.id);
      const dx = evt.clientX - panel.x;
      const dy = evt.clientY - panel.y;
      // Window-level listeners keep the drag alive when the pointer leaves
      // the header or moves faster than the panel re-renders.
      const move = (e: MouseEvent) => {
        const x = Math.max(
          0,
          Math.min(window.innerWidth - 120, e.clientX - dx)
        );
        const y = Math.max(
          0,
          Math.min(window.innerHeight - 60, e.clientY - dy)
        );
        onMove(panel.id, x, y);
      };
      const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    },
    [panel.id, panel.x, panel.y, onMove, onFocus]
  );
  return { onMouseDown };
}

const RelatedPanel: React.FunctionComponent<{
  panel: Panel;
  onClose(id: number): void;
  onFocus(id: number): void;
  onMove(id: number, x: number, y: number): void;
  onReplace(id: number, frame: RelatedFrame): void;
  renderDocuments(frame: RelatedFrame, docs: HadronDocument[]): React.ReactNode;
}> = ({ panel, onClose, onFocus, onMove, onReplace, renderDocuments }) => {
  const darkMode = useDarkMode();
  const connectionInfo = useConnectionInfo();
  const dispatch = useHighlighterDispatch();
  const { openCollectionWorkspace } = useOpenWorkspace();
  const drag = useDrag(panel, onMove, onFocus);
  const [state, setState] = useState<{
    status: 'loading' | 'ready' | 'error';
    docs: HadronDocument[];
    error?: string;
  }>({ status: 'loading', docs: [] });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', docs: [] });
    dispatch(
      fetchRelatedDocuments(connectionInfo.id, panel.namespace, panel.filter)
    ).then(
      (docs) => {
        if (!cancelled) {
          setState({
            status: 'ready',
            docs: docs.map((d) => new HadronDocument(d)),
          });
        }
      },
      (err: Error) => {
        if (!cancelled) {
          setState({ status: 'error', docs: [], error: err.message });
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [panel.namespace, panel.filter, dispatch, connectionInfo.id]);

  const openInNewTab = useCallback(() => {
    openCollectionWorkspace(connectionInfo.id, panel.namespace, {
      newTab: true,
      initialQuery: panel.filter,
    });
  }, [
    openCollectionWorkspace,
    connectionInfo.id,
    panel.namespace,
    panel.filter,
  ]);

  return createPortal(
    <div
      className={cx(panelStyles, darkMode && panelDarkStyles)}
      style={{ left: panel.x, top: panel.y, zIndex: panel.z }}
      data-testid="highlighter-related-panel"
      onMouseDownCapture={() => onFocus(panel.id)}
      role="dialog"
      aria-label={panel.title}
    >
      <div
        className={cx(headerStyles, darkMode && headerDarkStyles)}
        data-testid="highlighter-related-panel-header"
      >
        <div
          className={gripStyles}
          onMouseDown={drag.onMouseDown}
          title="Drag to move"
          data-testid="highlighter-related-panel-grip"
        >
          <Icon glyph="Drag" />
        </div>
        <div className={headerTextStyles}>
          <span
            className={cx(breadcrumbStyles, darkMode && breadcrumbDarkStyles)}
            data-testid="highlighter-related-panel-breadcrumb"
          >
            {collectionName(panel.origin.namespace)}.{panel.origin.path}
            <span className={breadcrumbArrowStyles}>→</span>
            {collectionName(panel.namespace)}({panel.origin.subject})
          </span>
          <span className={cx(detailStyles, darkMode && detailDarkStyles)}>
            {panel.title} · {panel.namespace} · {filterToShell(panel.filter)}
          </span>
        </div>
        <div className={headerActionsStyles}>
          <Button size="xsmall" variant="primary" onClick={openInNewTab}>
            Open in new tab
          </Button>
          <IconButton aria-label="Close" onClick={() => onClose(panel.id)}>
            <Icon glyph="X" />
          </IconButton>
        </div>
      </div>
      <div className={bodyStyles}>
        {panel.alternatives && panel.alternatives.length > 0 && (
          <div className={altRowStyles}>
            <Body>Also maps to:</Body>
            {panel.alternatives.map((alt) => (
              <Button
                key={`${alt.namespace}:${alt.title}`}
                size="xsmall"
                onClick={() =>
                  onReplace(panel.id, {
                    ...alt,
                    origin: panel.origin,
                    alternatives: [
                      {
                        namespace: panel.namespace,
                        filter: panel.filter,
                        title: panel.title,
                      },
                      ...(panel.alternatives ?? []).filter((a) => a !== alt),
                    ],
                  })
                }
              >
                {alt.title}
              </Button>
            ))}
          </div>
        )}
        {state.status === 'loading' && (
          <SpinLoaderWithLabel progressText="Loading related documents…" />
        )}
        {state.status === 'error' && (
          <Banner variant="danger">{state.error}</Banner>
        )}
        {state.status === 'ready' && state.docs.length === 0 && (
          <Banner variant="info">
            No document in <InlineCode>{panel.namespace}</InlineCode> matches.
          </Banner>
        )}
        {state.status === 'ready' && state.docs.length > 0 && (
          <>
            <Body>
              {state.docs.length === RELATED_DOCUMENTS_LIMIT
                ? `First ${RELATED_DOCUMENTS_LIMIT} matching documents (open in a new tab to see all)`
                : `${state.docs.length} matching document${
                    state.docs.length === 1 ? '' : 's'
                  }`}
            </Body>
            <PanelContext.Provider value={panel.id}>
              {renderDocuments(panel, state.docs)}
            </PanelContext.Provider>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

export const RelatedDocumentCard: React.FunctionComponent<{
  doc: HadronDocument;
}> = ({ doc }) => {
  // A panel exists to follow links, so show every field instead of hiding
  // the tail behind "show more" where the mapped ids usually are.
  useMemo(() => doc.setMaxVisibleElementsCount(1000), [doc]);
  return (
    <KeylineCard className={docCardStyles}>
      <DocumentList.Document value={doc} editable={false} />
    </KeylineCard>
  );
};

/**
 * Owns the floating related-documents panels of a collection tab. Panels are
 * independent windows: drag them by the header, keep several open to compare,
 * close each on its own. A link followed inside a panel opens a new panel
 * cascaded next to it.
 */
export const RelatedNavigationProvider: React.FunctionComponent<{
  renderDocuments(frame: RelatedFrame, docs: HadronDocument[]): React.ReactNode;
  children?: React.ReactNode;
}> = ({ renderDocuments, children }) => {
  const [panels, setPanels] = useState<Panel[]>([]);
  const nextId = useRef(1);
  const nextZ = useRef(BASE_Z);

  const push = useCallback((frame: RelatedFrame, fromPanel?: number | null) => {
    setPanels((prev) => {
      const parent = prev.find((p) => p.id === fromPanel);
      const count = prev.length;
      const x = parent
        ? Math.min(parent.x + CASCADE, window.innerWidth - PANEL_WIDTH / 2)
        : Math.max(
            24,
            (window.innerWidth - PANEL_WIDTH) / 2 + (count % 5) * CASCADE
          );
      const y = parent
        ? Math.min(parent.y + CASCADE, window.innerHeight - 200)
        : 72 + (count % 5) * CASCADE;
      return [
        ...prev,
        { ...frame, id: nextId.current++, x, y, z: nextZ.current++ },
      ];
    });
  }, []);

  const value = useMemo(() => ({ push }), [push]);
  const onClose = useCallback((id: number) => {
    setPanels((prev) => prev.filter((p) => p.id !== id));
  }, []);
  const onFocus = useCallback((id: number) => {
    setPanels((prev) => {
      const top = Math.max(...prev.map((p) => p.z));
      return prev.map((p) =>
        p.id === id && p.z !== top ? { ...p, z: nextZ.current++ } : p
      );
    });
  }, []);
  const onMove = useCallback((id: number, x: number, y: number) => {
    setPanels((prev) => prev.map((p) => (p.id === id ? { ...p, x, y } : p)));
  }, []);
  const onReplace = useCallback((id: number, frame: RelatedFrame) => {
    setPanels((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...frame, id } : p))
    );
  }, []);

  return (
    <RelatedNavigationContext.Provider value={value}>
      {children}
      {panels.map((panel) => (
        <RelatedPanel
          key={panel.id}
          panel={panel}
          onClose={onClose}
          onFocus={onFocus}
          onMove={onMove}
          onReplace={onReplace}
          renderDocuments={renderDocuments}
        />
      ))}
    </RelatedNavigationContext.Provider>
  );
};

/**
 * Navigation handle for decorations rendered inside a panel: new panels
 * cascade from that panel.
 */
export function useRelatedNavigationFromPanel(): RelatedNavigation | null {
  const navigation = useContext(RelatedNavigationContext);
  const panelId = useContext(PanelContext);
  return useMemo(() => {
    if (!navigation) {
      return null;
    }
    return {
      push: (frame: RelatedFrame) =>
        (navigation.push as (f: RelatedFrame, from?: number | null) => void)(
          frame,
          panelId
        ),
    };
  }, [navigation, panelId]);
}
