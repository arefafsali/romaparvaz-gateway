import { IGatewayImplement } from "../../Repositories/Contracts/IGatewayImplement";
import { ExternalRequest } from "../../Infrastructure/ExternalRequests";
import {
  gatewaySearchInput,
  gatewaySession,
  gatewayInputOptions,
  gatewayRuleInput,
  gatewaySearchInputItinerary,
} from "../../Common/Metadata/gatewayLogicInputMetadata";
import {
  gatewaySearchFlightResult,
  searchFlightResult,
  searchFlightItinerary,
  itineraryFlightSegment,
  nameObject,
  searchCalendarResult,
} from "../../Common/Metadata/gatewaySearchResultMetadata";
import { errorObj } from "../../Common/Metadata/errorObjMetadata";
import * as moment from "moment-jalaali";
import { TimeToString } from "../../Repositories/Utility/TimeToString";
import { IataTimezonesHelper } from "../../Repositories/Utility/IataTimezonesHelper";
import { FlightTypeHelper } from "../../Repositories/Utility/FlightTypeHelper";
import { MarkupHelper } from "../../Repositories/Utility/MarkupHelper";
import { gatewayRulesResult } from "../../Common/Metadata/gatewayRulesResultMetadata";
import { CancelingRuleHelper } from "../../Repositories/Utility/CancelingRuleHelper";
import { FlightBookingClassHelper } from "../../Repositories/Utility/FlightBookingCalssHelper";
import { gatewayBookInternalResult } from "../../Common/Metadata/gatewayBookResultMetadata";
import { gatewayTicketInternalResult } from "../../Common/Metadata/gatewayTicketResultMetadata";
import { RandomNumberGenerator } from "../../Repositories/Utility/RandomNumberGenerator";
const soapRequest = require("easy-soap-request");
const fs = require("fs");
var parseString = require("xml2js").parseString;
const _ = require("lodash");

export class Sepehr360Manager implements IGatewayImplement {
  private signitureData: any;
  private searchURL: string;
  private lockURL: string;
  private bookURL: string;
  private gatewayCode: string;

