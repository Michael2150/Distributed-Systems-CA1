import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import {Movie, Review} from '../shared/types';

export class DistributedSystemsCa1Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // DynamoDB tables for movies and reviews
    const movieTable = new dynamodb.Table(this, 'MovieTable', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: 'Movies',
    });

    const reviewTable = new dynamodb.Table(this, 'ReviewTable', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: 'Reviews',
    });

    // Add a global secondary index to the review table
    reviewTable.addGlobalSecondaryIndex({
      indexName: 'movie_id-index',
      partitionKey: { name: 'movie_id', type: dynamodb.AttributeType.NUMBER },
    });

    // Fill the tables with data
    const movieData = require('../shared/movies.json');
    const reviewData = require('../shared/reviews.json');
    

  }
}
