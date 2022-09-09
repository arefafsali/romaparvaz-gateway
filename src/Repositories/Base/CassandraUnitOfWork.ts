import { IUnitOfWork } from "../Contracts/IUnitOfWork";
import { injectable } from "inversify";
import DataAccess = require("./DataAccess");

@injectable()
export class CassandraUnitOfWork<T> implements IUnitOfWork<T> {
  public _collection: any;

  constructor() {
    // var db = new DataAccess();
    this._collection = DataAccess.ModelInstance;
  }

  getList(
    tableName: string,
    query: any,
    callback: (error: any, result: any) => void
  ) {
    this._collection.instance[tableName].find(
      query,
      { raw: true, allow_filtering: true },
      callback
    );
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
    var queries: any = [];
    var that: any = this;
    entity.forEach(function(val, index) {
      delete val["id"];
      var model = new that._collection.instance[tableName](val);
      queries.push(model.save({ return_query: true }));
    });
    this._collection.doBatch(queries, callback);
  }
  grabInsertWithTTL(
    tableName: string,
    entity: T[],
    ttl: number,
    callback: (error: any, result: any) => void
  ) {
    var queries: any = [];
    var that: any = this;
    entity.forEach(function(val, index) {
      delete val["id"];
      var model = new that._collection.instance[tableName](val);
      queries.push(model.save({ return_query: true, ttl: ttl }));
    });
    this._collection.doBatch(queries, callback);
  }
  grabUpdate(
    tableName: string,
    entity: T[],
    callback: (error: any, result: any) => void
  ) {
    let queries: any = [];
    let that: any = this;
    entity.forEach(function(val, index) {
      let id = (<any>val)["id"];
      console.log(id)
      delete (<any>val)["id"];
      var model = that._collection.instance[tableName].update(
        { id: that._collection.datatypes.Uuid.fromString(id) },
        val,
        {
          return_query: true
        }
      );
      queries.push(model);
    });
    this._collection.doBatch(queries, callback);
  }
  grabDelete(
    tableName: string,
    id: any[],
    callback: (error: any, result: any) => void
  ) {
    let queries: any = [];
    let that: any = this;
    id.forEach(function(val, index) {
      var model = that._collection.instance[tableName].delete(
        { id: val },
        {
          return_query: true
        }
      );
      queries.push(model);
    });
    this._collection.doBatch(queries, callback);
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
