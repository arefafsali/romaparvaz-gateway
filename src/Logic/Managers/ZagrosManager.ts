import { NiraSoftManager } from "../../Repositories/Utility/NiraSoftManager";

export class ZagrosManager extends NiraSoftManager {

  public static sessionId: string = "";

  constructor(signitureData) {
    super(signitureData, "zagros", process.env.ZAGROS_AIRLINE_CODE, "ZagrosProvider"
      , process.env.ZAGROS_AVAILABILITY_WEBSERVICE_ACTION
      , process.env.ZAGROS_FARE_WEBSERVICE_ACTION
      , process.env.ZAGROS_RESERVE_WEBSERVICE_ACTION
      , process.env.ZAGROS_ETISSUE_WEBSERVICE_ACTION,
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
      }], "1", "2")
  }
}

Object.seal(ZagrosManager);