import { NiraSoftManager } from "../../Repositories/Utility/NiraSoftManager";

export class QeshmAirManager extends NiraSoftManager {

  public static sessionId: string = "";

  constructor(signitureData) {
    super(signitureData, "qeshmair", process.env.QESHMAIR_AIRLINE_CODE, "QESHMAIRProvider"
      , process.env.QESHMAIR_AVAILABILITY_WEBSERVICE_ACTION
      , process.env.QESHMAIR_FARE_WEBSERVICE_ACTION
      , process.env.QESHMAIR_RESERVE_WEBSERVICE_ACTION
      , process.env.QESHMAIR_ETISSUE_WEBSERVICE_ACTION,
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

Object.seal(QeshmAirManager);