import { Request, Response, NextFunction } from "express";
import { BaseRouter } from "../Repositories/Utility/BaseRouter";
import { KishAirManager } from "../Logic/Managers/KishAirManager";

export class KishAirController extends BaseRouter {
  constructor() {
    super(KishAirManager);
    this.init();
  }

  init() {
    // super.init();
    // this.router.post("/search", this.getSearch);
    // this.router.post("/search_original", this.getOriginal);
    // this.router.post("/book_flight", this.getFlightBook);
  }

  getSearch = (req: Request, res: Response, next: NextFunction) => {
    this.manager.getSearch(req.body, undefined, true).then(result => res.send(result)).
      catch(err => res.status(500).send({ error: err }));
  };

  getOriginal = (req: Request, res: Response, next: NextFunction) => {
    this.manager.getOriginal(req.body, (err, result) => {
      if (err) res.status(500).send({ error: err });
      else res.send(result);
    });
  }

  getFlightBook = (req: Request, res: Response, next: NextFunction) => {
    this.manager.getFlightBook(req.body, (err, result) => {
      if (err) res.status(500).send({ error: err });
      else res.send(result);
    });
  }
}

const kishController = new KishAirController();
export default kishController.router;