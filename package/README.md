`postgres-searchbox` adds full text search to your existing Postgres tables, using Postgres itself as a (good
enough) search engine. You don't need an external search index (such as Elastic), which is often tedious to set
up, keep synchronized with Postgres, and operate. With Postgres keeping both your data and your search index,
everything is always guaranteed to be up-to-date, and there's only one server to maintain.

Setting up Postgres as a search index is easy with `postgres-searchbox`: you tell it which table you want to be
searchable, and it gives you SQL commands to execute to create the index.

Implementing a web page with a searchbox is also easy with `postgres-searchbox`, which connects your Postgres
search index with the excellent search-UI library [React InstantSearch
Hooks](https://www.algolia.com/doc/guides/building-search-ui/what-is-instantsearch/react-hooks/). Here is a
working rudimentary search page using this approach:

```javascript pages/search.tsx
import { InstantSearch, SearchBox, Hits } from 'react-instantsearch-hooks-web';
import { make_client } from 'postgres-searchbox/client';

const client = make_client('api/search');

function Hit({ hit }) {
  return (
    <article>
      <h1>{hit.primarytitle}</h1>
      <p>
        {hit.titletype}, {hit.startyear}, {hit.runtimeminutes} min
      </p>
      <p>{hit.genres}</p>
    </article>
  );
}

export default function Home() {
  return (
    <div>
      <main>
        <h1>Please enter your search terms here:</h1>
        <InstantSearch searchClient={client} indexName="table_name_here">
          <SearchBox />
          <Hits hitComponent={Hit} />
        </InstantSearch>
      </main>
    </div>
  );
}
```

You hook up a couple of React components, tell them your table's name, and voila -- you have a web interface to
search your Postgres data! Please read on for detailed instructions.

# Usage Details

Here is how you can make your Postgres data searchable in three easy steps:

## Create a Search Index for Your Postgres Table

Install the package to your project with `yarn add postgres-searchbox`.

`postgres-searchbox` includes a script that can generate the SQL commands for creating a search index on the table
you want to search. The script is at `scripts/create-index.js`; it reads the table definition and creates a search
index in thePostgres database. This index will cover all text columns in the table, allowing a single searchbox to
match against all the text the table contains.

From the `postgres-searchbox/package` folder run `PG_SB_TABLE_NAME=table_name yarn script:create-index`
You should replace `table_name` with your table name.

When executed, this script will create a new column in your table that serves as a text-search target, plus an index
that significantly speeds up matching queries against this new column. Executing this script will likely take a
while, depending on the size and nature of your data. Postgres will automatically update the index every time you
modify your data; as soon as a database modification completes, the new content will be searchable.

IMPORTANT: For the Postgres connection to work, you must set the values of some [environment
variables](https://www.postgresql.org/docs/current/libpq-envars.html), so the handler can find the right Postgres
host, database, user, and password. At a minimum the following should be set

- PGHOST
- PGUSER
- PGPASSWORD
- PGDATABASE

## Set up a Search API Route

For InstantSearch to work with our Postgres client, you need one new route in your web server. This new route
accepts search queries and executes them against your Postgres database. When you instantiate the
`postgres-searchbox` client in the `<InstantSearch>` component in the next step, you'll need to provide the new
endpoint's URL.

`postgres-searchbox` provides a handy way to implement this endpoint. For example, if your server is NextJS, you
can simply put this in the file `pages/api/search.ts`:

```javascript pages/api/search.ts
import { getSearchHandler } from 'postgres-searchbox';
export default getSearchHandler();
```

Note that the relative URL of this page is `api/search`, which is what we'll use in the next step.

IMPORTANT: The above note about environment variables applies here too.

## Implement a Search Page

To put up a web page with a searchbox for your table's contents, use the InstantSearch React components, as
illustrated in the example at the beginning of this document. Provide the URL from the last step to the
`make_client` function and the table name to the `indexName` parameter.

In the `<Hit>` component, you can access any row field using `{hit.<fieldName>}`, like in the example.

### Compatibility

The following components should work.:

- SearchBox
- Hits
- HitsPerPage
- InfiniteHits
- Pagination
- SortBy
- Highlight
- DynamicWidgets

Sorting by columns is supported. Use the syntax `?column_name(+asc|+desc)?(+nulls+last)?,column_name_2(+asc|+desc)...`.

By default Postgres sorts asc and returns null values first. So they can be left off, e.g.

```javascript pages/search.tsx
<SortBy
  items={[
    { label: 'Relevance', value: 'table_name_here' },
    { label: 'Title (asc)', value: 'table_name_here?sort=column_name' },
    {
      label: 'Title (desc)',
      value: 'table_name_here?sort=column_name+desc+nulls+last',
    },
  ]}
/>
```

The Highlight widget works, only because it does not use _all properties_ of the usual Algolia response.
If you use a custom UI that relies on properties `{ matchedWords, matchLevel, fullyHighlighted }` then it wont
work correctly. See the issue https://github.com/dekimir/postgres-searchbox/issues/8

Highlight requires some config to work correctly. See Configuring section or a full explanation.

```javascript pages/search.tsx
const client = make_client('api/search');
// ...
<Highlight hit={hit} attribute="column_name_here" className="Hit-label" />;
```

```javascript pages/api/search.ts
import { getSearchHandler } from 'postgres-searchbox';
export default getSearchHandler({
  settings: {
    attributesToHighlight: ['column_name_here'],
  },
});
```

## Configuring

There are two ways to configure the behavior of postgres-searchbox: server-side and client-side.
You can get started with zero-config, but configuring will alow for a faster and more secure setup.

Important terminology. With instantsearch, Algolia have used terms that don't exactly translate to Postgres or SQL

- indexName means the source of the search results, this is the Postgres table name.
- attribute means a value associated with a search result, e.g. id, name, url etc.
  it's similar to a column value but it's not an exact translation,
  for example in Postgres a search results attribute could be in a different table.
  For now, postgres-searchbox does not work with cross-table attributes.
- facets, these are the attribute keys like color, price etc. In Postgres, they're column names.

### Server side

The default server-side config is at [/package/src/constants.ts]. The defaults are fine during development,
but they fetch all attributes as facets and return all attributes in the search response.

The defaults should not be used in production for 2 reasons.

1. Security. You may be exposing data that should not leave the server.
1. Performance. Returning all attributes in an extra load on the server and network.

This can be addressed by explicitly setting `attributesToRetrieve` when instantiating getSearchHandler like:

```javascript pages/api/search.ts
import { getSearchHandler } from 'postgres-searchbox';
export default getSearchHandler({
  settings: { attributesToRetrieve: ['name'] },
});
```

The settings property map directly to
[Algolia Settings API Parameters](https://www.algolia.com/doc/api-reference/settings-api-parameters/),
but are only a subset of Algolia. They can be set with type-safety and autofill `ctrl + space` in VSCode.

If your searchHandler should handle multiple indexes, instead of passing one config object you can pass in an
array of configs like this. Make sure to set the indexName property for each config.

```javascript pages/api/search.ts
[
  {
    indexName: 'postgres_searchbox_movies',
  },
  {
    indexName: 'bestbuy_product',
    settings: { attributesToRetrieve: ['name'] },
  },
];
```

Sometimes server-side config is not flexible enough, maybe you have an app and website hitting the same endpoint.
And, the app and website need different attributes.
In this case, use the client config as explained below, but set some server-side validation with the
clientValidation property.

```javascript pages/api/search.ts
export default getSearchHandler({
  clientValidation: {
    validAttributesToRetrieve: [
      'id',
      'name',
      'price',
      'description',
      'mobile_column',
      'web_column',
    ],
    validAttributesToHighlight: ['column_name_here', 'column_2', 'column_3'],
  },
});
```

### Client side

The client-side options map directly to
[Algolia Search API Parameters](https://www.algolia.com/doc/api-reference/search-api-parameters/),
but are only a subset of Algolia.

They can be set with type-safety and autofill.

```javascript pages/search.tsx
import { Configure } from 'react-instantsearch-hooks-web';
import { make_client } from 'postgres-searchbox/client';
import type { SearchOptions } from 'postgres-searchbox/client.types';
const client = make_client('api/search');
const configureProps: SearchOptions = {
  validAttributesToRetrieve: [
    'id',
    'name',
    'price',
    'description',
    'web_column',
  ],
  attributesToHighlight: ['column_name_here', 'column_2'],
};
<InstantSearch searchClient={client} indexName="table_name_here">
  <Configure {...configureProps} />
  <SearchBox />
  <Hits hitComponent={Hit} />
</InstantSearch>;
```

# Limitations

This package is a work in progress, so not all InstantSearch components work yet. Most notably, the
highlight components isn't ready for prime-time.

## Postgres text-search limitations

Postgres is not quite at the Elastic level of functionality yet. For example, it doesn't offer spell-corrections
for mistyped terms, and its multi-language support is uneven.

The search index created by `postgres-searchbox` is the general search index, whose performance isn't necessarily
optimal for all possible use cases. There are other indexing options, which require customization by an experienced
developer.

It's also worth mentioning that `postgres-searchbox` currently requires a precise match for diacritics (accents on
non-ASCII letters). This will be remedied in the future by using the
[`unaccent`](https://www.postgresql.org/docs/current/unaccent.html) dictionary.

# Contributing

## Starting with tests

A config for VSCode dev containers and docker-compose file are included for developer convenience, but they don't have to be used.

Getting started with VSCode

- Open the project in VSCode.
- In command pallet: `Dev Containers: Reopen in Container`
- `cd package`
- `yarn install`
- `yarn test:watch`

Getting started with Docker Compose

- Run `docker-compose up` from project root
- In a new terminal, get bash access to the container with `docker-compose exec bash`
- `/home/default/package`
- `yarn install`
- `yarn test:watch`
- Stop with ``docker-compose stop`

Getting started without docker

- Start up a Postgres instance for testing
- Go to this project `cd package`
- `yarn install`
- The test scripts expect the following environment variables
  - PGHOST
  - PGUSER
  - PGPASSWORD
  - PGDATABASE
- `yarn test:watch`

## Real-world data

To work with a modest dataset of 20K rows. You can import an Algolia dataset
[algolia/instant-search-demo](https://github.com/algolia/instant-search-demo) collected from the bestbuy API.
A helper script to create a table, download, insert, and index the data is at `packages/scripts/create-store.ts`.
To run this script `yarn install` and `yarn script:create-store`, the database is around 20MB.

To work with a dataset of 10M rows. You can import https://datasets.imdbws.com/title.basics.tsv.gz from IMDB.
A helper script to create a table, download, insert, and index the data is at `packages/scripts/create-movies.ts`.
To run this script `yarn install` and `yarn script:create-movies` this could take 5-10 minutes.

## Local development with example(s)

During development it may be useful to see postgres-searchbox in context of a website.
In the folder `examples/with-nextjs` is a default React (NextJS) install with
postgres-searchbox installed. See the 3 files:

- `examples/with-nextjs/pages/api/search.ts`
- `examples/with-nextjs/pages/movies.tsx`
- `examples/with-nextjs/pages/store.tsx`

In `examples/with-nextjs` you can `yarn && yarn dev` to get the dev. server running.

- You can see the movies page at http://locaalhost:3000/movies
- You can see the store page at http://locaalhost:3000/store

NextJS can import the `package/build/*.js` files, to keep them up to date run `yarn dev` from a 2nd terminal.

Using swc here is orders of magnitude faster than tsc. The downside is that it doesn't check for type correctness.

## Publishing to npm

As the project source is written in Typescript it's necessary to compile before publishing to npm

- Ensure al tests are passing with `yarn test`
- `yarn build` this will use `tsc` to output to `package/build`. It check type correctness and fail on any Typescript errors.
- Update the version number in `package.json`
- `npm publish`
