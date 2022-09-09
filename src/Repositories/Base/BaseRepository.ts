// Interfaces
import { IRead } from "../Contracts/IRead";
import { IWrite } from "../Contracts/IWrite";
import { IUnitOfWork } from "../Contracts/IUnitOfWork";
import { myContainer } from "../../App_Start/Inversify.Config";
var ObjectId = require("mongodb").ObjectID;

// The class only can be extended
export abstract class BaseRepository<T> implements IWrite<T>, IRead<T> {
  public repository: IUnitOfWork<T>;
  public entity: string;

  constructor(entity: string) {
    this.repository = myContainer.get<IUnitOfWork<T>>("IUnitOfWork");
    this.entity = entity;
  }

  create(item: T, callback: (error: any, result: any) => void) {
    this.repository.grabInsert(this.entity, [item], callback);
  }

  createWithTTL(
    item: T,
    ttl: number,
    callback: (error: any, result: any) => void
  ) {
    this.repository.grabInsertWithTTL(this.entity, [item], ttl, callback);
  }

  update(item: T, callback: (error: any, result: any) => void) {
    this.repository.grabUpdate(this.entity, [item], callback);
  }

  delete(_id: any, callback: (error: any, result: any) => void) {
    this.repository.grabDelete(this.entity, [_id], callback);
  }

  createBatch(item: T[], callback: (error: any, result: any) => void) {
    this.repository.grabInsert(this.entity, item, callback);
  }

  updateBatch(item: T[], callback: (error: any, result: any) => void) {
    this.repository.grabUpdate(this.entity, item, callback);
  }

  deleteBatch(_id: any[], callback: (error: any, result: any) => void) {
    this.repository.grabDelete(this.entity, _id, callback);
  }

  find(query: any, callback: (error: any, result: any) => void, aggregates?: any) {
    this.repository.getList(this.entity, query, callback, aggregates);
  }

  findOne(_id: string, callback: (error: any, result: T) => void) {
    this.repository.getList(this.entity, { _id: ObjectId(_id) }, callback);
  }
}
