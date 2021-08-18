import Document, { DocumentContext, Html, Head, Main, NextScript } from 'next/document'
import Link from 'next/link'
import { GA_TRACKING_ID } from '@/lib/gtag'

class PokeDoc extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx)

    return initialProps
  }

  render() {
    return (
      <Html>
        <Head>
           {/* Global Site Tag (gtag.js) - Google Analytics */}
          <script
            async
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`}
          />
          <script
            dangerouslySetInnerHTML={{
              __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_TRACKING_ID}', {
              page_path: window.location.pathname,
            });
          `,
            }}
          />
        </Head>
        <body>
          <Main />
          <NextScript />
          <footer>© {new Date().getFullYear()} Ibrahim Cesar | <Link href="https://updown.io/akzp"><a>PokéAPI Status</a></Link></footer>
        </body>
      </Html>
    )
  }
}

export default PokeDoc