import { IGatewayImplement } from "../../Repositories/Contracts/IGatewayImplement";
import { ExternalRequest } from "../../Infrastructure/ExternalRequests";
import {
  gatewaySearchInput,
  amadeusSession,
  gatewaySearchInputItinerary,
  gatewayLogicOutput,
  gatewayInputOptions,
  gatewayRuleInput,
} from "../../Common/Metadata/gatewayLogicInputMetadata";
import {
  gatewaySearchFlightResult,
  searchFlightResult,
  priceObject,
  searchFlightItinerary,
  itineraryFlightSegment,
  searchCalendarResult,
  nameObject,
} from "../../Common/Metadata/gatewaySearchResultMetadata";
import { errorObj } from "../../Common/Metadata/errorObjMetadata";
import { TimeToString } from "../../Repositories/Utility/TimeToString";
import { FlightTypeHelper } from "../../Repositories/Utility/FlightTypeHelper";
import { MarkupHelper } from "../../Repositories/Utility/MarkupHelper";
import {
  gatewayRulesResult,
  CancelingRule,
} from "../../Common/Metadata/gatewayRulesResultMetadata";
import {
  gatewayBookInternalResult,
  gatewayBookInternalData,
} from "../../Common/Metadata/gatewayBookResultMetadata";
import { gatewayTicketInternalResult } from "../../Common/Metadata/gatewayTicketResultMetadata";
import * as crypto from "crypto";
import { writeFile } from "fs";
import { logHelper } from "../../Repositories/Utility/logHelper";

const soapRequest = require("easy-soap-request");
const fs = require("fs");
var parseString = require("xml2js").parseString;
const _ = require("lodash");
const sessionMaxTime = parseInt(process.env.AMADEUS_MAX_SESSION_TIME);
const sessionMainName = process.env.AMADEUS_SESSION_MAIN_COOKIE_NAME + "=";
const securityNumber = process.env.AMADEUS_WEB_SERVICE_SECURITY_NUMBER;
let sha1hash = crypto.createHash("sha1");
const logFlag = true;

export class AmadeusManager implements IGatewayImplement {
  private signitureData: any;

  constructor(signitureData) {
    this.signitureData = signitureData;
  }

  // Call Search API from Amadeus webservice using SearchFlight XML template
  getSearch(
    item: gatewaySearchInput,
    session: amadeusSession,
    calendarResultNotRequired?: boolean,
    loggedInUser?: any,
    options?: gatewayInputOptions
  ) {
    return new Promise(
      (
        resolve: (result: gatewaySearchFlightResult) => void,
        reject: (error: errorObj) => void
      ) => {
        let calculateMarkup = (
          item: gatewaySearchInput,
          result: gatewaySearchFlightResult
        ) => {
          MarkupHelper.calculateMarkup(
            loggedInUser,
            "amadeus",
            item,
            result,
            options
          )
            .then((newResult: gatewaySearchFlightResult) => {
              resolve(newResult);
            })
            .catch((err) => {
              console.log(err);
              // error on fetch markup
              // return bare result for now
              resolve(result);
            });
        };
        let searchCallBack = (result: gatewayLogicOutput) => {
          // Find the body for checking error in it
          let data = result.body;
          var _body =
            data["soap:Envelope"]["soap:Body"][0].SearchFlightResponse[0]
              .OTA_AirLowFareSearchRS[0];
          if (_body.Errors)
            reject(
              new errorObj(
                "amadeusSearchError",
                "",
                _body.Errors[0].Error[0].$.ShortText,
                "Amadeus Manager -> Search",
                data
              )
            );
          else {
            // Find the list of flights in response
            var final_data =
              data["soap:Envelope"]["soap:Body"][0].SearchFlightResponse[0]
                .OTA_AirLowFareSearchRS[0].PricedItineraries[0];
            var _result = new gatewaySearchFlightResult();
            _result.session = result.session;

            // Map on the result for returning a specifict result
            final_data.PricedItinerary = final_data.PricedItinerary.map(
              (_pricedItinerary) => {
                _pricedItinerary.AirItinerary[0].OriginDestinationCombinations[0].OriginDestinationCombination.map(
                  (ogc) => {
                    let _flightData = new searchFlightResult();
                    let generatePriceObject = (fare) => {
                      let _fareResult = new priceObject();
                      let quantity = fare.PassengerTypeQuantity[0].$.Quantity
                        ? fare.PassengerTypeQuantity[0].$.Quantity
                        : "1";
                      _fareResult.BaseFare =
                        fare.PassengerFare[0].BaseFare[0].$.Amount;
                      _fareResult.Tax =
                        fare.PassengerFare[0].Taxes[0].Tax[0].$.Amount;
                      _fareResult.TotalPrice =
                        fare.PassengerFare[0].TotalFare[0].$.Amount;
                      _fareResult.TicketDesignators = fare.TicketDesignators
                        ? fare.TicketDesignators[0].TicketDesignator.map(
                            (td) => {
                              return {
                                Code: td.$.TicketDesignatorCode,
                                Extension: td.$.TicketDesignatorExtension,
                              };
                            }
                          )
                        : [];
                      return _fareResult;
                    };
                    _flightData.Currency = _pricedItinerary.$.Currency;
                    _flightData.ProviderType = _pricedItinerary.$.ProviderType;
                    _flightData.SequenceNumber =
                      _pricedItinerary.$.SequenceNumber;
                    _flightData.CombinationId = ogc.$.CombinationID;
                    _flightData.ValidatingAirlineCode =
                      ogc.$.ValidatingAirlineCode;
                    _flightData.ForceETicket = ogc.$.ForceETicket;
                    _flightData.E_TicketEligibility = ogc.$.E_TicketEligibility;
                    _flightData.ServiceFeeAmount = ogc.$.ServiceFeeAmount;
                    _flightData.TotalPrice = parseFloat(
                      _pricedItinerary.AirItineraryPricingInfo[0]
                        .ItinTotalFare[0].TotalFare[0].$.Amount
                    );

                    let _tempPrice =
                      _pricedItinerary.AirItineraryPricingInfo[0].PTC_FareBreakdowns[0].PTC_FareBreakdown.some(
                        (fare) => fare.PassengerTypeQuantity[0].$.Code == "ADT"
                      )
                        ? _pricedItinerary.AirItineraryPricingInfo[0].PTC_FareBreakdowns[0].PTC_FareBreakdown.filter(
                            (fare) =>
                              fare.PassengerTypeQuantity[0].$.Code == "ADT"
                          ).map(generatePriceObject)[0]
                        : new priceObject();
                    _flightData.AdultPrice.BaseFare = parseFloat(
                      _tempPrice.BaseFare
                    );
                    _flightData.AdultPrice.Tax = parseFloat(_tempPrice.Tax);
                    _flightData.AdultPrice.TicketDesignators =
                      _tempPrice.TicketDesignator;
                    _flightData.AdultPrice.TotalPrice = parseFloat(
                      _tempPrice.TotalPrice
                    );

                    _tempPrice =
                      _pricedItinerary.AirItineraryPricingInfo[0].PTC_FareBreakdowns[0].PTC_FareBreakdown.some(
                        (fare) => fare.PassengerTypeQuantity[0].$.Code == "CHD"
                      )
                        ? _pricedItinerary.AirItineraryPricingInfo[0].PTC_FareBreakdowns[0].PTC_FareBreakdown.filter(
                            (fare) =>
                              fare.PassengerTypeQuantity[0].$.Code == "CHD"
                          ).map(generatePriceObject)[0]
                        : new priceObject();
                    _flightData.ChildPrice.BaseFare = parseFloat(
                      _tempPrice.BaseFare
                    );
                    _flightData.ChildPrice.Tax = parseFloat(_tempPrice.Tax);
                    _flightData.ChildPrice.TicketDesignators =
                      _tempPrice.TicketDesignator;
                    _flightData.ChildPrice.TotalPrice = parseFloat(
                      _tempPrice.TotalPrice
                    );

                    _tempPrice =
                      _pricedItinerary.AirItineraryPricingInfo[0].PTC_FareBreakdowns[0].PTC_FareBreakdown.some(
                        (fare) => fare.PassengerTypeQuantity[0].$.Code == "INF"
                      )
                        ? _pricedItinerary.AirItineraryPricingInfo[0].PTC_FareBreakdowns[0].PTC_FareBreakdown.filter(
                            (fare) =>
                              fare.PassengerTypeQuantity[0].$.Code == "INF"
                          ).map(generatePriceObject)[0]
                        : new priceObject();
                    _flightData.InfantPrice.BaseFare = parseFloat(
                      _tempPrice.BaseFare
                    );
                    _flightData.InfantPrice.Tax = parseFloat(_tempPrice.Tax);
                    _flightData.InfantPrice.TicketDesignators =
                      _tempPrice.TicketDesignator;
                    _flightData.InfantPrice.TotalPrice = parseFloat(
                      _tempPrice.TotalPrice
                    );

                    let refIds = ogc.$.IndexList.split(";");

                    for (let index = 0; index < refIds.length; index++) {
                      const itineraryRefId = refIds[index];
                      let _originalItinerary =
                        _pricedItinerary.AirItinerary[0].OriginDestinationOptions[0].OriginDestinationOption.filter(
                          (odo) =>
                            odo.$.DirectionId == index.toString() &&
                            odo.$.RefNumber == itineraryRefId
                        )[0];
                      let _itinerary = new searchFlightItinerary();

                      //#region Map amadeus data
                      _itinerary.DirectionId = _originalItinerary.$.DirectionId;
                      _itinerary.ElapsedTime = _originalItinerary.$.ElapsedTime;
                      _itinerary.RefNumber = _originalItinerary.$.RefNumber;
                      _itinerary.StopCount =
                        _originalItinerary.FlightSegment.length - 1;

                      let _tempStopTime: number = 0;

                      _originalItinerary.FlightSegment.map((flight, index) => {
                        if (index > 0)
                          _tempStopTime +=
                            new Date(flight.$.DepartureDateTime).getTime() -
                            new Date(
                              _originalItinerary.FlightSegment[
                                index - 1
                              ].$.ArrivalDateTime
                            ).getTime();
                        let _itineraryFlight = new itineraryFlightSegment();
                        _itineraryFlight.DepartureDateTime =
                          flight.$.DepartureDateTime;
                        _itineraryFlight.ArrivalDateTime =
                          flight.$.ArrivalDateTime;
                        _itineraryFlight.FlightNumber = flight.$.FlightNumber;
                        _itineraryFlight.ResBookDesigCode =
                          flight.$.ResBookDesigCode;
                        _itineraryFlight.FlightDuration =
                          flight.FlightDuration[0] &&
                          typeof flight.FlightDuration[0] == "string"
                            ? flight.FlightDuration[0]
                                .split("T")[1]
                                .split(":")[0] +
                              ":" +
                              flight.FlightDuration[0]
                                .split("T")[1]
                                .split(":")[1]
                            : _originalItinerary.FlightSegment.length == 1
                            ? _originalItinerary.$.ElapsedTime.substr(0, 2) +
                              ":" +
                              _originalItinerary.$.ElapsedTime.substr(2, 2)
                            : "0";
                        _itineraryFlight.DepartureAirport.Code =
                          flight.DepartureAirport[0].$.LocationCode;
                        _itineraryFlight.DepartureAirport.Terminal =
                          flight.DepartureAirport[0].$.Terminal;
                        _itineraryFlight.ArrivalAirport.Code =
                          flight.ArrivalAirport[0].$.LocationCode;
                        _itineraryFlight.ArrivalAirport.Terminal =
                          flight.ArrivalAirport[0].$.Terminal;
                        _itineraryFlight.MarketingAirline.Code =
                          flight.MarketingAirline
                            ? flight.MarketingAirline[0].$.Code
                            : "";
                        _itineraryFlight.OperatingAirline.Code =
                          flight.OperatingAirline
                            ? flight.OperatingAirline[0].$.Code
                            : "";
                        _itineraryFlight.Equipment.Code = flight.Equipment
                          ? flight.Equipment[0].$.AirEquipType
                          : "";
                        _itineraryFlight.BookingClassAvails =
                          flight.BookingClassAvails
                            ? flight.BookingClassAvails[0].BookingClassAvail[0]
                                .$
                            : null; // TODO make this array
                        if (
                          _itineraryFlight.BookingClassAvails
                            .ResBookDesigCabinCode == "M"
                        )
                          _itineraryFlight.BookingClassAvails.ResBookDesigCabinCode =
                            "Y";
                        _itineraryFlight.BookingClassAvails.ResBookDesigCabinName =
                          new nameObject();
                        // .map(
                        //   bookClass => bookClass.$)[0] : null;
                        _itineraryFlight.Baggage = flight.Baggages
                          ? flight.Baggages[0].Baggage.map((bag) => {
                              return {
                                ...bag.$,
                                ...final_data.FreeBaggages[0].Baggage.filter(
                                  (fbag) => bag.$.Index == fbag.$.Index
                                )[0].$,
                              };
                            })
                          : [];
                        if (_itineraryFlight.Baggage.length == 0) {
                          _itineraryFlight.Baggage.push({
                            Index: "-1",
                            Quantity: "0",
                            Unit: "PC",
                            Type: "ADT",
                          });
                        }
                        _itineraryFlight.StopLocation = flight.StopLocation
                          ? flight.StopLocation.map((stop) => stop.$)
                          : [];
                        _itinerary.Flights.push(_itineraryFlight);
                      });
                      _itinerary.TotalStopTime =
                        TimeToString.generateTimeStirng(_tempStopTime);
                      //#endregion

                      _flightData.Itineraries[index] = _itinerary;
                    }
                    _result.flights.push(_flightData);
                  }
                );
              }
            );
            if (
              item.itineraries.length == 1 ||
              (item.itineraries.length == 2 &&
                FlightTypeHelper.checkRoundTripFlight(item.itineraries))
            )
              this.getSearchCalendar(item, loggedInUser, options)
                .then((cal_result) => {
                  _result.calendar = cal_result;
                  calculateMarkup(item, _result);
                })
                .catch((error) => {
                  console.log(error);
                  if (error.name == "searchCalendarMultiLegError")
                    calculateMarkup(item, _result);
                  else reject(error);
                });
            else calculateMarkup(item, _result);
          }
        };

        let callSearch = (session: amadeusSession) => {
          this.callSearchApi(
            item,
            session,
            process.env.AMADEUS_SEARCHFLIGHT_SOAP_ACTION,
            "SearchFlight.xml",
            options
          )
            .then((result) => {
              let hasMoreResult =
                result.body["soap:Envelope"]["soap:Body"][0][
                  "SearchFlightResponse"
                ][0]["OTA_AirLowFareSearchRS"][0]["HasMoreResult"][0];
              if (hasMoreResult != "false")
                this.callNextFlight(
                  result.session,
                  (err, result, session) => {
                    searchCallBack(result);
                  },
                  options
                );
              else searchCallBack(result);
            })
            .catch((error) => reject(error));
        };

        if (
          session.sessionId &&
          session.sessionTime &&
          new Date().getTime() - new Date(session.sessionTime).getTime() >
            sessionMaxTime
        )
          this.callSignOut(session.sessionId, (err, res) => {
            callSearch(new amadeusSession());
          });
        else callSearch(session);
      }
    );
  }

