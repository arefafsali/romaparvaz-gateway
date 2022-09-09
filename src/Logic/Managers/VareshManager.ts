import { NiraSoftManager } from "../../Repositories/Utility/NiraSoftManager";

export class VareshManager extends NiraSoftManager {

  public static sessionId: string = "";

  constructor(signitureData) {
    super(signitureData, "varesh", process.env.VARESH_AIRLINE_CODE, "VareshProvider"
      , process.env.VARESH_AVAILABILITY_WEBSERVICE_ACTION
      , process.env.VARESH_FARE_WEBSERVICE_ACTION
      , process.env.VARESH_RESERVE_WEBSERVICE_ACTION
      , process.env.VARESH_ETISSUE_WEBSERVICE_ACTION,
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

Object.seal(VareshManager);