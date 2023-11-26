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
  private auth: apig.IResource;
  private userPoolId: string;
  private userPoolClientId: string;

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

    this.userPoolId = userPool.userPoolId;

    const appClient = userPool.addClient("AppClient", {
      authFlows: { userPassword: true },
    });

    this.userPoolClientId = appClient.userPoolClientId;



    // =================== Auth API ===================

    // Auth Lambda functions
    const commonLambdaConfig = {
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "handler",
      environment: {
        USER_POOL_ID: this.userPoolId,
        CLIENT_ID: this.userPoolClientId,
        REGION: cdk.Aws.REGION
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

    this.auth = authApi.root.addResource("auth");

    const signUpEndpoint = this.auth.addResource("sign_up");
    const confirmSignUpEndpoint = this.auth.addResource("confirm_sign_up");
    const signInEndpoint = this.auth.addResource("sign_in");
    const signOutEndpoint = this.auth.addResource("sign_out");

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
    reviewsEndpoint.addMethod('POST', new apig.LambdaIntegration(addReviewLambda, { proxy: true }), {
      authorizer: requestAuthorizer,
      authorizationType: apig.AuthorizationType.CUSTOM,
    });

    // GET /movies/{movie_id}/reviews
    // GET /movies/{movie_id}/reviews?minRating=n
    movieIdReviewsEndpoint.addMethod('GET', new apig.LambdaIntegration(getAllReviewsForMovieLambda, { proxy: true }), {
      authorizer: requestAuthorizer,
      authorizationType: apig.AuthorizationType.CUSTOM,
    });

    // GET /movies/{movie_id}/reviews/{reviewer_name}
    reviewerNameEndpoint.addMethod('GET', new apig.LambdaIntegration(getMovieReviewByReviewerLambda, { proxy: true }), {
      authorizer: requestAuthorizer,
      authorizationType: apig.AuthorizationType.CUSTOM,
    });

    // PUT /movies/{movie_id}/reviews/{reviewer_name}
    reviewerNameEndpoint.addMethod('PUT', new apig.LambdaIntegration(updateReviewLambda, { proxy: true }), {
      authorizer: requestAuthorizer,
      authorizationType: apig.AuthorizationType.CUSTOM,
    });

    // GET /movies/{movie_id}/reviews/{year}
    yearEndpoint.addMethod('GET', new apig.LambdaIntegration(getReviewsByYearLambda, { proxy: true }), {
      authorizer: requestAuthorizer,
      authorizationType: apig.AuthorizationType.CUSTOM,
    });

    // GET /movies/reviews/{reviewer_name}
    // reviewsByReviewerEndpoint.addMethod('GET', new apig.LambdaIntegration(getReviewByReviewerLambda, { proxy: true }), {
    //   authorizer: requestAuthorizer,
    //   authorizationType: apig.AuthorizationType.CUSTOM,
    // });

    // GET /movies/{movie_id}/reviews/{reviewer_name}/translation?language=code
    translationEndpoint.addMethod('GET', new apig.LambdaIntegration(getTranslatedReviewLambda, { proxy: true }), {
      authorizer: requestAuthorizer,
      authorizationType: apig.AuthorizationType.CUSTOM,
    });
  }
}
