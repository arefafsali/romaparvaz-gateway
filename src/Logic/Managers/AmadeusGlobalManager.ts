import { IGatewayImplement } from "../../Repositories/Contracts/IGatewayImplement";
import { ExternalRequest } from "../../Infrastructure/ExternalRequests";
import { gatewaySearchInput, amadeusSession, gatewaySearchInputItinerary, gatewayLogicOutput, gatewayInputOptions, gatewayRuleInput, gatewaySession, amadeusGlobalSession } from "../../Common/Metadata/gatewayLogicInputMetadata";
import { gatewaySearchFlightResult, searchFlightResult, priceObject, searchFlightItinerary, itineraryFlightSegment, searchCalendarResult, nameObject } from "../../Common/Metadata/gatewaySearchResultMetadata";
import { errorObj } from "../../Common/Metadata/errorObjMetadata";
import { TimeToString } from "../../Repositories/Utility/TimeToString";
import { FlightTypeHelper } from "../../Repositories/Utility/FlightTypeHelper";
import { MarkupHelper } from "../../Repositories/Utility/MarkupHelper";
import { gatewayRulesResult, CancelingRule } from "../../Common/Metadata/gatewayRulesResultMetadata";
import { gatewayBookInternalResult, gatewayBookInternalData } from "../../Common/Metadata/gatewayBookResultMetadata";
import { gatewayTicketInternalResult } from "../../Common/Metadata/gatewayTicketResultMetadata";
import * as crypto from "crypto";
import uuid = require("uuid");
import { logHelper } from "../../Repositories/Utility/logHelper";

const soapRequest = require("easy-soap-request");
const fs = require("fs");
var parseString = require("xml2js").parseString;
const _ = require("lodash");
const sessionMaxTime = parseInt(process.env.AMADEUS_MAX_SESSION_TIME);
const sessionMainName = process.env.AMADEUS_SESSION_MAIN_COOKIE_NAME + "=";
const securityNumber = process.env.AMADEUS_WEB_SERVICE_SECURITY_NUMBER;
let sha1hash = crypto.createHash('sha1');

export class AmadeusGlobalManager implements IGatewayImplement {

  private signitureData: any;

  constructor(signitureData) {
    this.signitureData = signitureData;
  }

  getSearch(item: gatewaySearchInput, session: amadeusGlobalSession, calendarResultNotRequired?: boolean, loggedInUser?: any, options?: gatewayInputOptions) {
    return new Promise((resolve: (result: gatewaySearchFlightResult) => void, reject: (error: errorObj) => void) => {
      let exchangeRate = this.getExchangeRate();

      let calculateMarkup = (item: gatewaySearchInput, result: gatewaySearchFlightResult) => {
        MarkupHelper.calculateMarkup(loggedInUser, "amadeus_global", item, result, options)
          .then((newResult: gatewaySearchFlightResult) => {
            resolve(newResult);
          })
          .catch(err => {
            console.log(err)
            // error on fetch markup
            // return bare result for now
            resolve(result);
          })
      }

      this.callSearchApi(item, options)
        .then(result => {
          // Find the body for checking error in it
          let data = result.body;
          var _body = data["soapenv:Envelope"]["soapenv:Body"][0]["Fare_MasterPricerTravelBoardSearchReply"][0]
          if (_body["errorMessage"])
            reject(new errorObj("amadeusGlobalSearchError",
              "",
              _body["errorMessage"][0]["errorMessageText"][0]["description"][0],
              "Amadeus Global Manager -> Search",
              data));
          else {
            // Find the list of flights in response
            var _result = new gatewaySearchFlightResult();
            _result.session = result.session;

            //TODO: minirules in gatewayData??

            // Map on the result for returning a specifict result
            _body["recommendation"].forEach((_recom, _recomIndex) => {
              _recom["segmentFlightRef"].forEach((_option, _optionIndex) => {
                let _flightData = new searchFlightResult();
                let generatePriceObject = fare => {
                  let _fareResult = new priceObject();
                  _fareResult.Tax = fare["paxFareDetail"][0]["totalTaxAmount"][0];
                  _fareResult.TotalPrice = fare["paxFareDetail"][0]["totalFareAmount"][0];
                  _fareResult.BaseFare = _fareResult.TotalPrice - _fareResult.Tax;
                  _fareResult.TicketDesignators = Array.from(new Set(fare["fareDetails"].filter(el => el["groupOfFares"][0]["ticketInfos"] && el["groupOfFares"][0]["ticketInfos"][0]["additionalFareDetails"]
                    && el["groupOfFares"][0]["ticketInfos"][0]["additionalFareDetails"][0]["ticketDesignator"]).map(el => el["groupOfFares"][0]["ticketInfos"][0]["additionalFareDetails"][0]["ticketDesignator"][0])));
                  return _fareResult;
                };

                _flightData.Currency = "IRR";//_body["conversionRate"][0]["conversionRateDetail"][0]["currency"][0];
                _flightData.ProviderType = "AmadeusGlobalProvider";
                _flightData.SequenceNumber = _recomIndex.toString();
                _flightData.CombinationId = _optionIndex.toString();
                _flightData.ValidatingAirlineCode = _recom["paxFareProduct"][0]["paxFareDetail"][0]["codeShareDetails"] ?
                  (_recom["paxFareProduct"][0]["paxFareDetail"][0]["codeShareDetails"].some(el => el.transportStageQualifier && el.transportStageQualifier[0] == "V") ?
                    _recom["paxFareProduct"][0]["paxFareDetail"][0]["codeShareDetails"].find(el => el.transportStageQualifier && el.transportStageQualifier[0] == "V").company[0] :
                    (_recom["paxFareProduct"][0]["paxFareDetail"][0]["codeShareDetails"].some(el => !el.transportStageQualifier) ?
                      _recom["paxFareProduct"][0]["paxFareDetail"][0]["codeShareDetails"].find(el => !el.transportStageQualifier).company[0] : null)) : null;
                // let eTicket = "Eligible";
                _flightData.ForceETicket = null;
                _flightData.E_TicketEligibility = "Eligible";
                _flightData.ServiceFeeAmount = null;
                _flightData.TotalPrice = this.calculateExchangeValue(parseFloat(_recom["recPriceInfo"][0]["monetaryDetail"][0]["amount"][0]), exchangeRate);

                let _tempPrice = _recom["paxFareProduct"].some(fare => fare["paxReference"][0]["ptc"][0] == "ADT") ?
                  _recom["paxFareProduct"].filter(fare => fare["paxReference"][0]["ptc"][0] == "ADT").map(generatePriceObject)[0] : new priceObject();
                _flightData.AdultPrice.BaseFare = this.calculateExchangeValue(parseFloat(_tempPrice.BaseFare), exchangeRate);
                _flightData.AdultPrice.Tax = this.calculateExchangeValue(parseFloat(_tempPrice.Tax), exchangeRate);
                _flightData.AdultPrice.TicketDesignators = _tempPrice.TicketDesignator;
                _flightData.AdultPrice.TotalPrice = this.calculateExchangeValue(parseFloat(_tempPrice.TotalPrice), exchangeRate);

                _tempPrice = _recom["paxFareProduct"].some(fare => fare["paxReference"][0]["ptc"][0] == "CNN") ?
                  _recom["paxFareProduct"].filter(fare => fare["paxReference"][0]["ptc"][0] == "CNN").map(generatePriceObject)[0] : new priceObject();
                _flightData.ChildPrice.BaseFare = this.calculateExchangeValue(parseFloat(_tempPrice.BaseFare), exchangeRate);
                _flightData.ChildPrice.Tax = this.calculateExchangeValue(parseFloat(_tempPrice.Tax), exchangeRate);
                _flightData.ChildPrice.TicketDesignators = _tempPrice.TicketDesignator;
                _flightData.ChildPrice.TotalPrice = this.calculateExchangeValue(parseFloat(_tempPrice.TotalPrice), exchangeRate);

                _tempPrice = _recom["paxFareProduct"].some(fare => fare["paxReference"][0]["ptc"][0] == "INF") ?
                  _recom["paxFareProduct"].filter(fare => fare["paxReference"][0]["ptc"][0] == "INF").map(generatePriceObject)[0] : new priceObject();
                _flightData.InfantPrice.BaseFare = this.calculateExchangeValue(parseFloat(_tempPrice.BaseFare), exchangeRate);
                _flightData.InfantPrice.Tax = this.calculateExchangeValue(parseFloat(_tempPrice.Tax), exchangeRate);
                _flightData.InfantPrice.TicketDesignators = _tempPrice.TicketDesignator;
                _flightData.InfantPrice.TotalPrice = this.calculateExchangeValue(parseFloat(_tempPrice.TotalPrice), exchangeRate);

                _flightData.GatewayData = { adult: item.adult, child: item.child, infant: item.infant, rph: "" };
                if (_flightData.ValidatingAirlineCode)
                  _flightData.GatewayData.vc = _flightData.ValidatingAirlineCode;

                let specificRecDetail = _option["referencingDetail"].filter(el => el["refQualifier"][0] == "A")
                  .map(ref => _recom["specificRecDetails"].find(el => el["specificRecItem"][0]["referenceType"][0] == "A" && el["specificRecItem"][0]["refNumber"][0] == ref["refNumber"][0]))[0]

                _option["referencingDetail"].filter(el => el["refQualifier"][0] == "S").forEach((_itin, _itinIndex) => {
                  let _originalItinerary = _body["flightIndex"].find(el => el["requestedSegmentRef"][0]["segRef"][0] == (_itinIndex + 1).toString())["groupOfFlights"]
                    .find(el => el["propFlightGrDetail"][0]["flightProposal"].find(el => !el["unitQualifier"])["ref"][0] == _itin["refNumber"][0]);
                  let _itinerary = new searchFlightItinerary();
                  _itinerary.DirectionId = _itinIndex.toString();
                  _itinerary.ElapsedTime = _originalItinerary["propFlightGrDetail"][0]["flightProposal"].find(el => el["unitQualifier"] == "EFT")["ref"][0];
                  _itinerary.RefNumber = _itin["refNumber"][0];
                  _itinerary.StopCount = _originalItinerary["flightDetails"].length - 1;
                  let _tempStopTime: number = 0;

                  if (_itinIndex > 0)
                    _flightData.GatewayData.rph += "@@";

                  _originalItinerary["flightDetails"].forEach((flight, index) => {
                    flight = flight["flightInformation"][0];

                    let _itineraryFlight = new itineraryFlightSegment();
                    _itineraryFlight.DepartureDateTime = this.generateDateTime(flight["productDateTime"][0]["dateOfDeparture"][0], flight["productDateTime"][0]["timeOfDeparture"][0]);
                    _itineraryFlight.ArrivalDateTime = this.generateDateTime(flight["productDateTime"][0]["dateOfArrival"][0], flight["productDateTime"][0]["timeOfArrival"][0]);
                    if (index > 0)
                      _tempStopTime += new Date(_itineraryFlight.DepartureDateTime).getTime() - new Date(_itinerary.Flights[index - 1].ArrivalDateTime).getTime();
                    _itineraryFlight.FlightNumber = flight["flightOrtrainNumber"][0];
                    _itineraryFlight.FlightDuration = flight["attributeDetails"].find(el => el["attributeType"][0] == "EFT")["attributeDescription"][0].substr(0, 2) + ":" +
                      flight["attributeDetails"].find(el => el["attributeType"][0] == "EFT")["attributeDescription"][0].substr(2, 2);
                    _itineraryFlight.DepartureAirport.Code = flight["location"][0]["locationId"][0];
                    _itineraryFlight.DepartureAirport.Terminal = flight["location"][0]["terminal"] ? flight["location"][0]["terminal"][0] : undefined;
                    _itineraryFlight.ArrivalAirport.Code = flight["location"][1]["locationId"][0];
                    _itineraryFlight.ArrivalAirport.Terminal = flight["location"][1]["terminal"] ? flight["location"][1]["terminal"][0] : undefined;
                    _itineraryFlight.MarketingAirline.Code = flight["companyId"][0]["marketingCarrier"][0];
                    _itineraryFlight.OperatingAirline.Code = flight["companyId"][0]["operatingCarrier"] ? flight["companyId"][0]["operatingCarrier"][0] : flight["companyId"][0]["marketingCarrier"][0];
                    _itineraryFlight.Equipment.Code = flight["productDetail"][0]["equipmentType"][0];
                    let fareDetail = _recom["paxFareProduct"][0]["fareDetails"].find(el => el["segmentRef"][0]["segRef"][0] == (_itinIndex + 1).toString())["groupOfFares"][index]["productInformation"][0];
                    _itineraryFlight.ResBookDesigCode = fareDetail["cabinProduct"][0]["rbd"][0];
                    _itineraryFlight.BookingClassAvails = {
                      AvailablePTC: fareDetail["fareProductDetail"][0]["passengerType"][0],
                      FareBasis: fareDetail["fareProductDetail"][0]["fareBasis"][0],
                      FareType: fareDetail["fareProductDetail"][0]["fareType"][0],
                      RPH: fareDetail["fareProductDetail"][0]["passengerType"][0],
                      ResBookDesigCabinCode: fareDetail["cabinProduct"][0]["cabin"][0],
                      ResBookDesigCabinName: new nameObject(),
                      ResBookDesigCode: fareDetail["cabinProduct"][0]["rbd"][0],
                      ResBookDesigQuantity: fareDetail["cabinProduct"][0]["avlStatus"][0]
                    }
                    if (_itineraryFlight.BookingClassAvails.ResBookDesigCabinCode == "M")
                      _itineraryFlight.BookingClassAvails.ResBookDesigCabinCode = "Y";

                    _itineraryFlight.Baggage = _option["referencingDetail"].filter(el => el["refQualifier"][0] == "B")
                      .map(_baggage => {
                        let bag = _body["serviceFeesGrp"].find(el => el["serviceTypeInfo"][0]["carrierFeeDetails"][0]["type"][0] == "FBA")["freeBagAllowanceGrp"]
                          .find(el => el["itemNumberInfo"][0]["itemNumberDetails"][0]["number"][0] == (_body["serviceFeesGrp"].find(el => el["serviceTypeInfo"][0]["carrierFeeDetails"][0]["type"][0] == "FBA")["serviceCoverageInfoGrp"]
                            .find(el => el["itemNumberInfo"][0]["itemNumber"][0]["number"][0] == _baggage["refNumber"][0])["serviceCovInfoGrp"][0]["refInfo"]
                            .find(el => el["referencingDetail"][0]["refQualifier"][0] = "F")["referencingDetail"][0]["refNumber"][0]))["freeBagAllownceInfo"][0]["baggageDetails"][0]
                        return {
                          Index: _baggage["refNumber"][0],
                          Quantity: bag["freeAllowance"][0],
                          Unit: bag["quantityCode"][0] == "N" ? "PC" : "KG",
                          Type: "ADT"
                        }
                      })
                    if (_itineraryFlight.Baggage.length == 0) {
                      _itineraryFlight.Baggage.push({
                        Index: "-1",
                        Quantity: "0",
                        Unit: "PC",
                        Type: "ADT"
                      })
                    }
                    _itineraryFlight.StopLocation = [];

                    if (index > 0)
                      _flightData.GatewayData.rph += "@";
                    _flightData.GatewayData.rph += [flight["productDateTime"][0]["dateOfDeparture"][0],
                    flight["productDateTime"][0]["timeOfDeparture"][0],
                    flight["location"][0]["locationId"][0],
                    flight["location"][1]["locationId"][0],
                    flight["companyId"][0]["marketingCarrier"][0],
                    flight["companyId"][0]["operatingCarrier"] ? flight["companyId"][0]["operatingCarrier"][0] : flight["companyId"][0]["marketingCarrier"][0],
                    flight["flightOrtrainNumber"][0],
                    fareDetail["cabinProduct"][0]["rbd"][0],
                    fareDetail["fareProductDetail"][0]["fareType"][0]].join("|");
                    if (specificRecDetail && specificRecDetail["specificProductDetails"][0]["fareContextDetails"].some(el => el["requestedSegmentInfo"][0]["segRef"][0] == (_itinIndex + 1).toString()))
                      _flightData.GatewayData.rph += `|${specificRecDetail["specificProductDetails"][0]["fareContextDetails"]
                        .find(el => el["requestedSegmentInfo"][0]["segRef"][0] == (_itinIndex + 1).toString())["cnxContextDetails"][index]["fareCnxInfo"][0]["contextDetails"][0]["availabilityCnxType"][0]}`
                    _itinerary.Flights.push(_itineraryFlight);
                  })
                  _itinerary.TotalStopTime = TimeToString.generateTimeStirng(_tempStopTime);

                  _flightData.Itineraries[_itinIndex] = _itinerary;
                })

                _result.flights.push(_flightData);
              })
            });
            if (item.itineraries.length == 1 || (item.itineraries.length == 2 && FlightTypeHelper.checkRoundTripFlight(item.itineraries)))
              this.getSearchCalendar(item, undefined, options)
                .then(cal_result => {
                  _result.calendar = cal_result;
                  calculateMarkup(item, _result);
                })
                .catch(error => {
                  console.log(error);
                  if (error.name == "searchCalendarMultiLegError")
                    calculateMarkup(item, _result);
                  else
                    reject(error);
                })
            else
              calculateMarkup(item, _result);
          }
        })
        .catch(error => reject(error))

    })
  }

