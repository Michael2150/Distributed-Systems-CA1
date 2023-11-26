import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { createDDbDocClient } from "../../shared/util";
import {
  ScanCommandInput,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

const ddbClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  console.log("event", event);

  try {
    const movieId = event.pathParameters?.movie_id;
    const minRating = event.queryStringParameters?.minRating || "0";

    if (!movieId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing movie_id path parameter" }),
      };
    }

    if (isNaN(Number(minRating))) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "minRating must be a number" }),
      };
    }

    const params: ScanCommandInput = {
      TableName: process.env.TABLE_NAME,
      FilterExpression: "movie_id = :movie_id AND rating >= :minRating",
      ExpressionAttributeValues: {
        ":movie_id": Number(movieId),
        ":minRating": Number(minRating),
      },
    };

    const result = await ddbClient.send(new ScanCommand(params));

    return {
      statusCode: 200,
      body: JSON.stringify({ "movie_id" : movieId, "minRating" : minRating, "reviews" : result.Items}),
    };
  } catch (error) {
    console.log("error", error);
    return {
      statusCode: 500,
      body: JSON.stringify(error),
    };
  }
};

