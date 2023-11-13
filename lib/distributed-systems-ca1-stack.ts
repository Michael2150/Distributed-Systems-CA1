import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as custom from "aws-cdk-lib/custom-resources";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as node from "aws-cdk-lib/aws-lambda-nodejs";
import { generateBatch } from "../shared/utils";
import * as apig from "aws-cdk-lib/aws-apigateway";

export class DistributedSystemsCa1Stack extends cdk.Stack {
  private auth: apig.IResource;
  private userPoolId: string;
  private userPoolClientId: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ==== Cognito User Pool ====
    // User Pool
    const userPool = new cognito.UserPool(this, "UserPool", {
      signInAliases: { username: true, email: true },
      selfSignUpEnabled: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.userPoolId = userPool.userPoolId;
    
    const appClient = userPool.addClient("AppClient", {
      authFlows: { userPassword: true},
    });
    
    this.userPoolClientId = appClient.userPoolClientId;


    // ==== DynamoDB Tables ====
    // Movie table
    const movieTable = new dynamodb.Table(this, "MovieTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "id", type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "Movies",
    });

    // Review table
    const reviewTable = new dynamodb.Table(this, "ReviewTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "Reviews",
    });

    // Add a global secondary index to the review table
    reviewTable.addGlobalSecondaryIndex({
      indexName: "movie_id-index",
      partitionKey: { name: "movie_id", type: dynamodb.AttributeType.NUMBER },
    });

    // Read Seed Data from JSON files and add to DynamoDB tables
    const movieData = require("../seed/movies.json");
    const reviewData = require("../seed/reviews.json");

    // Create a custom resource to add seed data to DynamoDB tables
    new custom.AwsCustomResource(this, "InitDBData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [movieTable.tableName]: generateBatch(movieData),
            [reviewTable.tableName]: generateBatch(reviewData),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("InitDBData"),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [movieTable.tableArn, reviewTable.tableArn],
      }),
    });

    // ==== API Gateway ====

    // Authentication Service API
    const authApi = new apig.RestApi(this, "AuthServiceApi", {
      description: "Authentication Service RestApi",
      endpointTypes: [apig.EndpointType.REGIONAL],
      defaultCorsPreflightOptions: {
        allowOrigins: apig.Cors.ALL_ORIGINS,
      },
    });

    this.auth = authApi.root.addResource("auth");

    this.addAuthRoute(
      "signup",
      "POST",
      "SignupFn",
      'signup.ts'
    );

    this.addAuthRoute(
      "confirm_signup",
      "POST",
      "ConfirmFn",
      "confirm-signup.ts"
    );

    const appApi = new apig.RestApi(this, "MovieReviewApi", {
      description: "Movies REST API",
      endpointTypes: [apig.EndpointType.REGIONAL],
      defaultCorsPreflightOptions: {
        allowOrigins: apig.Cors.ALL_ORIGINS,
      },
    });

    const protectedRes = appApi.root.addResource("protected");
    const publicRes = appApi.root.addResource("public");

    // Public Endpoints
    
  }


  private addAuthRoute(
    resourceName: string,
    method: string,
    fnName: string,
    fnEntry: string,
    allowCognitoAccess?: boolean
  ): void {
    const commonFnProps = {
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
    
    const resource = this.auth.addResource(resourceName);
    
    const fn = new node.NodejsFunction(this, fnName, {
      ...commonFnProps,
      entry: `${__dirname}/../lambda/auth/${fnEntry}`,
    });

    resource.addMethod(method, new apig.LambdaIntegration(fn));
  }
}
