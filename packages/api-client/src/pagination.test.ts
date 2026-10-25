import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { offsetPagination } from './pagination.ts';

const page = (offset: number, limit: number, hasNextPage: boolean) => ({
  data: [],
  meta: { offset, limit, total: 45, hasNextPage },
});

describe('offsetPagination', () => {
  it('starts at offset 0', () => {
    assert.equal(offsetPagination.initialPageParam, 0);
  });

  it('asks for the next offset while the API reports a next page', () => {
    assert.equal(offsetPagination.getNextPageParam(page(20, 20, true)), 40);
  });

  it('stops when the API reports no next page', () => {
    assert.equal(
      offsetPagination.getNextPageParam(page(40, 20, false)),
      undefined,
    );
  });
});
