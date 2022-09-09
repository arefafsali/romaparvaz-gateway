import { NextFunction, Request, Response } from "express";
import uuid = require("uuid");
import { ExternalRequest } from "../../Infrastructure/ExternalRequests";

export class logHelper {
  public static addRequestUUID(req: Request, res: Response, next: NextFunction) {
    req["guuid"] = uuid.v4();
    next();
  }

  public static logRequest(req: Request, res: Response, next: NextFunction) {
    // if (req.url.indexOf("gateway") >= 0) {
    let log = new gatewayLog();
    log.uuid = req["guuid"];
    log.logMessage = "call API";
    log.requestUrl = req.url;
    log.requestMethod = req.method;
    log.requestBody = req.body;
    log.requestHeader = req.headers;
    logHelper.info(log)
    // }
    next();
  }

  public static logResponseError(req: Request, error: any) {
    let log = new gatewayLog();
    log.uuid = req["guuid"];
    if (error instanceof Error) {
      log.logMessage = error.message;
      log.logData = error.stack;
    }
    else {
      log.logMessage = "API error";
      log.logData = error;
    }
    log.requestUrl = req.url;
    log.requestMethod = req.method;
    log.requestBody = req.body;
    log.requestHeader = req.headers;
    logHelper.error(log)
  }

  public static logGatewayError(gatewayCode: string, uuid: string, error: any) {
    let log = new gatewayLog();
    log.uuid = uuid;
    if (error instanceof Error) {
      log.logMessage = error.message;
      log.logData = error.stack;
    }
    else {
      log.logMessage = "API error";
      log.logData = error;
    }
    log.gatewayCode = gatewayCode;
    logHelper.error(log);
  }

  public static logGatewayRequestError(gatewayCode: string, uuid: string, error: any, gatewayAction: string, request: { url: string, body: string, header: any }) {
    let log = new gatewayLog();
    log.uuid = uuid;
    log.logMessage = "gateway request error";
    log.gatewayCode = gatewayCode;
    log.gatewayAction = gatewayAction;
    log.gatewayRequestUrl = request.url;
    log.gatewayRequestBody = request.body;
    log.gatewayRequestHeader = request.header;
    if (error instanceof Error) {
      log.logData = error.stack;
    }
    else {
      log.logData = error;
    }
    logHelper.error(log);
  }

  public static logGatewayTimeout(gatewayCode: string, uuid: string) {
    let log = new gatewayLog();
    log.uuid = uuid;
    log.logMessage = "Gateway Timeout";
    log.gatewayCode = gatewayCode;
    logHelper.error(log);
  }

  public static logGatewayRequestResponse(gatewayCode: string, uuid: string, gatewayAction: string, request: { url: string, body: string, header: any }, response: { body: string, header: any, statusCode: string }) {
    let log = new gatewayLog();
    log.uuid = uuid;
    log.logMessage = "gateway request and response";
    log.gatewayCode = gatewayCode;
    log.gatewayAction = gatewayAction;
    log.gatewayRequestUrl = request.url;
    log.gatewayRequestBody = request.body;
    log.gatewayRequestHeader = request.header;
    log.gatewayResponseBody = response.body;
    log.gatewayResponseHeader = response.header;
    log.gatewayResponseStatusCode = response.statusCode.toString();
    logHelper.requestResponse(log);
  }

  public static info(log: gatewayLog) {
    log.logType = "info";
    logHelper.insert(log)
  }

  public static error(log: gatewayLog) {
    log.logType = "error";
    logHelper.insert(log)
  }

  private static requestResponse(log: gatewayLog) {
    log.logType = "request/response";
    logHelper.insert(log);
  }

  private static insert(log: gatewayLog) {
    ExternalRequest.syncPostRequest(process.env.MAIN_URL + "gateway_log", undefined, log, undefined, "POST")
      .then()
      .catch(err => { })
  }
}

class gatewayLog {
  public uuid: string = "";
  public logType: string = ""; // INFO, Error
  public logMessage: string = "";
  public logData: any = null;
  public requestUrl: string = "";
  public requestMethod: string = "";
  public requestBody: any = null;
  public requestHeader: any = null;
  public gatewayCode: string = "";
  public gatewayAction: string = "";
  public gatewayRequestUrl: string = "";
  public gatewayRequestBody: string = "";
  public gatewayRequestHeader: any = null;
  public gatewayResponseBody: string = "";
  public gatewayResponseHeader: any = null;
  public gatewayResponseStatusCode: string = "";
}