  // Get lowest fare for a period of times
  getSearchCalendar(item: gatewaySearchInput, loggedInUser?: any, options?: gatewayInputOptions) {
    return new Promise((resolve: (result: searchCalendarResult[]) => void, reject: (error: errorObj) => void) => {
      let calculateMarkup = (item: gatewaySearchInput, result: searchCalendarResult[]) => {
        // MarkupHelper.calculateCalendarMarkup(loggedInUser, "amadeus", item, result, options)
        //   .then((newResult: searchCalendarResult[]) => {
        resolve(result);
        // })
        // .catch(err => {
        //   // error on fetch markup
        //   // return bare result for now
        //   resolve(result);
        // })
      }

      let callSearchCalendar = (item: gatewaySearchInput) => {
        return new Promise((resolve: (result: searchCalendarResult[]) => void, reject: (error: errorObj) => void) => {
          let exchangeRate = this.getExchangeRate();
          this.callSearchCalendarApi(item, options)
            .then(result => {
              let _body = result.body["soapenv:Envelope"]["soapenv:Body"][0]["Fare_MasterPricerCalendarReply"][0];
              if (_body["errorMessage"])
                reject(new errorObj("amadeusGlobalSearchError",
                  "",
                  _body["errorMessage"][0]["errorMessageText"][0]["description"][0],
                  "Amadeus Global Manager -> Search Calendar",
                  result.body));
              else {
                let _result: searchCalendarResult[] = [];

                _body["recommendation"].forEach((_recom, _recomIndex) => {
                  _recom["segmentFlightRef"].forEach((_option, _optionIndex) => {
                    let _dailyResult: searchCalendarResult = new searchCalendarResult();
                    _dailyResult.Currency = "IRR";// _body["conversionRate"][0]["conversionRateDetail"][0]["currency"][0];
                    _dailyResult.AdultPrice = this.calculateExchangeValue(parseFloat(_recom["paxFareProduct"].filter(fare => fare["paxReference"][0]["ptc"][0] == "ADT")[0]["paxFareDetail"][0]["totalFareAmount"][0]), exchangeRate);
                    _option["referencingDetail"].filter(el => el["refQualifier"][0] == "S").forEach((_itin, _itinIndex) => {
                      let _originalItinerary = _body["flightIndex"].find(el => el["requestedSegmentRef"][0]["segRef"][0] == (_itinIndex + 1).toString())["groupOfFlights"]
                        .find(el => el["propFlightGrDetail"][0]["flightProposal"].find(el => !el["unitQualifier"])["ref"][0] == _itin["refNumber"][0])["flightDetails"][0]["flightInformation"][0]["productDateTime"][0];
                      _dailyResult.Date[_itinIndex] = this.generateDateTime(_originalItinerary["dateOfDeparture"][0], _originalItinerary["timeOfDeparture"][0]);
                    })

                    _result.push(_dailyResult);
                  })
                });
                resolve(_result);
              }
            })
            .catch(error => {
              reject(error);
            })
        })
      }
      if (item.itineraries.length > 2 || (item.itineraries.length == 2 && !FlightTypeHelper.checkRoundTripFlight(item.itineraries))) {
        reject(new errorObj("searchCalendarMultiLegError",
          "",
          "SearchFlightCalendar method is not allowed with MultiLeg",
          "Amadeus Global Manager -> Search Calendar"))
      }
      else {
        let modifiedItem = JSON.parse(JSON.stringify(item));
        modifiedItem.itineraries.forEach(itinerary => {
          let today = new Date((new Date()).toISOString().split("T")[0] + "T10:00:00");
          let date = new Date(itinerary.departDate);
          if (Math.floor(Math.abs(date.getTime() - today.getTime()) / (1000 * 3600 * 24)) < 3) {
            today.setDate(today.getDate() + 3);
            itinerary.departDate = today.toISOString().split("T")[0];
          }
        });
        callSearchCalendar(item)
          .then(result => calculateMarkup(item, result))
          .catch(error => reject(error))
      }
    })
  }

