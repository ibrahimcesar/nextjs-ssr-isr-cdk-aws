# PokéServerless

> **[Live Demo](https://d2isii528175w2.cloudfront.net)**

## This is _just_ a Proof of Concept!

Minimal NextJS with Server Side Rendering (SSR) – **Gotta Fetch'Em All!** – and deployed with [Serverless Nextjs CDK construct](https://serverless-nextjs.com/docs/cdkconstruct/) on AWS using CloudFront and Lambda@Edge.

Each one of the Pokémons pages are just a **Ditto** `[ditto].js` making a SSR call to the PokéApp, this way, transformig itself in the requested pokemon by name, e.g. [Toguepi](https://d2isii528175w2.cloudfront.net/togepi).


## Thanks!
[NextJS](https://nextjs.org/) – What a great framework! And the freedom to build and deploy wherever we need or want! Great fan  
[Serverless Nextjs CDK construct](https://serverless-nextjs.com/docs/cdkconstruct/), in special [Henry Kirkness](https://github.com/kirkness) and 
[Daniel Phang](https://github.com/dphang) for all work at [this feature](https://github.com/serverless-nextjs/serverless-next.js/pull/878).
 
 ### MIT License
 
© Copyright 2021 Ibrahim Cesar

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
