import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { createDDbDocClient } from "../../shared/util";
import {
    ScanCommandInput, ScanCommand,
  } from "@aws-sdk/lib-dynamodb";

const ddbClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    console.log('event', event);
    try {
        const reviewer_name = event.pathParameters?.reviewer_name;

        if (!reviewer_name) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Missing reviewer_name path parameter" })
            };
        }

        const params: ScanCommandInput = {
            TableName: process.env.TABLE_NAME,
            FilterExpression: "author = :r",
            ExpressionAttributeValues: {
                ":r": reviewer_name,
            },
        };

        const result = await ddbClient.send(new ScanCommand(params));

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ "reviewer_name" : reviewer_name, "reviews" : result.Items}),
        };
    } catch (error) {
        console.log('error', error);
        return {
            statusCode: 500,
            body: JSON.stringify(error)
        };
    }
}
