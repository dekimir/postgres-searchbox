import Head from 'next/head';
import Image from 'next/image';
import { Inter } from 'next/font/google';
import styles from '@/styles/Home.module.css';
import {
  useConnector,
  InstantSearch,
  Breadcrumb,
  Configure,
  ClearRefinements,
  CurrentRefinements,
  DynamicWidgets,
  HierarchicalMenu,
  Highlight,
  Hits,
  HitsPerPage,
  InfiniteHits,
  Menu,
  Pagination,
  RangeInput,
  RefinementList,
  PoweredBy,
  SearchBox,
  SortBy,
  ToggleRefinement,
} from 'react-instantsearch-hooks-web';
import connectStats from 'instantsearch.js/es/connectors/stats/connectStats';
import type { UiState } from 'instantsearch.js';
import type {
  StatsConnectorParams,
  StatsWidgetDescription,
} from 'instantsearch.js/es/connectors/stats/connectStats';
import { Panel } from '../components/Panel';

type UseStatsProps = StatsConnectorParams;

import { make_client } from 'postgres-searchbox/client';
import type { SearchOptions } from 'postgres-searchbox/client.types';
// During postgres-searchbox development this can be:
// import { make_client } from '../../../package/build/client';
// import type { SearchOptions } from '../../../package/build/client.types';

const client = make_client('api/search');

function Hit({ hit }: { hit: any }) {
  return (
    <article>
      <h1>
        <Highlight hit={hit} attribute="primarytitle" className="Hit-label" />
      </h1>
      <p>
        {hit.titletype}, {hit.startyear}, {hit.runtimeminutes} min
      </p>
      <p>{hit.genres}</p>
    </article>
  );
}

export default function Basic() {
  const configureProps: SearchOptions = {
    attributesToHighlight: ['primarytitle'],
  };

  return (
    <>
      <Head>
        <title>Postgres Searchbox - With NextJS</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <InstantSearch
        searchClient={client}
        indexName="postgres_searchbox_movies"
      >
        <Configure {...configureProps} />
        <div className="Container">
          <div>
            <DynamicWidgets fallbackComponent={FallbackComponent} />
          </div>
          <div className="Search">
            <SearchBox placeholder="Search" autoFocus defaultValue="test" />

            <div className="Search-header">
              <Stats />
              <PoweredBy />
              <HitsPerPage
                items={[
                  { label: '20 hits per page', value: 20, default: true },
                  { label: '40 hits per page', value: 40 },
                ]}
              />
              <SortBy
                items={[
                  { label: 'Relevance', value: 'postgres_searchbox_movies' },
                  {
                    label: 'Title (asc)',
                    value: 'postgres_searchbox_movies?sort=primarytitle',
                  },
                  {
                    label: 'Title (desc)',
                    value: 'postgres_searchbox_movies?sort=primarytitle+desc',
                  },
                  {
                    label: 'Start year (asc)',
                    value: 'postgres_searchbox_movies?sort=startyear+asc',
                  },
                  {
                    label: 'Start year (desc)',
                    value:
                      'postgres_searchbox_movies?sort=startyear+desc+nulls+last',
                  },
                ]}
              />
              {/* <Refresh /> */}
            </div>

            <InfiniteHits hitComponent={Hit} />
            <Pagination className="Pagination" />
          </div>
        </div>
      </InstantSearch>
    </>
  );
}

function FallbackComponent({ attribute }: { attribute: string }) {
  return (
    <Panel header={attribute}>
      <RefinementList attribute={attribute} />
    </Panel>
  );
}

/**
 * Stats
 */

function useStats(props?: UseStatsProps) {
  return useConnector<StatsConnectorParams, StatsWidgetDescription>(
    connectStats,
    props
  );
}

function Stats(props: UseStatsProps) {
  const { nbHits, processingTimeMS } = useStats(props);

  return (
    <span>
      {nbHits} results found in {processingTimeMS}ms
    </span>
  );
}