  book(booking: any, session: amadeusGlobalSession, options?: gatewayInputOptions) {
    return new Promise<gatewayBookInternalResult>((resolve, reject) => {

      let { adult, child, infant, rph, vc } = booking.flights.gatewayData;
      let odiList = [];
      let tstCount = 0;
      let rawData: any = {};
      let pnr = "";
      let ticketTimeLimit = "";
      let totalPrice = 0;
      let moneyUnit = "";
      let exchangeRate = this.getExchangeRate();
      this.callInformativePricingWithoutPNR(adult, child, infant, rph, vc, options)
        .then(informativePrice_result => {
          if (informativePrice_result.body["soapenv:Envelope"]["soapenv:Body"][0]["Fare_InformativePricingWithoutPNRReply"][0]["errorGroup"])
            reject(new errorObj("amadeusGlobalSearchError",
              "",
              informativePrice_result.body["soapenv:Envelope"]["soapenv:Body"][0]["Fare_InformativePricingWithoutPNRReply"][0]["errorGroup"][0]["errorWarningDescription"][0]["freeText"][0],
              "Amadeus Global Manager -> Book",
              informativePrice_result.body));
          else {
            let _body = informativePrice_result.body["soapenv:Envelope"]["soapenv:Body"][0]["Fare_InformativePricingWithoutPNRReply"][0]["mainGroup"][0];
            //check price
            let _totalPrice = this.calculateExchangeValue(_body["pricingGroupLevelGroup"].reduce((prev, val) =>
              prev + (parseInt(val["numberOfPax"][0]["segmentControlDetails"][0]["numberOfUnits"][0]) *
                parseFloat(val["fareInfoGroup"][0]["fareAmount"][0]["otherMonetaryDetails"].find(el => el["typeQualifier"][0] == "712")["amount"][0])), 0), exchangeRate);
            console.log("ASd", Math.abs(_totalPrice))
            console.log("ASd", Math.abs(booking.totalPrice))
            console.log("ASd", Math.abs(_totalPrice - booking.totalPrice))
            if (Math.abs(_totalPrice - booking.totalPrice) > 0.001)
              reject(new errorObj("amadeusGlobalSearchError",
                "",
                "Price has changed",
                "Amadeus Global Manager -> Book",
                _body));
            else {
              //fill odiList
              let index = 0;
              rph.split('@@').forEach((_itin, _itinIndex) => {
                odiList[_itinIndex] = { origin: "", destination: "" };
                odiList[_itinIndex].origin = _body["pricingGroupLevelGroup"][0]["fareInfoGroup"][0]["segmentLevelGroup"].find(el => el["segmentInformation"][0]["itemNumber"][0] == (index + 1).toString())
                ["segmentInformation"][0]["boardPointDetails"][0]["trueLocationId"][0];
                index += _itin.split('@').length;
                odiList[_itinIndex].destination = _body["pricingGroupLevelGroup"][0]["fareInfoGroup"][0]["segmentLevelGroup"].find(el => el["segmentInformation"][0]["itemNumber"][0] == index.toString())
                ["segmentInformation"][0]["offpointDetails"][0]["trueLocationId"][0];
              })
              // _body["pricingGroupLevelGroup"][0]["fareInfoGroup"][0]["fareComponentDetailsGroup"].forEach(el => {
              //   odiList[(parseInt(el["fareComponentID"][0]["itemNumberDetails"][0]["number"][0]) - 1)] = {
              //     origin: el["marketFareComponent"][0]["boardPointDetails"][0]["trueLocationId"][0],
              //     destination: el["marketFareComponent"][0]["offpointDetails"][0]["trueLocationId"][0]
              //   }
              // })
              //signout
              this.callSignOut(this.extractSession(informativePrice_result.body), options);
              return this.callAirSellFromRecommendation(odiList, rph, adult + child, options)
            }
          }
        })
        .then(airSell_result => {
          if (airSell_result.body["soapenv:Envelope"]["soapenv:Body"][0]["Air_SellFromRecommendationReply"][0]["errorAtMessageLevel"])
            reject(new errorObj("amadeusGlobalSearchError",
              "",
              "Booking error",
              "Amadeus Global Manager -> Book",
              airSell_result.body));
          else {
            // rawData.airSell = airSell_result.body;
            let _body = airSell_result.body["soapenv:Envelope"]["soapenv:Body"][0]["Air_SellFromRecommendationReply"][0];
            if (!_body["itineraryDetails"].every(el => el["segmentInformation"].every(el => el["actionDetails"][0]["statusCode"][0] == "OK")))
              reject(new errorObj("amadeusGlobalSearchError",
                "",
                "Booking error",
                "Amadeus Global Manager -> Book",
                _body));
            else {
              return this.callPNRAddMultiElement("0", booking, this.extractSession(airSell_result.body), options)
            }
          }
        })
        .then(pnrAddElement_result => {
          // if (pnrAddElement_result.body["soapenv:Envelope"]["soapenv:Body"][0]["PNR_Reply"][0]["errorAtMessageLevel"])
          //   reject(new errorObj("amadeusGlobalSearchError",
          //     "",
          //     "Booking error",
          //     "Amadeus Global Manager -> Book",
          //     pnrAddElement_result.body));
          // else {
          // let _body = pnrAddElement_result.body["soapenv:Envelope"]["soapenv:Body"][0]["PNR_Reply"][0];
          // if (!_body["itineraryDetails"].every(el => el["segmentInformation"].every(el => el["actionDetails"][0]["statusCode"][0] == "OK")))
          //   reject(new errorObj("amadeusGlobalSearchError",
          //     "",
          //     "Booking error",
          //     "Amadeus Global Manager -> Book",
          //     _body));
          // else {
          // rawData.pnrAddElement = pnrAddElement_result.body;
          return this.callFOPCreateFormOfPayment(this.extractSession(pnrAddElement_result.body), options)
          // }
          // }
        })
        .then(fop_result => {
          //check for errors
          // rawData.fop = fop_result.body;
          return this.callPricePNRWithBookingClass(rph.split('@@')[0].split('@')[0].split('|')[8], vc, this.extractSession(fop_result.body), options)
        })
        .then(price_result => {
          //check for errors
          rawData.pricing = price_result.body;
          let fareList = price_result.body["soapenv:Envelope"]["soapenv:Body"][0]["Fare_PricePNRWithBookingClassReply"][0]["fareList"];
          tstCount = fareList.length;
          let ticketElement = fareList[0]["lastTktDate"][0]["dateTime"][0];
          ticketTimeLimit = `${ticketElement["year"][0]}-${ticketElement["month"][0].length < 2 ? "0" : ""}${ticketElement["month"][0]}-${ticketElement["day"][0].length < 2 ? "0" : ""}${ticketElement["day"][0]}T${ticketElement["hour"][0].length < 2 ? "0" : ""}${ticketElement["hour"][0]}:${ticketElement["minutes"][0].length < 2 ? "0" : ""}${ticketElement["minutes"][0]}:00`;
          totalPrice = this.calculateExchangeValue(fareList.reduce((prev, val) => val["paxSegReference"][0]["refDetails"].length *
            parseFloat(val["fareDataInformation"][0]["fareDataSupInformation"].find(el => el["fareDataQualifier"][0] == "712")["fareAmount"][0]), 0), exchangeRate);
          moneyUnit = "IRR";//fareList[0]["fareDataInformation"][0]["fareDataSupInformation"].find(el => el["fareDataQualifier"][0] == "712")["fareCurrency"][0];
          return this.callCreateTSTFromPricing(tstCount, this.extractSession(price_result.body), options)
        })
        .then(createTST_result => {
          //check for errors
          // rawData.tst = createTST_result.body;
          return this.callPNRAddMultiElement("11", null, this.extractSession(createTST_result.body), options)
        })
        .then(pnrAddElement_result => {
          //check for error
          // rawData.commitPNR = pnrAddElement_result.body;
          pnr = pnrAddElement_result.body["soapenv:Envelope"]["soapenv:Body"][0]["PNR_Reply"][0]["pnrHeader"][0]["reservationInfo"][0]["reservation"][0]["controlNumber"][0]
          return this.callPNRRetrive(pnr, this.extractSession(pnrAddElement_result.body), options)
        })
        .then(pnrRetrive_result => {
          //check for errors
          // rawData.pnrRetrive = pnrRetrive_result.body;
          return this.callIssueTicket("TKT", this.extractSession(pnrRetrive_result.body), options)
        })
        .then(checkIssueTicket_result => {
          //check for error
          rawData.checkIssueTicket = checkIssueTicket_result.body;
          if (checkIssueTicket_result.body["soapenv:Envelope"]["soapenv:Body"][0]["DocIssuance_IssueTicketReply"][0]["processingStatus"][0]["statusCode"][0] == "O") {
            this.callSignOut(this.extractSession(checkIssueTicket_result.body), options)
            let _result: gatewayBookInternalData = {
              ticketTimeLimit: ticketTimeLimit,
              ticketType: [""],
              pnr: booking.flights.itineraries.map(el => pnr),
              totalPrice: totalPrice,
              moneyUnit: moneyUnit,
              bookDate: new Date().toISOString(),
              rawData: [rawData]
            }
            resolve({
              result: _result,
              session: null
            })
            resolve
          }
          else {
            this.callCancelPNR(pnr, this.extractSession(checkIssueTicket_result.body), options)
              .then(cancelPNR_result => {
                //check for errors
                this.callSignOut(this.extractSession(cancelPNR_result.body), options)
                reject(new errorObj("amadeusGlobalSearchError",
                  "",
                  "Booking error",
                  "Amadeus Global Manager -> Book",
                  checkIssueTicket_result.body));
              })
          }
        })
        .catch(err => reject(new errorObj("bookRequestError", "",
          "Error in booking request", "Amadeus Global Manage -> book", err.stack ? err.stack : err)));
    })
  }

  // Get ping result for checking the connection and number of request
  getPing() {
    return new Promise<string>((resolve, reject) => {
      // var header = {
      //   "Content-Type": "text/xml; charset=utf-8",
      //   soapAction: process.env.AMADEUS_PING_SOAP_ACTION
      // };
      // var xml = fs.readFileSync(
      //   "src/Assets/AmadeusRequestTemplates/Ping.xml",
      //   "utf-8"
      // );
      // // usage of module
      // this.gatewaySoapRequestStateless(
      //   process.env.AMADEUS_WEBSERVICE_URL,
      //   header,
      //   xml,
      //   10000000
      // ).then(res => {
      //   // console.log(response);
      //   const { headers, body, statusCode } = res.response;
      //   let sessionId = null;
      //   if (headers["set-cookie"] && headers["set-cookie"].length > 0) {
      //     sessionId = headers["set-cookie"].filter(
      //       val => val.indexOf("ASP.NET_SessionId") == 0
      //     )[0];
      //     sessionId = sessionId && sessionId.split(";")[0];
      //     sessionId = sessionId && sessionId.split("=")[1];
      //     this.callSignOut(sessionId, (err, res) => { });
      //   }
      //   if (statusCode == 200)
      //     parseString(body, (error, data) => {
      //       resolve(data);
      //     });
      //   else reject("Response Error");
      // }).catch(err => {
      //   reject(err);
      // });
    })
  }

  getFlightRules(item: gatewayRuleInput, session?: amadeusGlobalSession, options?: gatewayInputOptions) {
    return new Promise<gatewayRulesResult[]>((resolve, reject) => {
      let { adult, child, infant, rph, vc } = item.gatewayData;
      this.callInformativePricingWithoutPNR(adult, child, infant, rph, vc, options)
        .then(selectFlight_result => {
          if (selectFlight_result.body["soapenv:Envelope"]["soapenv:Body"][0]["Fare_InformativePricingWithoutPNRReply"][0]["errorGroup"])
            reject(new errorObj("amadeusGlobalSearchError",
              "",
              selectFlight_result.body["soapenv:Envelope"]["soapenv:Body"][0]["Fare_InformativePricingWithoutPNRReply"][0]["errorGroup"][0]["errorWarningDescription"][0]["freeText"][0],
              "Amadeus Global Manager -> Get Flight Rule",
              selectFlight_result.body));
          else {
            let session = this.extractSession(selectFlight_result.body);
            let fareLength = 1;//[adult, child, infant].filter(el => el > 0).length;
            let flightLength = rph.split('@@').length;
            let resultCount = 0;
            let result = [new gatewayRulesResult()];
            result[0].flightRule = {
              miniRulesPriceText: [],
              fareRules: []
            }
            let getRules = (fareIndex, flightIndex) => {
              this.callFareCheckRule(fareIndex + 1, flightIndex + 1, session, options)
                .then((ruleResult: any) => {
                  session = this.extractSession(ruleResult.body)
                  let _body = ruleResult.body["soapenv:Envelope"]["soapenv:Body"][0]["Fare_CheckRulesReply"][0]
                  if (!_body["errorInfo"]) {
                    if (_body["tariffInfo"].some(el => el["fareRuleInfo"][0]["ruleCategoryCode"][0] == "(16)"))
                      result[0].cancelingRuleText += (_body["tariffInfo"].find(el => el["fareRuleInfo"][0]["ruleCategoryCode"][0] == "(16)").fareRuleText
                        .reduce((prev, value) => prev + value.freeText[0] + "\n", "") + "\n");

                    result[0].flightRule.miniRulesPriceText = result[0].flightRule.miniRulesPriceText.concat(_body["tariffInfo"]
                      .map(el => el.fareRuleText.reduce((prev, value) => prev + value.freeText[0] + "\n", "")));

                    result[0].flightRule.fareRules = result[0].flightRule.fareRules.concat(_body["tariffInfo"]
                      .map(el => {
                        return {
                          title: el.fareRuleText.find(el => el.freeTextQualification[0].informationType && el.freeTextQualification[0].informationType[0] == "CAT").freeText[0],
                          text: el.fareRuleText.reduce((prev, value) => prev + value.freeText[0] + "\n", "")
                        };
                      }));
                  }
                  if (++resultCount == fareLength * flightLength) {
                    this.callSignOut(session, options)
                    resolve(result)
                  }
                  else if (flightIndex + 1 < flightLength)
                    getRules(fareIndex, flightIndex + 1)
                  else
                    getRules(fareIndex + 1, 0)
                })
                .catch(err => console.log(flightIndex, fareIndex, err))
            }
            getRules(0, 0);
          }
        })
        .catch(error => reject(error))
    })
  }

