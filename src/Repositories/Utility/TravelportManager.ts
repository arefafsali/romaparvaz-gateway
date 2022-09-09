import { IGatewayImplement } from "../../Repositories/Contracts/IGatewayImplement";
import { gatewaySearchInput, gatewaySession, gatewayInputOptions, gatewayRuleInput, gatewaySearchInputItinerary } from "../../Common/Metadata/gatewayLogicInputMetadata";
import { gatewaySearchFlightResult, searchFlightResult, searchFlightItinerary, itineraryFlightSegment, nameObject, searchCalendarResult } from "../../Common/Metadata/gatewaySearchResultMetadata";
import { errorObj } from "../../Common/Metadata/errorObjMetadata";
import * as moment from "moment-jalaali"
import { TimeToString } from "../../Repositories/Utility/TimeToString";
import { IataTimezonesHelper } from "../../Repositories/Utility/IataTimezonesHelper";
import { FlightTypeHelper } from "../../Repositories/Utility/FlightTypeHelper";
import { MarkupHelper } from "../../Repositories/Utility/MarkupHelper";
import { gatewayRulesResult } from "../../Common/Metadata/gatewayRulesResultMetadata";
import { CancelingRuleHelper } from "../../Repositories/Utility/CancelingRuleHelper";
import { gatewayBookInternalResult } from "../../Common/Metadata/gatewayBookResultMetadata";
import { gatewayTicketInternalResult } from "../../Common/Metadata/gatewayTicketResultMetadata";
import uuid = require("uuid");
const _ = require("lodash");
const uAPI = require("uapi-json");


export class TravelportManager implements IGatewayImplement {

  private gatewayCode: string;
  private provider: string
  private AirService: any;

  public static sessionId: string = "";
  constructor(_signitureData, _gatewayCode: string, _provider: string) {
    this.gatewayCode = _gatewayCode;
    this.provider = _provider;
    const settings = {
      auth: {
        username: _signitureData.username,
        password: _signitureData.password,
        targetBranch: _signitureData.targetBranch,
        // region: "Americas",
        provider: _provider
      },
      production: process.env.TRAVELPORT_PRODUCTION == "true",
    };
    this.AirService = uAPI.createAirService(settings);
  }

