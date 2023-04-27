import type {
  GetPaginationParams,
  UpdateResParams,
  UpdateResReturn,
  Pagination,
} from './pagination.types.js';

export const getPagination = (params: GetPaginationParams): Pagination => {
  const updateRes = ({ res, totalHits }: UpdateResParams): UpdateResReturn => ({
    ...res,
    // set nbHits with default value of 0
    nbHits: totalHits ?? 0,
    // set nbPages to 0 if there are no hits
    ...(!totalHits && { nbPages: 0 }),
    // set nbPages to the number of pages if there are hits and hitsPerPage is set
    ...(totalHits &&
      res.hitsPerPage && {
        nbPages: Math.ceil(totalHits / res.hitsPerPage),
      }),
  });

  if (params.offset !== undefined) {
    return {
      res: {
        offset: params.offset,
        length: params.length ?? 20,
      },
      db: {
        offset: params.offset,
        limit: params.length ?? 20,
      },
      updateRes,
    };
  }

  const res = {
    page: params.page ?? 0,
    hitsPerPage: params.hitsPerPage ?? 20,
  };

  return {
    res,
    db: {
      offset: res.page * res.hitsPerPage,
      limit: res.hitsPerPage,
    },
    updateRes,
  };
};
