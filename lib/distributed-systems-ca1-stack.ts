import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as custom from "aws-cdk-lib/custom-resources";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Movie, Review } from "../shared/types";
import { generateBatch } from "../shared/utils";

export class DistributedSystemsCa1Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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
  }
}
