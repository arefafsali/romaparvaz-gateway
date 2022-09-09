import { NiraSoftManager } from "../../Repositories/Utility/NiraSoftManager";

export class FlyPersiaManager extends NiraSoftManager {

  public static sessionId: string = "";

  constructor(signitureData) {
    super(signitureData, "flypersia", process.env.FLYPERSIA_AIRLINE_CODE, "FLYPERSIAProvider"
      , process.env.FLYPERSIA_AVAILABILITY_WEBSERVICE_ACTION
      , process.env.FLYPERSIA_FARE_WEBSERVICE_ACTION
      , process.env.FLYPERSIA_RESERVE_WEBSERVICE_ACTION
      , process.env.FLYPERSIA_ETISSUE_WEBSERVICE_ACTION,
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

Object.seal(FlyPersiaManager);