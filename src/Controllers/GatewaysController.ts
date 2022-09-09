import { Request, Response, NextFunction } from "express";
import { GatewaysManager } from "../Logic/Managers/GatewaysManager";
import { BaseRouter } from "../Repositories/Utility/BaseRouter";
import { ExternalRequest } from "../Infrastructure/ExternalRequests";
import { Permission } from "../Repositories/Utility/Permission";
import { gatewayStaticData } from "../Repositories/Utility/GatewayStaticData";
import { PermissionPolicy } from "../Repositories/Utility/PermissionPolicy";
import { logHelper } from "../Repositories/Utility/logHelper";
const soapRequest = require("easy-soap-request");
const fs = require("fs");
var parseString = require("xml2js").parseString;
import { writeFile } from "fs";



const sessionMaxTime = {
  amadeus: parseInt(process.env.AMADEUS_MAX_SESSION_TIME),
  mahan: parseInt(process.env.MAHAN_MAX_SESSION_TIME)
};

export class GatewaysController extends BaseRouter {
  manager: GatewaysManager;
  constructor() {
    super(GatewaysManager);
    this.init();
  }

  init() {
    let permissionPoilicy = new PermissionPolicy();
    permissionPoilicy = {
      get: false,
      getById: false,
      insert: false,
      update: false,
      delete: false
    }
    super.init(permissionPoilicy);
    // this.router.get("/", this.getAuth, this.getAll);
    this.router.get("/import_pnr_enabled", Permission.permissionRequired(false), this.getEnabledImportPNR)
    this.router.get("/code/:code", Permission.permissionRequired(false), this.getByInternalCode);
    this.router.post("/list", Permission.permissionRequired(false), this.getByIdsList);

    this.router.post("/search", logHelper.logRequest, Permission.loginProvideToAPI, this.search); // Add validation
    this.router.post("/search_calendar", logHelper.logRequest, Permission.loginProvideToAPI, this.searchCalendar);
    this.router.post("/rules", logHelper.logRequest, Permission.permissionRequired(false), this.getRules)
    this.router.get("/book/:paymentType/:id", logHelper.logRequest, Permission.permissionRequired(false), this.bookFlight); //b(bank),c(credit),w(wallet),p(point),r(reserve)
    this.router.get("/issue_ticket/:id", logHelper.logRequest, Permission.permissionRequired(false), this.issueTicket);

    this.router.post("/import_pnr/:code/:pnr", logHelper.logRequest, Permission.permissionRequired(true), this.importPNR)

    this.router.post("/failed_payment/:id", logHelper.logRequest, Permission.permissionRequired(["internalapi"]), this.failedPayment);
    this.router.post("/success_payment/:id", logHelper.logRequest, Permission.permissionRequired(["internalapi"]), this.successPayment);

    this.router.get("/session", Permission.permissionRequired(false), this.getSession);
  }

  getEnabledImportPNR = (req: Request, res: Response, next: NextFunction) => {
    this.manager.getEnabledImportPNR()
      .then(result => res.locals.send(result, next))
      .catch(err => res.status(500).locals.send(err, next))
  }

  getByInternalCode = (req: Request, res: Response, next: NextFunction) => {
    this.manager.getByCode(req.params.code)
      .then(result => res.locals.send(result, next))
      .catch(err => res.status(500).locals.send(err, next))
  }

  getSession = (req: Request, res: Response, next: NextFunction) => {
    let session = req["gsessions"];
    Object.keys(session).forEach(element => {
      session[element] = { ...session[element], sessionRemainingTime: sessionMaxTime[element] - (new Date().getTime() - new Date(session[element].sessionTime).getTime()) }
    });
    res.locals.send(session);
    next();
  };

  getByIdsList = (req: Request, res: Response, next: NextFunction) => {
    this.manager.getByIdsList(req.body, (err, result) => {
      if (err) res.status(500).send({ error: err });
      else res.send(result);
    });
  };

