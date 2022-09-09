import { Request, Response, NextFunction } from "express";
import { MahanManager } from "../Logic/Managers/MahanManager";
import { BaseRouter } from "../Repositories/Utility/BaseRouter";

export class MahanController extends BaseRouter {
  manager: MahanManager;
  constructor() {
    super(MahanManager);
    this.init();
  }

  init() {
    super.init();
    this.router.post("/search", this.getSearch);
    this.router.get("/ping", this.getPing);
    this.router.post("/price", this.getPrice);
    this.router.post("/flight_book", this.getFlightBook);
    this.router.post("/search_calendar", this.getSearchCalendar);
  }

  getSearch = (req: Request, res: Response, next: NextFunction) => {
    // this.manager.getSearch(req.body, (err, result) => {
    //   if (err) res.status(500).send({ error: err });
    //   else res.send(result);
    // });
  };

  getPing = (req: Request, res: Response, next: NextFunction) => {
    this.manager.getPing()
      .then(result => {console.log(result); res.send(result)})
      .catch(err => res.status(500).send({ error: err }));
  };

  getPrice = (req: Request, res: Response, next: NextFunction) => {
    // this.manager.getPrice(req.body, (err, result) => {
    //   if (err) res.status(500).send({ error: err });
    //   else res.send(result);
    // });
  };

  getSearchCalendar = (req: Request, res: Response, next: NextFunction) => {
    // this.manager.getSearchCalendar(req.body, (err, result) => {
    //   if (err) res.status(500).send({ error: err });
    //   else res.send(result);
    // });
  };

  getFlightBook = (req: Request, res: Response, next: NextFunction) => {
    // this.manager.getFlightBook(req.body, (err, result) => {
    //   if (err) res.status(500).send({ error: err });
    //   else res.send(result);
    // });
  };
}

const mahanController = new MahanController();

export default mahanController.router;