  // Get the original result from Search API of Amadeus for develop version
  getOriginal(
    item: any,
    callback: (error: any, result: any, session: any) => void,
    options: gatewayInputOptions
  ) {
    var sessionId = item.session.sessionId;
    var sessionTime = item.session.sessionTime;
    item = item.body;
    var searchCallBack = (err, data, session) => {
      var final_data =
        data["soap:Envelope"]["soap:Body"][0].SearchFlightResponse[0]
          .OTA_AirLowFareSearchRS[0];
      let hasMoreResult =
        data["soap:Envelope"]["soap:Body"][0]["SearchFlightResponse"][0][
          "OTA_AirLowFareSearchRS"
        ][0]["HasMoreResult"][0];
      console.log(
        "TCL: AmadeusManager -> searchCallBack -> hasMoreResult",
        hasMoreResult
      );
      if (hasMoreResult == "true")
        this.callNextFlight(
          session,
          (err, result, session) => {
            callback(null, data, session);
          },
          options
        );
      else callback(null, data, session);
    };
    if (
      sessionId &&
      sessionTime &&
      new Date().getTime() - new Date(sessionTime).getTime() > sessionMaxTime
    ) {
      this.callSignOut(sessionId, (err, res) => {
        this.callSearchApi(
          item,
          null,
          process.env.AMADEUS_SEARCHFLIGHT_SOAP_ACTION,
          item.roundTrip
            ? "SearchFlightRoundTrip.xml"
            : "SearchFlightOneWay.xml",
          // searchCallBack
          options
        );
      });
    } else {
      this.callSearchApi(
        item,
        sessionId,
        process.env.AMADEUS_SEARCHFLIGHT_SOAP_ACTION,
        item.roundTrip ? "SearchFlightRoundTrip.xml" : "SearchFlightOneWay.xml",
        // searchCallBack
        options
      );
    }
  }

