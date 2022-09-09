import { TravelportManager } from "../../Repositories/Utility/TravelPortManager";

export class TravelportApolloManager extends TravelportManager {

  public static sessionId: string = "";

  constructor(signitureData) {
    super(signitureData, "travelport_1v", "1V")
  }
}

Object.seal(TravelportApolloManager);