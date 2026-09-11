import { describe, expect, it } from 'vitest';
import { parseJSON } from './importExport';

describe('importExport.parseJSON', () => {
  it('returns null for invalid JSON', () => {
    expect(parseJSON('not-json')).toBeNull();
  });

  it('returns null for non-object JSON', () => {
    expect(parseJSON('[]')).toBeNull();
    expect(parseJSON('"x"')).toBeNull();
  });

  it('parses an object without logging contents', () => {
    const parsed = parseJSON('{"judges":[],"entrants":[]}');
    expect(parsed).toEqual({ judges: [], entrants: [] });
  });
});