  // Get lowest fare for a period of times
  getSearchCalendar(
    item: gatewaySearchInput,
    loggedInUser?: any,
    options?: gatewayInputOptions
  ) {
    return new Promise(
      (
        resolve: (result: searchCalendarResult[]) => void,
        reject: (error: errorObj) => void
      ) => {
        let calculateMarkup = (
          item: gatewaySearchInput,
          result: searchCalendarResult[]
        ) => {
          // MarkupHelper.calculateCalendarMarkup(loggedInUser, "amadeus", item, result, options)
          //   .then((newResult: searchCalendarResult[]) => {
          resolve(result);
          // })
          // .catch(err => {
          //   // error on fetch markup
          //   // return bare result for now
          //   resolve(result);
          // })
        };

        let callSearchCalendar = (item: gatewaySearchInput) => {
          return new Promise(
            (
              resolve: (result: searchCalendarResult[]) => void,
              reject: (error: errorObj) => void
            ) => {
              this.callSearchApi(
                item,
                null,
                process.env.AMADEUS_SEARCHCALENDAR_SOAP_ACTION,
                "SearchFlightCalendar.xml",
                options
              )
                .then((result) => {
                  if (result.session.sessionId)
                    this.callSignOut(
                      result.session.sessionId,
                      (err, res) => {}
                    );
                  let _body =
                    result.body["soap:Envelope"]["soap:Body"][0]
                      .SearchFlightCalendarResponse[0]
                      .OTA_AirLowFareSearchRS[0];
                  // console.log("Calendar Result Amadeus", JSON.stringify(_body))
                  if (_body.Errors)
                    reject({
                      code: "",
                      error: _body.Errors[0].Error[0].$.ShortText,
                      location: "Amadeus Manager -> Search Calendar",
                      name: "amadeusSearchCalendarError",
                      data: result,
                    });
                  else {
                    _body = _body.PricedItineraries[0].PricedItinerary;
                    let _result: searchCalendarResult[] = [];
                    _body.map((_pricedItinerary) => {
                      _pricedItinerary.AirItinerary[0].OriginDestinationCombinations[0].OriginDestinationCombination.map(
                        (_cmb) => {
                          let refIds = _cmb.$.IndexList.split(";");
                          let _dailyResult: searchCalendarResult =
                            new searchCalendarResult();
                          _dailyResult.Currency = _pricedItinerary.$.Currency;
                          _dailyResult.AdultPrice = parseFloat(
                            _pricedItinerary.AirItineraryPricingInfo[0].PTC_FareBreakdowns[0].PTC_FareBreakdown.filter(
                              (ADT) =>
                                ADT.PassengerTypeQuantity[0].$.Code == "ADT"
                            )[0].PassengerFare[0].TotalFare[0].$.Amount
                          );
                          for (let index = 0; index < refIds.length; index++) {
                            const refId = refIds[index];
                            _dailyResult.Date[index] =
                              _pricedItinerary.AirItinerary[0].OriginDestinationOptions[0].OriginDestinationOption.filter(
                                (_odo) =>
                                  _odo.$.RefNumber == refIds[index] &&
                                  _odo.$.DirectionId == index
                              )[0].FlightSegment[0].$.DepartureDateTime;
                          }
                          _result.push(_dailyResult);
                        }
                      );
                    });
                    resolve(_result);
                  }
                })
                .catch((error) => {
                  reject(error);
                });
            }
          );
        };
        if (
          item.itineraries.length > 2 ||
          (item.itineraries.length == 2 &&
            !FlightTypeHelper.checkRoundTripFlight(item.itineraries))
        ) {
          reject(
            new errorObj(
              "searchCalendarMultiLegError",
              "",
              "SearchFlightCalendar method is not allowed with MultiLeg",
              "Amadeus Manager -> Search Calendar"
            )
          );
        } else {
          let modifiedItem = { ...item };
          modifiedItem.itineraries.forEach((itinerary) => {
            let today = new Date(
              new Date().toISOString().split("T")[0] + "T10:00:00"
            );
            let date = new Date(itinerary.departDate);
            if (
              Math.floor(
                Math.abs(date.getTime() - today.getTime()) / (1000 * 3600 * 24)
              ) < 3
            ) {
              today.setDate(today.getDate() + 3);
              date = new Date(today.toISOString().split("T")[0]);
              itinerary.departDate = today.toISOString().split("T")[0];
            }
          });
          callSearchCalendar(item)
            .then((result) => calculateMarkup(item, result))
            .catch((error) => reject(error));
        }
      }
    );
    // var date = new Date(item.departDate);
    // var today = new Date(); // Get today date
    // if (Math.floor(Math.abs(date.getTime() - new Date().getTime()) / (1000 * 3600 * 24)) < 3) {
    //   // Check if the date is less than 3 day to pass the middle day of the 7 days
    //   today.setDate(today.getDate() + 3);
    //   date = new Date(today.toISOString().split("T")[0]);
    //   item.departDate = today.toISOString().split("T")[0];
    // } else {
    //   // Plus 3 days to requested date for sending the middle day of 7 days
    //   date.setDate(date.getDate() + 3);
    //   item.departDate = date.toISOString().split("T")[0];
    // }

    // if (item.isWeek && !item.roundTrip)
    //   // Check if request needs only 7 days
    //   this.callSearchCalendar(item, (err, result) => {
    //     callback(null, _.orderBy(result, ["Date"], ["asc"]));
    //   });
    // else if (item.isWeek && item.roundTrip) {
    //   // Check if request needs only 7 days
    //   date.setDate(date.getDate() - 4);
    //   let _dateArray = [];
    //   for (let i = 0; i < 7; i++) {
    //     date.setDate(date.getDate() + 1);
    //     _dateArray.push({
    //       Date: date.toISOString().split("T")[0]
    //     });
    //   }
    //   callback(null, _dateArray);
    // // check if request needs 28 days
    // var _callIndex = 0;
    // var final_result = [];
    // // Result callback for all of 4 call request to get 28 days
    // var result_callback = (err, result) => {
    //   _callIndex++;
    //   if (result) final_result = [...final_result, ...result.map(res => res)];
    //   if (_callIndex == 4)
    //     // If all of 4 request is complete to send the result
    //     callback(null, _.orderBy(final_result, ["Date"], ["asc"]));
    // };

    // // Get every 7 days using one fuction for all of 28 days
    // this.callSearchCalendar(item, result_callback);
    // date.setDate(date.getDate() + 7);
    // item.departDate = date.toISOString().split("T")[0];
    // this.callSearchCalendar(item, result_callback);
    // date.setDate(date.getDate() + 7);
    // item.departDate = date.toISOString().split("T")[0];
    // this.callSearchCalendar(item, result_callback);
    // date.setDate(date.getDate() + 7);
    // item.departDate = date.toISOString().split("T")[0];
    // this.callSearchCalendar(item, result_callback);
    // }
  }

  book(booking: any, session: amadeusSession, options: gatewayInputOptions) {
    return new Promise<gatewayBookInternalResult>((resolve, reject) => {
      console.log("AMADEUS Session", JSON.stringify(session));
      if (session.sessionId && session.sessionTime) {
        if (
          new Date().getTime() - new Date(session.sessionTime).getTime() >
          sessionMaxTime
        ) {
          this.callSignOut(session.sessionId, (err, res) => {
            reject(
              new errorObj(
                "expiredSession",
                "",
                "Your session is expired. Try to search for flights first",
                "Amadeus Manager -> book",
                { session: { sessionDeleted: true } }
              )
            );
          });
        } else {
          let header = {
            "Content-Type": "text/xml; charset=utf-8",
            soapAction: process.env.AMADEUS_BOOKFLIGHT_SOAP_ACTION,
            Cookie: `ASP.NET_SessionId=${session.sessionId}; path=/; secure; HttpOnly`,
          };
          let xml = fs.readFileSync(
            "src/Assets/AmadeusRequestTemplates/BookFlight.xml",
            "utf-8"
          );
          let passengers = this.generateXMLAirTraveler(
            booking.passengers,
            booking.issuerContactInfo.email
              ? booking.issuerContactInfo.email
              : process.env.ETICKET_DEFAULT_EMAIL
          );
          xml = xml
            .replace(/{{passengers}}/g, passengers)
            .replace(/{{RecommendationID}}/g, booking.flights.sequenceNumber)
            .replace(/{{CombinationID}}/g, booking.flights.combinationId)
            .replace(/<!--[\s\S]*?-->/g, "");
          this.gatewaySoapRequest(
            process.env.AMADEUS_WEBSERVICE_URL,
            header,
            xml,
            10000000,
            options
          )
            .then((res) => {
              const { headers, body, statusCode } = res.response;
              session.sessionTime = new Date().toISOString();
              if (statusCode == 200) {
                parseString(body, (error, data) => {
                  let result =
                    data["soap:Envelope"]["soap:Body"][0][
                      "BookFlightResponse"
                    ][0]["OTA_AirBookRS"][0]["Success"];
                  if (result != undefined) {
                    if (!options.disableSignOut)
                      this.callSignOut(session.sessionId, (err, res) => {});
                    let _finalData =
                      data["soap:Envelope"]["soap:Body"][0]
                        .BookFlightResponse[0].OTA_AirBookRS[0]
                        .AirReservation[0];
                    let _result: gatewayBookInternalData = {
                      ticketTimeLimit:
                        _finalData.Ticketing[0].$.TicketTimeLimit,
                      ticketType: booking.flights.itineraries.map(
                        (el) => _finalData.Ticketing[0].$.TicketType
                      ),
                      pnr: booking.flights.itineraries.map(
                        (el) => _finalData.BookingReferenceID[0].$.ID_Context
                      ),
                      totalPrice: parseFloat(
                        _finalData.PriceInfo[0].ItinTotalFare[0]
                          .TotalAmountInTicketingCurrency[0].$.Amount
                      ),
                      moneyUnit:
                        _finalData.PriceInfo[0].ItinTotalFare[0]
                          .TotalAmountInTicketingCurrency[0].$.Currency,
                      bookDate: new Date().toISOString(),
                      rawData: [data],
                    };
                    resolve({
                      result: _result,
                      session: {
                        ...session,
                        sessionDeleted: !options.disableSignOut,
                      },
                    });
                    // callback(null, _result, { sessionDeleted: !options.disableSignOut });
                  } else {
                    //check if price changed
                    //check if price charge requied
                    console.log("Booking Data", JSON.stringify(data));
                    reject(
                      new errorObj(
                        "bookError",
                        "",
                        "Error in booking process",
                        "Amadeus Manager -> book",
                        {
                          error:
                            data["soap:Envelope"]["soap:Body"][0][
                              "BookFlightResponse"
                            ][0]["OTA_AirBookRS"][0]["Errors"][0]["Error"][0][
                              "$"
                            ]["ShortText"],
                          session,
                        }
                      )
                    );
                  }
                });
              } else
                reject(
                  new errorObj(
                    "bookResponseError",
                    "",
                    "Error in booking response",
                    "Amadeus Manager -> book",
                    { session }
                  )
                );
            })
            .catch((err) =>
              reject(
                new errorObj(
                  "bookRequestError",
                  "",
                  "Error in booking request",
                  "Amadeus Manage -> book",
                  err
                )
              )
            );
        }
      } else {
        reject(
          new errorObj(
            "noExistingSession",
            "",
            "There is no existing session. Try to search for flights first.",
            "Amadeus Manager -> book",
            { session: { sessionDeleted: true } }
          )
        );
      }
    });
  }

