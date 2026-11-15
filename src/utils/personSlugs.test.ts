import { describe, expect, it } from 'vitest';
import { buildSlugMap, FLOW_DOCUMENT_SLUG } from './personSlugs';

describe('buildSlugMap', () => {
  it('never gives a person the flow document slug', () => {
    const slugs = buildSlugMap([{ id: 'abcd1234', name: 'Flow Doc' }]);
    expect(slugs.abcd1234).not.toBe(FLOW_DOCUMENT_SLUG);
    expect(slugs.abcd1234).toBe('flow-doc-abcd');
  });
});