  createTicket(booking: any, session: amadeusSession, options?: gatewayInputOptions) {
    return new Promise<gatewayTicketInternalResult>((resolve, reject) => {
      let finalResult: gatewayTicketInternalResult = new gatewayTicketInternalResult();
      let rawData: any = {};
      finalResult.session = null;
      let needsFurtherActions = false;
      let startDateTime;

      this.callPNRRetriveStateless(booking.flights.itineraries[0].pnr, options)
        .then(PNR_result => {
          return this.callIssueTicket("ET", this.extractSession(PNR_result.body), options)
        })
        .then(issueTicket_result => {
          //check for error
          this.callSignOut(this.extractSession(issueTicket_result.body), options)
          rawData.issueTicket = issueTicket_result.body;
          if (issueTicket_result.body["soapenv:Envelope"]["soapenv:Body"][0]["DocIssuance_IssueTicketReply"][0]["processingStatus"][0]["statusCode"][0] == "O") {
            setTimeout(() => {
              startDateTime = Date.now();
              extractTicketNumbers();
            }, 2000);
          }
          else if (issueTicket_result.body["soapenv:Envelope"]["soapenv:Body"][0]["DocIssuance_IssueTicketReply"][0]["errorGroup"][0]["errorOrWarningCodeDetails"][0]["errorDetails"][0]["errorCode"][0] == "3025")
            extractTicketNumbers();
          else {
            reject(new errorObj("amadeusGlobalSearchError",
              "",
              "Issue Ticket error",
              "Amadeus Global Manager -> createTicket",
              issueTicket_result.body));
          }
        })
        .catch(err => reject(err))

      let extractTicketNumbers = () => {
        this.callPNRRetriveStateless(booking.flights.itineraries[0].pnr, options)
          .then(PNR_result => {
            //check for errors
            let FAList = PNR_result.body["soapenv:Envelope"]["soapenv:Body"][0]["PNR_Reply"][0]["dataElementsMaster"][0]["dataElementsIndiv"].filter(el => el["elementManagementData"][0]["segmentName"][0] == "FA");
            console.log(FAList.length);
            if (FAList.length == booking.passengers.length) {
              // rawData.pnrResult = PNR_result.body;
              this.callPNRAddMultiElement("20", null, this.extractSession(PNR_result.body), options)
                .then(result => {
                  this.callSignOut(this.extractSession(result.body), options);
                })
              finalResult.result = {
                data: rawData,
                callSupport: needsFurtherActions,
                tickets: []
              }

              FAList.forEach(faRecord => {
                let travellerInfo = PNR_result.body["soapenv:Envelope"]["soapenv:Body"][0]["PNR_Reply"][0]["travellerInfo"].find(el =>
                  el["elementManagementPassenger"][0]["reference"][0]["number"][0] == faRecord["referenceForDataElement"][0]["reference"].find(el => el["qualifier"][0] == "PT")["number"][0])
                let isInfant = faRecord["otherDataFreetext"][0]["longFreetext"][0].substr(0, 3) == "PAX" ? false : true;
                let _passIndex = booking.passengers.find(el => (isInfant && this.convertPassengerType(el.type) == "INF" &&
                  el.firstName.toLowerCase() == travellerInfo["enhancedPassengerData"].find(el => el["enhancedTravellerInformation"][0]["travellerNameInfo"][0]["type"][0] == "INF")["enhancedTravellerInformation"][0]["otherPaxNamesDetails"][0]["givenName"][0].toLowerCase() &&
                  el.lastName.toLowerCase() == travellerInfo["enhancedPassengerData"].find(el => el["enhancedTravellerInformation"][0]["travellerNameInfo"][0]["type"][0] == "INF")["enhancedTravellerInformation"][0]["otherPaxNamesDetails"][0]["surname"][0].toLowerCase()) ||
                  (!isInfant && this.convertPassengerType(el.type) == travellerInfo["enhancedPassengerData"][0]["enhancedTravellerInformation"][0]["travellerNameInfo"][0]["type"][0] &&
                    el.firstName.toLowerCase() == travellerInfo["enhancedPassengerData"][0]["enhancedTravellerInformation"][0]["otherPaxNamesDetails"][0]["givenName"][0].toLowerCase() &&
                    el.lastName.toLowerCase() == travellerInfo["enhancedPassengerData"][0]["enhancedTravellerInformation"][0]["otherPaxNamesDetails"][0]["surname"][0].toLowerCase())).index;
                booking.flights.itineraries.forEach(itin => {
                  finalResult.result.tickets.push({
                    passengerIndex: _passIndex,
                    flightIndex: itin.index,
                    refrenceId: "",
                    ticketNumber: faRecord["otherDataFreetext"][0]["longFreetext"][0].split('-')[1].split('/')[0],
                    status: [],
                    pnr: booking.flights.itineraries[0].pnr,
                    cancelReason: null,
                    showTicketType: null,
                    callSupport: needsFurtherActions
                  })
                })
              })
              console.log("finalResult", finalResult)
              resolve(finalResult)
            }
            else if (Date.now() - startDateTime < 120000) {
              this.callPNRAddMultiElement("20", null, this.extractSession(PNR_result.body), options)
                .then(result => {
                  this.callSignOut(this.extractSession(result.body), options)
                  setTimeout(() => {
                    extractTicketNumbers();
                  }, 10000);
                })
            }
            else {
              needsFurtherActions = true;
              finalResult.result = {
                data: rawData,
                callSupport: needsFurtherActions,
                tickets: []
              }
              resolve(finalResult)
            }
          })
      }
    })
  }

  importPNR(pnr: string, pnrFields: any) {
    return new Promise<any>((resolve, reject) => {
      // this.callGetPNR(pnr, pnrFields.leadLastName)
      //   .then((pnrResult: any) => {
      //     parseString(pnrResult.body, (error, data) => {
      //       if (error)
      //         reject({
      //           error: error,
      //           location: "Amadeus manager -> importPNR -> parseString",
      //           code: "",
      //           name: "xmlNotValid",
      //           data: pnrResult
      //         });
      //       else {
      //         let finalData = data["soap:Envelope"]["soap:Body"][0]["GetPNRResponse"][0]["OTA_AirBookRS"][0]
      //         if (finalData.Success) {
      //           finalData = finalData["AirReservation"][0]
      //           let booking: any = {};
      //           booking.totalPrice = parseFloat(finalData["PriceInfo"][0]["ItinTotalFare"][0]["TotalFare"][0].$.Amount)
      //           booking.moneyUnit = {
      //             moneyUnit: finalData["PriceInfo"][0]["ItinTotalFare"][0]["TotalFare"][0].$.Currency
      //           }
      //           booking.flights = {};
      //           booking.flights.adultCount = finalData["TravelerInfo"][0]["AirTraveler"].filter(el => el.$.PassengerTypeCode == "ADT").length;
      //           booking.flights.childCount = finalData["TravelerInfo"][0]["AirTraveler"].filter(el => el.$.PassengerTypeCode == "CHD").length;
      //           booking.flights.infantCount = finalData["TravelerInfo"][0]["AirTraveler"].filter(el => el.$.PassengerTypeCode == "INF").length;
      //           booking.flights.sequenceNumber = "0";
      //           booking.flights.combinationId = "0";
      //           booking.flights.providerType = "AmadeusProvider";
      //           booking.flights.forceETicket = "false";
      //           booking.flights.eTicketEligibility = "Eligible";
      //           booking.flights.gatewayData = null;
      //           booking.flights.rawBookingData = JSON.stringify(data);
      //           booking.flights.ticketTimeLimit = finalData["Ticketing"][0].$.TicketTimeLimit;
      //           booking.flights.rules = [
      //             {
      //               cancelingRule: [],
      //               cancelingRuleText: "",
      //               flightRule: {
      //                 miniRulesPriceText: [],//finalData.PriceMessageInfo[0].PriceMessageInfo[0].MiniRulesPriceMessages[0].Text[0].MiniRulesPriceText ? [] :
      //                 //finalData.PriceMessageInfo[0].PriceMessageInfo[0].MiniRulesPriceMessages[0].Text[0].MiniRulesPriceText.map(el => el.$).map(el => el.PriceMessageValue.replace(/\{0\}/g, el.PriceDataList)),
      //                 fareRules: []
      //               }
      //             }
      //           ]
      //           booking.flights.itineraries = finalData["AirItinerary"][0]["OriginDestinationOptions"][0]["OriginDestinationOption"].map((option, index) => {
      //             let itin = {
      //               index: index,
      //               price: null,
      //               refNumber: option.$.RefNumber,
      //               directionId: option.$.DirectionId,
      //               elapsedTime: option.$.ElapsedTime,
      //               pnr: finalData["BookingReferenceID"][0].$.ID_Context,
      //               ticketType: finalData["Ticketing"][0].$.TicketType,
      //               flights: option["FlightSegment"].map(segment => {
      //                 return {
      //                   gatewayData: null,
      //                   departureAirport: { code: segment["DepartureAirport"][0].$.LocationCode, terminal: segment["DepartureAirport"][0].$.Terminal },
      //                   arrivalAirport: { code: segment["ArrivalAirport"][0].$.LocationCode, terminal: segment["ArrivalAirport"][0].$.Terminal },
      //                   marketingAirline: { code: segment["MarketingAirline"][0].$.Code },
      //                   operatingAirline: { code: segment["OperatingAirline"][0].$.Code },
      //                   equipment: { code: segment["Equipment"][0].$.AirEquipType },
      //                   stopLocation: segment.StopLocation ? segment.StopLocation.map(stop => stop.$) : [],
      //                   departureDateTime: segment.$.DepartureDateTime,
      //                   arrivalDateTime: segment.$.ArrivalDateTime,
      //                   flightNumber: segment.$.FlightNumber,
      //                   resBookDesigCode: segment.$.ResBookDesigCode,
      //                   flightDuration: segment.FlightDuration[0] && typeof (segment.FlightDuration[0]) == "string"
      //                     ? segment.FlightDuration[0].split("T")[1].split(":")[0] + ":" + segment.FlightDuration[0].split("T")[1].split(":")[1]
      //                     : (option["FlightSegment"].length == 1) ? option.$.ElapsedTime.substr(0, 2) + ":" + option.$.ElapsedTime.substr(2, 2) : "0",
      //                   resBookDesigCabinCode: segment["BookingClassAvails"][0]["BookingClassAvail"].find(el => el.$.ResBookDesigCode == segment.$.ResBookDesigCode).$.ResBookDesigCabinCode == "M" ? "Y" :
      //                     segment["BookingClassAvails"][0]["BookingClassAvail"].find(el => el.$.ResBookDesigCode == segment.$.ResBookDesigCode).$.ResBookDesigCabinCode,
      //                   fareBasis: segment["BookingClassAvails"][0]["BookingClassAvail"].find(el => el.$.ResBookDesigCode == segment.$.ResBookDesigCode).$.FareBasis,
      //                   fareType: segment["BookingClassAvails"][0]["BookingClassAvail"].find(el => el.$.ResBookDesigCode == segment.$.ResBookDesigCode).$.FareType,
      //                   baggage: []
      //                 };
      //               }),
      //               stopCount: 0,
      //               totalStopTime: ""
      //             }
      //             let _tempStopTime = 0;
      //             option["FlightSegment"].forEach((segment, index) => {
      //               if (index > 0)
      //                 _tempStopTime += new Date(segment.$.DepartureDateTime).getTime() - new Date(option["FlightSegment"][index - 1].$.ArrivalDateTime).getTime();
      //             })
      //             itin.stopCount = itin.flights.length - 1;
      //             itin.totalStopTime = TimeToString.generateTimeStirng(_tempStopTime);
      //             return itin;
      //           })
      //           booking.passengers = finalData["TravelerInfo"][0]["AirTraveler"].map((traveler, index) => {
      //             let pass = {
      //               index: index,
      //               isPrimary: index == 0 ? true : false,
      //               price: {
      //                 totalPrice: parseFloat(finalData["PriceInfo"][0]["PTC_FareBreakdowns"][0]["PTC_FareBreakdown"].find(el => el["PassengerTypeQuantity"][0].$.Code == traveler.$.PassengerTypeCode)["PassengerFare"][0]["TotalFare"][0].$.Amount),
      //                 baseFare: parseFloat(finalData["PriceInfo"][0]["PTC_FareBreakdowns"][0]["PTC_FareBreakdown"].find(el => el["PassengerTypeQuantity"][0].$.Code == traveler.$.PassengerTypeCode)["PassengerFare"][0]["BaseFare"][0].$.Amount),
      //                 tax: parseFloat(finalData["PriceInfo"][0]["PTC_FareBreakdowns"][0]["PTC_FareBreakdown"].find(el => el["PassengerTypeQuantity"][0].$.Code == traveler.$.PassengerTypeCode)["PassengerFare"][0]["Taxes"][0]["Tax"][0].$.Amount),
      //               },
      //               type: traveler.$.PassengerTypeCode == "INF" ? "infant" : (traveler.$.PassengerTypeCode == "CHD" ? "child" : "adult"),
      //               birthDate: traveler["BirthDate"] ? [0] : null,
      //               avatar: "39.png",
      //               lastName: traveler["PersonName"][0]["Surname"][0],
      //               firstName: traveler["PersonName"][0]["GivenName"][0],
      //               isMale: (traveler["PersonName"][0]["NamePrefix"][0] == "MS" || traveler["PersonName"][0]["NamePrefix"][0] == "MRS" || traveler["PersonName"][0]["NamePrefix"][0] == "MISS") ? false : true,
      //               nationality: traveler["Document"] ? { code: traveler["Document"][0].$.DocIssueCountry } : null,
      //               passportCountry: traveler["Document"] ? traveler["Document"][0].$.DocIssueCountry : null,
      //               nationalCode: null,
      //               passportNo: traveler["Document"] ? traveler["Document"].find(el => el.$.InnerDocType == "Passport").$.DocID : null,
      //               passportExpireDate: traveler["Document"] ? traveler["Document"].find(el => el.$.InnerDocType == "Passport").$.ExpireDate : null,
      //               ticketDesignators: finalData["PriceInfo"][0]["PTC_FareBreakdowns"][0]["PTC_FareBreakdown"].find(el => el["PassengerTypeQuantity"][0].$.Code == traveler.$.PassengerTypeCode)["TicketDesignators"] ?
      //                 finalData["PriceInfo"][0]["PTC_FareBreakdowns"][0]["PTC_FareBreakdown"].find(el => el["PassengerTypeQuantity"][0].$.Code == traveler.$.PassengerTypeCode)["TicketDesignators"][0]["TicketDesignator"].map(el => el.$.TicketDesignatorCode + "|" + el.$.TicketDesignatorExtension) : []
      //             };
      //             return pass;
      //           })
      //           resolve(booking);
      //         }
      //         else
      //           reject(finalData.Errors)
      //       }
      //     })
      //   })
      //   .catch(err => reject(err))
    })
  }

