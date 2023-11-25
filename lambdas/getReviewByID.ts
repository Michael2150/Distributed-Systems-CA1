import { APIGatewayProxyHandlerV2 } from "aws-lambda";  // CHANGED
import { QueryCommand, QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import { createDDbDocClient } from "../shared/util";

const ddbClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    try {
        const parameters = event.pathParameters;
        const minRating = event?.queryStringParameters?.minRating;
        const movieID = parameters?.movieId ? parseInt(parameters.movieId) : undefined;

        if(!movieID) {
            return {
                statusCode: 404,
                headers: {
                    "content-type": "application/json"
                },
                body: JSON.stringify({ Message: "Missing movie ID" }),
            };
        }


        

        let commandInput: QueryCommandInput = {
            TableName: process.env.TABLE_NAME,
            KeyConditionExpression: "movieId = :m",
            ExpressionAttributeValues: {
                ":m": movieID,
            },
        }

        if(minRating !== undefined) {
            commandInput = {
                
                ...commandInput,
                FilterExpression: "rating >= :r",
                ExpressionAttributeValues: {
                    ...commandInput.ExpressionAttributeValues,
                    ":r": parseFloat(minRating),
                },
            }
        }



        const commandOutput = await ddbClient.send(new QueryCommand(commandInput));

        const body = {
            data: commandOutput.Items
        }

        return {
            statusCode: 200,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify(body)
        }

    } catch(error) {
        return {
            statusCode: 500,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ error }),
        }
    }
}