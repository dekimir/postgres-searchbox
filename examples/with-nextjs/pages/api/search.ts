import { getSearchHandler } from 'postgres-searchbox';
// During postgres-searchbox development this can be:
// import { searchHandler } from '../../../../package/build';

export default getSearchHandler([
  {
    tableName: 'postgres_searchbox_movies',
    validHighlightColumns: [
      'primarytitle',
      'originaltitle',
      'genres',
      'titletype',
    ],
    validReturnColumns: [
      'primarytitle',
      'originaltitle',
      'genres',
      'titletype',
      'startyear',
      'endyear',
      'runtime',
    ],
  },
]);
