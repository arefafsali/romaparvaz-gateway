export interface IWrite<T> {
  create: (item: T, callback: (error: any, result: any) => void) => void;
  update: (item: T, callback: (error: any, result: any) => void) => void;
  delete: (_id: any, callback: (error: any, result: any) => void) => void;
  createBatch: (item: T[], callback: (error: any, result: any) => void) => void;
  updateBatch: (item: T[], callback: (error: any, result: any) => void) => void;
  deleteBatch: (
    _id: any[],
    callback: (error: any, result: any) => void
  ) => void;
}
