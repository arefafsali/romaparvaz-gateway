import { IGatewayImplement } from "../../Repositories/Contracts/IGatewayImplement";
import { ExternalRequest } from "../../Infrastructure/ExternalRequests";
import { createSession } from "../../Assets/PartoCRSRequestTemplate/CreateSession";
import { searchFlight } from "../../Assets/PartoCRSRequestTemplate/SearchFlight";
import { BookFlight } from "../../Assets/PartoCRSRequestTemplate/BookFlight";
import { cancelFlight } from "../../Assets/PartoCRSRequestTemplate/CancelFlight";
const _ = require("lodash");
export class PartoCRSManager { // implements IGatewayImplement {

  public static sessionId: string = "";
  constructor() { }

  getSearch(item: any, callback: (error: any, result: any) => void) {
    this.createSession((err, result) => {
      var _search_flight = new searchFlight();
      this.callApi(item,
        process.env.PARTOCRS_SEARCHFLIGHT_WEBSERVICE_URL, _search_flight, (search_err, search_result) => {
          var _airportCodes = [];
          var _airlineCodes = [];
          var _airplaneCodes = [];
          if (!search_result.Success) callback(search_result.Error.Message, null);
          else {
            var _result = new Array();
            // Map on the result for returning a specifict result
            search_result.PricedItineraries.map(_pricedItinerary => {
              var _elapsedHour = Math.floor(
                (_pricedItinerary.OriginDestinationOptions[0]
                  .JourneyDurationPerMinute +
                  _pricedItinerary.OriginDestinationOptions[0]
                    .ConnectionTimePerMinute) /
                60
              ).toString();
              var _elapsedMin = (
                (_pricedItinerary.OriginDestinationOptions[0]
                  .JourneyDurationPerMinute +
                  _pricedItinerary.OriginDestinationOptions[0]
                    .ConnectionTimePerMinute) %
                60
              ).toString();

              _pricedItinerary = {
                Currency:
                  _pricedItinerary.AirItineraryPricingInfo.ItinTotalFare.Currency,
                ProviderType: "PartoCRS",
                SequenceNumber: _pricedItinerary.FareSourceCode,
                TotalPrice:
                  _pricedItinerary.AirItineraryPricingInfo.ItinTotalFare
                    .TotalFare,
                AdultPrice: {
                  TotalPrice: _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                    ADT => ADT.PassengerTypeQuantity.PassengerType == 1
                  ).length > 0
                    ? _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                      ADT => ADT.PassengerTypeQuantity.PassengerType == 1
                    )[0].PassengerFare.TotalFare
                    : 0,
                  BestFare: _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                    ADT => ADT.PassengerTypeQuantity.PassengerType == 1
                  ).length > 0
                    ? _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                      ADT => ADT.PassengerTypeQuantity.PassengerType == 1
                    )[0].PassengerFare.BaseFare
                    : 0,
                  Tax: _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                    ADT => ADT.PassengerTypeQuantity.PassengerType == 1
                  ).length > 0
                    ? _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                      ADT => ADT.PassengerTypeQuantity.PassengerType == 1
                    )[0].PassengerFare.Taxes[0].Amount
                    : 0
                },

                ChildPrice: {
                  TotalPrice: _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                    CHD => CHD.PassengerTypeQuantity.PassengerType == 2
                  ).length > 0
                    ? _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                      CHD => CHD.PassengerTypeQuantity.PassengerType == 2
                    )[0].PassengerFare.TotalFare
                    : 0,
                  BestFare: _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                    ADT => ADT.PassengerTypeQuantity.PassengerType == 2
                  ).length > 0
                    ? _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                      ADT => ADT.PassengerTypeQuantity.PassengerType == 2
                    )[0].PassengerFare.BaseFare
                    : 0,
                  Tax: _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                    ADT => ADT.PassengerTypeQuantity.PassengerType == 2
                  ).length > 0
                    ? _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                      ADT => ADT.PassengerTypeQuantity.PassengerType == 2
                    )[0].PassengerFare.Taxes[0].Amount
                    : 0
                },

                InfantPrice: {
                  TotalPrice: _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                    CHD => CHD.PassengerTypeQuantity.PassengerType == 3
                  ).length > 0
                    ? _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                      CHD => CHD.PassengerTypeQuantity.PassengerType == 3
                    )[0].PassengerFare.TotalFare
                    : 0,
                  BestFare: _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                    ADT => ADT.PassengerTypeQuantity.PassengerType == 3
                  ).length > 0
                    ? _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                      ADT => ADT.PassengerTypeQuantity.PassengerType == 3
                    )[0].PassengerFare.BaseFare
                    : 0,
                  Tax: _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                    ADT => ADT.PassengerTypeQuantity.PassengerType == 3
                  ).length > 0
                    ? _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                      ADT => ADT.PassengerTypeQuantity.PassengerType == 3
                    )[0].PassengerFare.Taxes[0].Amount
                    : 0
                },
                RefNumber: _pricedItinerary.FareSourceCode,
                DirectionId: _pricedItinerary.DirectionInd,
                ElapsedTime:
                  (_elapsedHour.length == 1 ? "0" + _elapsedHour : _elapsedHour) +
                  (_elapsedMin.length == 1 ? "0" + _elapsedMin : _elapsedMin),
                StopCount: 0,
                Flights: _pricedItinerary.OriginDestinationOptions[0].FlightSegments.map(
                  flight => {
                    // Add cities codes to _citiyCodes object for relation
                    if (flight.DepartureAirportLocationCode)
                      _airportCodes.push(flight.DepartureAirportLocationCode);
                    // Add cities codes to _citiyCodes object for relation
                    if (flight.ArrivalAirportLocationCode)
                      _airportCodes.push(flight.ArrivalAirportLocationCode);
                    if (flight.OperatingAirline) {
                      // Add airline codes to _airlineCodes object for relation
                      _airlineCodes.push(flight.OperatingAirline.Code);
                      // Add airplane codes to _airplaneCodes object for relation
                      _airplaneCodes.push(flight.OperatingAirline.Equipment);
                    }
                    let {
                      DepartureDateTime,
                      ArrivalDateTime,
                      FlightNumber
                    } = flight;
                    return {
                      DepartureDateTime,
                      ArrivalDateTime,
                      FlightNumber,
                      Airports: [],
                      FlightDuration: flight.FlightDuration,
                      IsCharter: flight.IsCharter,
                      ResBookDesigCode: flight.ResBookDesigCode,
                      DepartureAirport: {
                        LocationCode: flight.DepartureAirportLocationCode,
                        Terminal: "",
                        Code: flight.DepartureAirportLocationCode
                      },
                      ArrivalAirport: {
                        LocationCode: flight.ArrivalAirportLocationCode,
                        Terminal: "",
                        Code: flight.ArrivalAirportLocationCode
                      },
                      OperatingAirline: {
                        Code: flight.OperatingAirline.Code
                      },
                      Equipment: {
                        AirEquipType: flight.OperatingAirline.Equipment
                      },
                      MarketingAirline: {
                        Code: flight.OperatingAirline.Code
                      },
                      Baggage: {
                        Index: "0",
                        Quantity: "0",
                        Unit: "KG"
                      },
                      BookingClassAvails: {
                        ResBookDesigCode: flight.ResBookDesigCode,
                        ResBookDesigQuantity: flight.SeatsRemaining
                          ? flight.SeatsRemaining
                          : 0,
                        RPH: "",
                        AvailablePTC: "",
                        ResBookDesigCabinCode: flight.ResBookDesigCode,
                        FareBasis: "",
                        FareType: ""
                      }
                    };
                  }
                )
              };
              _result.push(_pricedItinerary);
            });
            var _request_index = 0;
            var booking_callback = (err, result) => {
              _request_index++;
              if (err == "airport") _airportCodes = result;
              if (err == "airline") _airlineCodes = result;
              if (err == "airplane") _airplaneCodes = result;
              if (_request_index == 3) {
                _result.map(RES =>
                  RES.Flights.map(FLG => {

                    FLG.Airports.push({
                      Code:
                        _airportCodes.filter(
                          CTY => CTY.iata == FLG.DepartureAirport.LocationCode
                        ).length > 0
                          ? _airportCodes.filter(
                            CTY => CTY.iata == FLG.DepartureAirport.LocationCode
                          )[0].iata
                          : FLG.DepartureAirport.LocationCode,
                      Name:
                        _airportCodes.filter(
                          CTY => CTY.iata == FLG.DepartureAirport.LocationCode
                        ).length > 0
                          ? _airportCodes.filter(
                            CTY => CTY.iata == FLG.DepartureAirport.LocationCode
                          )[0].name
                          : FLG.DepartureAirport.LocationCode
                    }),
                      FLG.Airports.push({
                        Code:
                          _airportCodes.filter(
                            CTY => CTY.iata == FLG.ArrivalAirport.LocationCode
                          ).length > 0
                            ? _airportCodes.filter(
                              CTY => CTY.iata == FLG.ArrivalAirport.LocationCode
                            )[0].iata
                            : FLG.ArrivalAirport.LocationCode,
                        Name:
                          _airportCodes.filter(
                            CTY => CTY.iata == FLG.ArrivalAirport.LocationCode
                          ).length > 0
                            ? _airportCodes.filter(
                              CTY => CTY.iata == FLG.ArrivalAirport.LocationCode
                            )[0].name
                            : FLG.ArrivalAirport.LocationCode
                      }),

                      (FLG.DepartureAirport.LocationCode =
                        _airportCodes.filter(
                          CTY => CTY.iata == FLG.DepartureAirport.LocationCode
                        ).length > 0
                          ? _airportCodes.filter(
                            CTY => CTY.iata == FLG.DepartureAirport.LocationCode
                          )[0].location[0].name
                          : FLG.DepartureAirport.LocationCode),
                      (FLG.ArrivalAirport.LocationCode =
                        _airportCodes.filter(
                          CTY => CTY.iata == FLG.ArrivalAirport.LocationCode
                        ).length > 0
                          ? _airportCodes.filter(
                            CTY => CTY.iata == FLG.ArrivalAirport.LocationCode
                          )[0].location[0].name
                          : FLG.ArrivalAirport.LocationCode),
                      (FLG.OperatingAirline.Code =
                        _airlineCodes.filter(
                          ARP => ARP.code == FLG.OperatingAirline.Code
                        ).length > 0
                          ? _airlineCodes.filter(
                            ARP => ARP.code == FLG.OperatingAirline.Code
                          )[0].name
                          : FLG.OperatingAirline.Code),
                      (FLG.MarketingAirline.Code =
                        _airlineCodes.filter(
                          ARP => ARP.code == FLG.OperatingAirline.Code
                        ).length > 0
                          ? _airlineCodes.filter(
                            ARP => ARP.code == FLG.OperatingAirline.Code
                          )[0].name
                          : FLG.OperatingAirline.Code),
                      (FLG.Equipment.AirEquipType =
                        _airplaneCodes.filter(
                          ARP => ARP.code == FLG.Equipment.AirEquipType
                        ).length > 0
                          ? _airplaneCodes.filter(
                            ARP => ARP.code == FLG.Equipment.AirEquipType
                          )[0].name
                          : FLG.Equipment.AirEquipType);
                  })
                );
                //this.getSearchCalendar(item, (cal_err, cal_result) => {
                //callback(null, _result);
                callback(null, {
                  flights: _result,
                  airlines: _airlineCodes,
                  airports: _airportCodes,
                  calendar: [],
                  stopCount: _result
                    .map(res => {
                      if (!item.roundTrip) return res.Flights.length - 1;
                      else {
                        return (
                          (res[0].Flights.length > res[1].Flights.length
                            ? res[0].Flights.length
                            : res[1].Flights.length) - 1
                        );
                      }
                    })
                    .filter((v, i, a) => a.indexOf(v) === i)
                });
                //});
              }
            };
            ExternalRequest.syncPostRequest(
              process.env.MAIN_URL + "airport/codes_list",
              null,
              _airportCodes,
              (err, result) => {
                booking_callback("airport", result.payload.data);
              }
            );
            ExternalRequest.syncPostRequest(
              process.env.MAIN_URL + "airline/codes_list",
              null,
              _airlineCodes,
              (err, result) => {
                booking_callback("airline", result.payload.data);
              }
            );
            ExternalRequest.syncPostRequest(
              process.env.MAIN_URL + "airplane/codes_list",
              null,
              _airplaneCodes,
              (err, result) => {
                booking_callback("airplane", result.payload.data);
              }
            );
          }
        });
    });
  }

  // Get the original result from Search API of Amadeus for develop version
  getOriginal(item: any, callback: (error: any, result: any) => void) {
    this.createSession((err, result) => {
      var _search_flight = new searchFlight();
      this.callApi(
        item,
        process.env.PARTOCRS_SEARCHFLIGHT_WEBSERVICE_URL, _search_flight,
        (err, data) => {
          callback(null, data);
        }
      );
    });
  }

  // Get ping result for checking the connection and number of request
  getPing(callback: (error: any, result: any) => void) { }

  // Get lowest fare for a period of times
  getSearchCalendar(item: any, callback: (error: any, result: any) => void) {
    var date = new Date(item.departDate);
    var today = new Date(); // Get today date

    if (
      Math.floor(
        Math.abs(date.getTime() - new Date().getTime()) / (1000 * 3600 * 24)
      ) < 3
    ) {
      // Check if the date is less than 3 day to pass the middle day of the 7 days
      today.setDate(today.getDate() + 3);
      date = new Date(today.toISOString().split("T")[0]);
      item.departDate = today.toISOString().split("T")[0];
    } else {
      // Plus 3 days to requested date for sending the middle day of 7 days
      date.setDate(date.getDate() + 3);
      item.departDate = date.toISOString().split("T")[0];
    }
    if (item.isWeek)
      // Check if request needs only 7 days
      this.callSearchCalendar(item, (err, result) => {
        callback(null, _.orderBy(result, ["Date"], ["asc"]));
      });
    else {
      // check if request needs 28 days
      var _callIndex = 0;
      var final_result = [];
      // Result callback for all of 4 call request to get 28 days
      var result_callback = (err, result) => {
        _callIndex++;
        if (result) final_result = [...final_result, ...result.map(res => res)];
        if (_callIndex == 4)
          // If all of 4 request is complete to send the result
          callback(null, _.orderBy(final_result, ["Date"], ["asc"]));
      };

      // Get every 7 days using one fuction for all of 28 days
      this.callSearchCalendar(item, result_callback);
      date.setDate(date.getDate() + 7);
      item.departDate = date.toISOString().split("T")[0];
      this.callSearchCalendar(item, result_callback);
      date.setDate(date.getDate() + 7);
      item.departDate = date.toISOString().split("T")[0];
      this.callSearchCalendar(item, result_callback);
      date.setDate(date.getDate() + 7);
      item.departDate = date.toISOString().split("T")[0];
      this.callSearchCalendar(item, result_callback);
    }
  }

  callSearchCalendar(item: any, callback: (error: any, result: any) => void) {
    this.createSession((err, result) => {

      var _search_flight = new searchFlight();
      this.callApi(item,
        process.env.PARTOCRS_SEARCHFLIGHT_WEBSERVICE_URL, _search_flight, (search_err, search_result) => {
          if (!search_result.Success) callback(search_result.Error.Message, null);
          else {
            search_result.PricedItineraries.map(_pricedItinerary => {
              _pricedItinerary = {

                Date:
                  _pricedItinerary.OriginDestinationOptions[0].FlightSegments[0].DepartureDateTime,


                AdultPrice: {
                  TotalPrice: _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                    ADT => ADT.PassengerTypeQuantity.PassengerType == 1
                  ).length > 0
                    ? _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                      ADT => ADT.PassengerTypeQuantity.PassengerType == 1
                    )[0].PassengerFare.TotalFare
                    : 0,
                  BestFare: _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                    ADT => ADT.PassengerTypeQuantity.PassengerType == 1
                  ).length > 0
                    ? _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                      ADT => ADT.PassengerTypeQuantity.PassengerType == 1
                    )[0].PassengerFare.BaseFare
                    : 0,
                  Tax: _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                    ADT => ADT.PassengerTypeQuantity.PassengerType == 1
                  ).length > 0
                    ? _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                      ADT => ADT.PassengerTypeQuantity.PassengerType == 1
                    )[0].PassengerFare.Taxes[0].Amount
                    : 0
                },

                ChildPrice: {
                  TotalPrice: _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                    CHD => CHD.PassengerTypeQuantity.PassengerType == 2
                  ).length > 0
                    ? _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                      CHD => CHD.PassengerTypeQuantity.PassengerType == 2
                    )[0].PassengerFare.TotalFare
                    : 0,
                  BestFare: _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                    ADT => ADT.PassengerTypeQuantity.PassengerType == 2
                  ).length > 0
                    ? _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                      ADT => ADT.PassengerTypeQuantity.PassengerType == 2
                    )[0].PassengerFare.BaseFare
                    : 0,
                  Tax: _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                    ADT => ADT.PassengerTypeQuantity.PassengerType == 2
                  ).length > 0
                    ? _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                      ADT => ADT.PassengerTypeQuantity.PassengerType == 2
                    )[0].PassengerFare.Taxes[0].Amount
                    : 0
                },

                InfantPrice: {
                  TotalPrice: _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                    CHD => CHD.PassengerTypeQuantity.PassengerType == 3
                  ).length > 0
                    ? _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                      CHD => CHD.PassengerTypeQuantity.PassengerType == 3
                    )[0].PassengerFare.TotalFare
                    : 0,
                  BestFare: _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                    ADT => ADT.PassengerTypeQuantity.PassengerType == 3
                  ).length > 0
                    ? _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                      ADT => ADT.PassengerTypeQuantity.PassengerType == 3
                    )[0].PassengerFare.BaseFare
                    : 0,
                  Tax: _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                    ADT => ADT.PassengerTypeQuantity.PassengerType == 3
                  ).length > 0
                    ? _pricedItinerary.AirItineraryPricingInfo.PtcFareBreakdown.filter(
                      ADT => ADT.PassengerTypeQuantity.PassengerType == 3
                    )[0].PassengerFare.Taxes[0].Amount
                    : 0
                },

              }
            });
          }
        });
    });
    // this.callApi(
    //   item,
    //   process.env.AMADEUS_SEARCHCALENDAR_SOAP_ACTION,
    //   item.roundTrip
    //     ? "SearchFlightCalendarRoundTrip.xml"
    //     : "SearchFlightCalendarOneWay.xml",
    //   (err, data) => {
    //     var _body =
    //       data["soap:Envelope"]["soap:Body"][0].SearchFlightCalendarResponse[0]
    //         .OTA_AirLowFareSearchRS[0];
    //     if (_body.Errors) {
    //       callback(_body.Errors[0].Error[0].$.ShortText, null);
    //     } else {
    //       var final_data =
    //         data["soap:Envelope"]["soap:Body"][0]
    //           .SearchFlightCalendarResponse[0].OTA_AirLowFareSearchRS[0]
    //           .PricedItineraries[0].PricedItinerary;
    //       var _result = new Array();
    //       final_data = final_data.map(_pricedItinerary => ({
    //         // return _pricedItinerary.AirItinerary[0].OriginDestinationOptions[0].OriginDestinationOption.map(
    //         //   _originDestinationOption => {
    //         //     _result.push({
    //         Date:
    //           _pricedItinerary.AirItinerary[0].OriginDestinationOptions[0]
    //             .OriginDestinationOption[0].FlightSegment[0].$
    //             .DepartureDateTime,
    //         Currency: _pricedItinerary.$.Currency,
    //         AdultPrice:
    //           _pricedItinerary.AirItineraryPricingInfo[0].PTC_FareBreakdowns[0].PTC_FareBreakdown.filter(
    //             ADT => ADT.PassengerTypeQuantity[0].$.Code == "ADT"
    //           ).length > 0
    //             ? _pricedItinerary.AirItineraryPricingInfo[0].PTC_FareBreakdowns[0].PTC_FareBreakdown.filter(
    //               ADT => ADT.PassengerTypeQuantity[0].$.Code == "ADT"
    //             )[0].PassengerFare[0].TotalFare[0].$.Amount
    //             : 0,
    //         ChildPrice:
    //           _pricedItinerary.AirItineraryPricingInfo[0].PTC_FareBreakdowns[0].PTC_FareBreakdown.filter(
    //             CHD => CHD.PassengerTypeQuantity[0].$.Code == "CHD"
    //           ).length > 0
    //             ? _pricedItinerary.AirItineraryPricingInfo[0].PTC_FareBreakdowns[0].PTC_FareBreakdown.filter(
    //               CHD => CHD.PassengerTypeQuantity[0].$.Code == "CHD"
    //             )[0].PassengerFare[0].TotalFare[0].$.Amount
    //             : 0
    //         //     });
    //         //   }
    //         // );
    //       }));
    //       callback(null, final_data);
    //     }
    //   }
    // );
  }

  getFlightBook(item: any, callback: (error: any, result: any) => void) {
    this.createSession((err, result) => {
      var _book_flight = new BookFlight();
      this.callApi(item,
        process.env.PARTOCRS_BOOKFLIGHT_WEBSERVICE_URL, _book_flight, (book_err, book_result) => {
          if (!book_result.Success) callback(book_result.Error.Message, null);
          else {
            callback(null, book_result);
          }
        });
    });
  }

  getCancel(item: any, callback: (error: any, result: any) => void) {
    this.createSession((err, result) => {
      var _cancel_flight = new cancelFlight(PartoCRSManager.sessionId);
      this.callApi(item,
        process.env.PARTOCRS_CANCELFLIGHT_WEBSERVICE_URL, _cancel_flight, (cancel_err, cancel_result) => {
          if (!cancel_result.Success) callback(cancel_result.Error.Message, null);
          else {
            callback(null, cancel_result);
          }
        });
    });
  }

  getAirOrderTicket(item: any, callback: (error: any, result: any) => void) {

  }

  getPrice(item: any, callback: (error: any, result: any) => void) { }

  callApi(
    item: any,
    url: string,
    template_url: any,
    callback: (error: any, result: any) => void
  ) {
    //console.log(typeof template_url);
    //console.log(item);
    let issearchtypeof = template_url instanceof searchFlight;
    let isbookflight = template_url instanceof BookFlight;
    let iscancelflight = template_url instanceof cancelFlight;

    if (issearchtypeof) {
      template_url.AdultCount = item.adult;
      template_url.ChildCount = item.child;
      template_url.InfantCount = item.infant;
      template_url.SessionId = PartoCRSManager.sessionId;
      template_url.OriginDestinationInformations[0].DestinationLocationCode =
        item.destination;
      template_url.OriginDestinationInformations[0].OriginLocationCode =
        item.origin;
      template_url.OriginDestinationInformations[0].DepartureDateTime = item.departDate;
    } else if (isbookflight) {
      template_url.SessionId = PartoCRSManager.sessionId;
      template_url.FareSourceCode = item.RefNumber;
      template_url.TravelerInfo = {
        "PhoneNumber": item.PhoneNumber,
        "Email": item.Email,
        "AirTravelers": [
          {
            "DateOfBirth": "1990-11-01T00:00:00",
            "Gender": item.Gender,
            "PassengerType": item.PassengerType,
            "PassengerName": {
              "PassengerFirstName": item.FirstName,
              "PassengerMiddleName": "",
              "PassengerLastName": item.LastName,
              "PassengerTitle": item.PassengerTitle
            },
            "Passport": {
              "Country": item.Country,
              "ExpiryDate": "2025-11-01T00:00:00",
              "IssueDate": "2016-05-06T00:00:00",
              "PassportNumber": item.PassportNumber
            },
            "NationalId": item.NationalId,
            "Nationality": item.Nationality,
            "ExtraServiceId": [
              "sample string 1"
            ],
            "FrequentFlyerNumber": "123456789",
            "SeatPreference": 0,
            "MealPreference": 0,
            "Wheelchair": false
          }
        ]
      };
    } else if (iscancelflight) {
      template_url.uniqueid = item.uniqueid;
    }
    ExternalRequest.syncPostRequest(
      url,
      null,
      template_url,
      callback
    );
  }

  createSession(callback: (error: any, result: any) => void) {
    if (!PartoCRSManager.sessionId) {
      var session = new createSession();
      ExternalRequest.syncPostRequest(
        process.env.PARTOCRS_CREATESESSION_WEBSERVICE_URL,
        null,
        session,
        (err, result) => {
          PartoCRSManager.sessionId = result.payload.data.SessionId;
          callback(null, PartoCRSManager.sessionId);
        }
      );
    } else callback(null, PartoCRSManager.sessionId);
  }

  endSession(callback: (error: any, result: any) => void) {
    if (!PartoCRSManager.sessionId) {
      var endSession = new endSession(PartoCRSManager.sessionId);
      ExternalRequest.syncPostRequest(
        process.env.PARTOCRS_ENDSESSION_WEBSERVICE_URL,
        null,
        endSession, (err, result) => {
          callback(null, result.payload.data);
        }
      );
    } else callback(null, PartoCRSManager.sessionId);
  }

}
Object.seal(PartoCRSManager);
