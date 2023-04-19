/**
 * PaginationRes
 * This is the shape of the data that instantsearch expects.
 * Docs: https://www.algolia.com/doc/guides/building-search-ui/ui-and-ux-patterns/pagination/react-hooks/
 * - all
 * - picked (because either offset/length or page/hitsPerPage is used)
 */

export interface PaginationRes {
  nbHits: number;
  nbPages?: number;
  offset?: number;
  length?: number;
  page?: number;
  hitsPerPage?: number;
  exhaustiveNbHits?: boolean;
}

export type PaginationResPicked = Pick<PaginationRes, 'offset' | 'length'> &
  Pick<PaginationRes, 'page' | 'hitsPerPage'>;

/**
 * UpdateRes
 * - params
 * - return
 */

export interface UpdateResParams {
  res: Pick<PaginationRes, 'offset' | 'length'> &
    Pick<PaginationRes, 'page' | 'hitsPerPage'>;
  totalHits: number;
}

export type UpdateResReturn = PaginationResPicked & {
  nbHits: number;
};

/**
 * GetPagination
 * - params
 * - partial
 * - return
 */

export interface GetPaginationParams {
  page?: number;
  hitsPerPage?: number;
  offset?: number;
  length?: number;
}

interface PaginationDbParams {
  offset: number;
  limit: number;
}

export interface Pagination {
  res: PaginationResPicked;
  db: PaginationDbParams;
  updateRes: ({ res, totalHits }: UpdateResParams) => UpdateResReturn;
}
