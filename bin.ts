// bin.ts
import * as cdk from "@aws-cdk/core";
import { Builder } from "@sls-next/lambda-at-edge";
import { NextStack } from "./stack";

// Run the serverless builder, this could be done elsewhere in your workflow
const builder = new Builder(".", "./build", {args: ['build']});

builder
  .build(true)
  .then(() => {
    const app = new cdk.App();
    new NextStack(app, "NextJsStack", {
      analyticsReporting: true,
      description: "Testing deploying NextJS Serverless Construct"
    });
  })
  .catch((e) => {
    console.log(e);
    process.exit(1);
  });