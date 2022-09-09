import { NiraSoftManager } from "../../Repositories/Utility/NiraSoftManager";

export class AsemanManager extends NiraSoftManager {

  // public static sessionId: string = "";

  constructor(signitureData) {
    super(signitureData, "aseman", process.env.ASEMAN_AIRLINE_CODE, "AsemanProvider"
      , process.env.ASEMAN_AVAILABILITY_WEBSERVICE_ACTION
      , process.env.ASEMAN_FARE_WEBSERVICE_ACTION
      , process.env.ASEMAN_RESERVE_WEBSERVICE_ACTION
      , process.env.ASEMAN_ETISSUE_WEBSERVICE_ACTION,
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

Object.seal(AsemanManager);