  private callSearchApi(item: gatewaySearchInput, options: gatewayInputOptions) {
    return new Promise((resolve: (response: gatewayLogicOutput) => void, reject: (error: errorObj) => void) => {
      let header = {
        "Content-Type": "text/xml; charset=utf-8",
        soapAction: process.env.AMADEUS_GLOBAL_SEARCHFLIGHT_SOAP_ACTION
      };
      var xml = fs.readFileSync("src/Assets/AmadeusGlobalRequestTemplates/SearchFlight.xml", "utf-8");

      var passengers = "";
      if (item.adult > 0) {
        passengers += '<paxReference>';
        passengers += '<ptc>ADT</ptc>';
        for (var _i = 0; _i < item.adult; _i++)
          passengers += `<traveller><ref>${_i + 1}</ref></traveller>`;
        passengers += '</paxReference>';
      }
      if (item.child > 0) {
        passengers += '<paxReference>';
        passengers += '<ptc>CNN</ptc>';
        for (var _i = 0; _i < item.child; _i++)
          passengers += `<traveller><ref>${_i + item.adult + 1}</ref></traveller>`;
        passengers += '</paxReference>';
      }
      if (item.infant > 0) {
        passengers += '<paxReference>';
        passengers += '<ptc>INF</ptc>';
        for (var _i = 0; _i < item.infant; _i++)
          passengers += `<traveller><ref>${_i + 1}</ref><infantIndicator>1</infantIndicator></traveller>`;
        passengers += '</paxReference>';
      }
      xml = xml
        .replace(/{{SeatCount}}/g, item.adult + item.child)
        .replace(/{{Passengers}}/g, passengers)
        .replace(/{{Itineraries}}/g, this.generateXMLItineraries(item.itineraries));
      this.gatewaySoapRequestStateless(process.env.AMADEUS_GLOBAL_WEBSERVICE_URL, header, xml, 10000000, options)
        .then(response => {
          const { headers, body, statusCode } = response.response;
          if (statusCode == 200)
            parseString(body, (error, data) => {
              if (error)
                reject({
                  error: error,
                  location: "Amadeus Global manager -> callSearchApi -> soapRequest -> parseString",
                  code: "",
                  name: "xmlNotValid",
                  data: {
                    body: body,
                    session: null
                  }
                });
              else
                resolve({
                  body: data,
                  session: null
                });
            })
          else
            reject({
              error: body,
              location: "Amadeus Global manager -> callSearchApi -> soapRequest -> statusCode is not 200",
              code: "",
              name: "statusNotOK",
              data: body
            });
        })
        .catch(error => {
          reject({
            error: error,
            location: "Amadeus Global manager -> callSearchApi -> soapRequest",
            code: "",
            name: "soapRequestError",
            data: null
          })
        })
    })
  }

  private callSearchCalendarApi(item: gatewaySearchInput, options: gatewayInputOptions) {
    return new Promise((resolve: (response: gatewayLogicOutput) => void, reject: (error: errorObj) => void) => {
      let header = {
        "Content-Type": "text/xml; charset=utf-8",
        soapAction: process.env.AMADEUS_GLOBAL_SEARCHFLIGHT_CALENDAR_SOAP_ACTION
      };
      var xml = fs.readFileSync("src/Assets/AmadeusGlobalRequestTemplates/SearchFlightCalendar.xml", "utf-8");

      var passengers = "";
      if (item.adult > 0) {
        passengers += '<paxReference>';
        passengers += '<ptc>ADT</ptc>';
        for (var _i = 0; _i < item.adult; _i++)
          passengers += `<traveller><ref>${_i + 1}</ref></traveller>`;
        passengers += '</paxReference>';
      }
      if (item.child > 0) {
        passengers += '<paxReference>';
        passengers += '<ptc>CNN</ptc>';
        for (var _i = 0; _i < item.child; _i++)
          passengers += `<traveller><ref>${_i + item.adult + 1}</ref></traveller>`;
        passengers += '</paxReference>';
      }
      if (item.infant > 0) {
        passengers += '<paxReference>';
        passengers += '<ptc>INF</ptc>';
        for (var _i = 0; _i < item.infant; _i++)
          passengers += `<traveller><ref>${_i + 1}</ref><infantIndicator>1</infantIndicator></traveller>`;
        passengers += '</paxReference>';
      }
      xml = xml
        .replace(/{{SeatCount}}/g, item.adult + item.child)
        .replace(/{{Passengers}}/g, passengers)
        .replace(/{{Itineraries}}/g, this.generateXMLItinerariesCalendar(item.itineraries));
      this.gatewaySoapRequestStateless(process.env.AMADEUS_GLOBAL_WEBSERVICE_URL, header, xml, 10000000, options)
        .then(response => {
          const { headers, body, statusCode } = response.response;
          if (statusCode == 200)
            parseString(body, (error, data) => {
              if (error)
                reject({
                  error: error,
                  location: "Amadeus Global manager -> callSearchCalendarApi -> soapRequest -> parseString",
                  code: "",
                  name: "xmlNotValid",
                  data: {
                    body: body,
                    session: null
                  }
                });
              else
                resolve({
                  body: data,
                  session: null
                });
            })
          else
            reject({
              error: body,
              location: "Amadeus Global manager -> callSearchCalendarApi -> soapRequest -> statusCode is not 200",
              code: "",
              name: "statusNotOK",
              data: body
            });
        })
        .catch(error => {
          reject({
            error: error,
            location: "Amadeus Global manager -> callSearchCalendarApi -> soapRequest",
            code: "",
            name: "soapRequestError",
            data: null
          })
        })
    })
  }

  private callInformativePricingWithoutPNR(adult: number, child: number, infant: number, rph: string, VC: string, options: gatewayInputOptions) {
    return new Promise<gatewayLogicOutput>((resolve, reject) => {
      var header = {
        "Content-Type": "text/xml; charset=utf-8",
        soapAction: process.env.AMADEUS_GLOBAL_INFORMATIVE_PRICING_WITHOUT_PNR_SOAP_ACTION
      };
      var xml = fs.readFileSync("src/Assets/AmadeusGlobalRequestTemplates/InformativePriceWithoutPNR.xml", "utf-8");

      let n = 1;
      var passengers = "";
      if (adult > 0) {
        passengers += '<passengersGroup>';
        passengers += '<segmentRepetitionControl>';
        passengers += '<segmentControlDetails>';
        passengers += '<quantity>';
        passengers += (n++).toString();
        passengers += '</quantity>';
        passengers += '<numberOfUnits>';
        passengers += adult;
        passengers += '</numberOfUnits>';
        passengers += '</segmentControlDetails>';
        passengers += '</segmentRepetitionControl>';
        passengers += '<travellersID>';
        for (var _i = 0; _i < adult; _i++)
          passengers += `<travellerDetails><measurementValue>${_i + 1}</measurementValue></travellerDetails>`;
        passengers += '</travellersID>';
        passengers += '<discountPtc><valueQualifier>ADT</valueQualifier></discountPtc>';
        passengers += '</passengersGroup>';
      }
      if (infant > 0) {
        passengers += '<passengersGroup>';
        passengers += '<segmentRepetitionControl>';
        passengers += '<segmentControlDetails>';
        passengers += '<quantity>';
        passengers += (n++).toString();
        passengers += '</quantity>';
        passengers += '<numberOfUnits>';
        passengers += infant;
        passengers += '</numberOfUnits>';
        passengers += '</segmentControlDetails>';
        passengers += '</segmentRepetitionControl>';
        passengers += '<travellersID>';
        for (var _i = 0; _i < infant; _i++)
          passengers += `<travellerDetails><measurementValue>${_i + 1}</measurementValue></travellerDetails>`;
        passengers += '</travellersID>';
        passengers += '<discountPtc><valueQualifier>INF</valueQualifier><fareDetails><qualifier>766</qualifier></fareDetails></discountPtc>';
        passengers += '</passengersGroup>';
      }
      if (child > 0) {
        passengers += '<passengersGroup>';
        passengers += '<segmentRepetitionControl>';
        passengers += '<segmentControlDetails>';
        passengers += '<quantity>';
        passengers += (n++).toString();
        passengers += '</quantity>';
        passengers += '<numberOfUnits>';
        passengers += child;
        passengers += '</numberOfUnits>';
        passengers += '</segmentControlDetails>';
        passengers += '</segmentRepetitionControl>';
        passengers += '<travellersID>';
        for (var _i = 0; _i < child; _i++)
          passengers += `<travellerDetails><measurementValue>${_i + adult + 1}</measurementValue></travellerDetails>`;
        passengers += '</travellersID>';
        passengers += '<discountPtc><valueQualifier>CH</valueQualifier></discountPtc>';
        passengers += '</passengersGroup>';
      }

      let segments = '';
      let fareTypes = "";
      n = 1;
      rph.split('@@').forEach((_itin, _itinIndex) => {
        _itin.split('@').forEach((_flight, _flightIndex) => {
          let flgDetails = _flight.split('|');
          segments += "<segmentGroup>";
          segments += "<segmentInformation>";
          segments += "<flightDate>";
          segments += "<departureDate>";
          segments += flgDetails[0];
          segments += "</departureDate>";
          segments += "<departureTime>";
          segments += flgDetails[1];
          segments += "</departureTime>";
          segments += "</flightDate>";
          segments += "<boardPointDetails>";
          segments += "<trueLocationId>";
          segments += flgDetails[2];
          segments += "</trueLocationId>";
          segments += "</boardPointDetails>";
          segments += "<offpointDetails>";
          segments += "<trueLocationId>";
          segments += flgDetails[3];
          segments += "</trueLocationId>";
          segments += "</offpointDetails>";
          segments += "<companyDetails>";
          segments += "<marketingCompany>";
          segments += flgDetails[4];
          segments += "</marketingCompany>";
          segments += "<operatingCompany>";
          segments += flgDetails[5];
          segments += "</operatingCompany>";
          segments += "</companyDetails>";
          segments += "<flightIdentification>";
          segments += "<flightNumber>";
          segments += flgDetails[6];
          segments += "</flightNumber>";
          segments += "<bookingClass>";
          segments += flgDetails[7];
          segments += "</bookingClass>";
          segments += "</flightIdentification>";
          segments += "<flightTypeDetails>";
          segments += "<flightIndicator>";
          segments += (_itinIndex + 1).toString();
          segments += "</flightIndicator>";
          segments += "</flightTypeDetails>";
          segments += "<itemNumber>";
          segments += (n++).toString();
          segments += "</itemNumber>";
          segments += "</segmentInformation>";
          segments += "</segmentGroup>";

          if (fareTypes.indexOf(">" + flgDetails[8] + "<") < 0) {
            fareTypes += "<pricingOptionGroup><pricingOptionKey><pricingOptionKey>";
            fareTypes += flgDetails[8] == "RP" ? "RP" : "RU";
            fareTypes += "</pricingOptionKey></pricingOptionKey></pricingOptionGroup>";
          }
        })
      })

      let validatingCompany = "";
      if (VC) {
        validatingCompany += "<pricingOptionGroup><pricingOptionKey><pricingOptionKey>VC</pricingOptionKey></pricingOptionKey><carrierInformation><companyIdentification><otherCompany>";
        validatingCompany += VC;
        validatingCompany += "</otherCompany></companyIdentification></carrierInformation></pricingOptionGroup>";
      }

      xml = xml
        .replace(/{{passengers}}/g, passengers)
        .replace(/{{segments}}/g, segments)
        .replace(/{{fareTypes}}/g, fareTypes)
        .replace(/{{validatingCompany}}/g, validatingCompany);

      this.gatewaySoapRequestStateless(process.env.AMADEUS_GLOBAL_WEBSERVICE_URL, header, xml, 10000000, options)
        .then(response => {
          const { headers, body, statusCode } = response.response;
          if (statusCode == 200)
            parseString(body, (error, data) => {
              if (error)
                reject({
                  error: error,
                  location: "Amadeus Global manager -> callInformativePricingWithoutPNR -> soapRequest -> parseString",
                  code: "",
                  name: "xmlNotValid",
                  data: {
                    body: body,
                    session: null
                  }
                });
              else
                resolve({
                  body: data,
                  session: null
                });
            })
          else
            reject({
              error: body,
              location: "Amadeus Global manager -> callInformativePricingWithoutPNR -> soapRequest -> statusCode is not 200",
              code: "",
              name: "statusNotOK",
              data: body
            });
        })
        .catch(error => {
          reject({
            error: error,
            location: "Amadeus Global manager -> callInformativePricingWithoutPNR -> soapRequest",
            code: "",
            name: "soapRequestError",
            data: null
          })
        })
    })
  }