  getSearch(item: gatewaySearchInput, session?: gatewaySession, calendarResultNotRequired?: boolean, loggedInUser?: any, options?: gatewayInputOptions) {
    return new Promise((resolve: (result: gatewaySearchFlightResult) => void, reject: (error: errorObj) => void) => {
      let _result = new gatewaySearchFlightResult();
      let baggageIndex: any[] = [];
      const params = {
        legs: item.itineraries.map(el => { return { from: el.origin, to: el.destination, departureDate: el.departDate } }),
        passengers: {
          ADT: item.adult,
          CNN: item.child,
          INF: item.infant,
          /*
           CNN:1,
           INF: 1,
           INS: 1, //infant with a seat
           */
        },
        // carriers: ["KL"],
        // cabins: ["Business"], // ['Business'],
        requestId: uuid.v4(),
        // permittedConnectionPoints: ['AMS'],
        // preferredConnectionPoints: ['KBP'],
        // prohibitedConnectionPoints: ['DME', 'SVO', 'PAR'],
        // maxJourneyTime: 300,
        pricing: {
          currency: "IRR",
          // eTicketability: true,
        },
      };

      this.AirService.shop(params)
        .then((result: any[]) => {
          result.forEach((el, ind) => {
            let combinationCount = el.directions.reduce((a, b) => a * b.length, 1)
            for (let index = 0; index < combinationCount; index++) {
              let _flightData = new searchFlightResult();
              _flightData.Currency = "IRR";
              _flightData.ProviderType = "Travelport-" + this.provider + "Provider";
              _flightData.SequenceNumber = ind.toString();
              _flightData.CombinationId = index.toString();
              _flightData.ValidatingAirlineCode = el.platingCarrier;
              _flightData.ForceETicket = null;
              _flightData.E_TicketEligibility = "Eligible";
              _flightData.ServiceFeeAmount = null;
              _flightData.TotalPrice = parseFloat(el.totalPrice.replace(/IRR/g, ""));
              if (el.passengerFares.ADT) {
                _flightData.AdultPrice.TotalPrice = parseFloat(el.passengerFares.ADT.totalPrice.replace(/IRR/g, ""));
                _flightData.AdultPrice.BaseFare = parseFloat(el.passengerFares.ADT.equivalentBasePrice.replace(/IRR/g, ""));
                _flightData.AdultPrice.Tax = parseFloat(el.passengerFares.ADT.taxes.replace(/IRR/g, ""));
              }
              if (el.passengerFares.CNN) {
                _flightData.ChildPrice.TotalPrice = parseFloat(el.passengerFares.CNN.totalPrice.replace(/IRR/g, ""));
                _flightData.ChildPrice.BaseFare = parseFloat(el.passengerFares.CNN.equivalentBasePrice.replace(/IRR/g, ""));
                _flightData.ChildPrice.Tax = parseFloat(el.passengerFares.CNN.taxes.replace(/IRR/g, ""));
              }
              if (el.passengerFares.INF) {
                _flightData.InfantPrice.TotalPrice = parseFloat(el.passengerFares.INF.totalPrice.replace(/IRR/g, ""));
                _flightData.InfantPrice.BaseFare = parseFloat(el.passengerFares.INF.equivalentBasePrice.replace(/IRR/g, ""));
                _flightData.InfantPrice.Tax = parseFloat(el.passengerFares.INF.taxes.replace(/IRR/g, ""));
              }
              let _temp_ind = index;
              el.directions.forEach((el, ind) => {
                let _index = _temp_ind % el.length;
                _temp_ind = Math.floor(_temp_ind / el.length);
                let _itin = el[_index];
                let _itinerary = new searchFlightItinerary();
                _itinerary.DirectionId = ind.toString();
                _itinerary.ElapsedTime = this.convertMinuteToTimeString(_itin.segments[0].details[0].travelTime).replace(":", "");
                _itinerary.RefNumber = "";
                _itinerary.StopCount = _itin.segments.length - 1;

                let _tempStopTime: number = 0;
                _itin.segments.forEach((el, ind) => {
                  if (ind > 0)
                    _tempStopTime += new Date(el.departure).getTime() - new Date(_itin.segments[ind - 1].arrival).getTime();
                  let _itineraryFlight = new itineraryFlightSegment();
                  _itineraryFlight.GatewayData = el.uapi_segment_ref
                  _itineraryFlight.DepartureDateTime = el.departure.split(".")[0];
                  _itineraryFlight.ArrivalDateTime = el.arrival.split(".")[0];
                  _itineraryFlight.FlightNumber = el.flightNumber;
                  _itineraryFlight.ResBookDesigCode = el.bookingClass;
                  _itineraryFlight.FlightDuration = this.convertMinuteToTimeString(el.duration);
                  _itineraryFlight.DepartureAirport.Code = el.details[0].origin;
                  _itineraryFlight.DepartureAirport.Terminal = el.details[0].originTerminal ? el.details[0].originTerminal : "";
                  _itineraryFlight.ArrivalAirport.Code = el.details[0].destination;
                  _itineraryFlight.ArrivalAirport.Terminal = el.details[0].destinationTerminal ? el.details[0].destinationTerminal : "";
                  _itineraryFlight.MarketingAirline.Code = _itin.platingCarrier;
                  _itineraryFlight.OperatingAirline.Code = el.airline;
                  _itineraryFlight.Equipment.Code = el.details[0].equipment;
                  _itineraryFlight.BookingClassAvails = {
                    ResBookDesigCode: el.bookingClass,
                    ResBookDesigQuantity: "", // TODO
                    RPH: "ADT",
                    AvailablePTC: "ADT",
                    ResBookDesigCabinCode: el.serviceClass == "Economy" ? "Y" : "C", //First class and premium must be checked
                    FareBasis: el.fareBasisCode,
                    FareType: null,
                    ResBookDesigCabinName: new nameObject()
                  };

                  _itineraryFlight.Baggage = el.baggage && el.baggage[0] && el.baggage[0].amount != 0 ? [el.baggage[0]].map(bag => {
                    let bagIndex = baggageIndex.find(el => el.amount == bag.amount && el.units == bag.units);
                    if (!bagIndex) {
                      bagIndex = {
                        index: baggageIndex.length + 1,
                        amount: bag.amount,
                        units: bag.units
                      };
                      baggageIndex.push(bagIndex)
                    }
                    return {
                      Index: bagIndex.index.toString(),
                      Quantity: bagIndex.amount.toString(),
                      Unit: bagIndex.units == "kilograms" ? "KG" : "PC",
                      Type: "ADT"
                    }
                  }) : [{
                    Index: "-1",
                    Quantity: "0",
                    Unit: "PC",
                    Type: "ADT"
                  }];
                  _itineraryFlight.StopLocation = el.techStops ? el.techStops : [];
                  _itinerary.Flights.push(_itineraryFlight);
                })
                _itinerary.TotalStopTime = TimeToString.generateTimeStirng(_tempStopTime);
                _flightData.Itineraries[ind] = _itinerary;
              })
              _result.flights.push(_flightData);
            }
          })

          if (item.itineraries.length == 1 || (item.itineraries.length == 2 && FlightTypeHelper.checkRoundTripFlight(item.itineraries)))
            this.getSearchCalendar(item)
              .then(cal_result => {
                _result.calendar = cal_result;
                calculateMarkup(item, _result);
              })
              .catch(error => {
                console.log(error);
                // if (error.name == "searchCalendarMultiLegError")
                calculateMarkup(item, _result);
                // else
                //   reject(error);
              })
          else
            calculateMarkup(item, _result);

        })
        .catch((err) => {
          reject(new errorObj("searchError", "", err.name, "Travelport Manager -> getSearch", err))
        })

      let calculateMarkup = (item: gatewaySearchInput, result: gatewaySearchFlightResult) => {
        MarkupHelper.calculateMarkup(loggedInUser, this.gatewayCode, item, result, options)
          .then((newResult: gatewaySearchFlightResult) => {
            resolve(newResult);
          })
          .catch(err => {
            // error on fetch markup
            // return bare result for now
            resolve(result);
          })
      }
    })
  };

