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
        <title>PokéServerless - AWS Serverless Lambda@Edge</title>
        <meta property="og:title" content="PokéServerless - AWS Serverless Lambda@Edge" key="title" />
        <link rel="preconnect" href="https://fonts.gstatic.com"/>
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;1,700&display=swap" rel="stylesheet" />
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
        <meta property="og:image" content={`${process.env.baseUrl}/og.png`} key="image" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@ibrahimcesar" />
        <meta name="twitter:title" content="PokéServerless - AWS Serverless Lambda@Edge" />
        <meta name="twitter:description" content="Just another SSR site" />
        <meta name="twitter:image" content={`${process.env.baseUrl}/og.png`} />
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
          <footer>© {new Date().getFullYear()} <Link href="https://twitter.com/ibrahimcesar"><a>Ibrahim Cesar</a></Link> | <Link href="https://updown.io/akzp"><a>PokéAPI Status</a></Link></footer>
        </body>
      </Html>
    )
  }
}

export default PokeDoc