  private callFareCheckRule(fareIndex: number, flightIndex: number, session: amadeusGlobalSession, options: gatewayInputOptions) {
    return new Promise((resolve, reject) => {
      var header = {
        "Content-Type": "text/xml; charset=utf-8",
        soapAction: process.env.AMADEUS_GLOBAL_FARE_CHECK_RULE_SOAP_ACTION
      };

      var xml = fs.readFileSync("src/Assets/AmadeusGlobalRequestTemplates/FareCheckRule.xml", "utf-8");

      xml = xml
        .replace(/{{fareIndex}}/g, fareIndex.toString())
        .replace(/{{flightIndex}}/g, flightIndex.toString());

      session.sequenceNumber++;
      this.gatewaySoapRequestStateful(process.env.AMADEUS_GLOBAL_WEBSERVICE_URL, header, xml, 10000000, session, options)
        .then(response => {
          const { headers, body, statusCode } = response.response;
          if (statusCode == 200)
            parseString(body, (error, data) => {
              if (error)
                reject({
                  error: error,
                  location: "Amadeus Global manager -> callFareCheckRule -> soapRequest -> parseString",
                  code: "",
                  name: "xmlNotValid",
                  data: {
                    body: body,
                    session: null
                  }
                });
              else
                resolve({
                  body: data,
                  session: null
                });
            })
          else
            reject({
              error: body,
              location: "Amadeus Global manager -> callFareCheckRule -> soapRequest -> statusCode is not 200",
              code: "",
              name: "statusNotOK",
              data: body
            });
        })
        .catch(error => {
          reject({
            error: error,
            location: "Amadeus Global manager -> callInformativePricingWithoutPNR -> soapRequest",
            code: "",
            name: "soapRequestError",
            data: null
          })
        })
    })
  }

  private callSignOut(session: amadeusGlobalSession, options: gatewayInputOptions) {
    return new Promise((resolve, reject) => {
      var header = {
        "Content-Type": "text/xml; charset=utf-8",
        soapAction: process.env.AMADEUS_GLOBAL_SIGNOUT_SOAP_ACTION
      };
      var xml = fs.readFileSync("src/Assets/AmadeusGlobalRequestTemplates/SecuritySignOut.xml", "utf-8");
      this.gatewaySoapRequestStateful(process.env.AMADEUS_GLOBAL_WEBSERVICE_URL, header, xml, 10000000, session, options)
        .then(response => {
          const { headers, body, statusCode } = response.response;
          if (statusCode == 200)
            parseString(body, (error, data) => {
              if (!error) {
                let result = data["soapenv:Envelope"]["soapenv:Body"][0]["Security_SignOutReply"][0]["processStatus"][0]["statusCode"][0];
                if (result == "P") resolve(true);
                else resolve(false);
              } else resolve(false);
            });
          else
            resolve(false)
        })
        .catch(err => resolve(false))
    })
  }

  private callAirSellFromRecommendation(odiList: { origin: string, destination: string }[], rph: string, passengersCount: number, options: gatewayInputOptions) {
    return new Promise<gatewayLogicOutput>((resolve, reject) => {
      var header = {
        "Content-Type": "text/xml; charset=utf-8",
        soapAction: process.env.AMADEUS_GLOBAL_AIR_SELL_RECOM_SOAP_ACTION
      };
      var xml = fs.readFileSync("src/Assets/AmadeusGlobalRequestTemplates/AirSellFromRecommendation.xml", "utf-8");

      let itineraries = '';
      rph.split('@@').forEach((_itin, _itinIndex) => {
        itineraries += "<itineraryDetails>";
        itineraries += "<originDestinationDetails>";
        itineraries += "<origin>";
        itineraries += odiList[_itinIndex].origin;
        itineraries += "</origin>";
        itineraries += "<destination>";
        itineraries += odiList[_itinIndex].destination;
        itineraries += "</destination>";
        itineraries += "</originDestinationDetails>";
        itineraries += "<message><messageFunctionDetails><messageFunction>183</messageFunction></messageFunctionDetails></message>";
        _itin.split('@').forEach((_flight, _flightIndex) => {
          let flgDetails = _flight.split('|');
          itineraries += "<segmentInformation>";
          itineraries += "<travelProductInformation>";
          itineraries += "<flightDate>";
          itineraries += "<departureDate>";
          itineraries += flgDetails[0];
          itineraries += "</departureDate>";
          itineraries += "</flightDate>";
          itineraries += "<boardPointDetails>";
          itineraries += "<trueLocationId>";
          itineraries += flgDetails[2];
          itineraries += "</trueLocationId>";
          itineraries += "</boardPointDetails>";
          itineraries += "<offpointDetails>";
          itineraries += "<trueLocationId>";
          itineraries += flgDetails[3];
          itineraries += "</trueLocationId>";
          itineraries += "</offpointDetails>";
          itineraries += "<companyDetails>";
          itineraries += "<marketingCompany>";
          itineraries += flgDetails[4];
          itineraries += "</marketingCompany>";
          itineraries += "</companyDetails>";
          itineraries += "<flightIdentification>";
          itineraries += "<flightNumber>";
          itineraries += flgDetails[6];
          itineraries += "</flightNumber>";
          itineraries += "<bookingClass>";
          itineraries += flgDetails[7];
          itineraries += "</bookingClass>";
          itineraries += "</flightIdentification>";
          if (flgDetails[9]) {
            itineraries += "<flightTypeDetails>";
            itineraries += "<flightIndicator>";
            itineraries += flgDetails[9];
            itineraries += "</flightIndicator>";
            itineraries += "</flightTypeDetails>";
          }
          itineraries += "</travelProductInformation>";
          itineraries += "<relatedproductInformation>";
          itineraries += "<quantity>";
          itineraries += passengersCount.toString();
          itineraries += "</quantity>";
          itineraries += "<statusCode>NN</statusCode>";
          itineraries += "</relatedproductInformation>";
          itineraries += "</segmentInformation>";
        })
        itineraries += "</itineraryDetails>";
      })

      xml = xml.replace(/{{Itineraries}}/g, itineraries);

      this.gatewaySoapRequestStateless(process.env.AMADEUS_GLOBAL_WEBSERVICE_URL, header, xml, 10000000, options)
        .then(response => {
          const { headers, body, statusCode } = response.response;
          if (statusCode == 200)
            parseString(body, (error, data) => {
              if (error)
                reject({
                  error: error,
                  location: "Amadeus Global manager -> callAirSellFromRecommendation -> soapRequest -> parseString",
                  code: "",
                  name: "xmlNotValid",
                  data: {
                    body: body,
                    session: null
                  }
                });
              else
                resolve({
                  body: data,
                  session: null
                });
            })
          else
            reject({
              error: body,
              location: "Amadeus Global manager -> callAirSellFromRecommendation -> soapRequest -> statusCode is not 200",
              code: "",
              name: "statusNotOK",
              data: body
            });
        })
        .catch(error => {
          reject({
            error: error,
            location: "Amadeus Global manager -> callAirSellFromRecommendation -> soapRequest",
            code: "",
            name: "soapRequestError",
            data: null
          })
        })
    })
  }

