import { ScanCommand, ScanCommandInput } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { createDDbDocClient } from "../shared/util";

const ddbClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    const parameters = event?.pathParameters;
    const reviewerName = parameters?.reviewerName;  
    const movieID = parameters?.movieId ? parseInt(parameters.movieId) : undefined;
    

    if(!reviewerName) {
        return {
            statusCode: 404,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ message: "Missing reviewer name" })
        }
    }

    if(!movieID) {
        return {
            statusCode: 404,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ message: "Missing movie ID" })
        }
    }

    const commandInput: ScanCommandInput = {
        TableName: process.env.TABLE_NAME,
        FilterExpression: "movieId = :m and reviewerName = :r",
        ExpressionAttributeValues: {
            ":m": movieID,
            ":r": reviewerName,
        }
    };

    const commandOutput = await ddbClient.send(new ScanCommand(commandInput));

    return {
        statusCode: 200,
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify({ data: commandOutput.Items })
    }
}