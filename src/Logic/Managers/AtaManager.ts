import { NiraSoftManager } from "../../Repositories/Utility/NiraSoftManager";

export class AtaManager extends NiraSoftManager {

  public static sessionId: string = "";

  constructor(signitureData) {
    super(signitureData, "ata", process.env.ATA_AIRLINE_CODE, "ATAProvider"
      , process.env.ATA_AVAILABILITY_WEBSERVICE_ACTION
      , process.env.ATA_FARE_WEBSERVICE_ACTION
      , process.env.ATA_RESERVE_WEBSERVICE_ACTION
      , process.env.ATA_ETISSUE_WEBSERVICE_ACTION,
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

Object.seal(AtaManager);