  getSearchCalendar(item: gatewaySearchInput, loggedInUser?: any, options?: gatewayInputOptions) {
    return new Promise((resolve: (result: searchCalendarResult[]) => void, reject: (error: errorObj) => void) => {
      let calendarResultCount = 0;
      let totalCalendarResult = item.itineraries.length * 7;
      let calendarResult: searchCalendarResult[] = [];
      if (item.itineraries.length > 2 || (item.itineraries.length == 2 && !FlightTypeHelper.checkRoundTripFlight(item.itineraries))) {
        reject(new errorObj("searchCalendarMultiLegError",
          "",
          "SearchFlightCalendar method is not allowed with MultiLeg",
          this.gatewayCode + " Manager -> Search Calendar"))
      }
      else {
        let modifiedItem = JSON.parse(JSON.stringify(item));
        modifiedItem.itineraries.forEach(itinerary => {
          let today = new Date((new Date()).toISOString().split("T")[0] + "T10:00:00");
          let date = new Date(itinerary.departDate + "T10:00:00");
          if (Math.floor(Math.abs(date.getTime() - today.getTime()) / (1000 * 3600 * 24)) < 3) {
            today.setDate(today.getDate() + 3);
            itinerary.departDate = today.toISOString().split("T")[0];
          }
        });
        modifiedItem.itineraries.forEach((_itin, _itin_index) => {
          for (let dateOffset = -3; dateOffset <= +3; dateOffset++) {
            let date = new Date(_itin.departDate);
            date.setDate(date.getDate() + dateOffset);
            let _modified_item: gatewaySearchInput = {
              ...modifiedItem
              , itineraries: modifiedItem.itineraries.map(_temp_itin => { return { ..._temp_itin } })
            }
            _modified_item.itineraries[_itin_index].departDate = date.toISOString().split("T")[0];
            const params = {
              legs: _modified_item.itineraries.map(el => { return { from: el.origin, to: el.destination, departureDate: el.departDate } }),
              passengers: {
                ADT: _modified_item.adult,
                CNN: _modified_item.child,
                INF: _modified_item.infant,
              },
              requestId: uuid.v4(),
              pricing: {
                currency: "IRR",
              },
            };
            this.AirService.shop(params)
              .then((result: any[]) => {
                result.forEach(el => {
                  el.totalPrice = parseFloat(el.totalPrice.replace(/IRR/g, ""));
                })
                calendarResult.push({
                  AdultPrice: parseFloat(_(result).orderBy('totalPrice').value()[0].passengerFares.ADT.totalPrice.replace(/IRR/g, "")),
                  Currency: "IRR",
                  Date: _modified_item.itineraries.map(el => el.departDate)
                })
                if (++calendarResultCount == totalCalendarResult)
                  resolve(calendarResult);
              })
              .catch((err) => {
                if (++calendarResultCount == totalCalendarResult)
                  resolve(calendarResult);
              })
          }
        })
      }
    })
  };

