import { NiraSoftManager } from "../../Repositories/Utility/NiraSoftManager";

export class TabanManager extends NiraSoftManager {

  public static sessionId: string = "";

  constructor(signitureData) {
    super(signitureData, "taban", process.env.TABAN_AIRLINE_CODE, "TabanProvider"
      , process.env.TABAN_AVAILABILITY_WEBSERVICE_ACTION
      , process.env.TABAN_FARE_WEBSERVICE_ACTION
      , process.env.TABAN_RESERVE_WEBSERVICE_ACTION
      , process.env.TABAN_ETISSUE_WEBSERVICE_ACTION,
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

Object.seal(TabanManager);