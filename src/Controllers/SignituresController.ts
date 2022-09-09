import { Request, Response, NextFunction } from "express";
import { SignituresManager } from "../Logic/Managers/SignituresManager";
import { BaseRouter } from "../Repositories/Utility/BaseRouter";
import { PermissionPolicy } from "../Repositories/Utility/PermissionPolicy";
import { Permission } from "../Repositories/Utility/Permission";

export class SignituresController extends BaseRouter {
  constructor() {
    super(SignituresManager);
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
    this.router.get("/profile/:profileId", Permission.permissionRequired(false), this.getByProfile);
    this.router.get("/profile_gateway/:profileId/:gatewayId", Permission.permissionRequired(false), this.getByProfileAndGateway);
  }

  getByProfile = (req: Request, res: Response, next: NextFunction) => {
    this.manager.getByProfile(parseInt(req.params.profileId), (err, result) => {
      if (err) res.status(500).send({ error: err });
      else res.send(result);
    });
  };

  getByProfileAndGateway = (req: Request, res: Response, next: NextFunction) => {
    this.manager.getByProfileAndGateway(parseInt(req.params.profileId), req.params.gatewayId, (err, result) => {
      if (err) res.status(500).send({ error: err });
      else res.send(result);
    });
  };
}
const signituresController = new SignituresController();

export default signituresController.router;