  //
  postCancelBook(
    item: any,
    callback: (error: any, result: any, sessionId: string) => void,
    options: gatewayInputOptions
  ) {
    let sessionId = item.sessionId;
    item = item.body;
    var header = {
      "Content-Type": "text/xml; charset=utf-8",
      soapAction: process.env.AMADEUS_CANCEL_SOAP_ACTION,
    };
    if (sessionId)
      header["Cookie"] = sessionId.replace(/amdsid/g, "ASP.NET_SessionId");

    var xml = fs.readFileSync(
      "src/Assets/AmadeusRequestTemplates/Cancel.xml",
      "utf-8"
    );
    xml = xml
      .replace(/{{bookType}}/g, item.bookType)
      .replace(/{{PNR}}/g, item.PNR)
      .replace(/{{leadLastName}}/g, item.leadLastName);

    // usage of module
    (async () => {
      const { response } = await this.gatewaySoapRequest(
        process.env.AMADEUS_WEBSERVICE_URL,
        header,
        xml,
        10000000,
        options
      ); // Optional timeout parameter(milliseconds)
      const { headers, body, statusCode } = response;
      if (statusCode == 200) {
        let sessionId = null;
        if (headers["set-cookie"] && headers["set-cookie"].length > 0)
          sessionId = headers["set-cookie"][0]
            .replace(/ASP.NET_SessionId/g, "amdsid")
            .replace(/secure; /g, "");
        parseString(body, (error, data) => {
          if (!error) {
            let result =
              data["soap:Envelope"]["soap:Body"][0]["CancelResponse"][0][
                "OTA_CancelRS"
              ][0]["Success"];
            if (result != undefined) callback(null, data, sessionId);
            else
              callback(
                {
                  error:
                    data["soap:Envelope"]["soap:Body"][0]["CancelResponse"][0][
                      "OTA_CancelRS"
                    ][0]["Errors"][0]["Error"][0]["$"]["ShortText"],
                },
                null,
                null
              );
          } else callback({ error: "Response Error" }, null, null);
        });
      } else callback({ error: "Response Error" }, null, null);
    })();
  }

