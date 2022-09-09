import { Request, Response, NextFunction } from "express";
import { PartoCRSManager } from "../Logic/Managers/PartoCRSManager";
import { BaseRouter } from "../Repositories/Utility/BaseRouter";

export class PartoCRSController extends BaseRouter {
  constructor() {
    super(PartoCRSManager);
    this.init();
  }

  init() {
    // super.init();
    // this.router.post("/search", this.getSearch);
    // this.router.post("/search_original", this.getOriginal);
    // this.router.post("/search_calendar", this.getSearchCalendar);
    // this.router.get("/ping", this.getPing);
    // this.router.post("/flight_book", this.getFlightBook);
    // this.router.post("/cancel_flight",this.getCancelFlight);
    // this.router.post("/airOrder_ticket",this.getAirOrderTicket);
  }

  getSearch = (req: Request, res: Response, next: NextFunction) => {
    this.manager.getSearch(req.body, (err, result) => {
      if (err) res.status(500).send({ error: err });
      else res.send(result);
    });
  };

  getOriginal = (req: Request, res: Response, next: NextFunction) => {
    this.manager.getOriginal(req.body, (err, result) => {
      if (err) res.status(500).send({ error: err });
      else res.send(result);
    });
  };

  getSearchCalendar = (req: Request, res: Response, next: NextFunction) => {
    this.manager.getSearchCalendar(req.body, (err, result) => {
      if (err) res.status(500).send({ error: err });
      else res.send(result);
    });
  };

  getPing = (req: Request, res: Response, next: NextFunction) => {
    this.manager.getPing((err, result) => {
      if (err) res.status(500).send({ error: err });
      else res.send(result);
    });
  };

  getFlightBook = (req: Request, res: Response, next: NextFunction) => {
    this.manager.getFlightBook(req.body, (err, result) => {
      if (err) res.status(500).send({ error: err });
      else res.send(result);
    });
  };

  getCancelFlight = (req: Request, res: Response, next: NextFunction) => {
    this.manager.getCancel(req.body, (err, result) => {
      if (err) res.status(500).send({ error: err });
      else res.send(result);
    });
  };

  getAirOrderTicket = (req: Request, res: Response, next: NextFunction) => {
    this.manager.getAirOrderTicket(req.body, (err, result) => {
      if (err) res.status(500).send({ error: err });
      else res.send(result);
    });
  }

}
const partoCRSController = new PartoCRSController();

export default partoCRSController.router;
