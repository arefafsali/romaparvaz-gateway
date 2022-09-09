import { NiraSoftManager } from "../../Repositories/Utility/NiraSoftManager";

export class SahaManager extends NiraSoftManager {

  public static sessionId: string = "";

  constructor(signitureData) {
    super(signitureData, "saha", process.env.SAHA_AIRLINE_CODE, "SahaProvider"
      , process.env.SAHA_AVAILABILITY_WEBSERVICE_ACTION
      , process.env.SAHA_FARE_WEBSERVICE_ACTION
      , process.env.SAHA_RESERVE_WEBSERVICE_ACTION
      , process.env.SAHA_ETISSUE_WEBSERVICE_ACTION,
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

Object.seal(SahaManager);