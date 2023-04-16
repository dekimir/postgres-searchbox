// During postgres-searchbar development this can be:
import { getSearchHandler } from '../../../../package/build';
// Otherwize you should use:
// import { searchHandler } from 'postgres-searchbox';

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
