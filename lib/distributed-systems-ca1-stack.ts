import * as cdk from 'aws-cdk-lib';
import * as apig from 'aws-cdk-lib/aws-apigateway';
import * as custom from 'aws-cdk-lib/custom-resources';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import { generateBatch } from '../shared/util';
import { Construct } from 'constructs';
import { UserPool } from "aws-cdk-lib/aws-cognito";
import reviews from '../seed/reviews';

export class DistributedSystemsCa1Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
 
    // =================== Database ===================

    // DynamoDB Table for Reviews
    const reviewsTable = new dynamodb.Table(this, 'ReviewsTable', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: 'movie_id', type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: 'ReviewsTable',
    });

    // Global Secondary Index for reviewer_name
    reviewsTable.addGlobalSecondaryIndex({
      indexName: 'reviewer_name-index',
      partitionKey: { name: 'reviewer_name', type: dynamodb.AttributeType.STRING },
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



    // =================== Cognito Auth ===================

    // Cognito User Pool
    const userPool = new UserPool(this, "UserPool", {
      signInAliases: { username: true, email: true },
      selfSignUpEnabled: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const appClient = userPool.addClient("AppClient", {
      authFlows: { userPassword: true },
    });

    const userPoolId = userPool.userPoolId;

    const userPoolClientId = appClient.userPoolClientId;

    // =================== Auth API ===================

    // Auth Lambda functions
    const commonLambdaConfig = {
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "handler",
      environment: {
        USER_POOL_ID: userPoolId,
        CLIENT_ID: userPoolClientId,
        REGION: cdk.Aws.REGION,
        TABLE_NAME: reviewsTable.tableName,
      },
    };

    const signUpLambda = new lambdanode.NodejsFunction(this, 'SignUpFn', {
      ...commonLambdaConfig,
      entry: `${__dirname}/../lambdas/auth/signup.ts`,
    });

    const confirmSignUpLambda = new lambdanode.NodejsFunction(this, 'ConfirmSignUpFn', {
      ...commonLambdaConfig,
      entry: `${__dirname}/../lambdas/auth/confirm-signup.ts`,
    });

    const signInLambda = new lambdanode.NodejsFunction(this, 'SignInFn', {
      ...commonLambdaConfig,
      entry: `${__dirname}/../lambdas/auth/signin.ts`,
    });

    const signOutLambda = new lambdanode.NodejsFunction(this, 'SignOutFn', {
      ...commonLambdaConfig,
      entry: `${__dirname}/../lambdas/auth/signout.ts`,
    });

    const authorizerFn = new lambdanode.NodejsFunction(this, 'AuthFn', {
      ...commonLambdaConfig,
      entry: `${__dirname}/../lambdas/auth/authorizer.ts`,
    });

    const requestAuthorizer = new apig.RequestAuthorizer(
      this,
      "RequestAuthorizer",
      {
        identitySources: [apig.IdentitySource.header("cookie")],
        handler: authorizerFn,
        resultsCacheTtl: cdk.Duration.minutes(0),
      }
    );

    // Auth API Gateway
    const authApi = new apig.RestApi(this, "AuthServiceApi", {
      description: "Authentication Service RestApi",
      endpointTypes: [apig.EndpointType.REGIONAL],
      defaultCorsPreflightOptions: {
        allowOrigins: apig.Cors.ALL_ORIGINS,
      },
    });

    const auth = authApi.root.addResource("auth");

    const signUpEndpoint = auth.addResource("sign_up");
    const confirmSignUpEndpoint = auth.addResource("confirm_sign_up");
    const signInEndpoint = auth.addResource("sign_in");
    const signOutEndpoint = auth.addResource("sign_out");

    // POST /auth/signUp
    signUpEndpoint.addMethod("POST", new apig.LambdaIntegration(signUpLambda));
    // POST /auth/confirmSignUp
    confirmSignUpEndpoint.addMethod("POST", new apig.LambdaIntegration(confirmSignUpLambda));
    // POST /auth/signIn
    signInEndpoint.addMethod("POST", new apig.LambdaIntegration(signInLambda));
    // GET /auth/signOut
    signOutEndpoint.addMethod("GET", new apig.LambdaIntegration(signOutLambda));


    
    // =================== Reviews API ===================

    // Reviews Lambda functions
    const getAllReviews = new lambdanode.NodejsFunction(this, 'GetAllReviewsFn', {
      ...commonLambdaConfig,
      entry: `${__dirname}/../lambdas/reviews/getAllReviews.ts`,
    });

    const addReviewLambda = new lambdanode.NodejsFunction(this, 'AddReviewFn', {
      ...commonLambdaConfig,
      entry: `${__dirname}/../lambdas/reviews/addReview.ts`,
    });

    const getAllReviewsForMovieLambda = new lambdanode.NodejsFunction(this, 'GetAllReviewsForMovieFn', {
      ...commonLambdaConfig,
      entry: `${__dirname}/../lambdas/reviews/getAllReviewsForMovie.ts`,
    });

    const getAllReviewsForNameOrYearLambda = new lambdanode.NodejsFunction(this, 'getAllReviewsForNameOrYearFn', {
      ...commonLambdaConfig,
      entry: `${__dirname}/../lambdas/reviews/getAllReviewsForNameOrYear.ts`,
    });

    const getReviewsByRevierNameLambda = new lambdanode.NodejsFunction(this, 'getReviewsByReviewerNameFn', {
      ...commonLambdaConfig,
      entry: `${__dirname}/../lambdas/reviews/getReviewsByReviewerName.ts`,
    });

    const updateReviewLambda = new lambdanode.NodejsFunction(this, 'UpdateReviewFn', {
      ...commonLambdaConfig,
      entry: `${__dirname}/../lambdas/reviews/updateReview.ts`,
    });

    const getTranslatedReviewLambda = new lambdanode.NodejsFunction(this, 'GetTranslatedReviewFn', {
      ...commonLambdaConfig,
      entry: `${__dirname}/../lambdas/reviews/getTranslatedReview.ts`,
    });

    // Permissions
    reviewsTable.grantReadData(getAllReviews);
    reviewsTable.grantWriteData(addReviewLambda);
    reviewsTable.grantReadData(getAllReviewsForMovieLambda);
    reviewsTable.grantReadData(getAllReviewsForNameOrYearLambda);
    reviewsTable.grantReadData(getReviewsByRevierNameLambda);
    reviewsTable.grantWriteData(updateReviewLambda);
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
    const moviesReviewsEndpoint = moviesEndpoint.addResource('reviews');
    const moviesByReviewerNameEndpoint = moviesReviewsEndpoint.addResource('{reviewer_name}');
    const moviesByMovieIdEndpoint = moviesEndpoint.addResource('{movie_id}');
    const movieIdReviewsEndpoint = moviesByMovieIdEndpoint.addResource('reviews');
    const reviewerNameEndpoint = movieIdReviewsEndpoint.addResource('{reviewer_name}');
    const translationEndpoint = reviewerNameEndpoint.addResource('translation');



    // GET /movies
    moviesEndpoint.addMethod('GET', new apig.LambdaIntegration(getAllReviews, { proxy: true }));

    // POST /movies/reviews
    moviesReviewsEndpoint.addMethod('POST', new apig.LambdaIntegration(addReviewLambda, { proxy: true }), {
      authorizer: requestAuthorizer,
      authorizationType: apig.AuthorizationType.CUSTOM,
    });

    // GET /movies/reviews/{reviewer_name}
    moviesByReviewerNameEndpoint.addMethod('GET', new apig.LambdaIntegration(getReviewsByRevierNameLambda, { proxy: true }));

    // GET /movies/{movie_id}/reviews
    // GET /movies/{movie_id}/reviews?minRating=n
    movieIdReviewsEndpoint.addMethod('GET', new apig.LambdaIntegration(getAllReviewsForMovieLambda, { proxy: true }));

    // GET /movies/{movie_id}/reviews/{reviewer_name}
    // GET /movies/{movie_id}/reviews/{year}
    reviewerNameEndpoint.addMethod('GET', new apig.LambdaIntegration(getAllReviewsForNameOrYearLambda, { proxy: true }));

    // PUT /movies/{movie_id}/reviews/{reviewer_name}
    reviewerNameEndpoint.addMethod('PUT', new apig.LambdaIntegration(updateReviewLambda, { proxy: true }), {
      authorizer: requestAuthorizer,
      authorizationType: apig.AuthorizationType.CUSTOM,
    });

    // GET /movies/{movie_id}/reviews/{reviewer_name}/translation?language=code
    translationEndpoint.addMethod('GET', new apig.LambdaIntegration(getTranslatedReviewLambda, { proxy: true }));
  }
}
