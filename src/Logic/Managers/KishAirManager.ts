import { NiraSoftManager } from "../../Repositories/Utility/NiraSoftManager";

export class KishAirManager extends NiraSoftManager {

  public static sessionId: string = "";

  constructor(signitureData) {
    super(signitureData, "kishair", process.env.KISH_AIRLINE_CODE, "KISHAIRProvider"
      , process.env.KISH_AVAILABILITY_WEBSERVICE_ACTION
      , process.env.KISH_FARE_WEBSERVICE_ACTION
      , process.env.KISH_RESERVE_WEBSERVICE_ACTION
      , process.env.KISH_ETISSUE_WEBSERVICE_ACTION,
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

Object.seal(KishAirManager);