import React, { useCallback, useEffect, useState } from 'react';
import {
  Body,
  Button,
  TextArea,
  css,
  spacing,
} from '@mongodb-js/compass-components';

const containerStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[100],
});

const notesStyles = css({
  whiteSpace: 'pre-wrap',
});

const actionsStyles = css({
  display: 'flex',
  gap: spacing[100],
});

/**
 * Read view with an inline edit mode. Saving hands the text to the caller,
 * which writes it to the YAML; the editor closes once the new value arrives
 * through props so the UI never shows unsaved text as saved.
 */
export const NotesEditor: React.FunctionComponent<{
  notes: string | undefined;
  placeholder: string;
  label: string;
  onSave(notes: string): Promise<void>;
}> = ({ notes, placeholder, label, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) {
      setDraft(notes ?? '');
    }
  }, [notes, editing]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [draft, onSave]);

  if (!editing) {
    return (
      <div className={containerStyles}>
        {notes ? (
          <Body className={notesStyles}>{notes}</Body>
        ) : (
          <Body className={notesStyles} baseFontSize={13}>
            <em>{placeholder}</em>
          </Body>
        )}
        <div className={actionsStyles}>
          <Button size="xsmall" onClick={() => setEditing(true)}>
            {notes ? 'Edit notes' : 'Add notes'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={containerStyles}>
      <TextArea
        label={label}
        value={draft}
        onChange={(evt) => setDraft(evt.target.value)}
        rows={4}
      />
      <div className={actionsStyles}>
        <Button
          size="xsmall"
          variant="primary"
          disabled={saving}
          onClick={() => void save()}
        >
          Save
        </Button>
        <Button
          size="xsmall"
          disabled={saving}
          onClick={() => {
            setDraft(notes ?? '');
            setEditing(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
};
