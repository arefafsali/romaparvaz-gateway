import { NiraSoftManager } from "../../Repositories/Utility/NiraSoftManager";

export class ParsAirManager extends NiraSoftManager {

  public static sessionId: string = "";

  constructor(signitureData) {
    super(signitureData, "parsair", process.env.PARSAIR_AIRLINE_CODE, "PARSAIRProvider"
      , process.env.PARSAIR_AVAILABILITY_WEBSERVICE_ACTION
      , process.env.PARSAIR_FARE_WEBSERVICE_ACTION
      , process.env.PARSAIR_RESERVE_WEBSERVICE_ACTION
      , process.env.PARSAIR_ETISSUE_WEBSERVICE_ACTION,
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

Object.seal(ParsAirManager);