  // Get ping result for checking the connection and number of request
  getPing(options: gatewayInputOptions) {
    return new Promise<string>((resolve, reject) => {
      var header = {
        "Content-Type": "text/xml; charset=utf-8",
        soapAction: process.env.AMADEUS_PING_SOAP_ACTION,
      };
      var xml = fs.readFileSync(
        "src/Assets/AmadeusRequestTemplates/Ping.xml",
        "utf-8"
      );
      // usage of module
      this.gatewaySoapRequest(
        process.env.AMADEUS_WEBSERVICE_URL,
        header,
        xml,
        10000000,
        options
      )
        .then((res) => {
          // console.log(response);
          const { headers, body, statusCode } = res.response;
          let sessionId = null;
          if (headers["set-cookie"] && headers["set-cookie"].length > 0) {
            sessionId = headers["set-cookie"].filter(
              (val) => val.indexOf("ASP.NET_SessionId") == 0
            )[0];
            sessionId = sessionId && sessionId.split(";")[0];
            sessionId = sessionId && sessionId.split("=")[1];
            this.callSignOut(sessionId, (err, res) => {});
          }
          if (statusCode == 200)
            parseString(body, (error, data) => {
              resolve(data);
            });
          else reject("Response Error");
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  getAPISRules(
    item: any,
    callback: (error: any, result: any, session: any) => void,
    options: gatewayInputOptions
  ) {
    let session = item.session;
    item = item.body;
    if (session.sessionId && session.sessionTime)
      if (
        new Date().getTime() - new Date(session.sessionTime).getTime() >
        sessionMaxTime
      ) {
        this.callSignOut(session.sessionId, (err, res) => {
          callback(
            "Your session is expired. Try to search for flights first.",
            null,
            { sessionDeleted: true }
          );
        });
      } else {
        var header = {
          "Content-Type": "text/xml; charset=utf-8",
          soapAction: process.env.AMADEUS_GETAPISRULES_SOAP_ACTION,
        };
        header[
          "Cookie"
        ] = `ASP.NET_SessionId=${session.sessionId}; path=/; secure; HttpOnly`;
        var xml = fs.readFileSync(
          "src/Assets/AmadeusRequestTemplates/GetAPISRules.xml",
          "utf-8"
        );
        xml = xml
          .replace(/{{RecommendationID}}/g, item.RecommendationID)
          .replace(/{{CombinationID}}/g, item.CombinationID);
        (async () => {
          const { response } = await this.gatewaySoapRequest(
            process.env.AMADEUS_WEBSERVICE_URL,
            header,
            xml,
            10000000,
            options
          ); // Optional timeout parameter(milliseconds)
          const { body, statusCode } = response;
          session.sessionId = null;
          session.sessionTime = new Date().toISOString();
          if (statusCode == 200)
            parseString(body, (error, data) => {
              callback(null, data, session);
            });
          else callback({ error: "Response Error" }, null, session);
        })();
      }
    else
      callback(
        "There is no existing session. Try to search for flights first.",
        null,
        { sessionDeleted: true }
      );
  }

  getCheckETicket(
    item: any,
    callback: (error: any, result: any, session: any) => void,
    options: gatewayInputOptions
  ) {
    let session = item.session;
    item = item.body;
    if (session.sessionId && session.sessionTime)
      if (
        new Date().getTime() - new Date(session.sessionTime).getTime() >
        sessionMaxTime
      ) {
        this.callSignOut(session.sessionId, (err, res) => {
          callback(
            "Your session is expired. Try to search for flights first.",
            null,
            { sessionDeleted: true }
          );
        });
      } else {
        var header = {
          "Content-Type": "text/xml; charset=utf-8",
          soapAction: process.env.AMADEUS_CHECKETICKET_SOAP_ACTION,
        };
        header[
          "Cookie"
        ] = `ASP.NET_SessionId=${session.sessionId}; path=/; secure; HttpOnly`;
        var xml = fs.readFileSync(
          "src/Assets/AmadeusRequestTemplates/CheckETicket.xml",
          "utf-8"
        );
        xml = xml
          .replace(/{{RecommendationID}}/g, item.RecommendationID)
          .replace(/{{CombinationID}}/g, item.CombinationID);
        (async () => {
          const { response } = await this.gatewaySoapRequest(
            process.env.AMADEUS_WEBSERVICE_URL,
            header,
            xml,
            10000000,
            options
          ); // Optional timeout parameter(milliseconds)
          const { body, statusCode } = response;
          session.sessionId = null;
          session.sessionTime = new Date().toISOString();
          if (statusCode == 200)
            parseString(body, (error, data) => {
              if (!error) {
                let result =
                  data["soap:Envelope"]["soap:Body"][0][
                    "CheckETicketResponse"
                  ][0]["OTA_AirCheckETicketRS"][0]["Success"];
                if (result != undefined) callback(null, "true", session);
                else
                  callback(
                    {
                      error:
                        data["soap:Envelope"]["soap:Body"][0][
                          "CheckETicketResponse"
                        ][0]["OTA_AirCheckETicketRS"][0]["Errors"][0][
                          "Error"
                        ][0]["$"]["ShortText"],
                    },
                    null,
                    session
                  );
              } else callback({ error: "Response Error" }, null, session);
              // callback(null, data, session);
            });
          else callback({ error: "Response Error" }, null, session);
        })();
      }
    else
      callback(
        "There is no existing session. Try to search for flights first.",
        null,
        { sessionDeleted: true }
      );
  }

  getFlightRules(
    item: gatewayRuleInput,
    session: amadeusSession,
    options: gatewayInputOptions
  ) {
    return new Promise<gatewayRulesResult[]>((resolve, reject) => {
      if (session.sessionId && session.sessionTime)
        if (
          new Date().getTime() - new Date(session.sessionTime).getTime() >
          sessionMaxTime
        ) {
          this.callSignOut(session.sessionId, (err, res) => {
            reject(
              new errorObj(
                "amadeusExpiredSession",
                "",
                "Your session is expired. Try to search for flights first.",
                "Amadeus Manager -> getFlightRules",
                { session: { sessionDeleted: true } }
              )
            );
          });
        } else {
          var header = {
            "Content-Type": "text/xml; charset=utf-8",
            soapAction: process.env.AMADEUS_GETFLIGHTRULES_SOAP_ACTION,
          };
          header[
            "Cookie"
          ] = `ASP.NET_SessionId=${session.sessionId}; path=/; secure; HttpOnly`;
          var xml = fs.readFileSync(
            "src/Assets/AmadeusRequestTemplates/GetFlightRules.xml",
            "utf-8"
          );
          xml = xml
            .replace(/{{RecommendationID}}/g, item.sequenceNumber)
            .replace(/{{CombinationID}}/g, item.combinationId)
            .replace(/{{PassengerType}}/g, "ADT") //item.PassengerType
            .replace(/{{MiniRuleEnabled}}/g, "1") //item.MiniRuleEnabled ? "1" : "0"
            .replace(/{{PriceMessageEnabled}}/g, "1") //item.PriceMessageEnabled ? "1" : "0"
            .replace(/{{FlightRuleEnabled}}/g, "1"); //item.FlightRuleEnabled ? "1" : "0"
          (async () => {
            const { response } = await this.gatewaySoapRequest(
              process.env.AMADEUS_WEBSERVICE_URL,
              header,
              xml,
              10000000,
              options
            ); // Optional timeout parameter(milliseconds)
            const { body, statusCode } = response;
            session.sessionTime = new Date().toISOString();
            if (statusCode == 200)
              parseString(body, (error, data) => {
                if (
                  data["soap:Envelope"]["soap:Body"][0]
                    .GetFlightRulesResponse[0].OTA_AirRulesRS[0].Success
                ) {
                  let result: gatewayRulesResult[] = [];
                  result[0] = new gatewayRulesResult();
                  result[0].flightRule = {
                    miniRulesPriceText: data["soap:Envelope"][
                      "soap:Body"
                    ][0].GetFlightRulesResponse[0].OTA_AirRulesRS[0].PriceMessageInfoType[0].PriceMessageInfo[0].MiniRulesPriceMessages[0].Text[0].MiniRulesPriceText.map(
                      (el) => el.$
                    ),
                  };
                  result[0].flightRule.miniRulesPriceText =
                    result[0].flightRule.miniRulesPriceText.map((el) =>
                      el.PriceMessageValue.replace(/\{0\}/g, el.PriceDataList)
                    );
                  if (
                    data["soap:Envelope"]["soap:Body"][0]
                      .GetFlightRulesResponse[0].OTA_AirRulesRS[0]
                      .FareRuleResponseInfo[0].FareRuleInfo[0].FareRules[0]
                      .SubSection
                  ) {
                    result[0].flightRule.fareRules = data["soap:Envelope"][
                      "soap:Body"
                    ][0].GetFlightRulesResponse[0].OTA_AirRulesRS[0].FareRuleResponseInfo[0].FareRuleInfo[0].FareRules[0].SubSection.map(
                      (el) => {
                        return {
                          title: el.$.SubTitle,
                          text: el.Paragraph[0].Text[0],
                        };
                      }
                    );
                    result[0].cancelingRuleText = data["soap:Envelope"][
                      "soap:Body"
                    ][0].GetFlightRulesResponse[0].OTA_AirRulesRS[0].FareRuleResponseInfo[0].FareRuleInfo[0].FareRules[0].SubSection.some(
                      (el) => el.$.SubCode == "PE"
                    )
                      ? data["soap:Envelope"][
                          "soap:Body"
                        ][0].GetFlightRulesResponse[0].OTA_AirRulesRS[0].FareRuleResponseInfo[0].FareRuleInfo[0].FareRules[0].SubSection.find(
                          (el) => el.$.SubCode == "PE"
                        ).Paragraph[0].Text[0]
                      : "";
                  } else {
                    result[0].flightRule.fareRules = [];
                    result[0].cancelingRuleText = "";
                  }
                  resolve(result);
                } else resolve(data);
              });
            else
              reject(
                new errorObj(
                  "amadeusFlightRulesResponseError",
                  "",
                  "Response error",
                  "Amadeus Manager -> getFlightRules",
                  body
                )
              );
          })();
        }
      else
        reject(
          new errorObj(
            "amadeusNoSession",
            "",
            "There is no existing session. Try to search for flights first.",
            "Amadeus Manager -> getFlightRules",
            { sessionDeleted: true }
          )
        );
    });
  }

  createTicket(
    booking: any,
    session: amadeusSession,
    options: gatewayInputOptions
  ) {
    return new Promise<gatewayTicketInternalResult>((resolve, reject) => {
      console.log("0");
      let leadLastName = booking.passengers.filter((item) => item.isPrimary)[0]
        .lastName;
      this.callGetPNR(
        booking.flights.itineraries[0].pnr,
        leadLastName,
        options,
        booking.flights.gatewayData === "ImportPNR" ? "Import" : "Flight"
      )
        .then((pnrResult: any) => {
          console.log("GETPNR RESULT", JSON.stringify(pnrResult));
          return this.callCreateEticket(booking, pnrResult.session, options);
        })
        .then((eTicketResult: any) => {
          writeFile(
            "C:\\Amadeus\\CreateTicket_Response.txt",
            JSON.stringify(eTicketResult),
            (err) => {}
          );
          console.log("ETICKET RESULT", JSON.stringify(eTicketResult));
          console.log(
            "SASASASANNNNN",
            eTicketResult.data["soap:Envelope"]["soap:Body"][0]
              .CreateTicketResponse[0].OTA_AirBookRS[0].Success
          );
          if (
            eTicketResult.data["soap:Envelope"]["soap:Body"][0]
              .CreateTicketResponse[0].OTA_AirBookRS[0].Success
          ) {
            console.log("5");
            finalCallback(eTicketResult);
          } else if (
            eTicketResult.data["soap:Envelope"]["soap:Body"][0]
              .CreateTicketResponse[0].OTA_AirBookRS[0].Errors[0].Error[0].$
              .ShortText == "Prices have changed" ||
            eTicketResult.data["soap:Envelope"]["soap:Body"][0]
              .CreateTicketResponse[0].OTA_AirBookRS[0].Errors[0].Error[0].$
              .NodeList == "BOOK_WITH_PRICECHANGE"
          ) {
            console.log("6");
            let refrenceNumber =
              eTicketResult.data["soap:Envelope"]["soap:Body"][0]
                .CreateTicketResponse[0].OTA_AirBookRS[0].$.ReferenceNumber;
            let newTotalPrice = parseFloat(
              eTicketResult.data["soap:Envelope"]["soap:Body"][0]
                .CreateTicketResponse[0].OTA_AirBookRS[0].NewPrice[0]
                .ItinTotalFare[0].TotalFare[0].$.Amount
            );
            if (newTotalPrice == booking.totalPrice) {
              this.callCreateEticketWithPriceChanged(
                refrenceNumber,
                eTicketResult.session,
                options
              )
                .then((newTicketResult: any) => {
                  if (
                    newTicketResult.data["soap:Envelope"]["soap:Body"][0]
                      .CreateTicketResponse[0].OTA_AirBookRS[0].Success
                  ) {
                    finalCallback(newTicketResult);
                  } else {
                    this.callSignOut(eTicketResult.session.sessionId, () => {});
                    reject(
                      new errorObj(
                        "issueTicketError",
                        "",
                        "Error in issuing ticket",
                        "Amadeus Manager -> createTicket",
                        eTicketResult.data
                      )
                    );
                  }
                })
                .catch((err) => reject(err));
            } else {
              this.callSignOut(eTicketResult.session.sessionId, () => {});
              reject(
                new errorObj(
                  "issueTicketError",
                  "",
                  "Price change occured",
                  "Amadeus Manager -> createTicket",
                  eTicketResult.data
                )
              );
            }
          } else {
            this.callSignOut(eTicketResult.session.sessionId, () => {});
            reject(
              new errorObj(
                "issueTicketError",
                "",
                "Error in issuing ticket",
                "Amadeus Manager -> createTicket",
                eTicketResult.data
              )
            );
          }
        })
        .catch((err) => reject(err));
      let finalCallback = (ticketResult) => {
        console.log("1");
        let needsFurtherActions =
          ticketResult.data["soap:Envelope"]["soap:Body"][0]
            .CreateTicketResponse[0].OTA_AirBookRS[0].Warnings &&
          ticketResult.data["soap:Envelope"]["soap:Body"][0]
            .CreateTicketResponse[0].OTA_AirBookRS[0].Warnings[0] &&
          ticketResult.data["soap:Envelope"]["soap:Body"][0]
            .CreateTicketResponse[0].OTA_AirBookRS[0].Warnings[0].Warning &&
          ticketResult.data["soap:Envelope"]["soap:Body"][0]
            .CreateTicketResponse[0].OTA_AirBookRS[0].Warnings[0].Warning[0] &&
          ticketResult.data["soap:Envelope"]["soap:Body"][0]
            .CreateTicketResponse[0].OTA_AirBookRS[0].Warnings[0].Warning[0].$
            .Status == "ETICKET_ERROR"
            ? true
            : false;

        console.log("2");
        let finalResult: gatewayTicketInternalResult =
          new gatewayTicketInternalResult();
        finalResult.session.sessionDeleted = true;
        finalResult.result = {
          data: ticketResult.data,
          callSupport: needsFurtherActions,
          tickets: [],
        };
        console.log("3");
        booking.flights.itineraries.forEach((itin) => {
          booking.passengers.forEach((pass) => {
            finalResult.result.tickets.push({
              passengerIndex: pass.index,
              flightIndex: itin.index,
              refrenceId: "",
              ticketNumber: ticketResult.data["soap:Envelope"][
                "soap:Body"
              ][0].CreateTicketResponse[0].OTA_AirBookRS[0].AirReservation[0].TravelerInfo[0].AirTraveler.find(
                (el) =>
                  el.$.PassengerTypeCode ==
                    this.convertPassengerType(pass.type) &&
                  el.PersonName[0].NamePrefix[0] ==
                    (pass.isMale ? "MR" : "MS") &&
                  el.PersonName[0].GivenName[0].toLowerCase() ==
                    pass.firstName.toLowerCase() &&
                  el.PersonName[0].Surname[0].toLowerCase() ==
                    pass.lastName.toLowerCase()
              ).$.eTicketNumber,
              status: [],
              pnr: ticketResult.data["soap:Envelope"]["soap:Body"][0]
                .CreateTicketResponse[0].OTA_AirBookRS[0].AirReservation[0]
                .BookingReferenceID[0].$.ID_Context,
              cancelReason: null,
              showTicketType: null,
              callSupport: needsFurtherActions,
            });
          });
        });
        console.log("4");
        this.callSignOut(ticketResult.session.sessionId, () => {});
        resolve(finalResult);
      };
    });
  }

  importPNR(pnr: string, pnrFields: any, options: gatewayInputOptions) {
    return new Promise<any>((resolve, reject) => {
      this.callGetPNR(pnr, pnrFields.leadLastName, options, "Flight")
        .then((pnrResult: any) => {
          parseString(pnrResult.body, (error, data) => {
            if (error)
              reject({
                error: error,
                location: "Amadeus manager -> importPNR -> parseString",
                code: "",
                name: "xmlNotValid",
                data: pnrResult,
              });
            else {
              let finalData =
                data["soap:Envelope"]["soap:Body"][0]["GetPNRResponse"][0][
                  "OTA_AirBookRS"
                ][0];
              if (finalData.Success) {
                finalData = finalData["AirReservation"][0];
                let booking: any = {};
                booking.totalPrice = parseFloat(
                  finalData["PriceInfo"][0]["ItinTotalFare"][0]["TotalFare"][0]
                    .$.Amount
                );
                booking.moneyUnit = {
                  moneyUnit:
                    finalData["PriceInfo"][0]["ItinTotalFare"][0][
                      "TotalFare"
                    ][0].$.Currency,
                };
                booking.flights = {};
                booking.flights.adultCount = finalData["TravelerInfo"][0][
                  "AirTraveler"
                ].filter((el) => el.$.PassengerTypeCode == "ADT").length;
                booking.flights.childCount = finalData["TravelerInfo"][0][
                  "AirTraveler"
                ].filter((el) => el.$.PassengerTypeCode == "CHD").length;
                booking.flights.infantCount = finalData["TravelerInfo"][0][
                  "AirTraveler"
                ].filter((el) => el.$.PassengerTypeCode == "INF").length;
                booking.flights.sequenceNumber = "0";
                booking.flights.combinationId = "0";
                booking.flights.providerType = "AmadeusProvider";
                booking.flights.forceETicket = "false";
                booking.flights.eTicketEligibility = "Eligible";
                booking.flights.gatewayData = "ImportPNR";
                booking.flights.rawBookingData = JSON.stringify(data);
                booking.flights.ticketTimeLimit =
                  finalData["Ticketing"][0].$.TicketTimeLimit;
                booking.flights.rules = [
                  {
                    cancelingRule: [],
                    cancelingRuleText: "",
                    flightRule: {
                      miniRulesPriceText: [], //finalData.PriceMessageInfo[0].PriceMessageInfo[0].MiniRulesPriceMessages[0].Text[0].MiniRulesPriceText ? [] :
                      //finalData.PriceMessageInfo[0].PriceMessageInfo[0].MiniRulesPriceMessages[0].Text[0].MiniRulesPriceText.map(el => el.$).map(el => el.PriceMessageValue.replace(/\{0\}/g, el.PriceDataList)),
                      fareRules: [],
                    },
                  },
                ];
                booking.flights.itineraries = finalData["AirItinerary"][0][
                  "OriginDestinationOptions"
                ][0]["OriginDestinationOption"].map((option, index) => {
                  let itin = {
                    index: index,
                    price: null,
                    refNumber: option.$.RefNumber,
                    directionId: option.$.DirectionId,
                    elapsedTime: option.$.ElapsedTime,
                    pnr: finalData["BookingReferenceID"][0].$.ID_Context,
                    ticketType: finalData["Ticketing"][0].$.TicketType,
                    flights: option["FlightSegment"].map((segment) => {
                      return {
                        gatewayData: null,
                        departureAirport: {
                          code: segment["DepartureAirport"][0].$.LocationCode,
                          terminal: segment["DepartureAirport"][0].$.Terminal,
                        },
                        arrivalAirport: {
                          code: segment["ArrivalAirport"][0].$.LocationCode,
                          terminal: segment["ArrivalAirport"][0].$.Terminal,
                        },
                        marketingAirline: {
                          code: segment["MarketingAirline"][0].$.Code,
                        },
                        operatingAirline: {
                          code: segment["OperatingAirline"][0].$.Code,
                        },
                        equipment: {
                          code: segment["Equipment"][0].$.AirEquipType,
                        },
                        stopLocation: segment.StopLocation
                          ? segment.StopLocation.map((stop) => stop.$)
                          : [],
                        departureDateTime: segment.$.DepartureDateTime,
                        arrivalDateTime: segment.$.ArrivalDateTime,
                        flightNumber: segment.$.FlightNumber,
                        resBookDesigCode: segment.$.ResBookDesigCode,
                        flightDuration:
                          segment.FlightDuration[0] &&
                          typeof segment.FlightDuration[0] == "string"
                            ? segment.FlightDuration[0]
                                .split("T")[1]
                                .split(":")[0] +
                              ":" +
                              segment.FlightDuration[0]
                                .split("T")[1]
                                .split(":")[1]
                            : option["FlightSegment"].length == 1
                            ? option.$.ElapsedTime.substr(0, 2) +
                              ":" +
                              option.$.ElapsedTime.substr(2, 2)
                            : "0",
                        resBookDesigCabinCode:
                          segment["BookingClassAvails"][0][
                            "BookingClassAvail"
                          ].find(
                            (el) =>
                              el.$.ResBookDesigCode ==
                              segment.$.ResBookDesigCode
                          ).$.ResBookDesigCabinCode == "M"
                            ? "Y"
                            : segment["BookingClassAvails"][0][
                                "BookingClassAvail"
                              ].find(
                                (el) =>
                                  el.$.ResBookDesigCode ==
                                  segment.$.ResBookDesigCode
                              ).$.ResBookDesigCabinCode,
                        fareBasis: segment["BookingClassAvails"][0][
                          "BookingClassAvail"
                        ].find(
                          (el) =>
                            el.$.ResBookDesigCode == segment.$.ResBookDesigCode
                        ).$.FareBasis,
                        fareType: segment["BookingClassAvails"][0][
                          "BookingClassAvail"
                        ].find(
                          (el) =>
                            el.$.ResBookDesigCode == segment.$.ResBookDesigCode
                        ).$.FareType,
                        baggage: [],
                      };
                    }),
                    stopCount: 0,
                    totalStopTime: "",
                  };
                  let _tempStopTime = 0;
                  option["FlightSegment"].forEach((segment, index) => {
                    if (index > 0)
                      _tempStopTime +=
                        new Date(segment.$.DepartureDateTime).getTime() -
                        new Date(
                          option["FlightSegment"][index - 1].$.ArrivalDateTime
                        ).getTime();
                  });
                  itin.stopCount = itin.flights.length - 1;
                  itin.totalStopTime =
                    TimeToString.generateTimeStirng(_tempStopTime);
                  return itin;
                });
                booking.passengers = finalData["TravelerInfo"][0][
                  "AirTraveler"
                ].map((traveler, index) => {
                  let pass = {
                    index: index,
                    isPrimary: index == 0 ? true : false,
                    price: {
                      totalPrice: parseFloat(
                        finalData["PriceInfo"][0]["PTC_FareBreakdowns"][0][
                          "PTC_FareBreakdown"
                        ].find(
                          (el) =>
                            el["PassengerTypeQuantity"][0].$.Code ==
                            traveler.$.PassengerTypeCode
                        )["PassengerFare"][0]["TotalFare"][0].$.Amount
                      ),
                      baseFare: parseFloat(
                        finalData["PriceInfo"][0]["PTC_FareBreakdowns"][0][
                          "PTC_FareBreakdown"
                        ].find(
                          (el) =>
                            el["PassengerTypeQuantity"][0].$.Code ==
                            traveler.$.PassengerTypeCode
                        )["PassengerFare"][0]["BaseFare"][0].$.Amount
                      ),
                      tax: parseFloat(
                        finalData["PriceInfo"][0]["PTC_FareBreakdowns"][0][
                          "PTC_FareBreakdown"
                        ].find(
                          (el) =>
                            el["PassengerTypeQuantity"][0].$.Code ==
                            traveler.$.PassengerTypeCode
                        )["PassengerFare"][0]["Taxes"][0]["Tax"][0].$.Amount
                      ),
                    },
                    type:
                      traveler.$.PassengerTypeCode == "INF"
                        ? "infant"
                        : traveler.$.PassengerTypeCode == "CHD"
                        ? "child"
                        : "adult",
                    birthDate: traveler["BirthDate"] ? [0] : null,
                    avatar: "39.png",
                    lastName: traveler["PersonName"][0]["Surname"][0],
                    firstName: traveler["PersonName"][0]["GivenName"][0],
                    isMale:
                      traveler["PersonName"][0]["NamePrefix"][0] == "MS" ||
                      traveler["PersonName"][0]["NamePrefix"][0] == "MRS" ||
                      traveler["PersonName"][0]["NamePrefix"][0] == "MISS"
                        ? false
                        : true,
                    nationality: traveler["Document"]
                      ? { code: traveler["Document"][0].$.DocIssueCountry }
                      : null,
                    passportCountry: traveler["Document"]
                      ? traveler["Document"][0].$.DocIssueCountry
                      : null,
                    nationalCode: null,
                    passportNo: traveler["Document"]
                      ? traveler["Document"].find(
                          (el) => el.$.InnerDocType == "Passport"
                        ).$.DocID
                      : null,
                    passportExpireDate: traveler["Document"]
                      ? traveler["Document"].find(
                          (el) => el.$.InnerDocType == "Passport"
                        ).$.ExpireDate
                      : null,
                    ticketDesignators: finalData["PriceInfo"][0][
                      "PTC_FareBreakdowns"
                    ][0]["PTC_FareBreakdown"].find(
                      (el) =>
                        el["PassengerTypeQuantity"][0].$.Code ==
                        traveler.$.PassengerTypeCode
                    )["TicketDesignators"]
                      ? finalData["PriceInfo"][0]["PTC_FareBreakdowns"][0][
                          "PTC_FareBreakdown"
                        ]
                          .find(
                            (el) =>
                              el["PassengerTypeQuantity"][0].$.Code ==
                              traveler.$.PassengerTypeCode
                          )
                          ["TicketDesignators"][0]["TicketDesignator"].map(
                            (el) =>
                              el.$.TicketDesignatorCode +
                              "|" +
                              el.$.TicketDesignatorExtension
                          )
                      : [],
                  };
                  return pass;
                });
                resolve(booking);
              } else reject(finalData.Errors);
            }
          });
        })
        .catch((err) => reject(err));
    });
  }

  private callSearchApi(
    item: gatewaySearchInput,
    session: amadeusSession,
    soap_action: string,
    template_file: string,
    options: gatewayInputOptions
  ) {
    return new Promise(
      (
        resolve: (response: gatewayLogicOutput) => void,
        reject: (error: errorObj) => void
      ) => {
        // console.log(item);

        let header = {
          "Content-Type": "text/xml; charset=utf-8",
          soapAction: soap_action,
        };
        if (!session) session = new amadeusSession();
        if (session.sessionId)
          header[
            "Cookie"
          ] = `${sessionMainName}${session.sessionId}; path=/; secure; HttpOnly`;
        // Read template XML file for send to amadeus webservice
        var xml = fs.readFileSync(
          "src/Assets/AmadeusRequestTemplates/" + template_file,
          "utf-8"
        );
        // Replacing list of passengers in XML template
        var passengers = "";
        for (var _i = 0; _i < item.adult; _i++)
          passengers += '<PassengerTypeQuantity Code="ADT" />';
        for (var _i = 0; _i < item.child; _i++)
          passengers += '<PassengerTypeQuantity Code="CHD" />';
        for (var _i = 0; _i < item.infant; _i++)
          passengers += '<PassengerTypeQuantity Code="INF" />';
        for (var _i = 0; _i < item.student; _i++)
          passengers += '<PassengerTypeQuantity Code="STU" />';
        for (var _i = 0; _i < item.citizen; _i++)
          passengers +=
            '<PassengerTypeQuantity Code="YCD" AlternativeCode1="ADT" />';
        xml = xml
          .replace(/{{CabinType}}/g, item.cabin || "Economy")
          .replace(/{{SpecificFlightInfo}}/g, "")
          .replace(/{{Passengers}}/g, passengers)
          .replace(
            /{{OriginDestinationInformation}}/g,
            this.generateXMLOriginDestinationInformation(item.itineraries)
          );
        this.gatewaySoapRequest(
          process.env.AMADEUS_WEBSERVICE_URL,
          header,
          xml,
          10000000,
          options
        )
          .then((response) => {
            const { headers, body, statusCode } = response.response;
            if (
              headers["set-cookie"] &&
              headers["set-cookie"].length > 0 &&
              headers["set-cookie"].some(
                (val) => val.indexOf(sessionMainName) == 0
              ) > 0
            ) {
              session.sessionId = headers["set-cookie"]
                .filter((val) => val.indexOf(sessionMainName) == 0)[0]
                .split(";")[0]
                .split("=")[1];
            }
            session.sessionTime = new Date().toISOString();
            if (statusCode == 200)
              parseString(body, (error, data) => {
                if (error)
                  reject({
                    error: error,
                    location:
                      "Amadeus manager -> callSearchApi -> soapRequest -> parseString",
                    code: "",
                    name: "xmlNotValid",
                    data: {
                      body: body,
                      session: session,
                    },
                  });
                else
                  resolve({
                    body: data,
                    session: session,
                  });
              });
            else
              reject({
                error: body,
                location:
                  "Amadeus manager -> callSearchApi -> soapRequest -> statusCode is 200",
                code: "",
                name: "statusNotOK",
                data: body,
              });
          })
          .catch((error) => {
            reject({
              error: error,
              location: "Amadeus manager -> callSearchApi -> soapRequest",
              code: "",
              name: "soapRequestError",
              data: null,
            });
          });
      }
    );
  }

  private callSignOut(
    sessionId: String,
    callback: (error: any, result: any) => void
  ) {
    var header = {
      "Content-Type": "text/xml; charset=utf-8",
      soapAction: process.env.AMADEUS_SIGNOUT_SOAP_ACTION,
    };
    if (sessionId)
      header[
        "Cookie"
      ] = `ASP.NET_SessionId=${sessionId}; path=/; secure; HttpOnly`;
    var xml = fs.readFileSync(
      "src/Assets/AmadeusRequestTemplates/SignOut.xml",
      "utf-8"
    );
    (async () => {
      const { response } = await soapRequest(
        process.env.AMADEUS_WEBSERVICE_URL,
        header,
        xml,
        10000000
      ); // Optional timeout parameter(milliseconds)
      const { body, statusCode } = response;
      if (statusCode == 200) {
        parseString(body, (error, data) => {
          if (!error) {
            let result =
              data["soap:Envelope"]["soap:Body"][0]["SignOutResponse"][0][
                "SignOutResult"
              ][0];
            if (result == "true") callback(null, result);
            else callback({ error: "Response Error" }, null);
          } else callback({ error: "Response Error" }, null);
        });
      } else callback({ error: "Response Error" }, null);
    })();
  }

  private callNextFlight(
    session: any,
    callback: (error: any, result: any, session: any) => void,
    options: gatewayInputOptions
  ) {
    var header = {
      "Content-Type": "text/xml; charset=utf-8",
      soapAction: process.env.AMADEUS_GETNEXTFLIGHT_SOAP_ACTION,
    };
    header[
      "Cookie"
    ] = `ASP.NET_SessionId=${session.sessionId}; path=/; secure; HttpOnly`;
    var xml = fs.readFileSync(
      "src/Assets/AmadeusRequestTemplates/GetNextFlight.xml",
      "utf-8"
    );
    // usage of module
    (async () => {
      const { response } = await this.gatewaySoapRequest(
        process.env.AMADEUS_WEBSERVICE_URL,
        header,
        xml,
        10000000,
        options
      ); // Optional timeout parameter(milliseconds)
      const { body, statusCode } = response;
      session.sessionId = null;
      session.sessionTime = new Date().toISOString();
      // callback(null, body, session);
      if (statusCode == 200)
        parseString(body, (error, data) => {
          callback(null, data, session);
        });
      else callback({ error: "Response Error" }, null, session);
    })();
  }

  private callGetPNR(
    pnr: any,
    leadLastName: string,
    options: gatewayInputOptions,
    pnrType: string
  ) {
    return new Promise((resolve, reject) => {
      let header = {
        "Content-Type": "text/xml; charset=utf-8",
        soapAction: process.env.AMADEUS_GETPNR_SOAP_ACTION,
      };
      let xml = fs.readFileSync(
        "src/Assets/AmadeusRequestTemplates/GetPNR.xml",
        "utf-8"
      );
      xml = xml
        .replace(/{{PNRType}}/g, pnrType)
        .replace(/{{PNR}}/g, pnr)
        .replace(/{{leadLastName}}/g, leadLastName);
      writeFile(
        "C:\\Amadeus\\CALLGETPNR_Request.txt",
        JSON.stringify(xml),
        (err) => {}
      );
      (async () => {
        const { response } = await this.gatewaySoapRequest(
          process.env.AMADEUS_WEBSERVICE_URL,
          header,
          xml,
          10000000,
          options
        ); // Optional timeout parameter(milliseconds)
        const { headers, body, statusCode } = response;
        writeFile(
          "C:\\Amadeus\\CALLGETPNR_Response.txt",
          JSON.stringify(body),
          (err) => {}
        );
        let session = new amadeusSession();
        if (headers["set-cookie"] && headers["set-cookie"].length > 0) {
          session.sessionId = headers["set-cookie"].filter(
            (val) => val.indexOf("ASP.NET_SessionId") == 0
          )[0];
          session.sessionId =
            session.sessionId && session.sessionId.split(";")[0];
          session.sessionId =
            session.sessionId && session.sessionId.split("=")[1];
        }
        if (statusCode == 200) resolve({ body, session });
        else reject("Response Error");
      })();
    });
  }

  private callCreateEticket(
    booking: any,
    session: amadeusSession,
    options: gatewayInputOptions
  ) {
    return new Promise((resolve, reject) => {
      let header = {
        "Content-Type": "text/xml; charset=utf-8",
        soapAction: process.env.AMADEUS_CREATETICKET_SOAP_ACTION,
        Cookie: `ASP.NET_SessionId=${session.sessionId}; path=/; secure; HttpOnly`,
      };
      let xml = fs.readFileSync(
        "src/Assets/AmadeusRequestTemplates/CreateTicket.xml",
        "utf-8"
      );
      let passengers = this.generateXMLAirTraveler(
        booking.passengers,
        booking.issuerContactInfo.email
          ? booking.issuerContactInfo.email
          : process.env.ETICKET_DEFAULT_EMAIL
      );
      xml = xml
        .replace(/{{passengers}}/g, passengers)
        .replace(/{{PNR}}/g, booking.flights.itineraries[0].pnr);
      (async () => {
        const { response } = await this.gatewaySoapRequest(
          process.env.AMADEUS_WEBSERVICE_URL,
          header,
          xml,
          10000000,
          options
        ); // Optional timeout parameter(milliseconds)
        const { headers, body, statusCode } = response;
        console.log("TICKET RESPONSE", body);
        if (statusCode == 200)
          parseString(body, (error, data) => {
            if (!error) resolve({ data, session });
            else reject("Response Error");
          });
        else reject("Response Error");
      })();
    });
  }

  private callCreateEticketWithPriceChanged(
    refrenceNumber: string,
    session: amadeusSession,
    options: gatewayInputOptions
  ) {
    return new Promise((resolve, reject) => {
      console.log("Price change request");
      let header = {
        "Content-Type": "text/xml; charset=utf-8",
        soapAction: process.env.AMADEUS_CREATETICKET_SOAP_ACTION,
        Cookie: `ASP.NET_SessionId=${session.sessionId}; path=/; secure; HttpOnly`,
      };
      let xml = fs.readFileSync(
        "src/Assets/AmadeusRequestTemplates/CreateTicketWithPriceChange.xml",
        "utf-8"
      );
      sha1hash = crypto.createHash("sha1");
      xml = xml
        .replace(/{{ReferenceNumber}}/g, refrenceNumber)
        .replace(
          /{{ControlNumber}}/g,
          sha1hash.update(refrenceNumber + securityNumber).digest("base64")
        );
      (async () => {
        const { response } = await this.gatewaySoapRequest(
          process.env.AMADEUS_WEBSERVICE_URL,
          header,
          xml,
          10000000,
          options
        ); // Optional timeout parameter(milliseconds)
        const { headers, body, statusCode } = response;
        if (statusCode == 200)
          parseString(body, (error, data) => {
            if (!error) resolve({ data, session });
            else reject("Response Error");
          });
        else reject("Response Error");
      })();
    });
  }

  private convertPassengerType(type: String) {
    switch (type.toLowerCase()) {
      case "adult":
        return "ADT";
      case "child":
        return "CHD";
      case "infant":
        return "INF";
      default:
        return null;
    }
  }

  private generateXMLAirTraveler(passengers: any, emailAddress: string) {
    let passengersString = "";
    passengers.sort((a, b) => {
      if (b.isPrimary) return 1;
      if (a.isPrimary) return -1;
      return 0;
    });
    let primaryPassenger = passengers.filter((item) => item.isPrimary)[0];
    let otherPassengers = passengers.filter((item) => !item.isPrimary);

    // Primary passenger
    if (this.convertPassengerType(primaryPassenger.type)) {
      passengersString += `<AirTraveler PassengerTypeCode="${this.convertPassengerType(
        primaryPassenger.type
      )}">`;
      passengersString += `<PersonName>`;
      passengersString += `<GivenName>${primaryPassenger.firstName}</GivenName>`;
      passengersString += `<NamePrefix>${
        primaryPassenger.isMale ? "MR" : "MS"
      }</NamePrefix>`;
      passengersString += `<Surname>${primaryPassenger.lastName}</Surname>`;
      passengersString += `</PersonName>`;
      if (primaryPassenger.birthDate)
        passengersString += `<BirthDate>${primaryPassenger.birthDate}</BirthDate>`;
      passengersString += `<Email>${emailAddress}</Email>`;
      if (
        primaryPassenger.passportNo &&
        primaryPassenger.passportCountry &&
        primaryPassenger.passportExpireDate
      )
        passengersString += `<Document DocType="DOCS" DocID="${primaryPassenger.passportNo}" DocIssueCountry="${primaryPassenger.passportCountry}" ExpireDate="${primaryPassenger.passportExpireDate}" InnerDocType="Passport" />`;
      passengersString += `</AirTraveler>
          `;
    }
    // Other Passengers
    for (let index = 0; index < otherPassengers.length; index++) {
      const element = otherPassengers[index];
      if (this.convertPassengerType(element.type)) {
        passengersString += `<AirTraveler PassengerTypeCode="${this.convertPassengerType(
          element.type
        )}">`;
        passengersString += `<PersonName>`;
        passengersString += `<GivenName>${element.firstName}</GivenName>`;
        passengersString += `<NamePrefix>${
          element.isMale ? "MR" : "MS"
        }</NamePrefix>`;
        passengersString += `<Surname>${element.lastName}</Surname>`;
        passengersString += `</PersonName>`;
        if (element.birthDate)
          passengersString += `<BirthDate>${element.birthDate}</BirthDate>`;
        passengersString += `<Email>${emailAddress}</Email>`;
        if (
          element.passportNo &&
          element.passportCountry &&
          element.passportExpireDate
        )
          passengersString += `<Document DocType="DOCS" DocID="${element.passportNo}" DocIssueCountry="${element.passportCountry}" ExpireDate="${element.passportExpireDate}" InnerDocType="Passport" />`;
        passengersString += `</AirTraveler>
            `;
      }
      //EmailType="1" means personal
    }
    return passengersString;
  }

  private generateXMLOriginDestinationInformation(
    itineraries: gatewaySearchInputItinerary[]
  ) {
    let _result = "";
    itineraries.forEach((element) => {
      _result += `<OriginDestinationInformation>`;
      _result += `<DepartureDateTime>${element.departDate}T00:01:00</DepartureDateTime>`;
      _result += `<OriginLocation LocationCode="${element.origin}" ${
        element.isOriginLocation ? 'MultiAirportCityInd="true"' : ""
      } />`;
      _result += `<DestinationLocation LocationCode="${element.destination}" ${
        element.isDestinationLocation ? 'MultiAirportCityInd="true"' : ""
      } />`;
      _result += `</OriginDestinationInformation>`;
    });
    return _result;
  }

  private gatewaySoapRequest(
    url: string,
    header: any,
    xml: string,
    timeout: number,
    options: gatewayInputOptions
  ) {
    return new Promise<any>((resolve, reject) => {
      let identifier = Date.now();
      xml = xml
        .replace(/{{WSUserName}}/g, this.signitureData.username)
        .replace(/{{WSPassword}}/g, this.signitureData.password);
      if (logFlag) {
        writeFile(
          "C:\\Amadeus\\" + identifier + "_amadeusRequestHeader.txt",
          JSON.stringify(header),
          (err) => {}
        );
        writeFile(
          "C:\\Amadeus\\" + identifier + "_amadeusRequest.xml",
          xml,
          (err) => {}
        );
      }
      soapRequest(url, header, xml, timeout)
        .then((response) => {
          if (logFlag) {
            writeFile(
              "C:\\Amadeus\\" + identifier + "_amadeusResponseHeader.txt",
              JSON.stringify(response.response.headers),
              (err) => {}
            );
            writeFile(
              "C:\\Amadeus\\" + identifier + "_amadeusResponse.xml",
              response.response.body,
              (err) => {}
            );
          }
          logHelper.logGatewayRequestResponse(
            "amadeus",
            options.requestUUID,
            header.soapAction,
            { url, body: xml, header },
            {
              header: response.response.headers,
              body: response.response.body,
              statusCode: response.response.statusCode,
            }
          );
          resolve(response);
        })
        .catch((err) => {
          if (logFlag) {
            writeFile(
              "C:\\Amadeus\\" + identifier + "_amadeusResponse.txt",
              JSON.stringify(err),
              (err) => {}
            );
          }
          logHelper.logGatewayRequestError(
            "amadeus",
            options.requestUUID,
            header.soapAction,
            err,
            { url, body: xml, header }
          );
          reject(err);
        });
    });
  }

  // Developement Use
  getNextFlight(
    session: any,
    callback: (error: any, result: any, session: any) => void,
    options: gatewayInputOptions
  ) {
    if (session.sessionId && session.sessionTime)
      if (
        new Date().getTime() - new Date(session.sessionTime).getTime() >
        sessionMaxTime
      ) {
        this.callSignOut(session.sessionId, (err, res) => {
          callback(
            "Your session is expired. Try to search for flights first.",
            null,
            { sessionDeleted: true }
          );
        });
      } else {
        this.callNextFlight(session, callback, options);
      }
    else
      callback(
        "There is no existing session. Try to search for flights first.",
        null,
        { sessionDeleted: true }
      );
  }
}
Object.seal(AmadeusManager);