  public static sessionId: string = "";
  constructor(_signitureData, _gatewayCode: string) {
    this.signitureData = _signitureData;
    this.gatewayCode = _gatewayCode;
    switch (_gatewayCode) {
      case "mehrabseir":
        this.searchURL = process.env.SEPEHR360_MEHRABSEIR_SEARCH_ACTION;
        this.lockURL = process.env.SEPEHR360_MEHRABSEIR_LOCK_ACTION;
        this.bookURL = process.env.SEPEHR360_MEHRABSEIR_BOOK_ACTION;
        break;
      case "kiaparvazomidieh":
        this.searchURL = process.env.SEPEHR360_KIAPARVAZOMIDIEH_SEARCH_ACTION;
        this.lockURL = process.env.SEPEHR360_KIAPARVAZOMIDIEH_LOCK_ACTION;
        this.bookURL = process.env.SEPEHR360_KIAPARVAZOMIDIEH_BOOK_ACTION;
        break;
      case "rahbal":
        this.searchURL = process.env.SEPEHR360_RAHBAL_SEARCH_ACTION;
        this.lockURL = process.env.SEPEHR360_RAHBAL_LOCK_ACTION;
        this.bookURL = process.env.SEPEHR360_RAHBAL_BOOK_ACTION;
        break;
      case "toptours":
        this.searchURL = process.env.SEPEHR360_TOPTOURS_SEARCH_ACTION;
        this.lockURL = process.env.SEPEHR360_TOPTOURS_LOCK_ACTION;
        this.bookURL = process.env.SEPEHR360_TOPTOURS_BOOK_ACTION;
        break;
      case "taksetare":
        this.searchURL = process.env.SEPEHR360_TAKSETARE_SEARCH_ACTION;
        this.lockURL = process.env.SEPEHR360_TAKSETARE_LOCK_ACTION;
        this.bookURL = process.env.SEPEHR360_TAKSETARE_BOOK_ACTION;
        break;
      case "iranianbastan":
        this.searchURL = process.env.SEPEHR360_IRANIANBASTAN_SEARCH_ACTION;
        this.lockURL = process.env.SEPEHR360_IRANIANBASTAN_LOCK_ACTION;
        this.bookURL = process.env.SEPEHR360_IRANIANBASTAN_BOOK_ACTION;
        break;
      case "rahetamadon":
        this.searchURL = process.env.SEPEHR360_RAHETAMADON_SEARCH_ACTION;
        this.lockURL = process.env.SEPEHR360_RAHETAMADON_LOCK_ACTION;
        this.bookURL = process.env.SEPEHR360_RAHETAMADON_BOOK_ACTION;
        break;
      case "persiankavir":
        this.searchURL = process.env.SEPEHR360_PERSIANKAVIR_SEARCH_ACTION;
        this.lockURL = process.env.SEPEHR360_PERSIANKAVIR_LOCK_ACTION;
        this.bookURL = process.env.SEPEHR360_PERSIANKAVIR_BOOK_ACTION;
        break;
      case "zoraq":
        this.searchURL = process.env.SEPEHR360_ZORAQ_SEARCH_ACTION;
        this.lockURL = process.env.SEPEHR360_ZORAQ_LOCK_ACTION;
        this.bookURL = process.env.SEPEHR360_ZORAQ_BOOK_ACTION;
        break;
      case "sepehrsayahan":
        this.searchURL = process.env.SEPEHR360_SEPEHR_SAYAHAN_SEARCH_ACTION;
        this.lockURL = process.env.SEPEHR360_SEPEHR_SAYAHAN_LOCK_ACTION;
        this.bookURL = process.env.SEPEHR360_SEPEHR_SAYAHAN_BOOK_ACTION;
        break;
      case "sabahoma":
        this.searchURL = process.env.SEPEHR360_SABA_HOMA_SEARCH_ACTION;
        this.lockURL = process.env.SEPEHR360_SABA_HOMA_LOCK_ACTION;
        this.bookURL = process.env.SEPEHR360_SABA_HOMA_BOOK_ACTION;
        break;
      case "sabzgasht":
        this.searchURL = process.env.SEPEHR360_SABZ_GASHT_SEARCH_ACTION;
        this.lockURL = process.env.SEPEHR360_SABZ_GASHT_LOCK_ACTION;
        this.bookURL = process.env.SEPEHR360_SABZ_GASHT_BOOK_ACTION;
        break;
      case "setaregan":
        this.searchURL = process.env.SEPEHR360_SETAREGAN_SEARCH_ACTION;
        this.lockURL = process.env.SEPEHR360_SETAREGAN_LOCK_ACTION;
        this.bookURL = process.env.SEPEHR360_SETAREGAN_BOOK_ACTION;
        break;
      case "darioush":
        this.searchURL = process.env.SEPEHR360_DARIOUSH_SEARCH_ACTION;
        this.lockURL = process.env.SEPEHR360_DARIOUSH_LOCK_ACTION;
        this.bookURL = process.env.SEPEHR360_DARIOUSH_BOOK_ACTION;
        break;
      case "sepidtous":
        this.searchURL = process.env.SEPEHR360_SEPID_TOUS_SEARCH_ACTION;
        this.lockURL = process.env.SEPEHR360_SEPID_TOUS_LOCK_ACTION;
        this.bookURL = process.env.SEPEHR360_SEPID_TOUS_BOOK_ACTION;
        break;
      case "behtazgasht":
        this.searchURL = process.env.SEPEHR360_BEHTAZ_GASHT_SEARCH_ACTION;
        this.lockURL = process.env.SEPEHR360_BEHTAZ_GASHT_LOCK_ACTION;
        this.bookURL = process.env.SEPEHR360_BEHTAZ_GASHT_BOOK_ACTION;
        break;
      case "ariaparvaz":
        this.searchURL = process.env.SEPEHR360_ARIA_PARVAZ_SEARCH_ACTION;
        this.lockURL = process.env.SEPEHR360_ARIA_PARVAZ_LOCK_ACTION;
        this.bookURL = process.env.SEPEHR360_ARIA_PARVAZ_BOOK_ACTION;
        break;
      case "farhadgasht":
        this.searchURL = process.env.SEPEHR360_FARDAD_GASHT_SEARCH_ACTION;
        this.lockURL = process.env.SEPEHR360_FARDAD_GASHT_LOCK_ACTION;
        this.bookURL = process.env.SEPEHR360_FARDAD_GASHT_BOOK_ACTION;
        break;
      case "sepideparvaz":
        this.searchURL = process.env.SEPEHR360_SEPIDE_PARVAZ_SEARCH_ACTION;
        this.lockURL = process.env.SEPEHR360_SEPIDE_PARVAZ_LOCK_ACTION;
        this.bookURL = process.env.SEPEHR360_SEPIDE_PARVAZ_BOOK_ACTION;
        break;
      case "sahlangasht":
        this.searchURL = process.env.SEPEHR360_SAHLAN_GASHT_SEARCH_ACTION;
        this.lockURL = process.env.SEPEHR360_SAHLAN_GASHT_LOCK_ACTION;
        this.bookURL = process.env.SEPEHR360_SAHLAN_GASHT_BOOK_ACTION;
        break;
      case "sanamparvaz":
        this.searchURL = process.env.SEPEHR360_SANAM_PARVAZ_SEARCH_ACTION;
        this.lockURL = process.env.SEPEHR360_SANAM_PARVAZ_LOCK_ACTION;
        this.bookURL = process.env.SEPEHR360_SANAM_PARVAZ_BOOK_ACTION;
        break;
      case "artimankish":
        this.searchURL = process.env.SEPEHR360_ARTIMAN_KISH_SEARCH_ACTION;
        this.lockURL = process.env.SEPEHR360_ARTIMAN_KISH_LOCK_ACTION;
        this.bookURL = process.env.SEPEHR360_ARTIMAN_KISH_BOOK_ACTION;
        break;
      case "forouzangasht":
        this.searchURL = process.env.SEPEHR360_FOROUZAN_GASHT_SEARCH_ACTION;
        this.lockURL = process.env.SEPEHR360_FOROUZAN_GASHT_LOCK_ACTION;
        this.bookURL = process.env.SEPEHR360_FOROUZAN_GASHT_BOOK_ACTION;
        break;
      case "besatseir":
        this.searchURL = process.env.SEPEHR360_BESAT_SEIR_SEARCH_ACTION;
        this.lockURL = process.env.SEPEHR360_BESAT_SEIR_LOCK_ACTION;
        this.bookURL = process.env.SEPEHR360_BESAT_SEIR_BOOK_ACTION;
        break;
      case "alefbaiesafar":
        this.searchURL = process.env.SEPEHR360_ALEFBAIE_SAFAR_SEARCH_ACTION;
        this.lockURL = process.env.SEPEHR360_ALEFBAIE_SAFAR_LOCK_ACTION;
        this.bookURL = process.env.SEPEHR360_ALEFBAIE_SAFAR_BOOK_ACTION;
        break;
    }
  }

