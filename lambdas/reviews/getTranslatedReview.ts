import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { createDDbDocClient } from "../../shared/util";
import { ScanCommandInput, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { Translate } from 'aws-sdk';

const translate = new Translate({ region: 'eu-west-1' });
const ddbClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    console.log('event', event);
    try {
        const movieId = event.pathParameters?.movie_id;
        const reviewerName = event.pathParameters?.reviewer_name;
        const language = event.queryStringParameters?.language || "en";

        if (!movieId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Missing movie_id path parameter" })
            };
        }

        if (!reviewerName) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Missing reviewer_name path parameter" })
            };
        }

        const params : ScanCommandInput = {
            TableName: process.env.TABLE_NAME,
            FilterExpression: "movie_id = :movie_id AND author = :reviewer_name",
            ExpressionAttributeValues: {
                ":movie_id": Number(movieId),
                ":reviewer_name": reviewerName,
            },
        };

        const results = (await ddbClient.send(new ScanCommand(params))).Items || [];

        for (const review of results) {
            const params : Translate.Types.TranslateTextRequest = {
                SourceLanguageCode: 'en',
                TargetLanguageCode: language,
                Text: review.content,
            };
            const translatedReview = await translate.translateText(params).promise();
            review.content = translatedReview.TranslatedText;
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ "movie_id" : movieId, "reviewer_name" : reviewerName, "language" : language,  "reviews" : results}),
        };
    } catch (error) {
        console.log('error', error);
        return {
            statusCode: 500,
            body: JSON.stringify(error)
        };
    }
}
