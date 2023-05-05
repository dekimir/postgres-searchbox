import format from 'pg-format';

export const getTableAndSort = (
  indexName: string
): {
  table: string;
  formattedSort: string;
} => {
  const [table, queryString] = indexName.split('?');
  // Validate table name
  if (!table?.length) throw new Error('Invalid index name');
  if (!queryString) return { table, formattedSort: '' };
  // make a searchParams object from query string
  // format each sort and join them with a comma
  const sort = new URLSearchParams(queryString)
    ?.get('sort')
    ?.split(',')
    ?.map((sort) => {
      const [column, ...rest] = sort.split(' ');
      if (!column?.length) return null;
      const returnArray = [format('%I', column)];
      const restString = rest.join(' ');
      // does reststring contain ASC or DESC using regex case insensitive
      if (/ASC/i.test(restString)) returnArray.push('ASC');
      if (/DESC/i.test(restString)) returnArray.push('DESC');
      if (/NULLS +FIRST/i.test(restString)) returnArray.push('NULLS FIRST');
      if (/NULLS +LAST/i.test(restString)) returnArray.push('NULLS LAST');
      return returnArray.join(' ');
    })
    .filter((s) => s)
    ?.join(', ');

  return {
    table,
    formattedSort: !sort?.length ? '' : `ORDER BY ${sort}`,
  };
};
