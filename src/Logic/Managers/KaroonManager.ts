import { NiraSoftManager } from "../../Repositories/Utility/NiraSoftManager";

export class KaroonManager extends NiraSoftManager {

  public static sessionId: string = "";

  constructor(signitureData) {
    super(signitureData, "karoon", process.env.KAROON_AIRLINE_CODE, "KAROONProvider"
      , process.env.KAROON_AVAILABILITY_WEBSERVICE_ACTION
      , process.env.KAROON_FARE_WEBSERVICE_ACTION
      , process.env.KAROON_RESERVE_WEBSERVICE_ACTION
      , process.env.KAROON_ETISSUE_WEBSERVICE_ACTION,
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

Object.seal(KaroonManager);