  search = (req: Request, res: Response, next: NextFunction) => {
    if (req.query.devMode && req.query.staticData)
      res.send(gatewayStaticData);
    else
      this.manager.search(req.body, req["gsessions"], req["user"], { ...req.query, requestUUID: req["guuid"] })
        .then(result => {
          if (result.session)
            res.locals.session = result.session;
          res.locals.send(result.result, next)
        })
        .catch(err => {
          logHelper.logResponseError(req, err);
          console.log(err)
          if (err.data && err.data.session)
            res.locals.session = err.data.session;
          res.status(500).locals.send({ error: err }, next);
        })
  };

  searchCalendar = (req: Request, res: Response, next: NextFunction) => {
    this.manager.searchCalendar(req.body, req["user"], { ...req.query, requestUUID: req["guuid"] })
      .then(result => {
        res.locals.send(result, next)
      })
      .catch(err => {
        logHelper.logResponseError(req, err);
        if (err.data && err.data.session)
          res.locals.session = err.data.session;
        res.status(500).locals.send({ error: err }, next);
      })
  };

  getRules = (req: Request, res: Response, next: NextFunction) => {
    this.manager.getRules(req.body, req["gsessions"], { ...req.query, requestUUID: req["guuid"] })
      .then(result => res.locals.send(result, next))
      .catch(err => {
        logHelper.logResponseError(req, err);
        if (err.data && err.data.session)
          res.locals.session = err.data.session;
        res.status(500).locals.send({ error: err }, next);
      })

  }

  bookFlight = (req: Request, res: Response, next: NextFunction) => {
    console.log("Hello");
    this.manager.bookFlight(req.params.paymentType, req.params.id, req["gsessions"], { ...req.query, requestUUID: req["guuid"] })
      .then(result => {
        // Due o floating point errors
        result.result.totalPrice = parseFloat(result.result.totalPrice.toFixed(3));
        if (result.session)
          res.locals.session = result.session;
        console.log("Hello", req.params.paymentType.toLowerCase());
        if (req.params.paymentType.toLowerCase() === "r")
          res.send({ tempReserve: true, isPaid: true });
        else {
          ExternalRequest.syncPostRequest(process.env.MAIN_URL + "pg/request", null, {
            ...(result.result),
            paymentType: req.params.paymentType
          }, undefined)
            .then(result => { res.locals.send(result, next) })
            .catch(err => {
              logHelper.logResponseError(req, err.response.data);
              res.status(500).locals.send(err.response.data, next)
            });
        }
      })
      .catch(err => {
        logHelper.logResponseError(req, err);
        if (err.data && err.data.session)
          res.locals.session = err.data.session;
        res.status(500).locals.send({ error: err.response ? err.response.data : err }, next);
      });
  };

  failedPayment = (req: Request, res: Response, next: NextFunction) => {
    this.manager.bookingPaymentFailed(req.params.id, req.body)
      .then(result => res.send({ status: "success" }))
      .catch(err => {
        logHelper.logResponseError(req, err);
        res.status(500).locals.send({ error: err }, next)
      })
  }

  successPayment = (req: Request, res: Response, next: NextFunction) => {
    this.manager.bookingPaymentSuccess(req.params.id, req.body)
      .then(result => res.send(result))
      .catch(err => {
        logHelper.logResponseError(req, err);
        res.status(500).locals.send({ error: err }, next)
      })
  }

  importPNR = (req: Request, res: Response, next: NextFunction) => {
    this.manager.importPNR(req.params.code, req.params.pnr, req.body, req["user"], { ...req.query, requestUUID: req["guuid"] })
      .then(result => res.send(result))
      .catch(err => {
        logHelper.logResponseError(req, err);
        res.status(500).locals.send({ error: err }, next)
      })
  }

  issueTicket = (req: Request, res: Response, next: NextFunction) => {
    this.manager.issueTicket(req.params.id, req["gsessions"], { ...req.query, requestUUID: req["guuid"] })
      .then(result => {
        if (result.session)
          res.locals.session = result.session;
        res.locals.send(result.result, next)
      })
      .catch(err => {
        logHelper.logResponseError(req, err);
        if (err.data && err.data.session)
          res.locals.session = err.data.session;
        res.status(500).locals.send({ error: err }, next);
      })
  }

}
const gatewaysController = new GatewaysController();

export default gatewaysController.router;
