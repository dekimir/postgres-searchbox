`postgres-searchbox` adds full text search to your existing Postgres tables, using Postgres itself as a (good
enough) search engine.  You don't need an external search index (such as Elastic), which is often tedious to set
up, keep synchronized with Postgres, and operate.  With Postgres keeping both your data and your search index,
everything is always guaranteed to be up-to-date, and there's only one server to maintain.

Setting up Postgres as a search index is easy with `postgres-searchbox`: you tell it which table you want to be
searchable, and it gives you SQL commands to execute to create the index.

Implementing a web page with a searchbox is also easy with `postgres-searchbox`, which connects your Postgres
search index with the excellent search-UI library [React InstantSearch
Hooks](https://www.algolia.com/doc/guides/building-search-ui/what-is-instantsearch/react-hooks/).  Here is a
working rudimentary search page using this approach:

```javascript pages/search.tsx
import { InstantSearch, SearchBox, Hits } from 'react-instantsearch-hooks-web';
import { make_client } from 'postgres-searchbox/client'

const client = make_client('api/search')

function Hit({ hit }) {
  return (
    <article>
      <h1>{hit.primarytitle}</h1>
      <p>{hit.titletype}, {hit.startyear}, {hit.runtimeminutes} min</p>
      <p>{hit.genres}</p>
    </article>
  );
}

export default function Home() {
  return (
    <div>
      <main>
        <h1>
          Please enter your search terms here:
        </h1>
        <InstantSearch searchClient={client} indexName="table_name_here">
          <SearchBox />
          <Hits hitComponent={Hit} />
        </InstantSearch>
      </main>
    </div>
  )
}
```

You hook up a couple of React components, tell them your table's name, and voila -- you have a web interface to
search your Postgres data!  Please read on for detailed instructions.

# Usage Details

Here is how you can make your Postgres data searchable in three easy steps:

## Create a Search Index for Your Postgres Table

`postgres-searchbox` includes a script that can generate the SQL commands for creating a search index on the table
you want to search.  The script is named `mk-idx.mjs`; it reads the table definition on its input, processes it,
and outputs a sequence of SQL commands that will create a search index when you send them to your Postgres
database.  This index will cover all text columns in the table, allowing a single searchbox to match against all
the text the table contains.

To obtain the table definition, use the `\d` psql meta-command.  For example, if your table is named `users`, this
will print out its definition:
```bash
psql -c '\d users'
```

Because `mk-idx.mjs` takes this definition on its standard input, you can pipe the `psql` output to it, like this:
```bash
psql -c '\d users' | node mk-idx.mjs
```

This prints out some SQL that you can paste into `psql`.  When executed, this SQL will create a new column in your
table that serves as a text-search target, plus an index that significantly speeds up matching queries against this
new column.  Executing this SQL will likely take a while, depending on the size and nature of your data.  Postgres
will automatically update the index every time you modify your data; as soon as a database modification completes,
the new content will be searchable.

## Set up a Search API Route

For InstantSearch to work with our Postgres client, you need one new route in your web server.  This new route
accepts search queries and executes them against your Postgres database.  When you instantiate the
`postgres-searchbox` client in the `<InstantSearch>` component in the next step, you'll need to provide the new
endpoint's URL.

`postgres-searchbox` provides a handy way to implement this endpoint.  For example, if your server is NextJS, you
can simply put this in the file `pages/api/search.ts`:
```javascript pages/api/search.ts
import { handlerNextJS } from 'postgres-searchbox'
export default handlerNextJS

```

Note that the relative URL of this page is `api/search`, which is what we'll use in the next step.

IMPORTANT: For the Postgres connection to work, you must set the values of some [environment
variables](https://www.postgresql.org/docs/current/libpq-envars.html), so the handler can find the right Postgres
host, database, user, and password.

## Implement a Search Page

To put up a web page with a searchbox for your table's contents, use the InstantSearch React components, as
illustrated in the example at the beginning of this document.  Provide the URL from the last step to the
`make_client` function and the table name to the `indexName` parameter.

In the `<Hit>` component, you can access any row field using `{hit.<fieldname>}`, like in the example.

# Limitations

This package is a work in progress, so not all InstantSearch components work yet.  Most notably, the pagination and
highlight components aren't ready for prime-time.

## Postgres text-search limitations

Postgres is not quite at the Elastic level of functionality yet.  For example, it doesn't offer spell-corrections
for mistyped terms, and its multi-language support is uneven.

The search index created by `postgres-searchbox` is the general search index, whose performance isn't necessarily
optimal for all possible usecases.  There are other indexing options, which require customization by an experienced
developer.

It's also worth mentioning that `postgres-searchbox` currently requires a precise match for diacritics (accents on
non-ASCII letters).  This will be remedied in the future by using the
[`unaccent`](https://www.postgresql.org/docs/current/unaccent.html) dictionary.
