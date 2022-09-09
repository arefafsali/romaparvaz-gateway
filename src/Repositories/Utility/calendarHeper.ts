import { gatewaySearchInputItinerary } from "../../Common/Metadata/gatewayLogicInputMetadata";

export class calendarHelper {
  public static generateCalendarDates = (itinerary: gatewaySearchInputItinerary) => {
    let today = new Date(new Date().toISOString().split("T")[0] + "T10:00:00");
    let itinDate = new Date(itinerary.departDate + "T10:00:00");
    let result: string[] = [];
    if (Math.floor(Math.abs(itinDate.getTime() - today.getTime()) / (1000 * 3600 * 24)) < 3) {
      itinDate.setDate(today.getDate() + 3);
    }
    for (let dateOffset = -3; dateOffset <= +3; dateOffset++) {
      let date = new Date(itinDate);
      date.setDate(date.getDate() + dateOffset);
      result.push(date.toISOString().split('T')[0]);
    }
    return result;
  }
}