import { NiraSoftManager } from "../../Repositories/Utility/NiraSoftManager";

export class MerajManager extends NiraSoftManager {

  public static sessionId: string = "";

  constructor(signitureData) {
    super(signitureData, "meraj", process.env.MERAJ_AIRLINE_CODE, "MERAJProvider"
      , process.env.MERAJ_AVAILABILITY_WEBSERVICE_ACTION
      , process.env.MERAJ_FARE_WEBSERVICE_ACTION
      , process.env.MERAJ_RESERVE_WEBSERVICE_ACTION
      , process.env.MERAJ_ETISSUE_WEBSERVICE_ACTION,
      [{
        Index: "1",
        Quantity: "20",
        Type: "ADT",
        Unit: "KG"
      }, {
        Index: "2",
        Quantity: "20",
        Type: "CHD",
        Unit: "KG"
      }, {
        Index: "3",
        Quantity: "10",
        Type: "INF",
        Unit: "KG"
      }], "2", "2")
  }
}

Object.seal(MerajManager);