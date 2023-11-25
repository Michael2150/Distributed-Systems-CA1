import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apig from 'aws-cdk-lib/aws-apigateway';
import reviews from '../seed/reviews';
import { generateBatch } from '../shared/util';
import * as custom from "aws-cdk-lib/custom-resources"
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";

export class DistributedCa1Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const reviewsTable = new dynamodb.Table(this, 'ReviewsTable', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: 'movieId', type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: 'reviewDate', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: 'ReviewsTable',
    });

    reviewsTable.addLocalSecondaryIndex({
      indexName: "reviewerName",
      sortKey: { name: "reviewerName", type: dynamodb.AttributeType.STRING },
    })

    // Get all reviews lambda
    const getAllReviewsFn = new lambdanode.NodejsFunction(this, "GetAllReviewsFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: `${__dirname}/../lambdas/getAllReviews.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
          TABLE_NAME: reviewsTable.tableName,
          REGION: 'eu-west-1'
      }
    });

    // Add Reviews lambda
    const addReviewFn = new lambdanode.NodejsFunction(this, "AddReviewFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: `${__dirname}/../lambdas/addReview.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
          TABLE_NAME: reviewsTable.tableName,
          REGION: 'eu-west-1'
      }
    });

    // Get reviews by ID lambda
    const getReviewByIDFn = new lambdanode.NodejsFunction(this, "GetReviewByIDFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: `${__dirname}/../lambdas/getReviewByID.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
          TABLE_NAME: reviewsTable.tableName,
          REGION: 'eu-west-1'
      }
    });

    // Get Reviews by reviewer name lambda
    const getReviewByReviewerNameFn = new lambdanode.NodejsFunction(this, "GetReviewByReviewerNameFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: `${__dirname}/../lambdas/getReviewByReviewerName.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
          TABLE_NAME: reviewsTable.tableName,
          REGION: 'eu-west-1'
      }
    });

    
    new custom.AwsCustomResource(this, "initReviewsDDBData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [reviewsTable.tableName]: generateBatch(reviews),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("initReviewsDDBData"),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [reviewsTable.tableArn],
    }),
  });

  // Permissions
  reviewsTable.grantReadData(getAllReviewsFn);
  reviewsTable.grantReadData(getReviewByIDFn);
  reviewsTable.grantReadData(getReviewByReviewerNameFn);

  reviewsTable.grantWriteData(addReviewFn);

  const api = new apig.RestApi(this, 'ReviewsApi', {
    description: "Reviews API",
    deployOptions: {
      stageName: "dev",
    },

    defaultCorsPreflightOptions: {
      allowHeaders: ["Content-Type", "X-Amz-Date"],
      allowMethods: ["OPTIONS", "GET", "POST", "PUT", "DELETE"],
      allowCredentials: true,
      allowOrigins: ["*"],
    }
  });

  const moviesEndpoint = api.root.addResource('movies');
  const reviewsEndpoint = moviesEndpoint.addResource('reviews');
  const movieIdEndpoint = moviesEndpoint.addResource('{movieId}');
  const movieIdReviewsEndpoint = movieIdEndpoint.addResource('reviews');
  const reviewerNameEndpoint = movieIdReviewsEndpoint.addResource('{reviewerName}');

  // GET /movies/reviews
  reviewsEndpoint.addMethod('GET', new apig.LambdaIntegration(getAllReviewsFn, { proxy: true }));
  // POST /movies/reviews
  reviewsEndpoint.addMethod('POST', new apig.LambdaIntegration(addReviewFn, { proxy: true }));
  // GET /movies/{movieId}/reviews
  movieIdReviewsEndpoint.addMethod('GET', new apig.LambdaIntegration(getReviewByIDFn, { proxy: true }));
  // GET /movies/{movieId}/reviews/{reviewerName}
  reviewerNameEndpoint.addMethod('GET', new apig.LambdaIntegration(getReviewByReviewerNameFn, { proxy: true }));
}
}
