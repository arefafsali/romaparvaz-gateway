var cors = require("cors");
import * as express from "express";
import * as logger from "morgan";
import * as bodyParser from "body-parser";
import "reflect-metadata";

// Controllers
import AmadeusController from "./Controllers/AmadeusController";
import GatewaysController from "./Controllers/GatewaysController";
import PartoCRSController from "./Controllers/PartoCRSController";
import SignituresController from "./Controllers/SignituresController";
import MahanController from "./Controllers/MahanController";
import HotelBedsController from "./Controllers/HotelBedsController";

// Services
import { Permission } from "./Repositories/Utility/Permission";
import { SessionManagement } from "./Repositories/Utility/SessionManagement";
import { SendResult } from "./Repositories/Utility/SendResult";
import KishAirController from "./Controllers/KishAirController";
import ZagrosController from "./Controllers/ZagrosController";
import CaspianController from "./Controllers/CaspianController";
import { logHelper } from "./Repositories/Utility/logHelper";

export class App {
  // ref to Express instance
  public express: express.Application;

  //Run configuration methods on the Express instance.
  constructor() {
    this.express = express();
    this.middleware();
    this.routes();
    this.express.use(SessionManagement.setGatewaySessionCookies);
    this.express.use(SendResult.sendResult);
  }

  // Configure Express middleware.
  private middleware(): void {
    this.express.use(logger("dev"));
    this.express.use(cors());
    this.express.use(bodyParser.json());
    this.express.use(bodyParser.urlencoded({ extended: false }));
    this.express.use(logHelper.addRequestUUID)
    this.express.use(SessionManagement.getGatewaySessions);
    this.express.use(SendResult.defineResSend);
    // this.express.use(Permission.getAuth);
    // this.express.use(
    //   Permission.getGlobalBruteForce.getMiddleware({
    //     key: function(req, res, next) {
    //       // prevent too many attempts for the same username
    //       next(req.url);
    //     }
    //   })
    // );
  }

  // Configure API endpoints.
  private routes(): void {
    let router = express.Router();
    this.express.use("/", router);
    this.express.get("/health", (req, res) => {
      res.send({ "status": "UP" })
    })
    this.express.use("/gateway", GatewaysController);
    this.express.use("/gateway/amadeus", AmadeusController);
    this.express.use("/gateway/parto", PartoCRSController);
    this.express.use("/signiture", SignituresController);
    this.express.use("/gateway/mahan", MahanController);
    this.express.use("/gateway/kishair", KishAirController);
    this.express.use("/gateway/zagros", ZagrosController);
    this.express.use("/gateway/caspian", CaspianController);
    this.express.use("/gateway/hotelbeds", HotelBedsController);
  }
}

export default new App().express;
