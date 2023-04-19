import type { AppProps } from 'next/app';
import '../styles/globals.css';
import 'instantsearch.css/themes/satellite-min.css';

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
