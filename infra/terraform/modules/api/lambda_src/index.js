"use strict";

exports.handler = async (event) => {
  console.log("event", JSON.stringify(event));

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message: "ok",
      path: event?.rawPath ?? "",
      requestId: event?.requestContext?.requestId ?? "",
    }),
  };
};