  getSearch(
    item: gatewaySearchInput,
    session?: gatewaySession,
    calendarResultNotRequired?: boolean,
    loggedInUser?: any,
    options?: gatewayInputOptions
  ) {
    return new Promise(
      (
        resolve: (result: gatewaySearchFlightResult) => void,
        reject: (error: errorObj) => void
      ) => {
        let _result = new gatewaySearchFlightResult();
        let _temp_itineraries = [];
        let _finalSearchItems: gatewaySearchInput[] = [item];
        let _resultCount: number = 0;
        let _gatewayErrors: any[] = [];

        let searchProcess = (item: gatewaySearchInput) => {
          let searchObj = {
            OriginIataCode: item.itineraries[0].origin,
            DestinationIataCode: item.itineraries[0].destination,
            DepartureDate: item.itineraries[0].departDate,
            DepartureDateWindow: 0,
            FetchSupplierWebserviceFlights: false,
            Language: "FA",
          };
          this.callApi(this.searchURL, searchObj)
            .then((_availability_result) => {
              let _body = _availability_result["body"];
              if (_body["ErrorMessage"]) {
                // if(this.gatewayCode === "toptours")
                // console.log("SASAN TOP TOURS", _body["Errors"])
                _gatewayErrors.push({
                  code: "",
                  data: _body,
                  error: `gateway error ${item.itineraries[0].origin} to ${item.itineraries[0].destination}`,
                  location:
                    "Sepehr360 manager -> get Search -> _body[AvailableFlights].length",
                  name: _body["Errors"],
                });
                allSearchCallback();
              } else if (_body["CharterFlights"]) {
                if (_body["CharterFlights"].length == 0) {
                  // if(this.gatewayCode === "toptours")
                  // console.log("SASAN TOP TOURS 0", _body["PricedItineraries"])
                  _gatewayErrors.push({
                    code: "",
                    data: _availability_result["body"],
                    error: `no flight available for ${item.itineraries[0].origin} to ${item.itineraries[0].destination}`,
                    location:
                      "Sepehr360 manager -> get Search -> _body[AvailableFlights].length",
                    name: "NoFlightAvailable",
                  });
                  allSearchCallback();
                } else {
                  _temp_itineraries = _temp_itineraries.concat(
                    _body["CharterFlights"]
                  );
                  // _temp_itineraries = _temp_itineraries.concat(
                  //   _body["WebserviceFlights"]
                  // );
                  allSearchCallback();
                }
              } else {
                _gatewayErrors.push({
                  code: "",
                  data: _availability_result["body"],
                  error: "no AvailableFlights field",
                  location:
                    "Sepehr360 manager -> get Search -> parse _availability_result[body]",
                  name: "InvalidResponse",
                });
                allSearchCallback();
              }
            })
            .catch((error) => {
              // if(this.gatewayCode === "toptours")
              // console.log("SASAN TOP TOURS ERRORRR", error)
              _gatewayErrors.push({
                code: "",
                data: error,
                error: "gateway Error",
                location:
                  "Sepehr360 manager -> get Search -> callApi (availability)",
                name: "InvalidResponse",
              });
              allSearchCallback();
            });
        };

        let allSearchCallback = () => {
          if (++_resultCount == _finalSearchItems.length) {
            if (_temp_itineraries.length == 0) {
              reject({
                code: "",
                // method: "search",
                data: _gatewayErrors,
                error: `no flight available`,
                location:
                  "Sepehr360 manager -> get Search -> _body[AvailableFlights].length",
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
          _temp_itineraries.forEach((recom, ind) => {
            let returnRule = [];
            // if (
            //   recom["AirItineraryPricingInfo"].FareInfo &&
            //   recom["AirItineraryPricingInfo"].FareInfo.RuleInfo
            // )
            //   returnRule = recom[
            //     "AirItineraryPricingInfo"
            //   ].FareInfo.RuleInfo.filter(
            //     (rul) => rul.RuleType === "ReturningEqual"
            //   );
            if (returnRule.length === 0) {
              let _flg_segments = recom;
              // Check dismiss economy when cabin is business and first
              if((item.cabin === "Business" || item.cabin === "First") && _flg_segments["Classes"][0]["CabinType"] === "Economy")
                return;

              // Check dismiss business and first when flight is in local and is on economy class
              if((item.cabin === "Economy" && (item.itineraries[0].originCountryCode !== "IR" || item.itineraries[0].destinationCountryCode !== "IR")) && (_flg_segments["Classes"][0]["CabinType"] === "Business" || _flg_segments["Classes"][0]["CabinType"] === "First"))
                return;

              // Check Passenger count for flights seat less than passengers
              if(parseInt(_flg_segments["Classes"][0]["AvailableSeat"].toString()) < (item.adult+item.child+item.infant+item.citizen+item.student))
                return;
              let _flg_result = new searchFlightResult();
              _flg_result.Currency = "IRR";
              _flg_result.ProviderType = "Sepehr360Provider";
              _flg_result.SequenceNumber = ind.toString();
              _flg_result.CombinationId = "0";
              _flg_result.ValidatingAirlineCode = _flg_segments["Airline"];
              _flg_result.ForceETicket = null;
              _flg_result.E_TicketEligibility = "Eligible";
              _flg_result.ServiceFeeAmount = null;

              let adultPrice = _flg_segments["Classes"][0]["AdultFare"];
              _flg_result.AdultPrice.TotalPrice = adultPrice.Payable;
              _flg_result.AdultPrice.BaseFare =
                adultPrice.BaseFare - adultPrice.Commision;
              _flg_result.AdultPrice.Tax = adultPrice.Tax;

              let childPrice = _flg_segments["Classes"][0]["ChildFare"];
              _flg_result.ChildPrice.TotalPrice = childPrice.Payable;
              _flg_result.ChildPrice.BaseFare =
                childPrice.BaseFare - childPrice.Commision;
              _flg_result.ChildPrice.Tax = childPrice.Tax;

              let infantPrice = _flg_segments["Classes"][0]["InfantFare"];
              _flg_result.InfantPrice.TotalPrice = infantPrice.Payable;
              _flg_result.InfantPrice.BaseFare =
                infantPrice.BaseFare - infantPrice.Commision;
              _flg_result.InfantPrice.Tax = infantPrice.Tax;

              _flg_result.TotalPrice =
                item.adult * parseFloat(adultPrice.Payable) +
                item.child * parseFloat(childPrice.Payable) +
                item.infant * parseFloat(infantPrice.Payable);

              let _itinerary = new searchFlightItinerary();
              _itinerary.DirectionId = "0";
              
              // Save Original Price for booking
              _itinerary.OriginalPrice = {
                TotalPrice: _flg_result.TotalPrice,
                AdultPrice: {..._flg_result.AdultPrice},
                ChildPrice: {..._flg_result.ChildPrice},
                InfantPrice: {..._flg_result.InfantPrice}
              }
              let duration = parseInt(_flg_segments["Duration"]);
              _itinerary.ElapsedTime = `${
                parseInt((duration / 60).toString()) < 10 ? "0" : ""
              }${parseInt((duration / 60).toString())}${
                duration - parseInt((duration / 60).toString()) * 60
              }`;
              _itinerary.RefNumber = ind.toString();
              _itinerary.StopCount = _flg_segments.Stop1
                ? _flg_segments.Stop2
                  ? 2
                  : 1
                : 0;
              _itinerary.isCharter = true;
              _itinerary.TotalStopTime = TimeToString.generateTimeStirng(0); //TODO
              // _flg_segments.forEach((_segment, _segment_index) => {
              let _itineraryFlight = new itineraryFlightSegment();
              _itineraryFlight.GatewayData = null;
              _itineraryFlight.DepartureDateTime =
                _flg_segments["DepartureDateTime"].replace(" ", "T") +
                ":00.000Z";
              _itineraryFlight.ArrivalDateTime =
                _flg_segments["ArrivalDateTime"].replace(" ", "T") + ":00.000Z";
              _itineraryFlight.FlightNumber = _flg_segments["FlightNumber"];
              _itineraryFlight.ResBookDesigCode =
                _flg_segments["Classes"][0]["BookingCode"];
              _itineraryFlight.FlightDuration = `${
                parseInt((duration / 60).toString()) < 10 ? "0" : ""
              }${parseInt((duration / 60).toString())}:${
                duration - parseInt((duration / 60).toString()) * 60
              }`;
              _itineraryFlight.DepartureAirport.Code =
                _flg_segments["Origin"]["Code"];
              _itineraryFlight.DepartureAirport.Terminal = "";
              _itineraryFlight.ArrivalAirport.Code =
                _flg_segments["Destination"]["Code"];
              _itineraryFlight.ArrivalAirport.Terminal = "";
              _itineraryFlight.MarketingAirline.Code = _flg_segments["Airline"];
              _itineraryFlight.OperatingAirline.Code = _flg_segments["Airline"];
              _itineraryFlight.Equipment.Code = _flg_segments["Aircraft"];

              _itineraryFlight.BookingClassAvails = {
                ResBookDesigCode: _flg_segments["Classes"][0]["BookingCode"],
                ResBookDesigQuantity: _flg_segments["Classes"][0][
                  "AvailableSeat"
                ].toString(),
                RPH: "ADT",
                AvailablePTC: "ADT",
                ResBookDesigCabinCode:
                  _flg_segments["Classes"][0]["CabinType"] == "Economy"
                    ? "Y"
                    : _flg_segments["Classes"][0]["CabinType"] == "Business"
                    ? "C"
                    : _flg_segments["Classes"][0]["CabinType"],
                FareBasis: _flg_segments["Classes"][0]["FareName"],
                FareType: null,
                ResBookDesigCabinName: new nameObject(),
              };
              let _isInternational = item.itineraries[0].destinationCountryCode=="IR" && item.itineraries[0].originCountryCode == "IR" ? false : true;
              _itineraryFlight.Baggage = [
                {
                  Index: "0",
                  Quantity: _isInternational ? "40":"20",
                  Type: "ADT",
                  Unit: "KG",
                },
                {
                  Index: "1",
                  Quantity:  _isInternational ? "40":"20",
                  Type: "CHD",
                  Unit: "KG",
                },
                {
                  Index: "2",
                  Quantity: "10",
                  Type: "INF",
                  Unit: "KG",
                },
              ]; //TODO
              _itineraryFlight.StopLocation = [];

              _itinerary.Flights[0] = _itineraryFlight;
              // });
              _flg_result.Itineraries[0] = _itinerary;
              _result.flights.push(_flg_result);
            }
          });
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
            this.gatewayCode,
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

        this.extractAllOriginDestionationOptions(item)
          .then((result) => {
            _finalSearchItems = result;
          })
          .catch((err) => {})
          .finally(() => {
            _finalSearchItems.forEach((el, ind) => {
              searchProcess(el);
            }); 
          });
        // _finalSearchItems = [item]
        // _finalSearchItems.forEach((el, ind) => {
        //   searchProcess(el);
        // });
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
              "Sepehr360 Manager -> Search Calendar"
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
      booking.flights.itineraries[0].flights.forEach((_flg, _flg_ind) => {
        let requestObj = {
          FlightSegment: {
            FlightNumber: _flg.flightNumber,
            FlightDate: _flg.departureDateTime
              .replace("T", " ")
              .replace(":00.000Z", ""),
            OriginIataCode: _flg.departureAirport.code,
            DestinationIataCode: _flg.arrivalAirport.code,
            FareName: _flg.fareBasis,
          },
          AdultCount: booking.passengers.filter((pas) => pas.type == "adult")
            .length,
          ChildCount: booking.passengers.filter((pas) => pas.type == "child")
            .length,
        };
        this.callApi(this.lockURL, requestObj)
          .then((reserveResult: any) => {
            if (!reserveResult["body"]["ErrorMessage"])
              bookingCallback(_flg_ind, reserveResult["body"]);
            else
              reject({
                code: "",
                method: "book",
                data: reserveResult["body"],
                error:
                  reserveResult["body"]["Errors"] +
                  ` | Segment ${_flg.departureAirport.cityCode} to ${_flg.arrivalAirport.cityCode}`,
                location:
                  "Sepehr360 manager -> book -> callApi (book) -> + " +
                  ` | Segment ${_flg.departureAirport.cityCode} to ${_flg.arrivalAirport.cityCode}`,
                name: "Error in booking",
              });
            return;
          })
          .catch((error) => {
            console.log(error);
            reject({
              code: "",
              method: "book",
              data: requestObj,
              error: error.stack,
              location:
                "Sepehr360 manager -> book -> callApi (book) -> " +
                ` | Segment ${_flg.departureAirport.cityCode} to ${_flg.arrivalAirport.cityCode}`,
              name: "InvalidResponse",
            });
            return;
          });
      });

      let bookingCallback = (index: number, result: any) => {
        let ticketTimeLimit = new Date();
        ticketTimeLimit.setMinutes(ticketTimeLimit.getMinutes() + 10);
        finalResult.result.rawData[index] = result;
        finalResult.result.pnr[index] = result.LockId
          ? result.LockId
          : "SEPEHR";
        finalResult.result.ticketType[index] = "";
        if (
          finalResult.result.ticketTimeLimit == "" ||
          new Date(finalResult.result.ticketTimeLimit + "Z") > ticketTimeLimit
        )
          finalResult.result.ticketTimeLimit = ticketTimeLimit
            .toISOString()
            .replace("Z", "");
        if (++resultCount == booking.flights.itineraries.length) {
          finalResult.result.pnr = [finalResult.result.pnr.join("|")];
          finalResult.result.rawData = [finalResult.result.rawData];
          finalResult.result.totalPrice = booking.flights.itineraries[0].price
            ? booking.flights.itineraries[0].price.totalPrice
            : booking.totalPrice;
          finalResult.result.bookDate = new Date().toISOString();
          finalResult.result.moneyUnit = booking.moneyUnit.moneyUnit;
          resolve(finalResult);
        }
      };
    });
  }

  private generatePassengerList(
    passengers: any[],
    isInternational: boolean,
    passengerType: string
  ) {
    let infantCount = passengers.filter((pas) => pas.type == "infant").length;
    return passengers.filter(pass=> this.convertPassengerType(pass.type) ==passengerType).map((pass) => {
      if (this.convertPassengerType(pass.type) === passengerType)
        return {
          Title: pass.isMale ? "MR" : "MS",
          FirstName: pass.firstName,
          LastName: pass.lastName,
          BirthDate: pass.birthDate,
          IranianCartMelli: isInternational
            ? null
            : {
                CodeMelli:
                  isInternational || pass.passportCountry !== "IR"
                    ? pass.passportNo
                    : pass.nationalCode,
              },
          Passport: isInternational ? {
            Number: pass.passportNo,
            ExpiryDate: pass.passportExpireDate,
            NationalityCountryCode: pass.nationality.code,
            PlaceOfIssueCountryCode: pass.nationality.code,
          }: null,
          // Telephone: {
          //   // CountryAccessCode: null,
          //   // AreaCityCode: null,
          //   PhoneNumber: issuerContactInfo.mobile,
          // },
          // Email: {
          //   Value: issuerContactInfo.email
          //     ? issuerContactInfo.email
          //     : process.env.ETICKET_DEFAULT_EMAIL,
          // },
          // Document: {
          //   DocHolderNationality: pass.nationality.code,
          //   ExpireDate:
          //     isInternational || pass.passportCountry !== "IR"
          //       ? pass.passportExpireDate
          //       : null,
          //   DocIssueCountry: pass.passportCountry,
          //   DocType: isInternational || pass.passportCountry !== "IR" ? 2 : 5, // Passport: 2, ID card: 5
          //   DocID:
          //     isInternational || pass.passportCountry !== "IR"
          //       ? pass.passportNo
          //       : pass.nationalCode,
          //   // BirthCountry: null,
          // },
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
      let ticketTempData = [];
      let finalResult = new gatewayTicketInternalResult();
      finalResult.session = null;
      let callCreatTicket = (referenceId: string) => {
        let requestObj = {
          DepartureSegment: {
            OriginIataCode:
              booking.flights.itineraries[0].flights[0].departureAirport
                .code,
            DestinationIataCode:
              booking.flights.itineraries[0].flights[0].arrivalAirport.code,
            DepartureDateTime: booking.flights.itineraries[0].flights[0].departureDateTime
              .replace("T", " ")
              .replace(":00.000Z", ""),
            FlightNumber:
              booking.flights.itineraries[0].flights[0].flightNumber,
            FareName: booking.flights.itineraries[0].flights[0].fareBasis,
            LockId: booking.flights.itineraries[0].pnr.split("|")[0],
          },
          ReturningSegment: null,
          AdultPassengers: this.generatePassengerList(
            booking.passengers,
            booking.flights.isInternational,
            "ADT"
          ),
          ChildPassengers: !this.generatePassengerList(
            booking.passengers,
            booking.flights.isInternational,
            "CHD"
          ) ? undefined : this.generatePassengerList(
            booking.passengers,
            booking.flights.isInternational,
            "CHD"
          ),
          InfantPassengers: !this.generatePassengerList(
            booking.passengers,
            booking.flights.isInternational,
            "INF"
          ) ? undefined:this.generatePassengerList(
            booking.passengers,
            booking.flights.isInternational,
            "INF"
          ),
          MobileNumber: booking.issuerContactInfo.mobile,
          Email: booking.issuerContactInfo.email
            ? booking.issuerContactInfo.email
            : process.env.ETICKET_DEFAULT_EMAIL,
          TotalPayable: booking.flights.itineraries[0].originalPrice.totalPrice,
          YourLocalInventoryPnr: null,
        };
        // let requestObj = {
        //   AirItinerary: {
        //     OriginDestinationOptions: [
        //       {
        //         FlightSegment: booking.flights.itineraries[0].flights.map(
        //           (_flg, ind) => {
        //             let lockId = booking.flights.itineraries[0].pnr.split("|")[
        //               ind
        //             ];
        //             return {
        //               DepartureAirport: {
        //                 LocationCode: _flg.departureAirport.cityCode,
        //                 // Terminal: null
        //               },
        //               ArrivalAirport: {
        //                 LocationCode: _flg.arrivalAirport.cityCode,
        //                 // Terminal: null
        //               },
        //               // Equipment: null,
        //               DepartureDateTime: _flg.departureDateTime,
        //               // ArrivalDateTime: "2020-11-04T14:15:00",
        //               // StopQuantity: null,
        //               // RPH: 0,
        //               // MarketingAirline: null,
        //               FlightNumber: _flg.flightNumber,
        //               FareBasisCode: _flg.fareBasis,
        //               // CabinType: null,
        //               // ResBookDesigCode: null,
        //               // Comment: null,
        //               LockId: lockId == "SEPEHR" ? null : lockId,
        //             };
        //           }
        //         ),
        //       },
        //     ],
        //     DirectionInd: 0,
        //   },
        //   TravelerInfo: this.generatePassengerList(
        //     booking.passengers,
        //     booking.issuerContactInfo,
        //     booking.flights.isInternational
        //   ),
        //   // [
        //   //   {
        //   //     AccompaniedByInfantInd: true,
        //   //     BirthDate: "2018-05-27T11:04:30.6230619+04:30",
        //   //     Gender: 0, // Male:0 ,Female:1
        //   //     PassengerTypeCode: "ADT",
        //   //     PersonName: {
        //   //       // NamePrefix: null,
        //   //       GivenName: "SEYED HOSSEIN",
        //   //       Surname: "MOHAMMADI"
        //   //     },
        //   //     Telephone: {
        //   //       // CountryAccessCode: null,
        //   //       // AreaCityCode: null,
        //   //       PhoneNumber: "09351231234"
        //   //     },
        //   //     Email: {
        //   //       Value: "mohammadi@gmail.com"
        //   //     },
        //   //     Document: {
        //   //       DocHolderNationality: "IR",
        //   //       ExpireDate: "2018-05-27T11:04:30.6150644+04:30",
        //   //       DocIssueCountry: "IR",
        //   //       DocType: 2, // Passport: 2, ID card: 5
        //   //       DocID: "N1234567",
        //   //       // BirthCountry: null,
        //   //     },
        //   //   },
        //   //   {
        //   //     PersonName: {
        //   //       NamePrefix: null,
        //   //       GivenName: "MITRA",
        //   //       Surname: "HAJ HASSANI"
        //   //     },
        //   //     Telephone: {
        //   //       CountryAccessCode: null,
        //   //       AreaCityCode: null,
        //   //       PhoneNumber: "09351231234"
        //   //     },
        //   //     Email: {
        //   //       Value: "mohammadi@gmail.com"
        //   //     },
        //   //     Document: {
        //   //       DocID: "0074564951",
        //   //       DocType: 5,
        //   //       ExpireDate: "2018-05-27T11:03:57.1612152+04:30",
        //   //       DocIssueCountry: "US",
        //   //       BirthCountry: null,
        //   //       DocHolderNationality: "US"
        //   //     },
        //   //     Gender: 0,
        //   //     BirthDate: "2019-11-27T11:03:57.2371987+03:30",
        //   //     PassengerTypeCode: "INF",
        //   //     AccompaniedByInfantInd: false
        //   //   }
        //   // ],
        //   Fulfillment: {
        //     PaymentDetails: [
        //       {
        //         PaymentAmount: {
        //           CurrencyCode: "IRR",
        //           Amount: booking.totalPrice,
        //         },
        //       },
        //     ],
        //   },
        //   BookingReferenceID: {
        //     ID: referenceId,
        //   },
        // };
        console.log("SASANNN",requestObj)
        this.callApi(this.bookURL, requestObj)
          .then((bookResult: any) => {
            console.log("TICKETTTTTT", this.gatewayCode, bookResult["body"])
            if (!bookResult["body"]["ErrorMessage"])
              bookingCallback(0, bookResult["body"]);
            else if (
              bookResult["body"]["ErrorMessage"][0].ShortText.indexOf(
                "رفرنس "
              ) >= 0 &&
              bookResult["body"]["ErrorMessage"][0].ShortText.indexOf(
                referenceId
              ) >= 0
            )
              callCreatTicket(RandomNumberGenerator.generate(0, 9999999999));
            else
              reject({
                code: "",
                method: "issue",
                data: bookResult["body"],
                error:
                  bookResult["body"]["ErrorMessage"][0].ShortText +
                  ` | Segment ${
                    booking.flights.itineraries[0].flights[0].departureAirport
                      .cityCode
                  } to ${
                    booking.flights.itineraries[0].flights[
                      booking.flights.itineraries[0].flights.length - 1
                    ].arrivalAirport.cityCode
                  }`,
                location:
                  "Sepehr360 manager -> createTicket -> callApi (book) -> + " +
                  ` | Segment ${
                    booking.flights.itineraries[0].flights[0].departureAirport
                      .cityCode
                  } to ${
                    booking.flights.itineraries[0].flights[
                      booking.flights.itineraries[0].flights.length - 1
                    ].arrivalAirport.cityCode
                  }`,
                name: "Error in booking",
              });
            return;
          })
          .catch((error) => {
            console.log("ERRROOOOORRR", error)
            reject({
              code: "",
              method: "issue",
              data: requestObj,
              error: error.stack,
              location:
                "Sepehr360 manager -> createTicket -> callApi (book) -> " +
                ` | Segment ${
                  booking.flights.itineraries[0].flights[0].departureAirport
                    .cityCode
                } to ${
                  booking.flights.itineraries[0].flights[
                    booking.flights.itineraries[0].flights.length - 1
                  ].arrivalAirport.cityCode
                }`,
              name: "InvalidResponse",
            });
            return;
          });
      };

      let bookingCallback = (index: number, result: any) => {
        ticketTempData[index] = result;
        booking.passengers.forEach((pass, pass_ind) => {
          finalResult.result.tickets.push({
            passengerIndex: pass.index,
            flightIndex: 0,
            refrenceId: "", // TODO
            ticketNumber: result.Passengers[pass.index] ? result.Passengers[pass.index].TicketNumber:result.Passengers[pass_ind].TicketNumber, // TODO
            status: [],
            pnr: result["Pnr"],
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

      callCreatTicket(booking.invoiceNo);
    });

    // return new Promise<gatewayTicketInternalResult>((resolve, reject) => {
    //   // booking.flights.itineraries.forEach((el, ind) => {
    //   //     .then((reserveResult: any) => {
    //   //       reserveResult = reserveResult["body"].replace(/\r\n/g, '|@|');
    //   //       reserveResult = JSON.parse(reserveResult);
    //   //       if (reserveResult.AirNRSTICKETS[0].Tickets != "") {
    //   //         reserveResult.AirNRSTICKETS[0].Tickets = reserveResult.AirNRSTICKETS[0].Tickets.split("|@|")
    //   //         ticketCallback(ind, reserveResult);
    //   //       }
    //   //       else
    //   //         reject({
    //   //           code: "",
    // // method: "book",
    //   //           data: reserveURL,
    //   //           error: reserveResult.AirReserve[0].Error + ` | Segment ${el.flights[0].departureAirport.cityCode} to ${el.flights[el.flights.length - 1].arrivalAirport.cityCode}`,
    //   //           location: "Sepehr360 manager -> createTicket -> callApi (createTicket) -> + " + ` | Segment ${el.flights[0].departureAirport.cityCode} to ${el.flights[el.flights.length - 1].arrivalAirport.cityCode}`,
    //   //           name: "Error in createTicket"
    //   //         });
    //   //       return;
    //   //     })
    //   // })

    // })
  }

  getPing: () => Promise<string>;

  getCancel: (item: any, callback: (error: any, result: any) => void) => void;

  getAirOrderTicket: (
    item: any,
    callback: (error: any, result: any) => void
  ) => void;

  private callApi(url: string, body: any) {
    return new Promise((resolve, reject) => {
      let newBody = {
        UserName: this.signitureData.username,
        Password: this.signitureData.password,
        ...body,
      };
      ExternalRequest.syncPostRequest(
        url,
        null,
        newBody,
        (error, result) => {
          // console.log("\n\n\nSASANNNN ERRORR", error);
          // console.log("\n\n\nMEHDIIIIIIIII RESULT", result.data);
          if (!error) {
            if (url === this.bookURL || url === this.lockURL)
              console.log("SASANNNNNNNNNNNNNN", this.gatewayCode, result.data);
            // if(this.gatewayCode === "taksetare")
            //   console.log("TAKSETAREEE", this.gatewayCode, JSON.stringify(result.data))
            result.body = result.data;
            resolve(result);
          } else{ 
            // if(this.gatewayCode === "rahbal")
            // console.log("SASABBBBBBBB", this.gatewayCode)
            reject(error);}
        },
        "POST",
        undefined,
        true
      ).catch(error=>{
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

Object.seal(Sepehr360Manager);
