const chalk = require("chalk");
import { MongoClient } from "mongodb";

class DataAccess {
  static ModelInstance: any;

  constructor() {} 

  static connect() {
    return new Promise((resolve, reject) => {
      
      if (DataAccess.ModelInstance) resolve(DataAccess.ModelInstance);
      else
        MongoClient.connect(
          process.env.DB_URL,
          { useNewUrlParser: true ,useUnifiedTopology: true },
          (err,client)=> client ? console.log('db-connected')
          : process.exit(1) 
        );
    });
  }
  static test() {
    return new Promise((resolve, reject) => {
      DataAccess.connect().then(ModelInstance => {
        resolve(ModelInstance);
      });
    });
  }
}

export = DataAccess;
