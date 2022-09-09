import { IUnitOfWork } from "../Contracts/IUnitOfWork";
import { injectable } from "inversify";
import DataAccess = require("./DataAccess");
var ObjectId = require("mongodb").ObjectID;

@injectable()
export class MongoDBUnitOfWork<T> implements IUnitOfWork<T> {
  public _collection: any;

  constructor() {
    console.log('unit of db');
    
    if (DataAccess.ModelInstance) this._collection = DataAccess.ModelInstance;
    else
      DataAccess.test().then(modelInstance => {
        this._collection = modelInstance;
      });
  }

  getList(
    tableName: string,
    query: any,
    callback: (error: any, result: any) => void
  ) {
    this._collection.collection(tableName, function(err, collection) {
      collection.find(query).toArray(callback);
    });
  }
  getListAsync(
    tableName: string,
    query: any,
    callback: (error: any, result: any) => void
  ) {
    this._collection.instance[tableName].findAsync(
      query,
      { raw: true, allow_filtering: true },
      callback
    );
  }
  grabInsert(
    tableName: string,
    entity: T[],
    callback: (error: any, result: any) => void
  ) {
    entity.map(x => {
      delete x["_id"];
    });
    this._collection.collection(tableName, function(err, collection) {
      collection.insertMany(entity).then(function(result, err) {
        callback(err, result.result);
      });
    });
  }
  grabInsertWithTTL(
    tableName: string,
    entity: T[],
    ttl: number,
    callback: (error: any, result: any) => void
  ) {
    this._collection.collection(tableName, function(err, collection) {
      collection.insertMany(entity).then(function(result, err) {
        callback(err, result.result);
      });
    });
  }
  grabUpdate(
    tableName: string,
    entity: T[],
    callback: (error: any, result: any) => void
  ) {
    this._collection.collection(tableName, function(err, collection) {
      entity.forEach(function(val, index) {
        let id = (<any>val)["_id"];
        delete (<any>val)["_id"];
        collection
          .update({ _id: ObjectId(id) }, val)
          .then(function(result, err) {
            callback(err, result.result);
          });
      });
    });
  }
  grabDelete(
    tableName: string,
    id: any[],
    callback: (error: any, result: any) => void
  ) {
    this._collection.collection(tableName, function(err, collection) {
      collection.deleteMany({ id: { $in: id } }).then(function(result, err) {
        callback(err, result.result);
      });
    });
  }
  markNew(tableName: string, entity: T[], queryNumber?: string): string {
    return "";
  }
  markDirty(tableName: string, entity: T[], queryNumber?: string): string {
    return "";
  }
  markDeleted(tableName: string, entity: T[], queryNumber?: string): string {
    return "";
  }
  markList(tableName: string, query: any, queryNumber?: string): string {
    return "";
  }
  commit(
    tableName: string,
    queryNumber: string,
    callback: (error: any, result: any) => void
  ) {}
  commitAsync(
    tableName: string,
    queryNumber: string,
    callback: (error: any, result: any) => void
  ) {}
  rollback(
    tableName: string,
    queryNumber: string,
    callback: (error: any, result: any) => void
  ) {}
}