  private callPNRAddMultiElement(pnrAction: string, booking: any, session: amadeusGlobalSession, options: gatewayInputOptions) {
    return new Promise<gatewayLogicOutput>((resolve, reject) => {
      var header = {
        "Content-Type": "text/xml; charset=utf-8",
        soapAction: process.env.AMADEUS_GLOBAL_PNR_ADD_MULTI_ELEMENT_SOAP_ACTION
      };
      var xml = fs.readFileSync("src/Assets/AmadeusGlobalRequestTemplates/PNRAddMultiElements.xml", "utf-8");
      let content = '';
      let pnrActionText = "";

      if (pnrAction == "0") {
        pnrActionText = "<optionCode>0</optionCode>"

        let marketingAirlines = [];
        booking.flights.itineraries.map(_itin => {
          _itin.flights.map(_flg => {
            if (marketingAirlines.indexOf(_flg.marketingAirline.code) < 0)
              marketingAirlines.push(_flg.marketingAirline.code);
          })
        })

        let ssrText = '';

        let infantList = booking.passengers.filter(el => el.type == "infant");
        let _passIndex = 1;
        booking.passengers.filter(el => el.type == "adult").forEach((_pass) => {
          let _infant = infantList.splice(0, 1)[0];
          content += "<travellerInfo>";
          content += "<elementManagementPassenger>";
          content += "<reference>";
          content += "<qualifier>PR</qualifier>";
          content += "<number>";
          content += (_passIndex).toString();
          content += "</number>";
          content += "</reference>";
          content += "<segmentName>NM</segmentName>";
          content += "</elementManagementPassenger>";
          content += "<passengerData>";
          content += "<travellerInformation>";
          content += "<traveller>";
          content += "<surname>";
          content += _pass.lastName;
          content += "</surname>";
          content += "<quantity>";
          content += (_infant ? "2" : "1");
          content += "</quantity>";
          content += "</traveller>";
          content += "<passenger>";
          content += "<firstName>";
          content += _pass.firstName;
          content += "</firstName>";
          content += "<type>";
          content += "ADT";
          content += "</type>";
          if (_infant)
            content += "<infantIndicator>3</infantIndicator>";
          content += "</passenger>";
          content += "</travellerInformation>";
          content += "<dateOfBirth>";
          content += "<dateAndTimeDetails>";
          content += "<date>";
          content += this.generateDate(_pass.birthDate);
          content += "</date>";
          content += "</dateAndTimeDetails>";
          content += "</dateOfBirth>";
          content += "</passengerData>";

          marketingAirlines.forEach(marketingCode => {
            ssrText += "<dataElementsIndiv>";
            ssrText += "<elementManagementData><segmentName>SSR</segmentName></elementManagementData>";
            ssrText += "<serviceRequest><ssr><type>DOCS</type><status>HK</status><quantity>1</quantity><companyId>"
            ssrText += marketingCode;
            ssrText += "</companyId><freetext>"
            ssrText += `P-${_pass.passportCountry}-${_pass.passportNo}-${_pass.nationality.code}-${this.generateDate(_pass.birthDate)}-${_pass.isMale ? "M" : "F"}-${this.generateDate(_pass.passportExpireDate)}-${_pass.lastName}-${_pass.firstName}`;
            ssrText += "</freetext></ssr></serviceRequest>";
            ssrText += "<referenceForDataElement><reference><qualifier>PR</qualifier><number>";
            ssrText += (_passIndex).toString();
            ssrText += "</number></reference></referenceForDataElement>";
            ssrText += "</dataElementsIndiv>";
          })
          if (_infant) {
            content += "<passengerData>";
            content += "<travellerInformation>";
            content += "<traveller>";
            content += "<surname>";
            content += _infant.lastName;
            content += "</surname>";
            content += "</traveller>";
            content += "<passenger>";
            content += "<firstName>";
            content += _infant.firstName;
            content += "</firstName>";
            content += "<type>";
            content += "INF";
            content += "</type>";
            content += "</passenger>";
            content += "</travellerInformation>";
            content += "<dateOfBirth>";
            content += "<dateAndTimeDetails>";
            content += "<date>";
            content += this.generateDate(_infant.birthDate);
            content += "</date>";
            content += "</dateAndTimeDetails>";
            content += "</dateOfBirth>";
            content += "</passengerData>";

            marketingAirlines.forEach(marketingCode => {
              ssrText += "<dataElementsIndiv>";
              ssrText += "<elementManagementData><segmentName>SSR</segmentName></elementManagementData>";
              ssrText += "<serviceRequest><ssr><type>DOCS</type><status>HK</status><quantity>1</quantity><companyId>"
              ssrText += marketingCode;
              ssrText += "</companyId><freetext>"
              ssrText += `P-${_infant.passportCountry}-${_infant.passportNo}-${_infant.nationality.code}-${this.generateDate(_infant.birthDate)}-${_infant.isMale ? "M" : "F"}I-${this.generateDate(_infant.passportExpireDate)}-${_infant.lastName}-${_infant.firstName}`;
              ssrText += "</freetext></ssr></serviceRequest>";
              ssrText += "<referenceForDataElement><reference><qualifier>PR</qualifier><number>";
              ssrText += (_passIndex).toString();
              ssrText += "</number></reference></referenceForDataElement>";
              ssrText += "</dataElementsIndiv>";
            })
          }
          ssrText += "<dataElementsIndiv>";
          ssrText += "<elementManagementData><segmentName>SSR</segmentName></elementManagementData>";
          ssrText += "<serviceRequest><ssr><type>CTCE</type>"
          ssrText += "<freetext>"
          ssrText += (booking.issuerContactInfo.email ? booking.issuerContactInfo.email : process.env.ETICKET_DEFAULT_EMAIL).replace(/@/g, '//').replace(/-/g, './').replace(/_/g, '..');
          ssrText += "</freetext></ssr></serviceRequest>";
          ssrText += "<referenceForDataElement><reference><qualifier>PR</qualifier><number>";
          ssrText += (_passIndex).toString();
          ssrText += "</number></reference></referenceForDataElement>";
          ssrText += "</dataElementsIndiv>";
          content += "</travellerInfo>";
          _passIndex++;
        })

        booking.passengers.filter(el => el.type == "child").forEach((_pass) => {
          let _infant = infantList.splice(0, 1)[0];
          content += "<travellerInfo>";
          content += "<elementManagementPassenger>";
          content += "<reference>";
          content += "<qualifier>PR</qualifier>";
          content += "<number>";
          content += (_passIndex).toString();
          content += "</number>";
          content += "</reference>";
          content += "<segmentName>NM</segmentName>";
          content += "</elementManagementPassenger>";
          content += "<passengerData>";
          content += "<travellerInformation>";
          content += "<traveller>";
          content += "<surname>";
          content += _pass.lastName;
          content += "</surname>";
          content += "<quantity>";
          content += "1";
          content += "</quantity>";
          content += "</traveller>";
          content += "<passenger>";
          content += "<firstName>";
          content += _pass.firstName;
          content += "</firstName>";
          content += "<type>";
          content += "CHD";
          content += "</type>";
          content += "</passenger>";
          content += "</travellerInformation>";
          content += "<dateOfBirth>";
          content += "<dateAndTimeDetails>";
          content += "<date>";
          content += this.generateDate(_pass.birthDate);
          content += "</date>";
          content += "</dateAndTimeDetails>";
          content += "</dateOfBirth>";
          content += "</passengerData>";
          content += "</travellerInfo>";

          marketingAirlines.forEach(marketingCode => {
            ssrText += "<dataElementsIndiv>";
            ssrText += "<elementManagementData><segmentName>SSR</segmentName></elementManagementData>";
            ssrText += "<serviceRequest><ssr><type>DOCS</type><status>HK</status><quantity>1</quantity><companyId>"
            ssrText += marketingCode;
            ssrText += "</companyId><freetext>"
            ssrText += `P-${_pass.passportCountry}-${_pass.passportNo}-${_pass.nationality.code}-${this.generateDate(_pass.birthDate)}-${_pass.isMale ? "M" : "F"}-${this.generateDate(_pass.passportExpireDate)}-${_pass.lastName}-${_pass.firstName}`;
            ssrText += "</freetext></ssr></serviceRequest>";
            ssrText += "<referenceForDataElement><reference><qualifier>PR</qualifier><number>";
            ssrText += (_passIndex).toString();
            ssrText += "</number></reference></referenceForDataElement>";
            ssrText += "</dataElementsIndiv>";
          })

          ssrText += "<dataElementsIndiv>";
          ssrText += "<elementManagementData><segmentName>SSR</segmentName></elementManagementData>";
          ssrText += "<serviceRequest><ssr><type>CTCE</type>"
          ssrText += "<freetext>"
          ssrText += (booking.issuerContactInfo.email ? booking.issuerContactInfo.email : process.env.ETICKET_DEFAULT_EMAIL).replace(/@/g, '//').replace(/-/g, './').replace(/_/g, '..');
          ssrText += "</freetext></ssr></serviceRequest>";
          ssrText += "<referenceForDataElement><reference><qualifier>PR</qualifier><number>";
          ssrText += (_passIndex).toString();
          ssrText += "</number></reference></referenceForDataElement>";
          ssrText += "</dataElementsIndiv>";

          _passIndex++;
        })

        content += "<dataElementsMaster>";
        content += "<marker1 />";

        content += "<dataElementsIndiv>";
        content += "<elementManagementData><segmentName>AP</segmentName></elementManagementData>";
        content += "<freetextData>";
        content += "<freetextDetail><subjectQualifier>3</subjectQualifier><type>P02</type></freetextDetail>";
        content += "<longFreetext>";
        content += booking.issuerContactInfo.email ? booking.issuerContactInfo.email : process.env.ETICKET_DEFAULT_EMAIL;
        content += "</longFreetext>";
        content += "</freetextData>";
        content += "</dataElementsIndiv>";

        content += "<dataElementsIndiv>";
        content += "<elementManagementData><segmentName>TK</segmentName></elementManagementData>";
        content += "<ticketElement><ticket><indicator>OK</indicator></ticket></ticketElement>";
        content += "</dataElementsIndiv>";

        content += "<dataElementsIndiv>";
        content += "<elementManagementData><segmentName>RF</segmentName></elementManagementData>";
        content += "<freetextData>";
        content += "<freetextDetail><subjectQualifier>3</subjectQualifier><type>P02</type></freetextDetail>";
        content += "<longFreetext>";
        content += "RomaInternet";
        content += "</longFreetext>";
        content += "</freetextData>";
        content += "</dataElementsIndiv>";

        content += ssrText;

        content += "</dataElementsMaster>";
      }
      else if (pnrAction == "11") {
        pnrActionText = "<optionCode>11</optionCode><optionCode>267</optionCode>";
        content += "<dataElementsMaster><marker1 />";
        content += "<dataElementsIndiv><elementManagementData><segmentName>FM</segmentName></elementManagementData><commission><commissionInfo><percentage>0</percentage></commissionInfo></commission></dataElementsIndiv>";
        content += "</dataElementsMaster>";
      }
      else if (pnrAction == "20") {
        pnrActionText = "<optionCode>20</optionCode>";
      }

      xml = xml
        .replace(/{{PNRAction}}/g, pnrActionText)
        .replace(/{{Content}}/g, content);

      this.gatewaySoapRequestStateful(process.env.AMADEUS_GLOBAL_WEBSERVICE_URL, header, xml, 10000000, session, options)
        .then(response => {
          const { headers, body, statusCode } = response.response;
          if (statusCode == 200)
            parseString(body, (error, data) => {
              if (error)
                reject({
                  error: error,
                  location: "Amadeus Global manager -> callPNRAddMultiElement -> soapRequest -> parseString",
                  code: "",
                  name: "xmlNotValid",
                  data: {
                    body: body,
                    session: null
                  }
                });
              else
                resolve({
                  body: data,
                  session: null
                });
            })
          else
            reject({
              error: body,
              location: "Amadeus Global manager -> callPNRAddMultiElement -> soapRequest -> statusCode is not 200",
              code: "",
              name: "statusNotOK",
              data: body
            });
        })
        .catch(error => {
          reject({
            error: error,
            location: "Amadeus Global manager -> callPNRAddMultiElement -> soapRequest",
            code: "",
            name: "soapRequestError",
            data: null
          })
        })
    })
  }

  private callFOPCreateFormOfPayment(session: amadeusGlobalSession, options: gatewayInputOptions) {
    return new Promise<gatewayLogicOutput>((resolve, reject) => {
      var header = {
        "Content-Type": "text/xml; charset=utf-8",
        soapAction: process.env.AMADEUS_GLOBAL_FOP_CREATE_FORM_OF_PAYMENT_SOAP_ACTION
      };
      var xml = fs.readFileSync("src/Assets/AmadeusGlobalRequestTemplates/FOPCreateFormOfPayment.xml", "utf-8");

      this.gatewaySoapRequestStateful(process.env.AMADEUS_GLOBAL_WEBSERVICE_URL, header, xml, 10000000, session, options)
        .then(response => {
          const { headers, body, statusCode } = response.response;
          if (statusCode == 200)
            parseString(body, (error, data) => {
              if (error)
                reject({
                  error: error,
                  location: "Amadeus Global manager -> callFOPCreateFormOfPayment -> soapRequest -> parseString",
                  code: "",
                  name: "xmlNotValid",
                  data: {
                    body: body,
                    session: null
                  }
                });
              else
                resolve({
                  body: data,
                  session: null
                });
            })
          else
            reject({
              error: body,
              location: "Amadeus Global manager -> callFOPCreateFormOfPayment -> soapRequest -> statusCode is not 200",
              code: "",
              name: "statusNotOK",
              data: body
            });
        })
        .catch(error => {
          reject({
            error: error,
            location: "Amadeus Global manager -> callFOPCreateFormOfPayment -> soapRequest",
            code: "",
            name: "soapRequestError",
            data: null
          })
        })
    })
  }

  private callPricePNRWithBookingClass(fareType: string, VC: string, session: amadeusGlobalSession, options: gatewayInputOptions) {
    return new Promise<gatewayLogicOutput>((resolve, reject) => {
      var header = {
        "Content-Type": "text/xml; charset=utf-8",
        soapAction: process.env.AMADEUS_GLOBAL_PRICE_PNR_WITH_BOOKING_CLASS_SOAP_ACTION
      };
      var xml = fs.readFileSync("src/Assets/AmadeusGlobalRequestTemplates/PricePNRWithBookingClass.xml", "utf-8");

      let validatingCompany = "";
      if (VC) {
        validatingCompany += "<pricingOptionGroup><pricingOptionKey><pricingOptionKey>VC</pricingOptionKey></pricingOptionKey><carrierInformation><companyIdentification><otherCompany>";
        validatingCompany += VC;
        validatingCompany += "</otherCompany></companyIdentification></carrierInformation></pricingOptionGroup>";
      }

      xml = xml
        .replace(/{{fareType}}/g, fareType == "RP" ? "RP" : "RU")
        .replace(/{{validatingCompany}}/g, validatingCompany);

      this.gatewaySoapRequestStateful(process.env.AMADEUS_GLOBAL_WEBSERVICE_URL, header, xml, 10000000, session, options)
        .then(response => {
          const { headers, body, statusCode } = response.response;
          if (statusCode == 200)
            parseString(body, (error, data) => {
              if (error)
                reject({
                  error: error,
                  location: "Amadeus Global manager -> callPricePNRWithBookingClass -> soapRequest -> parseString",
                  code: "",
                  name: "xmlNotValid",
                  data: {
                    body: body,
                    session: null
                  }
                });
              else
                resolve({
                  body: data,
                  session: null
                });
            })
          else
            reject({
              error: body,
              location: "Amadeus Global manager -> callPricePNRWithBookingClass -> soapRequest -> statusCode is not 200",
              code: "",
              name: "statusNotOK",
              data: body
            });
        })
        .catch(error => {
          reject({
            error: error,
            location: "Amadeus Global manager -> callPricePNRWithBookingClass -> soapRequest",
            code: "",
            name: "soapRequestError",
            data: null
          })
        })
    })
  }

  private callCreateTSTFromPricing(tstCount: number, session: amadeusGlobalSession, options: gatewayInputOptions) {
    return new Promise<gatewayLogicOutput>((resolve, reject) => {
      var header = {
        "Content-Type": "text/xml; charset=utf-8",
        soapAction: process.env.AMADEUS_GLOBAL_CREATE_TST_FROM_PRICING_SOAP_ACTION
      };
      var xml = fs.readFileSync("src/Assets/AmadeusGlobalRequestTemplates/CreateTSTFromPricing.xml", "utf-8");

      let psaList = '';

      for (let index = 0; index < tstCount; index++) {
        psaList += "<psaList><itemReference><referenceType>TST</referenceType><uniqueReference>";
        psaList += (index + 1).toString();
        psaList += "</uniqueReference></itemReference></psaList>";
      }

      xml = xml
        .replace(/{{psaList}}/g, psaList);

      this.gatewaySoapRequestStateful(process.env.AMADEUS_GLOBAL_WEBSERVICE_URL, header, xml, 10000000, session, options)
        .then(response => {
          const { headers, body, statusCode } = response.response;
          if (statusCode == 200)
            parseString(body, (error, data) => {
              if (error)
                reject({
                  error: error,
                  location: "Amadeus Global manager -> callCreateTSTFromPricing -> soapRequest -> parseString",
                  code: "",
                  name: "xmlNotValid",
                  data: {
                    body: body,
                    session: null
                  }
                });
              else
                resolve({
                  body: data,
                  session: null
                });
            })
          else
            reject({
              error: body,
              location: "Amadeus Global manager -> callCreateTSTFromPricing -> soapRequest -> statusCode is not 200",
              code: "",
              name: "statusNotOK",
              data: body
            });
        })
        .catch(error => {
          reject({
            error: error,
            location: "Amadeus Global manager -> callCreateTSTFromPricing -> soapRequest",
            code: "",
            name: "soapRequestError",
            data: null
          })
        })
    })
  }

