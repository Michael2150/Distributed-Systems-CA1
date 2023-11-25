import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { createDDbDocClient } from "../shared/util";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";
import schema from "../shared/types.schema.json";

const ajv = new Ajv();
const isValidBodyParams = ajv.compile(schema.definitions["Review"] || {})
const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    const body = event.body ? JSON.parse(event.body) : undefined;

    if (!body) {
        return {
            statusCode: 500,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ message: "Missing request body" })
        }
    }

    if(!isValidBodyParams(body)) {
        return {
            statusCode: 500,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                message: "Invalid type. Must match Review schema",
                schema: schema.definitions["Review"]
            })
        }
    }

    await ddbDocClient.send(new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: body
    }));

    return {
        statusCode: 201,
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify({message: "Review Added"})
    }
}