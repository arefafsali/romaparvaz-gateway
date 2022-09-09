import { NiraSoftManager } from "../../Repositories/Utility/NiraSoftManager";

export class CaspianManager extends NiraSoftManager {

  public static sessionId: string = "";

  constructor(signitureData) {
    super(signitureData, "caspian", process.env.CASPIAN_AIRLINE_CODE, "CaspianProvider"
      , process.env.CASPIAN_AVAILABILITY_WEBSERVICE_ACTION
      , process.env.CASPIAN_FARE_WEBSERVICE_ACTION
      , process.env.CASPIAN_RESERVE_WEBSERVICE_ACTION
      , process.env.CASPIAN_ETISSUE_WEBSERVICE_ACTION,
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
      }], "4", "6")
  }
}

Object.seal(CaspianManager);