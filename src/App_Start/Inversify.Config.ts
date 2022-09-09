import { Container } from "inversify";
import { IUnitOfWork } from "../Repositories/Contracts/IUnitOfWork";
import { MongoDBUnitOfWork } from "../Repositories/Base/MongoDBUnitOfWork";

const myContainer = new Container();
console.log('binding');

myContainer.bind<IUnitOfWork<any>>("IUnitOfWork").to(MongoDBUnitOfWork);

export { myContainer };
