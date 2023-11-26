import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { createDDbDocClient } from "../../shared/util";
import Ajv from "ajv";
import schema from "../../shared/types.schema.json";
import { UpdateCommand, UpdateCommandInput } from "@aws-sdk/lib-dynamodb";

const ajv = new Ajv();
const isValidBodyParams = ajv.compile(schema.definitions["Review"] || {})
const ddbClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    console.log('event', event);
    try {
        const movie_id = event.pathParameters?.movie_id;
        const reviewer_name : string = event.pathParameters?.reviewer_name || "";
        const body = event.body? JSON.parse(event.body) : undefined;

        if (!body) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Missing body" })
            };
        }

        if (!isValidBodyParams(body)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Invalid body" })
            };
        }

        body.movie_id = Number(movie_id);
        body.reviewer_name = reviewer_name;

        const params : UpdateCommandInput = {
            TableName: process.env.TABLE_NAME,
            Key: {
                "movie_id": Number(movie_id),
                "author": reviewer_name,
            },
            UpdateExpression: "set rating = :rating, content = :review",
            ExpressionAttributeValues: {
                ":rating": body.rating,
                ":review": body.content,
            },
        };

        await ddbClient.send(new UpdateCommand(params));

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Review added", review: body })
        };
    } catch (error) {
        console.log('error', error);
        return {
            statusCode: 500,
            body: JSON.stringify(error)
        };
    }
}
