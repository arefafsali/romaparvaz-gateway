import { TravelportManager } from "../../Repositories/Utility/TravelPortManager";

export class TravelportWorldspanManager extends TravelportManager {

  public static sessionId: string = "";

  constructor(signitureData) {
    super(signitureData, "travelport_1p", "1P")
  }
}

Object.seal(TravelportWorldspanManager);