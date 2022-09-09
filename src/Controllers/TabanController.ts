
import { Request, Response, NextFunction } from "express";
import { TabanManager } from "../Logic/Managers/TabanManager";
import { BaseRouter } from "../Repositories/Utility/BaseRouter";

export class TabanController extends BaseRouter {
  manager: TabanManager;
  constructor() {
    super(TabanManager);
    this.init();
  }

  init() {
    // super.init();
    // this.router.post("/search", this.getSearch);
    // this.router.post("/search_original", this.getOriginal);
    // this.router.post("/price", this.getPrice);
    // this.router.post("/search_calendar", this.getSearchCalendar);
    // this.router.post("/book_flight", this.getFlightBook);
  }

  getSearch = (req: Request, res: Response, next: NextFunction) => {
    this.manager.getSearch(req.body).then(result => res.send(result)).catch(err => res.status(500).send({ error: err }));
  };

  getOriginal = (req: Request, res: Response, next: NextFunction) => {
    // this.manager.getOriginal(req.body, (err, result) => {
    //     if (err) res.status(500).send({ error: err });
    //     else res.send(result);
    // });
  }

  getPrice = (req: Request, res: Response, next: NextFunction) => {
    // this.manager.getPrice(req.body, (err, result) => {
    //     if (err) res.status(500).send({ error: err });
    //     else res.send(result);
    // });
  }

  getSearchCalendar = (req: Request, res: Response, next: NextFunction) => {
    this.manager.getSearchCalendar(req.body).then(result => res.send(result)).catch(err => res.status(500).send({ error: err }));
  }

  getFlightBook = (req: Request, res: Response, next: NextFunction) => {
    // this.manager.getFlightBook(req.body, (err, result) => {
    //     if (err) res.status(500).send({ error: err });
    //     else res.send(result);
    // });
  }

}

const tabanController = new TabanController();
export default tabanController.router;