import { Router, Response, NextFunction, Request } from "express";
import { ExternalRequest } from "../../Infrastructure/ExternalRequests";
var ExpressBrute = require("express-brute"),
  //   MemcacheStore = require("express-brute-memcached"),
  store;

store = new ExpressBrute.MemoryStore();

export class Permission {
  static getAuth(req: Request, res: Response, next: NextFunction) {
    // console.log(req.method);
    // res.status(403).send({error: 'access denied'});
    next();
  }

  static loginRequired(req: Request, res: Response, next: NextFunction) {
    return new Promise((resolve, reject) => {
      ExternalRequest.syncGetRequest(
        process.env.MAIN_URL + "jwt/current_user", undefined, undefined, undefined,
        { Cookie: req.header("cookie") }).then((user_result: any) => {
          if (!user_result.error) {
            req["user"] = user_result.payload.data;
            next();
          }
          // console.log(req.method);
          else res.status(403).send({ error: "access denied" });
        }).catch((err) => {
          res.status(403).send({ error: "access denied" });
          // reject(err)
        })
    })
  }

  static loginProvideToAPI(req: Request, res: Response, next: NextFunction) {
    return new Promise((resolve, reject) => {
      ExternalRequest.syncGetRequest(
        process.env.MAIN_URL + "jwt/current_user", undefined, undefined, undefined,
        { Cookie: req.header("cookie") }).then((user_result: any) => {
          if (!user_result.error) {
            req["user"] = user_result.payload.data;
            next();
          }
          // console.log(req.method);
          else {
            req["user"] = null;
            next();
          }
        }).catch((err) => {
          req["user"] = null;
          next();
          // reject(err)
        })
    })
  }
  static permissionRequired(permissions?: boolean | string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!permissions)
        next();
      else if (typeof permissions == "boolean" || (Array.isArray(permissions) && permissions.length == 0))
        ExternalRequest.syncGetRequest(process.env.MAIN_URL + "jwt/current_user", undefined, undefined, undefined, { Cookie: req.header("cookie") })
          .then((user_result: any) => {
            if (!user_result.error) {
              req["user"] = user_result.payload.data;
              next();
            }
            else if (req.headers.internalauth && req.headers.internalauth == process.env.INTERNAL_SECRET)
              next();
            else
              res.status(403).send({ error: "access denied" });
          })
          .catch((err) => {
            if (req.headers.internalauth && req.headers.internalauth == process.env.INTERNAL_SECRET)
              next();
            else
              res.status(403).send({ error: "access denied" });
          });
      else if (permissions.length > 0) {
        ExternalRequest.syncPostRequest(process.env.MAIN_URL + "jwt/check_permission_list", req.header("cookie"), permissions, undefined, "POST")
          .then((result: any) => {
            if (!result.error && result.payload.data.permission_result) {
              req["user"] = result.payload.data.user;
              next();
            }
            else if (req.headers.internalauth && req.headers.internalauth == process.env.INTERNAL_SECRET)
              next();
            else
              res.status(403).send({ error: "access denied" });
          })
          .catch((err) => {
            if (req.headers.internalauth && req.headers.internalauth == process.env.INTERNAL_SECRET)
              next();
            else
              res.status(403).send({ error: "access denied" });
          });
      }
      else if (req.headers.internalauth && req.headers.internalauth == process.env.INTERNAL_SECRET) {
        next();
      }
      else
        res.status(403).send({ error: "access denied" });
    }
  }
  static bruteFailCallback(
    req: Request,
    res: Response,
    next: NextFunction,
    nextValidRequestDate: Date
  ) {
    res.status(429).send("too many request from your ip!");
  }

  static bruteHandleStateError(error: any) {
    console.log("error");
  }

  static getGlobalBruteForce = new ExpressBrute(store, {
    freeRetries: 100,
    attachResetToRequest: false,
    refreshTimeoutOnRequest: false,
    minWait: 3000,
    maxWait: 30000,
    lifetime: 60 * 60, // 1 Hour (seconds not milliseconds)
    failCallback: Permission.bruteFailCallback,
    handleStoreError: Permission.bruteHandleStateError
  });
}
