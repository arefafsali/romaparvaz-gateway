export interface IRead<T> {
  find: (query: any, callback: (error: any, result: any) => void) => void;
  findOne: (id: string, callback: (error: any, result: T) => void) => void;
}
