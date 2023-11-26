import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { createDDbDocClient } from "../../shared/util";
import {
    ScanCommandInput,
    ScanCommand,
} from "@aws-sdk/lib-dynamodb";

const ddbClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    console.log('event', event);
    try {
        const movieId = event.pathParameters?.movie_id;

        if (!movieId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Missing movie_id path parameter" })
            };
        }

        const lastPathParameter = event.pathParameters?.reviewer_name;
        const regexForYear = new RegExp(/^(19|20)\d{2}$/);

        if (!lastPathParameter) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Missing last path parameter" })
            };
        }

        if (regexForYear.test(lastPathParameter)) {
            const params : ScanCommandInput = {
                TableName: process.env.TABLE_NAME,
                FilterExpression: "movie_id = :movie_id AND begins_with(created_at, :year)",
                ExpressionAttributeValues: {
                    ":movie_id": Number(movieId),
                    ":year": Number(lastPathParameter),
                },
            };
        
            const result = await ddbClient.send(new ScanCommand(params));
        
            return {
                statusCode: 200,
                body: JSON.stringify({ "movie_id" : movieId, "param" : lastPathParameter, "reviews" : result.Items}),
            };
        } else {
            const params : ScanCommandInput = {
                TableName: process.env.TABLE_NAME,
                FilterExpression: "movie_id = :movie_id AND author = :reviewer_name",
                ExpressionAttributeValues: {
                    ":movie_id": Number(movieId),
                    ":reviewer_name": lastPathParameter,
                },
            };
        
            const result = await ddbClient.send(new ScanCommand(params));
        
            return {
                statusCode: 200,
                body: JSON.stringify({ "movie_id" : movieId, "param" : lastPathParameter, "reviews" : result.Items}),
            };
        }
    } catch (error) {
        console.log('error', error);
        return {
            statusCode: 500,
            body: JSON.stringify(error)
        };
    }
}