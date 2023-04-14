import Head from 'next/head'
import Image from 'next/image'
import { Inter } from 'next/font/google'
import styles from '@/styles/Home.module.css'

import { InstantSearch, SearchBox, Hits } from 'react-instantsearch-hooks-web';
import { make_client } from '../../src/client'

const inter = Inter({ subsets: ['latin'] })

const client = make_client('api/search')

function Hit({ hit }: { hit: any }) {
  return (
    <article>
      <h1>{hit.primarytitle}</h1>
      <p>{hit.titletype}, {hit.startyear}, {hit.runtimeminutes} min</p>
      <p>{hit.genres}</p>
    </article>
  );
}

export default function Basic() {
  return (
    <div>
      <main>
        <h1>
          Please enter your search terms here:
        </h1>
        <InstantSearch searchClient={client} indexName="postgres_searchbox_playground">
          <SearchBox />
          <Hits hitComponent={Hit} />
        </InstantSearch>
      </main>
    </div>
  )
}