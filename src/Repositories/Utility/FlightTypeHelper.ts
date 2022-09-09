import { gatewaySearchInputItinerary } from "../../Common/Metadata/gatewayLogicInputMetadata";

export class FlightTypeHelper {
  public static checkRoundTripFlight(itineraries: gatewaySearchInputItinerary[]): boolean {
    if (itineraries.length == 2 &&
      itineraries[0].destination == itineraries[1].origin &&
      itineraries[1].destination == itineraries[0].origin &&
      itineraries[0].isDestinationLocation == itineraries[1].isOriginLocation &&
      itineraries[1].isDestinationLocation == itineraries[0].isOriginLocation)
      return true;
    return false;
  }

  public static checkInternationalItinarary(itinerary: gatewaySearchInputItinerary): boolean {
    if (itinerary.destinationCountryCode != "IR" || itinerary.originCountryCode != "IR")
      return true;
    return false;
  }
}