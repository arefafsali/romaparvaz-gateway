export interface IUnitOfWork<T> {
  getList: (
    tableName: string,
    query: any,
    callback: (error: any, result: any) => void,
    aggregates?: any
  ) => void;
  getListAsync: (
    tableName: string,
    query: any,
    callback: (error: any, result: any) => void
  ) => void;
  grabInsert: (
    tableName: string,
    entity: T[],
    callback: (error: any, result: any) => void
  ) => void;
  grabInsertWithTTL: (
    tableName: string,
    entity: T[],
    ttl:number,
    callback: (error: any, result: any) => void
  ) => void;
  grabUpdate: (
    tableName: string,
    entity: T[],
    callback: (error: any, result: any) => void
  ) => void;
  grabDelete: (
    tableName: string,
    id: any[],
    callback: (error: any, result: any) => void
  ) => void;
  markNew: (tableName: string, entity: T[], queryNumber?: string) => string;
  markDirty: (tableName: string, entity: T[], queryNumber?: string) => string;
  markDeleted: (tableName: string, entity: T[], queryNumber?: string) => string;
  markList: (tableName: string, query: any, queryNumber?: string) => string;
  commit: (
    tableName: string,
    queryNumber: string,
    callback: (error: any, result: any) => void
  ) => void;
  commitAsync: (
    tableName: string,
    queryNumber: string,
    callback: (error: any, result: any) => void
  ) => void;
  rollback: (
    tableName: string,
    queryNumber: string,
    callback: (error: any, result: any) => void
  ) => void;
}
