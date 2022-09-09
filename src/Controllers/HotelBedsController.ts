import { Request, Response, NextFunction, Router } from "express";
import { HotelBedsManager } from "../Logic/Managers/HotelBedsManager";
import { BaseRouter } from "../Repositories/Utility/BaseRouter";
import { Permission } from "../Repositories/Utility/Permission";

export class HotelBedsController extends BaseRouter {
  manager: HotelBedsManager;
  constructor() {
    super(HotelBedsManager);
    this.init();
  }

  init() {
    //super.init();
    this.router.post("/search", Permission.permissionRequired(false), this.getSearch);
    this.router.post("/detail", Permission.permissionRequired(false), this.getDetail);
    this.router.post("/book", Permission.permissionRequired(true), this.book);
    this.router.post("/checkrates", Permission.permissionRequired(false), this.checkrates);
  }

  //This api used for home page search , Calling search api from Hotel Beds in gateway project - You can see more info in manager of this controller
  getSearch = (req: Request, res: Response, next: NextFunction) => {
    this.manager
      .getSearch(req.body)
      .then(result => res.send(result))
      .catch(error => res.status(500).send(error));
  };

  //This api used for Hotel Detail , Calling detail api from Hotel Beds in gateway project - You can see more info in manager of this controller
  getDetail = (req: Request, res: Response, next: NextFunction) => {
    this.manager
      .getDetail(req.body)
      .then(result => res.send(result))
      .catch(error => res.status(500).send(error));
  };

  //This method just used for testing check rate hotels (Price)
  checkrates = (req: Request, res: Response, next: NextFunction) => {
    this.manager
      .checkValidityOfRoomsRates(req.body)
      .then(result => res.send(result))
      .catch(error => res.status(500).send(error));
  };

  //This api used for calling book api from Payment Page
  book = (req: Request, res: Response, next: NextFunction) => {
    this.manager
      .book(req.body, req["user"])
      .then(result => res.send(result))
      .catch(error => res.status(500).send(error));
  };
}
const hotelBedsController = new HotelBedsController();

export default hotelBedsController.router;
