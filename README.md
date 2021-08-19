<div align="center">

<img src="https://d2908q01vomqb2.cloudfront.net/7719a1c782a1ba91c031a682a0a2f8658209adbf/2021/01/15/cdk-logo6-1260x476.png" alt="CDK" width="620" />

# AWS CDK serverless deploy for Next.js with SSR and ISR

</div>

> Next.js webapp using Server Side Rendering (SSR) and Incremental Static Regeneration (ISR) deployed with Serverless Nextjs CDK construct on AWS using CloudFront and Lambda@Edge

> **[Live Demo](https://d2isii528175w2.cloudfront.net)**

### This is _just_ a Proof of Concept!

Minimal NextJS with Server Side Rendering (SSR) – **Gotta Fetch'Em All!** – and deployed with [Serverless Nextjs CDK construct](https://serverless-nextjs.com/docs/cdkconstruct/) on AWS using CloudFront and Lambda@Edge.

Each one of the Pokémons pages are just a **Ditto** `[ditto].js` making a SSR call to the PokéApi, this way, transformig itself in the requested pokemon by name, e.g. [Toguepi](https://d2isii528175w2.cloudfront.net/togepi).

### Deploy it yourself!

You will need working `aws` credentials. [Follow this guide](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html)

Run:

```
npm run cdk bootstrap
npm run cdk deploy
```

Now you can navigate to the AWS console > CloudFront and find the URL for your new distribution.

### Thanks!
[NextJS](https://nextjs.org/) – What a great framework! And the freedom to build and deploy wherever we need or want! Great fan  
[Serverless Nextjs CDK construct](https://serverless-nextjs.com/docs/cdkconstruct/), in special [Henry Kirkness](https://github.com/kirkness) and 
[Daniel Phang](https://github.com/dphang) for all work at [this feature](https://github.com/serverless-nextjs/serverless-next.js/pull/878).
 
 ### MIT License
 
© Copyright 2021 [Ibrahim Cesar](https://ibrahimcesar.cloud)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
