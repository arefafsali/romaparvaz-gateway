import { TravelportManager } from "../../Repositories/Utility/TravelPortManager";

export class TravelportGalileoManager extends TravelportManager {

  public static sessionId: string = "";

  constructor(signitureData) {
    super(signitureData, "travelport_1g", "1G")
  }
}

Object.seal(TravelportGalileoManager);