import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { createDDbDocClient } from "../../shared/util";
import { ScanCommand } from "@aws-sdk/client-dynamodb";

const ddbClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    console.log('event', event);
    try {
        const connectionResult = await ddbClient.send(
            new ScanCommand({
                TableName: process.env.TABLE_NAME
            }
        ));

        return {
            statusCode: 200,
            body: JSON.stringify(connectionResult.Items),
        }
    } catch (error) {
        console.log('error', error);
        return {
            statusCode: 500,
            body: JSON.stringify(error)
        };
    }
}
