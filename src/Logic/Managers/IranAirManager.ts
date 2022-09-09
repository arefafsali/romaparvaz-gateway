import { errorObj } from "../../Common/Metadata/errorObjMetadata";
import {
  gatewayBookInternalData,
  gatewayBookInternalResult,
} from "../../Common/Metadata/gatewayBookResultMetadata";
import {
  gatewayInputOptions,
  gatewayLogicOutput,
  gatewayRuleInput,
  gatewaySearchInput,
  gatewaySearchInputItinerary,
  gatewaySession,
} from "../../Common/Metadata/gatewayLogicInputMetadata";
import { gatewayRulesResult } from "../../Common/Metadata/gatewayRulesResultMetadata";
import {
  gatewaySearchFlightResult,
  itineraryFlightSegment,
  nameObject,
  priceObject,
  searchCalendarResult,
  searchFlightItinerary,
  searchFlightResult,
} from "../../Common/Metadata/gatewaySearchResultMetadata";
import { gatewayTicketInternalResult } from "../../Common/Metadata/gatewayTicketResultMetadata";
import { ExternalRequest } from "../../Infrastructure/ExternalRequests";
import { IGatewayImplement } from "../../Repositories/Contracts/IGatewayImplement";
import { CancelingRuleHelper } from "../../Repositories/Utility/CancelingRuleHelper";
import { IataTimezonesHelper } from "../../Repositories/Utility/IataTimezonesHelper";
import { FlightTypeHelper } from "../../Repositories/Utility/FlightTypeHelper";
import { MarkupHelper } from "../../Repositories/Utility/MarkupHelper";
import { TimeToString } from "../../Repositories/Utility/TimeToString";
import uuid = require("uuid");
import { logHelper } from "../../Repositories/Utility/logHelper";

const soapRequest = require("easy-soap-request");
const fs = require("fs");
var parseString = require("xml2js").parseString;
const _ = require("lodash");
const environment = "Test";

const baggageADT = {
  intJCIKA: "50",
  intJC: "45",
  intIIKA: "45",
  intI: "40",
  intYSVIKA: "45",
  intYSV: "40",
  intQKMIKA: "40",
  intQKM: "35",
  intNXLIKA: "35",
  intNXL: "30",
  domesticC: "30",
  domestic: "20",
};

let baggages = (ADTBaggage: string) => {
  return [
    {
      Index: "1",
      Quantity: ADTBaggage,
      Type: "ADT",
      Unit: "KG",
    },
    {
      Index: "2",
      Quantity: ADTBaggage,
      Type: "CHD",
      Unit: "KG",
    },
    {
      Index: "3",
      Quantity: "10",
      Type: "INF",
      Unit: "KG",
    },
  ];
};

export class IranAirManager implements IGatewayImplement {
  private signitureData: any;

  constructor(signitureData) {
    this.signitureData = signitureData;
  }

