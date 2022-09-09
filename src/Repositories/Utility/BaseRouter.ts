import { Router, Response, NextFunction, Request } from "express";
import { PermissionPolicy } from "./PermissionPolicy";
import { Permission } from "./Permission";

export class BaseRouter {
  router: Router;
  manager: any;

  constructor(type: any) {
    this.router = Router();
    this.manager = new type();
  }

  init(permissionPolicy: PermissionPolicy = new PermissionPolicy()) {
    this.router.get("/", Permission.permissionRequired(permissionPolicy.get), (req: Request, res: Response, next: NextFunction) => {
      this.getAll(this.manager, req, res, next);
    });
    this.router.get(
      "/id/:id", Permission.permissionRequired(permissionPolicy.getById),
      (req: Request, res: Response, next: NextFunction) => {
        this.getOne(this.manager, req, res, next);
      }
    );
    this.router.post("/", Permission.permissionRequired(permissionPolicy.insert), (req: Request, res: Response, next: NextFunction) => {
      this.add(this.manager, req, res, next);
    });
    this.router.put("/", Permission.permissionRequired(permissionPolicy.update), (req: Request, res: Response, next: NextFunction) => {
      this.update(this.manager, req, res, next);
    });
    this.router.delete(
      "/", Permission.permissionRequired(permissionPolicy.delete),
      (req: Request, res: Response, next: NextFunction) => {
        this.delete(this.manager, req, res, next);
      }
    );
  }


  getAll = (manager: any, req: Request, res: Response, next: NextFunction) => {
    manager.find({}, (err, result) => {
      res.send(result);
    });
  };

  getOne = (manager: any, req: Request, res: Response, next: NextFunction) => {
    manager.findOne(req.params.id, (err, result) => {
      res.send(result);
    });
  };

  add = (manager: any, req: Request, res: Response, next: NextFunction) => {
    manager.create(req.body, (err, result) => {
      res.send(result);
    });
  };

  update = (manager: any, req: Request, res: Response, next: NextFunction) => {
    manager.update(req.body, (err, result) => {
      res.send(result);
    });
  };

  delete = (manager: any, req: Request, res: Response, next: NextFunction) => {
    manager.delete(req.body._id, (err, result) => {
      res.send(result);
    });
  };
}
