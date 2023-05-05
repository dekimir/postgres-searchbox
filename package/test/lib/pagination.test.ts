import { getPagination } from '@/lib/pagination.js';
import { defaults } from '@/constants.js';

/**
 * Test pagination
 */

describe('pagination', () => {
  it('should handle offset and length', async () => {
    const params = {
      offset: 40,
      length: 20,
      hitsPerPage: 40, // a default that should just be returned but not acted upon
    };

    const pagination = getPagination(params);

    expect(pagination).toEqual({
      res: { ...params, page: 1 },
      db: { offset: 40, limit: 20 },
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
    const pagination = getPagination(defaults.settings);

    expect(pagination).toEqual({
      res: { page: 0, hitsPerPage: defaults.settings.hitsPerPage },
      db: { offset: 0, limit: defaults.settings.hitsPerPage },
      updateRes: expect.any(Function),
    });
  });

  it('should handle offset and default length', async () => {
    const pagination = getPagination({ ...defaults.settings, offset: 0 });

    expect(pagination).toEqual({
      res: {
        offset: 0,
        length: 20,
        page: 0,
        hitsPerPage: defaults.settings.hitsPerPage,
      },
      db: { offset: 0, limit: 20 },
      updateRes: expect.any(Function),
    });
  });

  it('should update res', async () => {
    const { res, updateRes } = getPagination(defaults.settings);

    expect(updateRes({ res, totalHits: 20 })).toEqual({
      page: 0,
      nbHits: 20,
      nbPages: 1,
      hitsPerPage: defaults.settings.hitsPerPage,
    });

    // With hitsPerPage 10
    expect(
      updateRes({ res: { ...res, hitsPerPage: 10 }, totalHits: 20 })
    ).toEqual({
      page: 0,
      hitsPerPage: 10,
      nbHits: 20,
      nbPages: 2,
    });
  });
});
