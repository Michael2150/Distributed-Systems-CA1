import * as cdk from 'aws-cdk-lib';
import * as apig from 'aws-cdk-lib/aws-apigateway';
import * as custom from 'aws-cdk-lib/custom-resources';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { generateBatch } from '../shared/util';
import { Construct } from 'constructs';
import reviews from '../seed/reviews';

export class DistributedSystemsCa1Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Table for Reviews
    const reviewsTable = new dynamodb.Table(this, 'ReviewsTable', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: 'movie_id', type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: 'ReviewsTable',
    });

    // Common Lambda configuration
    const commonLambdaConfig: lambdanode.NodejsFunctionProps = {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_16_X,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: reviewsTable.tableName,
        REGION: 'eu-west-1',
      },
    };

    // Lambda functions
    const addReviewLambda = new lambdanode.NodejsFunction(this, 'AddReviewFn', {
      ...commonLambdaConfig,
      entry: `${__dirname}/../lambdas/reviews/addReview.ts`,
    });

    const getAllReviewsForMovieLambda = new lambdanode.NodejsFunction(this, 'GetAllReviewsForMovieFn', {
      ...commonLambdaConfig,
      entry: `${__dirname}/../lambdas/reviews/getAllReviewsForMovie.ts`,
    });

    const getMovieReviewByReviewerLambda = new lambdanode.NodejsFunction(this, 'GetMovieReviewByReviewerFn', {
      ...commonLambdaConfig,
      entry: `${__dirname}/../lambdas/reviews/getMovieReviewByReviewer.ts`,
    });

    const getReviewByReviewerLambda = new lambdanode.NodejsFunction(this, 'GetReviewByReviewerFn', {
      ...commonLambdaConfig,
      entry: `${__dirname}/../lambdas/reviews/getReviewByReviewer.ts`,
    });

    const updateReviewLambda = new lambdanode.NodejsFunction(this, 'UpdateReviewFn', {
      ...commonLambdaConfig,
      entry: `${__dirname}/../lambdas/reviews/updateReview.ts`,
    });

    const getReviewsByYearLambda = new lambdanode.NodejsFunction(this, 'GetReviewsByYearFn', {
      ...commonLambdaConfig,
      entry: `${__dirname}/../lambdas/reviews/getReviewsByYear.ts`,
    });

    const getTranslatedReviewLambda = new lambdanode.NodejsFunction(this, 'GetTranslatedReviewFn', {
      ...commonLambdaConfig,
      entry: `${__dirname}/../lambdas/reviews/getTranslatedReview.ts`,
    });

    // Custom Resource to initialize DynamoDB data
    new custom.AwsCustomResource(this, 'InitReviewsDDBData', {
      onCreate: {
        service: 'DynamoDB',
        action: 'batchWriteItem',
        parameters: {
          RequestItems: {
            [reviewsTable.tableName]: generateBatch(reviews),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of('initReviewsDDBData'),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [reviewsTable.tableArn],
      }),
    });

    // Permissions
    reviewsTable.grantWriteData(addReviewLambda);
    reviewsTable.grantReadData(getAllReviewsForMovieLambda);
    reviewsTable.grantReadData(getMovieReviewByReviewerLambda);
    reviewsTable.grantReadData(getReviewByReviewerLambda);
    reviewsTable.grantWriteData(updateReviewLambda);
    reviewsTable.grantReadData(getReviewsByYearLambda);
    reviewsTable.grantReadData(getTranslatedReviewLambda);

    // API Gateway
    const api = new apig.RestApi(this, 'ReviewsApi', {
      description: 'Reviews API',
      deployOptions: {
        stageName: 'dev',
      },
      defaultCorsPreflightOptions: {
        allowHeaders: ['Content-Type', 'X-Amz-Date'],
        allowMethods: ['OPTIONS', 'GET', 'POST', 'PUT', 'DELETE'],
        allowCredentials: true,
        allowOrigins: ['*'],
      },
    });

    // API Gateway Endpoints
    const moviesEndpoint = api.root.addResource('movies');
    const reviewsEndpoint = moviesEndpoint.addResource('reviews');
    const movieIdEndpoint = moviesEndpoint.addResource('{movie_id}');
    const movieIdReviewsEndpoint = movieIdEndpoint.addResource('reviews');
    const reviewerNameEndpoint = movieIdReviewsEndpoint.addResource('{reviewer_name}');
    const yearEndpoint = movieIdEndpoint.addResource('{year}');
    // const reviewsByReviewerEndpoint = moviesEndpoint.addResource('{reviewer_name}');
    const translationEndpoint = movieIdReviewsEndpoint.addResource('translation');

    // POST /movies/reviews
    reviewsEndpoint.addMethod('POST', new apig.LambdaIntegration(addReviewLambda, { proxy: true }));
    // GET /movies/{movie_id}/reviews
    // GET /movies/{movie_id}/reviews?minRating=n
    movieIdReviewsEndpoint.addMethod('GET', new apig.LambdaIntegration(getAllReviewsForMovieLambda, { proxy: true }));
    // GET /movies/{movie_id}/reviews/{reviewer_name}
    reviewerNameEndpoint.addMethod('GET', new apig.LambdaIntegration(getMovieReviewByReviewerLambda, { proxy: true }));
    // PUT /movies/{movie_id}/reviews/{reviewer_name}
    reviewerNameEndpoint.addMethod('PUT', new apig.LambdaIntegration(updateReviewLambda, { proxy: true }));
    // GET /movies/{movie_id}/reviews/{year}
    yearEndpoint.addMethod('GET', new apig.LambdaIntegration(getReviewsByYearLambda, { proxy: true }));
    // GET /movies/reviews/{reviewer_name}
    // reviewsByReviewerEndpoint.addMethod('GET', new apig.LambdaIntegration(getReviewByReviewerLambda, { proxy: true }));
    // GET /movies/{movie_id}/reviews/{reviewer_name}/translation?language=code
    translationEndpoint.addMethod('GET', new apig.LambdaIntegration(getTranslatedReviewLambda, { proxy: true }));
  }
}
