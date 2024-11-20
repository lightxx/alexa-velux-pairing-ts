import AWS from "aws-sdk";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import * as shared from "velux-alexa-integration-shared";

const tableName = "alexaveluxdb";

interface BaseParams {
  TableName: string;
  Item: {
    id: string;
  };
}

interface GetParams {
  TableName: string;
  Key: {
    id: string;
  };
}

interface ConfigParams extends BaseParams {
  Item: BaseParams["Item"] & {
    username: string;
    password: string;
    home_id: string;
    bridge: string;
  };
}

// interface ConfigParams extends BaseParams {
//   Item: BaseParams["Item"] & {
    
//   };
// }

interface DynamoDBItem {
  userId: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid request, no body provided." }),
      };
    }

    const {
      code,
      username,
      password,
    }: { code: string; username: string; password: string } = JSON.parse(
      event.body
    );

    const getParams: GetParams = {
      TableName: tableName,
      Key: { id: code.toUpperCase() },
    };

    const dynamoDB = new AWS.DynamoDB.DocumentClient();
    const data = await dynamoDB.get(getParams).promise();

    if (!data.Item) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid code." }),
      };
    }

    const item = data.Item as DynamoDBItem;
    const userId = item.userId;
    const idstr = "config-" + userId;

    shared.state.storedUserId = userId;

    await shared.warmUp();

    shared.state.userData = {
      username: username,
      password: password,
      home_id: null,
      bridge: null,
    };
    console.log("State: " + JSON.stringify(shared.state, null, 2));

    console.log(`Trying to get a token from the Velux backend...`);
    await shared.makeTokenRequest("password");

    if (!shared.state.tokenData) {
      throw "Unable to obtain a token from Velux backend... Check your Velux Active credentials!";
    }

    const homeInfoJSON = await shared.postRequest("", "homeInfo");

    const homeData = homeInfoJSON.data as shared.ConfigurationEntry;

    console.log("Home Info: " + JSON.stringify(homeData, null, 2));

    const configParams: ConfigParams = {
      TableName: tableName,
      Item: {
        id: idstr,
        username,
        password,
        home_id: homeData.body.homes[0].id,
        bridge: homeData.body.homes[0].modules.find(
          (module) => module.type === "NXG"
        )?.id!,
      },
    };

    await dynamoDB.put(configParams).promise();
    
    // await dynamoDB.delete(getParams).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Account linked successfully.", homeInfo: JSON.stringify(homeInfoJSON.data) }),
    };
  } catch (error) {
    console.error("Error processing request:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error }),
    };
  }
};
