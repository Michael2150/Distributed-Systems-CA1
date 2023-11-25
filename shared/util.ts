import { marshall } from "@aws-sdk/util-dynamodb";
import { Review } from "./types";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

type Entity = Review;

export const generateReviewItem = (entity: Entity) => {
    return {
        PutRequest: {
            Item: marshall(entity),
        },
    };
};

export const generateBatch = (data: Entity[]) => {
    return data.map((e) => {
        return generateReviewItem(e);
    });
};

export function createDDbDocClient() {
    const ddbClient = new DynamoDBClient({ region: process.env.REGION });
    const marshallOptions = {
      convertEmptyValues: true,
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    };
    const unmarshallOptions = {
      wrapNumbers: false,
    };
    const translateConfig = { marshallOptions, unmarshallOptions };
    return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}