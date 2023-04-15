import { getPagination } from '@/lib/pagination.js';

/**
 * Test pagination
 */

describe('pagination', () => {
  it('should handle offset and length', async () => {
    const pagination = getPagination({ offset: 0, length: 20 });

    expect(pagination).toEqual({
      res: { offset: 0, length: 20 },
      db: { offset: 0, limit: 20 },
      updateRes: expect.any(Function),
    });
  });

  it('should handle page and hitsPerPage', async () => {
    const pagination = getPagination({ page: 0, hitsPerPage: 20 });

    expect(pagination).toEqual({
      res: { page: 0, hitsPerPage: 20 },
      db: { offset: 0, limit: 20 },
      updateRes: expect.any(Function),
    });
  });

  it('should handle page and hitsPerPage with default values', async () => {
    const pagination = getPagination({});

    expect(pagination).toEqual({
      res: { page: 0, hitsPerPage: 20 },
      db: { offset: 0, limit: 20 },
      updateRes: expect.any(Function),
    });
  });

  it('should handle offset and default length', async () => {
    const pagination = getPagination({ offset: 0 });

    expect(pagination).toEqual({
      res: { offset: 0, length: 20 },
      db: { offset: 0, limit: 20 },
      updateRes: expect.any(Function),
    });
  });

  it('should update res', async () => {
    const { updateRes } = getPagination({});

    // Without hitsPerPage
    expect(updateRes({ res: {}, totalHits: 20 })).toEqual({
      nbHits: 20,
    });

    // With hitsPerPage
    expect(updateRes({ res: { hitsPerPage: 10 }, totalHits: 20 })).toEqual({
      hitsPerPage: 10,
      nbHits: 20,
      nbPages: 2,
    });
  });
});