  getSearch(
    item: gatewaySearchInput,
    session?: gatewaySession,
    calendarResultNotRequired?: boolean,
    loggedInUser?: any,
    options?: gatewayInputOptions
  ) {
    return new Promise(
      (resolve: (result: any) => void, reject: (error: errorObj) => void) => {
        let _result = new gatewaySearchFlightResult();
        let _temp_itineraries = [];
        let _finalSearchItems: gatewaySearchInput[] = [item];
        let _resultCount: number = 0;
        let _gatewayErrors: any[] = [];
        let _bookingClasses: any[] = [];

        let searchProcess = (item: gatewaySearchInput) => {
          let xml_flight = "";
          // item.itineraries.map((flight) => {
          let xml_f = fs.readFileSync(
            "src/Assets/IranAirRequestTemplates/LowFareSearch_Flights.xml",
            "utf-8"
          );
          item.itineraries.forEach((element) => {
            xml_flight += xml_f
              .replace(/{{DepartureDateTime}}/g, element.departDate)
              .replace(/{{OriginCode}}/g, element.origin)
              .replace(/{{DestinationCode}}/g, element.destination);
          });
          // })
          let xml = fs.readFileSync(
            "src/Assets/IranAirRequestTemplates/LowFareSearch.xml",
            "utf-8"
          );
          xml = xml
            .replace(/{{TimeStamp}}/g, new Date().toISOString())
            .replace(/{{Agent_ID}}/g, process.env.IRANAIR_AgentID)
            .replace(/{{Cabin}}/g, "")
            .replace(/{{ADT}}/g, item.adult)
            .replace(/{{CHD}}/g, item.child)
            .replace(/{{INF}}/g, item.infant)
            .replace(/{{OriginDestinationInformations}}/g, xml_flight)
            .replace(/<!--[\s\S]*?-->/g, "")
            .replace(/\n/g, "")
            .replace(/\r/g, "")
            .replace(/ +(?= )/g, "");

          let headers = {
            "Content-Type": "text/xml",
            authorization: this.signitureData.authorizationKey,
            Accept: "application/xml, text/plain, */*",
          };

          this.callApi(process.env.IRANAIR_LOWFARE, xml, headers).then(
            (_availability_result) => {
              parseString(_availability_result, (err, result_iranAir: any) => {
                let _body: any = result_iranAir;
                if (_body["OTA_AirLowFareSearchRS"]["Errors"]) {
                  _gatewayErrors.push({
                    code: "",
                    data: _body,
                    error: `no flight available for ${item.itineraries[0].origin} to ${item.itineraries[0].destination}`,
                    location:
                      "IranAir manager -> get Search -> _body[AvailableFlights].length",
                    name: "NoFlightAvailable",
                  });
                  allSearchCallback();
                } else if (
                  _body["OTA_AirLowFareSearchRS"]["PricedItineraries"][0][
                  "PricedItinerary"
                  ]
                ) {
                  if (
                    _body["OTA_AirLowFareSearchRS"]["PricedItineraries"][0][
                      "PricedItinerary"
                    ].length == 0
                  ) {
                    _gatewayErrors.push({
                      code: "",
                      data: _body,
                      error: `no flight available for ${item.itineraries[0].origin} to ${item.itineraries[0].destination}`,
                      location:
                        "IranAir manager -> get Search -> _body[AvailableFlights].length",
                      name: "NoFlightAvailable",
                    });
                    allSearchCallback();
                  } else {
                    _temp_itineraries = _temp_itineraries.concat(
                      _body["OTA_AirLowFareSearchRS"]["PricedItineraries"][0][
                      "PricedItinerary"
                      ]
                    );
                    ExternalRequest.syncGetRequest(
                      `${process.env.MAIN_URL}flight_booking_class/airline_with_cabin/IR`,
                      undefined
                    ).then((bookingclass_Result: any) => {
                      _bookingClasses = bookingclass_Result.payload.data;
                      allSearchCallback();
                    });
                  }
                } else {
                  _gatewayErrors.push({
                    code: "",
                    data: _body,
                    error: "no AvailableFlights field",
                    location:
                      "IranAir manager -> get Search -> parse _availability_result[body]",
                    name: "InvalidResponse",
                  });
                  allSearchCallback();
                }
              });
            }
          )
          .catch((error) => {
            reject({
              code: "",
              data: process.env.URL_IRANAIRTOUR_ISSUE,
              error: error,
              location:
                "IranAir manager -> getSearch -> callApi (getSearch) -> ",
              name: "InvalidResponse",
            });
            return;
          });;
        };

        let allSearchCallback = () => {
          if (++_resultCount == _finalSearchItems.length) {
            if (_temp_itineraries.length == 0) {
              reject({
                code: "",
                data: _gatewayErrors,
                error: `no flight available`,
                location:
                  "IranAir manager -> get Search -> _body[AvailableFlights].length",
                name: "NoFlightAvailable",
              });
              return;
            } else {
              searchCallback();
            }
          }
        };

        let searchCallback = () => {
          let totalFlightCount = _temp_itineraries.length;
          let timezoneHelper = new IataTimezonesHelper();
          _temp_itineraries.forEach((flight, ind) => {
            let emptyObjPrice = {
              TotalPrice: null,
              BaseFare: null,
              Tax: null,
              TicketDesignators: [],
            };
            let adultObj = flight["AirItineraryPricingInfo"][0][
              "PTC_FareBreakdowns"
            ][0]["PTC_FareBreakdown"].find(
              (item) => item["PassengerTypeQuantity"][0]["$"]["Code"] == "ADT"
            );
            let childObj = flight["AirItineraryPricingInfo"][0][
              "PTC_FareBreakdowns"
            ][0]["PTC_FareBreakdown"].find(
              (item) => item["PassengerTypeQuantity"][0]["$"]["Code"] == "CHD"
            );
            let infantObj = flight["AirItineraryPricingInfo"][0][
              "PTC_FareBreakdowns"
            ][0]["PTC_FareBreakdown"].find(
              (item) => item["PassengerTypeQuantity"][0]["$"]["Code"] == "INF"
            );
            if (!adultObj) adultObj = emptyObjPrice;
            else
              adultObj = {
                TotalPrice: parseInt(
                  adultObj["PassengerFare"][0]["TotalFare"][0]["$"]["Amount"]
                ),
                BaseFare: parseInt(
                  adultObj["PassengerFare"][0]["BaseFare"][0]["$"]["Amount"]
                ),
                Tax:
                  parseInt(
                    adultObj["PassengerFare"][0]["TotalFare"][0]["$"]["Amount"]
                  ) -
                  parseInt(
                    adultObj["PassengerFare"][0]["BaseFare"][0]["$"]["Amount"]
                  ), //TODO: ask sasan about tax, it returns an array
                TicketDesignators: [],
              };
            if (!childObj) childObj = emptyObjPrice;
            else
              childObj = {
                TotalPrice: parseInt(
                  childObj["PassengerFare"][0]["TotalFare"][0]["$"]["Amount"]
                ),
                BaseFare: parseInt(
                  childObj["PassengerFare"][0]["BaseFare"][0]["$"]["Amount"]
                ),
                Tax:
                  parseInt(
                    childObj["PassengerFare"][0]["TotalFare"][0]["$"]["Amount"]
                  ) -
                  parseInt(
                    childObj["PassengerFare"][0]["BaseFare"][0]["$"]["Amount"]
                  ), //TODO: ask sasan about tax, it returns an array
                TicketDesignators: [],
              };
            if (!infantObj) infantObj = emptyObjPrice;
            else
              infantObj = {
                TotalPrice: parseInt(
                  infantObj["PassengerFare"][0]["TotalFare"][0]["$"]["Amount"]
                ),
                BaseFare: parseInt(
                  infantObj["PassengerFare"][0]["BaseFare"][0]["$"]["Amount"]
                ),
                Tax:
                  parseInt(
                    infantObj["PassengerFare"][0]["TotalFare"][0]["$"]["Amount"]
                  ) -
                  parseInt(
                    infantObj["PassengerFare"][0]["BaseFare"][0]["$"]["Amount"]
                  ), //TODO: ask sasan about tax, it returns an array
                TicketDesignators: [],
              };

            let _flg_result = new searchFlightResult();
            _flg_result.Currency =
              flight["AirItineraryPricingInfo"][0]["ItinTotalFare"][0][
              "BaseFare"
              ][0]["$"]["CurrencyCode"];
            _flg_result.ProviderType = "IranAirProvider";
            _flg_result.SequenceNumber = flight["$"]["SequenceNumber"];
            _flg_result.CombinationId = "0";
            _flg_result.ValidatingAirlineCode = "IR";
            _flg_result.ForceETicket = null;
            _flg_result.E_TicketEligibility = "Eligible";
            _flg_result.ServiceFeeAmount = null;

            _flg_result.TotalPrice = parseInt(
              flight["AirItineraryPricingInfo"][0]["ItinTotalFare"][0][
              "TotalFare"
              ][0]["$"]["Amount"]
            );

            _flg_result.AdultPrice = adultObj;
            _flg_result.ChildPrice = childObj;
            _flg_result.InfantPrice = infantObj;

            flight["AirItinerary"][0]["OriginDestinationOptions"][0][
              "OriginDestinationOption"
            ].map((itin_option, itin_index) => {
              let flight_Seg = itin_option["FlightSegment"][0];
              let _itinerary = new searchFlightItinerary();

              _itinerary.DirectionId = "0";
              let _duration = `${flight_Seg["$"]["Duration"]}`;
              _itinerary.ElapsedTime = _duration.replace(":", "").substr(0, 4);
              _itinerary.RefNumber = ind.toString();
              _itinerary.StopCount = flight_Seg["$"]["StopQuantity"] * 1;
              _itinerary.isCharter = false;
              _itinerary.TotalStopTime = "00:00";
              let _itineraryFlight = new itineraryFlightSegment();
              _itineraryFlight.GatewayData = ind;
              _itineraryFlight.DepartureDateTime =
                flight_Seg["$"]["DepartureDateTime"];
              _itineraryFlight.ArrivalDateTime =
                flight_Seg["$"]["ArrivalDateTime"];
              _itineraryFlight.FlightNumber = flight_Seg["$"]["FlightNumber"];
              _itineraryFlight.ResBookDesigCode =
                flight_Seg["BookingClassAvails"][0]["BookingClassAvail"][0]["$"][
                "ResBookDesigCode"
                ]; // TODO : ask Ali is it correct?
              _itineraryFlight.FlightDuration = flight_Seg["$"]["Duration"];
              _itineraryFlight.DepartureAirport.Code =
                flight_Seg["DepartureAirport"][0]["$"]["LocationCode"];
              _itineraryFlight.DepartureAirport.Terminal = "";
              _itineraryFlight.ArrivalAirport.Code =
                flight_Seg["ArrivalAirport"][0]["$"]["LocationCode"];
              _itineraryFlight.ArrivalAirport.Terminal = "";
              _itineraryFlight.MarketingAirline.Code =
                flight_Seg["OperatingAirline"][0]["$"]["Code"];
              _itineraryFlight.OperatingAirline.Code =
                flight_Seg["OperatingAirline"][0]["$"]["Code"];
              _itineraryFlight.Equipment.Code =
                flight_Seg["Equipment"][0]["$"]["AirEquipType"];
              _itineraryFlight.Equipment.Name.en =
                flight_Seg["Equipment"][0]["$"]["AirEquipType"];
              _itineraryFlight.Equipment.Name.fa =
                flight_Seg["Equipment"][0]["$"]["AirEquipType"];

              let _cabin = _bookingClasses.find((bcs) =>
                bcs.resBookDesigCode.includes(
                  flight_Seg["BookingClassAvails"][0]["BookingClassAvail"][0][
                  "$"
                  ]["ResBookDesigCode"]
                )
              );

              _itineraryFlight.BookingClassAvails = {
                ResBookDesigCode:
                  flight_Seg["BookingClassAvails"][0]["BookingClassAvail"][0][
                  "$"
                  ]["ResBookDesigCode"], // TODO : ask Ali is it correct?
                ResBookDesigQuantity:
                  flight_Seg["BookingClassAvails"][0]["BookingClassAvail"][0][
                  "$"
                  ]["ResBookDesigQuantity"],
                RPH: flight_Seg["$"]["RPH"],
                AvailablePTC: "ADT",
                ResBookDesigCabinCode: _cabin ? _cabin.cabinCode : "",
                FareBasis:
                  flight["AirItineraryPricingInfo"][0]["ItinTotalFare"][0][
                  "BaseFare"
                  ][0]["$"]["Amount"],
                FareType: null,
                ResBookDesigCabinName: new nameObject(),
              };

              let _isInternational = item.itineraries[0].destinationCountryCode=="IR" && item.itineraries[0].originCountryCode == "IR" ? false : true;
              _itineraryFlight.Baggage = [
                {
                  Index: "0",
                  Quantity: _isInternational ? "35":"20",
                  Type: "ADT",
                  Unit: "KG",
                },
              ]; //TODO
              _itineraryFlight.StopLocation = [];

              _itinerary.Flights[0] = _itineraryFlight;

              _flg_result.Itineraries[itin_index] = _itinerary;
            })

            _result.flights.push(_flg_result);

            // let identifier = Date.now();
            // writeFile("C:\\salamErrors\\" + identifier + "_1_IranAir__result.txt", JSON.stringify(_result), (err) => { })
          });
          // let identifier = Date.now();
          //   writeFile("C:\\salamErrors\\" + identifier + "_3_IranAir__result.txt", JSON.stringify(_result), (err) => { })
          if (!calendarResultNotRequired) {
            this.getSearchCalendar(item)
              .then((cal_result) => {
                _result.calendar = cal_result;
                calculateMarkup(item, _result);
              })
              .catch((error) => {
                if (error.name == "searchCalendarMultiLegError")
                  calculateMarkup(item, _result);
                else reject(error);
              });
          } else calculateMarkup(item, _result);
        };

        let calculateMarkup = (
          item: gatewaySearchInput,
          result: gatewaySearchFlightResult
        ) => {
          MarkupHelper.calculateMarkup(
            loggedInUser,
            "iranair",
            item,
            result,
            options
          )
            .then((newResult: gatewaySearchFlightResult) => {
              resolve(newResult);
            })
            .catch((err) => {
              // error on fetch markup
              // return bare result for now
              resolve(result);
            });
        };

        // console.log("IranAir ITEM", item)
        this.extractAllOriginDestionationOptions(item)
          .then((result) => {
            _finalSearchItems = result;
          })
          .catch((err) => { })
          .finally(() => {
            _finalSearchItems.forEach((el, ind) => {
              // console.log("IranAir", el)
              searchProcess(el);
            });
          });
      }
    );
  }

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
        let calendarResultCount = 0;
        let totalCalendarResult = item.itineraries.length * 7;
        let calendarResult: searchCalendarResult[] = [];
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
              "IranAirTour Manager -> Search Calendar"
            )
          );
        } else {
          item.itineraries.forEach((itinerary) => {
            let today = new Date(
              new Date().toISOString().split("T")[0] + "T10:00:00"
            );
            let date = new Date(itinerary.departDate + "T10:00:00");
            if (
              Math.floor(
                Math.abs(date.getTime() - today.getTime()) / (1000 * 3600 * 24)
              ) < 3
            ) {
              today.setDate(today.getDate() + 3);
              itinerary.departDate = today.toISOString().split("T")[0];
            }
          });
          item.itineraries.forEach((_itin, _itin_index) => {
            for (let dateOffset = -3; dateOffset <= +3; dateOffset++) {
              let date = new Date(_itin.departDate);
              date.setDate(date.getDate() + dateOffset);
              let _modified_item: gatewaySearchInput = {
                ...item,
                itineraries: item.itineraries.map((_temp_itin) => {
                  return { ..._temp_itin };
                }),
              };
              _modified_item.itineraries[
                _itin_index
              ].departDate = date.toISOString().split("T")[0];
              this.getSearch(_modified_item, undefined, true)
                .then((_result) => {
                  let _flight: searchFlightResult = _(_result.flights)
                    .orderBy("TotalPrice")
                    .value()[0];
                  calendarResult.push({
                    AdultPrice: _flight.AdultPrice.TotalPrice,
                    Currency: _flight.Currency,
                    Date: _flight.Itineraries.map(
                      (_itin) =>
                        _itin.Flights[0].DepartureDateTime.split("T")[0]
                    ),
                  });
                  if (++calendarResultCount == totalCalendarResult)
                    resolve(calendarResult);
                })
                .catch((_error) => {
                  if (++calendarResultCount == totalCalendarResult)
                    resolve(calendarResult);
                });
            }
          });
        }
      }
    );
  }

  getFlightRules(item: gatewayRuleInput, session?: gatewaySession) {
    return new Promise<gatewayRulesResult[]>((resolve, reject) => {
      let result: gatewayRulesResult[] = [];
      let successCount = 0;
      item.itineraryFlights.forEach((el, ind) => {
        result[ind] = new gatewayRulesResult();
        CancelingRuleHelper.getCancelingRule(
          el.airlineCode,
          el.resBookDesigCode
        )
          .then((helperResult) => callback(helperResult, ind))
          .catch((err) => reject(err));
      });
      let callback = (helperResult, ind) => {
        result[ind].cancelingRule = helperResult;
        if (++successCount == item.itineraryFlights.length) resolve(result);
      };
    });
  }

  book(booking: any, session?: gatewaySession, options?: gatewayInputOptions) {
    return new Promise<gatewayBookInternalResult>((resolve, reject) => {
      let resultCount = 0;
      let finalResult = new gatewayBookInternalResult();
      finalResult.session = null;
      let xml_traveler = "";
      let xml_flight = "";
      booking.flights.itineraries[0].flights.forEach((flight, _flg_ind) => {
        // let xml_f = fs.readFileSync("src/Assets/IranAirRequestTemplates/Book_Flights.xml", "utf-8");
        // xml_f = xml_f
        //   .replace(/{{FlightNumber}}/g, flight.flightNumber)
        //   .replace(/{{ResBookDesigCode}}/g, flight.resBookDesigCode)
        //   .replace(/{{DepartureDateTime}}/g, flight.departureDateTime) // time is in tehran local time "2021-03-15T08:00:00.000+03:30"
        //   .replace(/{{ArrivalDateTime}}/g, flight.arrivalDateTime) //
        //   .replace(/{{Duration}}/g, flight.flightDuration) // ?
        //   .replace(/{{StopQuantity}}/g, booking.flights.itineraries[0].stopCount || 0) // ?sasan     in iranAir stop is in flightSegment, in ours it is in Iteneraries
        //   .replace(/{{RPH}}/g, flight.RPH)//   ? RPH bayad save shavad
        //   .replace(/{{DepartureAirport}}/g, flight.departureAirport.code)
        //   .replace(/{{ArrivalAirport}}/g, flight.arrivalAirport.code)
        //   .replace(/{{OperatingAirline}}/g, flight.operatingAirline.code)// ?
        // xml_flight += xml_f;

        // let infant_num = booking.flights.infantCount;
        // booking.passengers.map((passenger, index) => {
        //   let xml_t = fs.readFileSync("src/Assets/IranAirRequestTemplates/Book_Travelers.xml", "utf-8");
        //   xml_t = xml_t
        //     .replace(/{{BirthDate}}/g, passenger.birthDate)
        //     .replace(/{{PassengerTypeCode}}/g, passenger.type == 'adult' ? 'ADT' : (passenger.type == 'child' ? 'CHD' : 'INF'))
        //     .replace(/{{Gender}}/g, passenger.isMale ? "M" : "F")
        //     .replace(/{{TravelerNationality}}/g, passenger.nationality.code)
        //     .replace(/{{NamePrefix}}/g, passenger.isMale ? (passenger.type == 'adult' ? "Mr" : "Master") : (passenger.type == 'adult' ? "MRS" : "Miss"))
        //     .replace(/{{GivenName}}/g, passenger.firstName)
        //     .replace(/{{Surname}}/g, passenger.lastName)
        //     .replace(/{{TravelerRefNumber_RPH}}/g, index + 1)
        //     .replace(/{{DocID}}/g, passenger.nationality.code == "IR" ? passenger.nationalCode : passenger.passportNo)
        //     .replace(/{{DocType}}/g, passenger.nationality.code == "IR" ? 5 : 2) //? 5 for Iranian ID, 2 for passport
        //     .replace(/{{DocIssueCountry}}/g, passenger.passportCountry)
        //     .replace(/{{PassportInfo}}/g, passenger.nationality.code != "IR" ? ` DocHolderNationality="${passenger.nationality.code}" ExpireDate="${passenger.passportExpireDate}" ` : '');
        //   ;
        //   if (passenger.type == "adult" && infant_num > 0) {
        //     xml_t = xml_t.replace(/{{AccompaniedByInfantInd}}/g, "true")
        //     infant_num--;
        //   }
        //   else {
        //     xml_t = xml_t.replace(/{{AccompaniedByInfantInd}}/g, "false")
        //   }
        //   xml_traveler += xml_t
        // })

        // let xml = fs.readFileSync("src/Assets/IranAirRequestTemplates/Book.xml", "utf-8");
        // xml = xml
        //   .replace(/{{TimeStamp}}/g, (new Date).toISOString())
        //   .replace(/{{Agent_ID}}/g, process.env.IRANAIR_AgentID)
        //   .replace(/{{DirectionInd}}/g, booking.flights.flightType == "roundtrip" ? "Return" : (booking.flights.flightType == "onewaytrip" ? "OneWay" : "Multi-city")) //? sasan
        //   .replace(/{{CurrencyCode}}/g, booking.moneyUnit.moneyUnit)
        //   .replace(/{{BaseFare_Amount}}/g, flight.fareBasis)  ///////// ? baseFarePrice bayad save shavad
        //   .replace(/{{TotalFare_Amount}}/g, booking.totalPrice)
        //   .replace(/{{ContactPerson_GivenName}}/g, booking.passengers[0].firstName)
        //   .replace(/{{ContactPerson_Surname}}/g, booking.passengers[0].lastName)
        //   .replace(/{{ContactPerson_PhoneNumber}}/g, "(98)9174855274")
        //   .replace(/{{ContactPerson_Email}}/g, booking.issuerContactInfo.email)
        //   .replace(/{{FlightSegments}}/g, xml_flight)
        //   .replace(/{{AirTravelers}}/g, xml_traveler)
        //   .replace(/<!--[\s\S]*?-->/g, "")
        //   .replace(/\n/g, "")
        //   .replace(/\r/g, "")
        //   .replace(/\t/g, "")
        //   .replace(/ +(?= )/g, '')

        // let headers = {
        //   "Content-Type": "text/xml",
        //   'authorization': this.signitureData.authorizationKey,
        //   Accept: 'application/xml, text/plain, */*'
        // }
        // this.callApi(process.env.IRANAIR_BOOK, xml, headers)
        //   .then((reserveResult: any) => {
        //     parseString(reserveResult, (err, result_iranAir: any) => {
        //       if (err) {
        //         console.log("err" + err);
        //         reject(err)
        //       }
        //       // console.log("SUCESSSS", JSON.stringify(result_iranAir["OTA_AirBookRS"]))
        //       if (result_iranAir["OTA_AirBookRS"]["Errors"])
        //         reject({
        //           code: "",
        //           data: reserveResult,
        //           error: result_iranAir["OTA_AirBookRS"]["Errors"] + ` | Segment ${flight.departureAirport
        //             .cityCode} to ${flight.arrivalAirport.cityCode}`,
        //           location: "IranAir manager -> book -> callApi (book) -> + " + ` | Segment ${flight.departureAirport.cityCode} to ${flight.arrivalAirport.cityCode}`,
        //           name: "Error in booking"
        //         });
        //       let final: any = {}
        //       bookingCallback(_flg_ind, result_iranAir["OTA_AirBookRS"]["AirReservation"][0]);

        //     })
        //     if (reserveResult.Success)
        //       bookingCallback(_flg_ind, reserveResult);
        //     else
        //       reject({
        //         code: "",
        //         data: reserveResult,
        //         error: reserveResult.Error + ` | Segment ${flight.departureAirport
        //           .cityCode} to ${flight.arrivalAirport.cityCode}`,
        //         location: "IranAir manager -> book -> callApi (book) -> + " + ` | Segment ${flight.departureAirport.cityCode} to ${flight.arrivalAirport.cityCode}`,
        //         name: "Error in booking"
        //       });
        //     return;
        //   })
        //   .catch(error => {
        //     reject({
        //       code: "",
        //       data: xml,
        //       error: error.stack,
        //       location: "IranAir manager -> book -> callApi (book) -> " + ` | Segment ${flight.departureAirport.cityCode} to ${flight.arrivalAirport.cityCode}`,
        //       name: "InvalidResponse"
        //     });
        //     return;
        //   })

        let ticketTimeLimit = new Date();
        ticketTimeLimit.setMinutes(ticketTimeLimit.getMinutes() + 10);
        finalResult.result.rawData[_flg_ind] = ""; //result;
        finalResult.result.pnr[_flg_ind] = "iranair"; //result["BookingReferenceID"].ID;
        finalResult.result.ticketType[_flg_ind] = "";
        if (
          finalResult.result.ticketTimeLimit == "" ||
          new Date(finalResult.result.ticketTimeLimit + "Z") > ticketTimeLimit
        )
          finalResult.result.ticketTimeLimit = ticketTimeLimit
            .toISOString()
            .replace("Z", "");
        if (++_flg_ind == booking.flights.itineraries.length) {
          finalResult.result.pnr = [finalResult.result.pnr.join("|")];
          finalResult.result.rawData = [finalResult.result.rawData];
          finalResult.result.totalPrice = booking.flights.itineraries[0].price
            ? booking.flights.itineraries[0].price.totalPrice
            : booking.totalPrice;
          finalResult.result.bookDate = new Date().toISOString();
          finalResult.result.moneyUnit = booking.moneyUnit.moneyUnit;
          resolve(finalResult);
        }
      });
    });
  }

  private generatePassengerList(
    passengers: any[],
    issuerContactInfo: any,
    isInternational: boolean
  ) {
    let infantCount = passengers.filter((pas) => pas.type == "infant").length;
    return passengers.map((pass) => {
      return {
        AccompaniedByInfantInd: infantCount-- > 0,
        BirthDate: pass.birthDate,
        Gender: pass.isMale ? 0 : 1, // Male:0 ,Female:1
        PassengerTypeCode: this.convertPassengerType(pass.type),
        PersonName: {
          // NamePrefix: null,
          GivenName: pass.firstName,
          Surname: pass.lastName,
        },
        Telephone: {
          // CountryAccessCode: null,
          // AreaCityCode: null,
          PhoneNumber: issuerContactInfo.mobile,
        },
        Email: {
          Value: issuerContactInfo.email
            ? issuerContactInfo.email
            : process.env.ETICKET_DEFAULT_EMAIL,
        },
        Document: {
          DocHolderNationality: pass.nationality.code,
          ExpireDate: isInternational ? pass.passportExpireDate : null,
          DocIssueCountry: pass.passportCountry,
          DocType: isInternational ? 2 : 5, // Passport: 2, ID card: 5
          DocID: isInternational ? pass.passportNo : pass.nationalCode,
          // BirthCountry: null,
        },
      };
    });
  }

  createTicket(
    booking: any,
    session?: gatewaySession,
    options?: gatewayInputOptions
  ) {
    return new Promise<gatewayTicketInternalResult>((resolve, reject) => {
      let resultCount = 0;
      let finalResult = new gatewayTicketInternalResult();
      let ticketTempData = [];
      finalResult.session = null;
      let xml_traveler = "";
      let xml_flight = "";
      booking.flights.itineraries[0].flights.forEach((flight, _flg_ind) => {
        let xml_f = fs.readFileSync(
          "src/Assets/IranAirRequestTemplates/Book_Flights.xml",
          "utf-8"
        );
        xml_f = xml_f
          .replace(/{{FlightNumber}}/g, flight.flightNumber)
          .replace(/{{ResBookDesigCode}}/g, flight.resBookDesigCode)
          .replace(/{{DepartureDateTime}}/g, flight.departureDateTime) // time is in tehran local time "2021-03-15T08:00:00.000+03:30"
          .replace(/{{ArrivalDateTime}}/g, flight.arrivalDateTime) //
          .replace(/{{Duration}}/g, flight.flightDuration) // ?
          .replace(
            /{{StopQuantity}}/g,
            booking.flights.itineraries[0].stopCount || 0
          ) // ?sasan     in iranAir stop is in flightSegment, in ours it is in Iteneraries
          .replace(/{{RPH}}/g, flight.RPH) //   ? RPH bayad save shavad
          .replace(/{{DepartureAirport}}/g, flight.departureAirport.code)
          .replace(/{{ArrivalAirport}}/g, flight.arrivalAirport.code)
          .replace(/{{OperatingAirline}}/g, flight.operatingAirline.code); // ?
        xml_flight += xml_f;

        let infant_num = booking.flights.infantCount;
        booking.passengers.map((passenger, index) => {
          let xml_t = fs.readFileSync(
            "src/Assets/IranAirRequestTemplates/Book_Travelers.xml",
            "utf-8"
          );
          xml_t = xml_t
            .replace(/{{BirthDate}}/g, passenger.birthDate)
            .replace(
              /{{PassengerTypeCode}}/g,
              passenger.type == "adult"
                ? "ADT"
                : passenger.type == "child"
                  ? "CHD"
                  : "INF"
            )
            .replace(/{{Gender}}/g, passenger.isMale ? "M" : "F")
            .replace(/{{TravelerNationality}}/g, passenger.nationality.code)
            .replace(
              /{{NamePrefix}}/g,
              passenger.isMale
                ? passenger.type == "adult"
                  ? "Mr"
                  : "Master"
                : passenger.type == "adult"
                  ? "MRS"
                  : "Miss"
            )
            .replace(/{{GivenName}}/g, passenger.firstName)
            .replace(/{{Surname}}/g, passenger.lastName)
            .replace(/{{TravelerRefNumber_RPH}}/g, index + 1)
            .replace(
              /{{DocID}}/g,
              booking.flights.isInternational ? 
                passenger.passportNo
                :(passenger.nationality.code == "IR" ? passenger.nationalCode : passenger.passportNo)
            )
            .replace(/{{DocType}}/g, booking.flights.isInternational || passenger.nationality.code != "IR" ? 2 : 5) //? 5 for Iranian ID, 2 for passport
            .replace(/{{DocIssueCountry}}/g, passenger.passportCountry)
            .replace(
              /{{PassportInfo}}/g,
              booking.flights.isInternational || passenger.nationality.code != "IR"
                ? ` DocHolderNationality="${passenger.nationality.code}" ExpireDate="${passenger.passportExpireDate}" `
                : ""
            );
          if (passenger.type == "adult" && infant_num > 0) {
            xml_t = xml_t.replace(/{{AccompaniedByInfantInd}}/g, "true");
            infant_num--;
          } else {
            xml_t = xml_t.replace(/{{AccompaniedByInfantInd}}/g, "false");
          }
          xml_traveler += xml_t;
        });

        let xml = fs.readFileSync(
          "src/Assets/IranAirRequestTemplates/Book.xml",
          "utf-8"
        );
        xml = xml
          .replace(/{{TimeStamp}}/g, new Date().toISOString())
          .replace(/{{Agent_ID}}/g, process.env.IRANAIR_AgentID)
          .replace(
            /{{DirectionInd}}/g,
            booking.flights.flightType == "roundtrip"
              ? "Return"
              : booking.flights.flightType == "onewaytrip"
                ? "OneWay"
                : "Multi-city"
          ) //? sasan
          .replace(/{{CurrencyCode}}/g, booking.moneyUnit.moneyUnit)
          .replace(/{{BaseFare_Amount}}/g, flight.fareBasis)
          .replace(/{{TotalFare_Amount}}/g, booking.totalPrice)
          .replace(
            /{{ContactPerson_GivenName}}/g,
            booking.passengers[0].firstName
          )
          .replace(/{{ContactPerson_Surname}}/g, booking.passengers[0].lastName)
          .replace(/{{ContactPerson_PhoneNumber}}/g, "(98)9174855274")
          .replace(/{{ContactPerson_Email}}/g, booking.issuerContactInfo.email)
          .replace(/{{FlightSegments}}/g, xml_flight)
          .replace(/{{AirTravelers}}/g, xml_traveler)
          .replace(/<!--[\s\S]*?-->/g, "")
          .replace(/\n/g, "")
          .replace(/\r/g, "")
          .replace(/\t/g, "")
          .replace(/ +(?= )/g, "");
        // console.log("TEST")
        let headers = {
          "Content-Type": "text/xml",
          authorization: this.signitureData.authorizationKey,
          Accept: "application/xml, text/plain, */*",
        };
        // console.log("JDJJDJCJJDCJ", xml)
        this.callApi(process.env.IRANAIR_BOOK, xml, headers)
          .then((reserveResult: any) => {
            console.log("IRANAIR TICKET",reserveResult);
            parseString(reserveResult, (err, result_iranAir: any) => {
              if (err) {
                console.log("err" + err);
                reject(err);
              }
              // console.log("SUCESSSS", JSON.stringify(result_iranAir["OTA_AirBookRS"]))
              if (result_iranAir["OTA_AirBookRS"]["Errors"])
                reject({
                  code: "",
                  method: "book",
                  data: process.env.IRANAIR_BOOK,
                  error:
                    result_iranAir["OTA_AirBookRS"]["Errors"] +
                    ` | Segment ${flight.flights[0].departureAirport.cityCode
                    } to ${flight.flights[flight.flights.length - 1].arrivalAirport
                      .cityCode
                    }`,
                  location:
                    "IranAir manager -> createTicket -> callApi (createTicket) -> + " +
                    ` | Segment ${flight.flights[0].departureAirport.cityCode
                    } to ${flight.flights[flight.flights.length - 1].arrivalAirport
                      .cityCode
                    }`,
                  name: "Error in createTicket",
                });
              let final: any = {};
              ticketCallback(
                _flg_ind,
                result_iranAir["OTA_AirBookRS"]["AirReservation"][0]
              );
            });
          })
          .catch((error) => {
            reject({
              code: "",
              method: "issue",
              data: process.env.URL_IRANAIRTOUR_ISSUE,
              error: error,
              location:
                "IranAir manager -> createTicket -> callApi (createTicket) -> " +
                ` | Segment ${flight.flights[0].departureAirport.cityCode} to ${flight.flights[flight.flights.length - 1].arrivalAirport
                  .cityCode
                }`,
              name: "InvalidResponse",
            });
            return;
          });
      });

      let ticketCallback = (index: number, result: any) => {
        // console.log("AMATEEEEEEEE", result);
        // console.log("SASSSSS", result["Ticketing"]);
        ticketTempData[index] = result;
        booking.passengers.forEach((pass, pass_index) => {
          finalResult.result.tickets.push({
            passengerIndex: pass.index,
            flightIndex: index,
            refrenceId: "",
            ticketNumber:
              result["Ticketing"][pass_index]["$"]["TicketDocumentNbr"],
            status: [],
            pnr: result["BookingReferenceID"][0]["$"].ID,
            cancelReason: null,
            showTicketType: null,
            callSupport: false,
          });
        });
        if (++resultCount == booking.flights.itineraries.length) {
          finalResult.result.data = ticketTempData;
          finalResult.result.callSupport = false;
          resolve(finalResult);
        }
      };
    });
  }

  getPing() {
    return new Promise((resolve, reject) => {
      let xml = fs.readFileSync(
        "src/Assets/IranAirRequestTemplates/Ping.xml",
        "utf-8"
      );
      xml = xml
        .replace(/{{Agent_ID}}/g, process.env.IRANAIR_AgentID)
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/\n/g, "")
        .replace(/ +(?= )/g, "");
      let headers = {
        "Content-Type": "application/xml",
      };
      this.callApi(process.env.IRANAIR_PING, xml, headers)
        .then(
          (response: any) => {
            resolve(response);
          },
          (error) => {
            console.log(error);
            reject({
              status: "500 ExternalRequest",
              message: error.message,
            });
          }
        )
        .catch((err) => reject(err));
    });
  }

  getCancel: (item: any, callback: (error: any, result: any) => void) => void;

  getAirOrderTicket: (
    item: any,
    callback: (error: any, result: any) => void
  ) => void;

  private callApi(url: string, body: any, header: any) {
    return new Promise((resolve, reject) => {
      // console.log("SASSSSSS", body)
      ExternalRequest.syncPostRequest(
        url,
        undefined,
        body,
        undefined,
        undefined,
        undefined,
        undefined,
        header
      )
        .then((iranAirResult: any) => {
          resolve(iranAirResult);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  private extractAllOriginDestionationOptions(item: gatewaySearchInput) {
    return new Promise<gatewaySearchInput[]>((resolve, reject) => {
      let _temp_locations: string[] = [];
      let _result: gatewaySearchInput[] = [item];

      item.itineraries.forEach((_itin) => {
        if (
          _itin.isOriginLocation &&
          _temp_locations.indexOf(_itin.origin) == -1
        )
          _temp_locations.push(_itin.origin);
        if (
          _itin.isDestinationLocation &&
          _temp_locations.indexOf(_itin.destination) == -1
        )
          _temp_locations.push(_itin.destination);
      });

      if (_temp_locations.length == 0) resolve(_result);
      else {
        ExternalRequest.syncPostRequest(
          process.env.MAIN_URL + "airport/location_list",
          undefined,
          _temp_locations,
          undefined
        )
          .then((airport_result: any) => {
            let _temp_origindestinations: string[][] = [];
            item.itineraries.forEach((el, ind) => {
              if (el.isOriginLocation)
                _temp_origindestinations[
                  2 * ind
                ] = airport_result.payload.data
                  .filter((airport) => airport.locationCode == el.origin)
                  .map((el) => el.iata);
              else _temp_origindestinations[2 * ind] = [el.origin];
              if (el.isDestinationLocation)
                _temp_origindestinations[
                  2 * ind + 1
                ] = airport_result.payload.data
                  .filter((airport) => airport.locationCode == el.destination)
                  .map((el) => el.iata);
              else _temp_origindestinations[2 * ind + 1] = [el.destination];
            });
            let _temp_total_count = _temp_origindestinations.reduce(
              (a, b) => a * b.length,
              1
            );
            _result = [];

            for (let ind = 0; ind < _temp_total_count; ind++) {
              let _temp_ind = ind;
              let _temp_item: gatewaySearchInput = new gatewaySearchInput();

              _temp_item.adult = item.adult;
              _temp_item.child = item.child;
              _temp_item.infant = item.infant;

              _temp_origindestinations.forEach((el, ind) => {
                let _index = _temp_ind % el.length;
                _temp_ind = Math.floor(_temp_ind / el.length);
                let _itin_index = Math.floor(ind / 2);
                if (!_temp_item.itineraries[_itin_index])
                  _temp_item.itineraries[
                    _itin_index
                  ] = new gatewaySearchInputItinerary();
                _temp_item.itineraries[_itin_index].departDate =
                  item.itineraries[_itin_index].departDate;
                _temp_item.itineraries[_itin_index].isOriginLocation = false;
                _temp_item.itineraries[
                  _itin_index
                ].isDestinationLocation = false;
                _temp_item.itineraries[_itin_index].originCountryCode =
                  item.itineraries[_itin_index].originCountryCode;
                _temp_item.itineraries[_itin_index].destinationCountryCode =
                  item.itineraries[_itin_index].destinationCountryCode;
                if (ind % 2 == 0)
                  _temp_item.itineraries[_itin_index].origin = el[_index];
                else
                  _temp_item.itineraries[_itin_index].destination = el[_index];
              });
              _result.push(_temp_item);
              resolve(_result);
            }
          })
          .catch((err) => resolve([item]));
      }
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
}
Object.seal(IranAirManager);
