import { ExternalRequest } from "../../Infrastructure/ExternalRequests";

export class FlightBookingClassHelper {
  public static getAirlineCabins(airlineCode: string) {
    return new Promise((resolve, reject) => {
      ExternalRequest.syncGetRequest(process.env.MAIN_URL + `flight_booking_class/airline_with_cabin/${airlineCode}`, undefined)
        .then((result: any) => resolve(result.payload.data))
        .catch(err => reject(err))
    })
  }
}