  private callPNRRetrive(pnr: string, session: amadeusGlobalSession, options: gatewayInputOptions) {
    return new Promise<gatewayLogicOutput>((resolve, reject) => {
      var header = {
        "Content-Type": "text/xml; charset=utf-8",
        soapAction: process.env.AMADEUS_GLOBAL_PNR_RETRIVE_SOAP_ACTION
      };
      var xml = fs.readFileSync("src/Assets/AmadeusGlobalRequestTemplates/PNRRetrive.xml", "utf-8");

      xml = xml
        .replace(/{{PNR}}/g, pnr);

      this.gatewaySoapRequestStateful(process.env.AMADEUS_GLOBAL_WEBSERVICE_URL, header, xml, 10000000, session, options)
        .then(response => {
          const { headers, body, statusCode } = response.response;
          if (statusCode == 200)
            parseString(body, (error, data) => {
              if (error)
                reject({
                  error: error,
                  location: "Amadeus Global manager -> callPNRRetrive -> soapRequest -> parseString",
                  code: "",
                  name: "xmlNotValid",
                  data: {
                    body: body,
                    session: null
                  }
                });
              else
                resolve({
                  body: data,
                  session: null
                });
            })
          else
            reject({
              error: body,
              location: "Amadeus Global manager -> callPNRRetrive -> soapRequest -> statusCode is not 200",
              code: "",
              name: "statusNotOK",
              data: body
            });
        })
        .catch(error => {
          reject({
            error: error,
            location: "Amadeus Global manager -> callPNRRetrive -> soapRequest",
            code: "",
            name: "soapRequestError",
            data: null
          })
        })
    })
  }

  private callPNRRetriveStateless(pnr: string, options: gatewayInputOptions) {
    return new Promise<gatewayLogicOutput>((resolve, reject) => {
      var header = {
        "Content-Type": "text/xml; charset=utf-8",
        soapAction: process.env.AMADEUS_GLOBAL_PNR_RETRIVE_SOAP_ACTION
      };
      var xml = fs.readFileSync("src/Assets/AmadeusGlobalRequestTemplates/PNRRetriveStateless.xml", "utf-8");

      xml = xml
        .replace(/{{PNR}}/g, pnr);

      this.gatewaySoapRequestStateless(process.env.AMADEUS_GLOBAL_WEBSERVICE_URL, header, xml, 10000000, options)
        .then(response => {
          const { headers, body, statusCode } = response.response;
          if (statusCode == 200)
            parseString(body, (error, data) => {
              if (error)
                reject({
                  error: error,
                  location: "Amadeus Global manager -> callPNRRetriveStateless -> soapRequest -> parseString",
                  code: "",
                  name: "xmlNotValid",
                  data: {
                    body: body,
                    session: null
                  }
                });
              else
                resolve({
                  body: data,
                  session: null
                });
            })
          else
            reject({
              error: body,
              location: "Amadeus Global manager -> callPNRRetriveStateless -> soapRequest -> statusCode is not 200",
              code: "",
              name: "statusNotOK",
              data: body
            });
        })
        .catch(error => {
          reject({
            error: error,
            location: "Amadeus Global manager -> callPNRRetriveStateless -> soapRequest",
            code: "",
            name: "soapRequestError",
            data: null
          })
        })
    })
  }

  private callIssueTicket(ticketCommand: string, session: amadeusGlobalSession, options: gatewayInputOptions) {
    return new Promise<gatewayLogicOutput>((resolve, reject) => {
      var header = {
        "Content-Type": "text/xml; charset=utf-8",
        soapAction: process.env.AMADEUS_GLOBAL_ISSUE_TICKET_SOAP_ACTION
      };
      var xml = fs.readFileSync("src/Assets/AmadeusGlobalRequestTemplates/IssueTicket.xml", "utf-8");

      xml = xml
        .replace(/{{TicketCommand}}/g, ticketCommand);

      this.gatewaySoapRequestStateful(process.env.AMADEUS_GLOBAL_WEBSERVICE_URL, header, xml, 10000000, session, options)
        .then(response => {
          const { headers, body, statusCode } = response.response;
          if (statusCode == 200)
            parseString(body, (error, data) => {
              if (error)
                reject({
                  error: error,
                  location: "Amadeus Global manager -> callIssueTicket -> soapRequest -> parseString",
                  code: "",
                  name: "xmlNotValid",
                  data: {
                    body: body,
                    session: null
                  }
                });
              else
                resolve({
                  body: data,
                  session: null
                });
            })
          else
            reject({
              error: body,
              location: "Amadeus Global manager -> callIssueTicket -> soapRequest -> statusCode is not 200",
              code: "",
              name: "statusNotOK",
              data: body
            });
        })
        .catch(error => {
          reject({
            error: error,
            location: "Amadeus Global manager -> callIssueTicket -> soapRequest",
            code: "",
            name: "soapRequestError",
            data: null
          })
        })
    })
  }

  private callCancelPNR(pnr: string, session: amadeusGlobalSession, options: gatewayInputOptions) {
    return new Promise<gatewayLogicOutput>((resolve, reject) => {
      var header = {
        "Content-Type": "text/xml; charset=utf-8",
        soapAction: process.env.AMADEUS_GLOBAL_CANCEL_PNR_SOAP_ACTION
      };
      var xml = fs.readFileSync("src/Assets/AmadeusGlobalRequestTemplates/CancelPNR.xml", "utf-8");

      xml = xml
        .replace(/{{PNR}}/g, pnr);

      this.gatewaySoapRequestStateful(process.env.AMADEUS_GLOBAL_WEBSERVICE_URL, header, xml, 10000000, session, options)
        .then(response => {
          const { headers, body, statusCode } = response.response;
          if (statusCode == 200)
            parseString(body, (error, data) => {
              if (error)
                reject({
                  error: error,
                  location: "Amadeus Global manager -> callCancelPNR -> soapRequest -> parseString",
                  code: "",
                  name: "xmlNotValid",
                  data: {
                    body: body,
                    session: null
                  }
                });
              else
                resolve({
                  body: data,
                  session: null
                });
            })
          else
            reject({
              error: body,
              location: "Amadeus Global manager -> callCancelPNR -> soapRequest -> statusCode is not 200",
              code: "",
              name: "statusNotOK",
              data: body
            });
        })
        .catch(error => {
          reject({
            error: error,
            location: "Amadeus Global manager -> callCancelPNR -> soapRequest",
            code: "",
            name: "soapRequestError",
            data: null
          })
        })
    })
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

  private generateDate(birthdate: string): string {
    let monthList = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    let result = birthdate.split('-')[2];
    result += monthList[parseInt(birthdate.split('-')[1]) - 1];
    result += birthdate.split('-')[0].substr(2, 2);
    return result;
  }

  private generateXMLItineraries(itineraries: gatewaySearchInputItinerary[]) {
    let _result = "";
    itineraries.forEach((element, index) => {
      let date = element.departDate.split('-');
      _result += `<itinerary>`;
      _result += `<requestedSegmentRef><segRef>${index + 1}</segRef></requestedSegmentRef>`;
      _result += `<departureLocalization><departurePoint><locationId>${element.origin}</locationId><airportCityQualifier>${element.isOriginLocation ? 'C' : 'A'}</airportCityQualifier></departurePoint></departureLocalization>`;
      _result += `<arrivalLocalization><arrivalPointDetails><locationId>${element.destination}</locationId><airportCityQualifier>${element.isDestinationLocation ? 'C' : 'A'}</airportCityQualifier></arrivalPointDetails></arrivalLocalization>`;
      _result += `<timeDetails><firstDateTimeDetail><date>${date[2]}${date[1]}${date[0].substr(2, 2)}</date></firstDateTimeDetail></timeDetails>`;
      _result += `</itinerary>`;
    });
    return _result;
  }

  private generateXMLItinerariesCalendar(itineraries: gatewaySearchInputItinerary[]) {
    let _result = "";
    itineraries.forEach((element, index) => {
      let date = element.departDate.split('-');
      _result += `<itinerary>`;
      _result += `<requestedSegmentRef><segRef>${index + 1}</segRef></requestedSegmentRef>`;
      _result += `<departureLocalization><departurePoint><locationId>${element.origin}</locationId><airportCityQualifier>${element.isOriginLocation ? 'C' : 'A'}</airportCityQualifier></departurePoint></departureLocalization>`;
      _result += `<arrivalLocalization><arrivalPointDetails><locationId>${element.destination}</locationId><airportCityQualifier>${element.isDestinationLocation ? 'C' : 'A'}</airportCityQualifier></arrivalPointDetails></arrivalLocalization>`;
      _result += `<timeDetails>`;
      _result += `<firstDateTimeDetail><date>${date[2]}${date[1]}${date[0].substr(2, 2)}</date></firstDateTimeDetail>`;
      _result += `<rangeOfDate><rangeQualifier>C</rangeQualifier><dayInterval>3</dayInterval></rangeOfDate>`;
      _result += `</timeDetails>`;
      _result += `</itinerary>`;
    });
    return _result;
  }

  private gatewaySoapRequestStateless(url: string, header: any, xml: string, timeout: number, options: gatewayInputOptions) {
    let nonce = crypto.randomBytes(16).toString('utf-8');
    let created = new Date().toISOString();
    xml = xml
      .replace(/{{Username}}/g, this.signitureData.username)
      .replace(/{{Nonce}}/g, Buffer.from(nonce).toString("base64"))
      .replace(/{{Password}}/g, this.generatePassword(this.signitureData.password, nonce, created))
      .replace(/{{Created}}/g, created)
      .replace(/{{OfficeId}}/g, this.signitureData.officeId);
    return this.gatewaySoapRequest(url, header, xml, timeout, options)
  }

  private gatewaySoapRequestStateful(url: string, header: any, xml: string, timeout: number, session: amadeusGlobalSession, options: gatewayInputOptions) {
    session.sequenceNumber += 1;
    xml = xml
      .replace(/{{SessionId}}/g, session.sessionId)
      .replace(/{{SequenceNumber}}/g, session.sequenceNumber.toString())
      .replace(/{{SecurityToken}}/g, session.securityToken);
    return this.gatewaySoapRequest(url, header, xml, timeout, options)
  }

  private gatewaySoapRequest(url: string, header: any, xml: string, timeout: number, options: gatewayInputOptions) {
    return new Promise<any>((resolve, reject) => {
      xml = xml
        .replace(/{{MessageId}}/g, uuid.v4())
        .replace(/{{Action}}/g, header.soapAction)
        .replace(/{{Endpoint}}/g, url)
        .replace(/{{WSAP}}/g, this.signitureData.wsap);
      soapRequest(url, header, xml, timeout)
        .then(response => {
          const { headers, body, statusCode } = response.response;
          logHelper.logGatewayRequestResponse("amadeus_global", options.requestUUID, header.soapAction, { url, body: xml, header }, { header: headers, body, statusCode })
          resolve(response)
        })
        .catch(err => {
          logHelper.logGatewayRequestError("amadeus_global", options.requestUUID, err, header.soapAction, { url, body: xml, header })
          reject(err)
        })
    })
  }

  private generatePassword(password: string, nonce: string, created: string): string {
    let b1 = Buffer.from(nonce)
    let b2 = Buffer.from(created)
    let b3 = require("crypto").createHash('sha1').update(password).digest();
    let b = Buffer.concat([b1, b2, b3], b1.length + b2.length + b3.length);
    return crypto.createHash('sha1').update(b).digest("base64");
  }

  private generateDateTime(date: string, time: string) {
    return `20${date.substr(4, 2)}-${date.substr(2, 2)}-${date.substr(0, 2)}T${time.substr(0, 2)}:${time.substr(2, 2)}:00`;
  }

  private extractSession(body: any): amadeusGlobalSession {
    let session = new amadeusGlobalSession();
    session.sessionId = body["soapenv:Envelope"]["soapenv:Header"][0]["awsse:Session"][0]["awsse:SessionId"][0];
    session.sequenceNumber = parseInt(body["soapenv:Envelope"]["soapenv:Header"][0]["awsse:Session"][0]["awsse:SequenceNumber"][0]);
    session.securityToken = body["soapenv:Envelope"]["soapenv:Header"][0]["awsse:Session"][0]["awsse:SecurityToken"][0];
    session.sessionTime = new Date().toISOString();
    return session;
  }

  private getExchangeRate(): number {
    return 1;
  }

  private calculateExchangeValue(value: number, rate: number) {
    return value * rate;
    // return Math.ceil(value * rate);
  }
  // Developement Use
  // getNextFlight(
  //   session: any,
  //   callback: (error: any, result: any, session: any) => void
  // ) {
  //   if (session.sessionId && session.sessionTime)
  //     if (
  //       new Date().getTime() - new Date(session.sessionTime).getTime() >
  //       sessionMaxTime
  //     ) {
  //       this.callSignOut(session.sessionId, (err, res) => {
  //         callback(
  //           "Your session is expired. Try to search for flights first.",
  //           null,
  //           { sessionDeleted: true }
  //         );
  //       });
  //     } else {
  //       this.callNextFlight(session, callback);
  //     }
  //   else
  //     callback(
  //       "There is no existing session. Try to search for flights first.",
  //       null,
  //       { sessionDeleted: true }
  //     );
  // }
}
Object.seal(AmadeusGlobalManager);
