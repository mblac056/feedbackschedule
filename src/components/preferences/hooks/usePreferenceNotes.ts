import { useState } from 'react';
import { getPreferenceNotes, savePreferenceNotes } from '../../../utils/localStorage';

export function usePreferenceNotes() {
  const [preferenceNotes, setPreferenceNotes] = useState(() => getPreferenceNotes());

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextNotes = e.target.value;
    setPreferenceNotes(nextNotes);
    savePreferenceNotes(nextNotes);
  };

  return { preferenceNotes, handleNotesChange };
}
