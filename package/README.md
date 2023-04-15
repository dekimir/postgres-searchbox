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

Install the package and peer dependencies to your project with `yarn add postgres-searchbox pg pg-format zod`.

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
import { handlerNextJS } from 'postgres-searchbox';
export default handlerNextJS;
```

Note that the relative URL of this page is `api/search`, which is what we'll use in the next step.

IMPORTANT: The above note about environment variables applies here too.

## Implement a Search Page

To put up a web page with a searchbox for your table's contents, use the InstantSearch React components, as
illustrated in the example at the beginning of this document. Provide the URL from the last step to the
`make_client` function and the table name to the `indexName` parameter.

In the `<Hit>` component, you can access any row field using `{hit.<fieldname>}`, like in the example.

# Limitations

This package is a work in progress, so not all InstantSearch components work yet. Most notably, the pagination and
highlight components aren't ready for prime-time.

## Postgres text-search limitations

Postgres is not quite at the Elastic level of functionality yet. For example, it doesn't offer spell-corrections
for mistyped terms, and its multi-language support is uneven.

The search index created by `postgres-searchbox` is the general search index, whose performance isn't necessarily
optimal for all possible usecases. There are other indexing options, which require customization by an experienced
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

## Realworld data

To work with a dataset of 10M rows. You can import https://datasets.imdbws.com/title.basics.tsv.gz from imdb.
A helper script to create a table, download, insert, and index the data is at `packages/scripts/create-movies.ts`.
To run this script `yarn install` and `yarn script:create-movies` this could take 5-10 minutes.

## Local development with example(s)

During development it may be useful to see postgres-searchbar in context of a website.
In the folder `examples/with-nextjs` is a default React (nNextJS) install with
postgres-searchbar installed. See the 3 files:

- `examples/with-nextjs/pages/api/search.ts`
- `examples/with-nextjs/pages/movies.tsx`
- `examples/with-nextjs/styles/Movies.module.css`

In `examples/with-nextjs` you can `yarn && yarn dev` to get the dev. server running.
You can see the movies page at http://locaalhost:3000/movies

NextJS can import the `package/build/*.js` files, to keep them up to date run `yarn build:watch-swc` from a 2nd treminal.

Using swc here is orders of magnitude faster than tsc. The downside is that it doesn't check for type correctnes.

## Publishing to npm

As the project source is written in Typescript it's necessary to compile before publishing to npm

- Ensure al tests are passing with `yarn test`
- `yarn build` this will use `tsc` to output to `package/build`. It check type correctness and fail on any Typescript errors.
- Update the version number in `package.json`
- `npm publish`