  // TODO: Get flight rules from travelport
  getFlightRules(item: gatewayRuleInput, session?: gatewaySession) {
    return new Promise<gatewayRulesResult[]>((resolve, reject) => {
      let result: gatewayRulesResult[] = [];
      let successCount = 0;
      item.itineraryFlights.forEach((el, ind) => {
        result[ind] = new gatewayRulesResult();
        CancelingRuleHelper.getCancelingRule(el.airlineCode, el.resBookDesigCode)
          .then(helperResult => callback(helperResult, ind))
          .catch(err => reject(err))
      })
      let callback = (helperResult, ind) => {
        result[ind].cancelingRule = helperResult;
        if (++successCount == item.itineraryFlights.length)
          resolve(result)
      }
    })
  }

  book(booking: any, session?: gatewaySession, options?: gatewayInputOptions) {
    return new Promise<gatewayBookInternalResult>((resolve, reject) => {
      // let resultCount = 0;
      // let finalResult = new gatewayBookInternalResult();
      // finalResult.session = null;
      // booking.flights.itineraries.forEach((el, ind) => {
      //   booking.passengers.forEach(pas => {
      //     pas.age = Math.ceil(moment(el.flights[0].departureDateTime).diff(moment(pas.birthDate, 'YYYY-MM-DD'), 'year', true));
      //   });
      //   let departdate = moment(el.flights[0].departureDateTime, 'YYYY-MM-DD').format('jMM-jDD');
      //   let reserveURL = this.bookURL;
      //   reserveURL += `AirLine=${this.airlineCode}`;
      //   reserveURL += `&cbSource=${el.flights[0].departureAirport.cityCode}`;
      //   reserveURL += `&cbTarget=${el.flights[el.flights.length - 1].arrivalAirport.cityCode}`;
      //   reserveURL += `&FlightClass=${el.flights[0].resBookDesigCode}`;
      //   reserveURL += `&FlightNo=${el.flights[0].flightNumber}`;
      //   reserveURL += `&Day=${departdate.split('-')[1]}`;
      //   reserveURL += `&Month=${departdate.split('-')[0]}`;
      //   reserveURL += `&No=${booking.passengers.length}`;
      //   reserveURL += `&${this.generatePassengerList(booking.passengers, booking.flights.isInternational)}`
      //   if (booking.issuerContactInfo.mobile)
      //     reserveURL += `&edtContact=${booking.issuerContactInfo.mobile.toString().replace('+', '00')}`
      //   this.callApi(reserveURL)
      //     .then((reserveResult: any) => {
      //       reserveResult = JSON.parse(reserveResult["body"])
      //       if (reserveResult.AirReserve[0].Error == "No Err")
      //         bookingCallback(ind, reserveResult, el.price ? el.price.totalPrice : booking.totalPrice);
      //       else
      //         reject({
      //           code: "",
      //           data: reserveURL,
      //           error: reserveResult.AirReserve[0].Error + ` | Segment ${el.flights[0].departureAirport.cityCode} to ${el.flights[el.flights.length - 1].arrivalAirport.cityCode}`,
      //           location: this.gatewayCode + " manager -> book -> callApi (book) -> + " + ` | Segment ${el.flights[0].departureAirport.cityCode} to ${el.flights[el.flights.length - 1].arrivalAirport.cityCode}`,
      //           name: "Error in booking"
      //         });
      //       return;
      //     })
      //     .catch(error => {
      //       reject({
      //         code: "",
      //         data: reserveURL,
      //         error: error,
      //         location: this.gatewayCode + " manager -> book -> callApi (book) -> " + ` | Segment ${el.flights[0].departureAirport.cityCode} to ${el.flights[el.flights.length - 1].arrivalAirport.cityCode}`,
      //         name: "InvalidResponse"
      //       });
      //       return;
      //     })
      // })

      // let bookingCallback = (index: number, result: any, totalPrice: number) => {
      //   let ticketTimeLimit = new Date();
      //   ticketTimeLimit.setMinutes(ticketTimeLimit.getMinutes() + 15);
      //   finalResult.result.rawData[index] = result;
      //   finalResult.result.pnr[index] = result.AirReserve[0].PNR;
      //   finalResult.result.ticketType[index] = "";
      //   finalResult.result.totalPrice += totalPrice;
      //   if (finalResult.result.ticketTimeLimit == "" || (new Date(finalResult.result.ticketTimeLimit + "Z") > ticketTimeLimit))
      //     finalResult.result.ticketTimeLimit = ticketTimeLimit.toISOString().replace('Z', '');
      //   if (++resultCount == booking.flights.itineraries.length) {
      //     finalResult.result.bookDate = new Date().toISOString();
      //     finalResult.result.moneyUnit = booking.moneyUnit.moneyUnit;
      //     resolve(finalResult)
      //   }
      // }
    })
  }

