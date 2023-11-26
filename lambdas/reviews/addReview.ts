import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { createDDbDocClient } from "../../shared/util";
import Ajv from "ajv";
import schema from "../../shared/types.schema.json";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

const ajv = new Ajv();
const isValidBodyParams = ajv.compile(schema.definitions["Review"] || {})
const ddbClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    console.log('event', event);
    try {
        
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

        const params = {
            TableName: process.env.TABLE_NAME,
            Item: body,
        };

        await ddbClient.send(new PutCommand(params));

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