  private generatePassengerList(passengers: any[], isInternational: boolean) {
    let passengersUrl = "";
    passengers.forEach((pass, ind) => {
      passengersUrl += `&edtName${ind + 1}=${pass.firstName.replace(/ /g, "")}&edtLast${ind + 1}=${pass.lastName.replace(/ /g, "")}&edtAge${ind + 1}=${pass.age}&edtID${ind + 1}=${isInternational ? pass.passportNo : pass.nationalCode}`
    })
    return passengersUrl;
  }

  createTicket(booking: any, session?: gatewaySession, options?: gatewayInputOptions) {
    return new Promise<gatewayTicketInternalResult>((resolve, reject) => {
      // let resultCount = 0;
      // let finalResult = new gatewayTicketInternalResult();
      // let ticketTempData = [];
      // finalResult.session = null;
      // booking.flights.itineraries.forEach((el, ind) => {
      //   let reserveURL = this.ticketURL;
      //   reserveURL += `AirLine=${this.airlineCode}`;
      //   reserveURL += `&PNR=${el.pnr}`;
      //   reserveURL += `&EMail=${booking.issuerContactInfo.email ? booking.issuerContactInfo.email : process.env.ETICKET_DEFAULT_EMAIL}`;
      //   this.callApi(reserveURL)
      //     .then((reserveResult: any) => {
      //       reserveResult = reserveResult["body"].replace(/\r\n/g, '|@|');
      //       reserveResult = JSON.parse(reserveResult);
      //       if (reserveResult.AirNRSTICKETS[0].Tickets != "") {
      //         reserveResult.AirNRSTICKETS[0].Tickets = reserveResult.AirNRSTICKETS[0].Tickets.split("|@|")
      //         ticketCallback(ind, reserveResult);
      //       }
      //       else
      //         reject({
      //           code: "",
      //           data: reserveURL,
      //           error: reserveResult.AirReserve[0].Error + ` | Segment ${el.flights[0].departureAirport.cityCode} to ${el.flights[el.flights.length - 1].arrivalAirport.cityCode}`,
      //           location: this.gatewayCode + " manager -> createTicket -> callApi (createTicket) -> + " + ` | Segment ${el.flights[0].departureAirport.cityCode} to ${el.flights[el.flights.length - 1].arrivalAirport.cityCode}`,
      //           name: "Error in createTicket"
      //         });
      //       return;
      //     })
      //     .catch(error => {
      //       reject({
      //         code: "",
      //         data: reserveURL,
      //         error: error,
      //         location: this.gatewayCode + " manager -> createTicket -> callApi (createTicket) -> " + ` | Segment ${el.flights[0].departureAirport.cityCode} to ${el.flights[el.flights.length - 1].arrivalAirport.cityCode}`,
      //         name: "InvalidResponse"
      //       });
      //       return;
      //     })
      // })

      // let ticketCallback = (index: number, result: any) => {
      //   ticketTempData[index] = result;
      //   booking.passengers.forEach(pass => {
      //     finalResult.result.tickets.push({
      //       passengerIndex: pass.index,
      //       flightIndex: index,
      //       refrenceId: "",
      //       ticketNumber: result.AirNRSTICKETS[0].Tickets.find(el => el.indexOf(`${pass.lastName.replace(/ /g, "").toUpperCase()}/${pass.firstName.replace(/ /g, "").toUpperCase()}`) >= 0).split("=")[1],
      //       status: [],
      //       pnr: booking.flights.itineraries[index].pnr,
      //       cancelReason: null,
      //       showTicketType: null,
      //       callSupport: false
      //     })
      //   })
      //   if (++resultCount == booking.flights.itineraries.length) {
      //     finalResult.result.data = ticketTempData;
      //     finalResult.result.callSupport = false;
      //     resolve(finalResult)
      //   }
      // }
    })
  }

  getPing: () => Promise<string>;

  private convertMinuteToTimeString(minuteString: string): string {
    let minutes = parseInt(minuteString);
    let hour = Math.floor(minutes / 60);
    minutes = minutes % 60;
    let hourstr = hour.toString();
    let minutestr = minutes.toString();
    if (hourstr.length < 2) hourstr = "0" + hourstr;
    if (minutestr.length < 2) minutestr = "0" + minutestr;
    return hourstr + ":" + minutestr;
  }
}

Object.seal(TravelportManager);