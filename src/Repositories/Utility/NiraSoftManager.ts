import { IGatewayImplement } from "../../Repositories/Contracts/IGatewayImplement";
import { ExternalRequest } from "../../Infrastructure/ExternalRequests";
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
import { FlightBookingClassHelper } from "../../Repositories/Utility/FlightBookingCalssHelper";
import { gatewayBookInternalResult } from "../../Common/Metadata/gatewayBookResultMetadata";
import { gatewayTicketInternalResult } from "../../Common/Metadata/gatewayTicketResultMetadata";
const soapRequest = require("easy-soap-request");
const fs = require("fs");
var parseString = require("xml2js").parseString;
const _ = require("lodash");

export class NiraSoftManager implements IGatewayImplement {

  private signitureData: any;
  private gatewayCode: string;
  private airlineCode: string;
  private provider: string;
  private searchURL: string;
  private fareURL: string;
  private bookURL: string;
  private ticketURL: string;
  private airlineBaggage: any;
  private thrDepartTerminal: string;
  private thrArrivTerminal: string;

  public static sessionId: string = "";
  constructor(_signitureData, _gatewayCode: string, _airlineCode: string, _provider: string, _searchURL: string
    , _fareURL: string, _reserveURL: string, _ticketURL: string, _airlineBaggaeg
    , _thrDepartTerminal: string, _thrArrivTerminal: string) {
    this.signitureData = _signitureData;
    this.gatewayCode = _gatewayCode;
    this.airlineCode = _airlineCode;
    this.provider = _provider;
    this.searchURL = _searchURL;
    this.fareURL = _fareURL;
    this.bookURL = _reserveURL;
    this.ticketURL = _ticketURL;
    this.airlineBaggage = _airlineBaggaeg;
    this.thrDepartTerminal = _thrDepartTerminal;
    this.thrArrivTerminal = _thrArrivTerminal;
  }

  getSearch(item: gatewaySearchInput, session?: gatewaySession, calendarResultNotRequired?: boolean, loggedInUser?: any, options?: gatewayInputOptions) {
    return new Promise((resolve: (result: gatewaySearchFlightResult) => void, reject: (error: errorObj) => void) => {
      let _result = new gatewaySearchFlightResult();
      let _temp_itineraries = new Array(item.itineraries.length);
      let _temp_locations: string[] = [];
      let cabinCodes: any = [];
      let _finalSearchItems: gatewaySearchInput[] = [item];
      let _resultCount: number = 0;
      let _gatewayErrors: any[] = [];

      let searchProcess = (item: gatewaySearchInput) => {
        let _itin_result_count = 0;
        item.itineraries.forEach((_itin, _itin_index) => {
          let url = this.searchURL;
          let departdate = moment(_itin.departDate, 'YYYY-MM-DD').format('jMM-jDD');
          url += `?Airline=${this.airlineCode}`;
          url += `&cbSource=${_itin.origin}`;
          url += `&cbTarget=${_itin.destination}`;
          url += `&cbDay1=${departdate.split('-')[1]}`;
          url += `&cbMonth1=${departdate.split('-')[0]}`;
          url += `&cbAdultQty=${item.adult}`;
          url += `&cbChildQty=${item.child}`;
          url += `&cbInfantQty=${item.infant}`;
          if (!_temp_itineraries[_itin_index])
            _temp_itineraries[_itin_index] = [];
          this.callApi(url)
            .then(_availability_result => {
              let _body = {};
              try {
                _body = JSON.parse(_availability_result["body"]);
              }
              catch (error) {
                _gatewayErrors.push({
                  code: "",
                  data: _availability_result["body"],
                  error: error,
                  location: this.gatewayCode + " manager -> get Search -> parse _availability_result[body]",
                  name: "InvalidJSON"
                })
                if (++_itin_result_count == item.itineraries.length)
                  getPriceFare();
              }
              if (_body["AvailableFlights"]) {
                if (_body["AvailableFlights"].length == 0) {
                  _gatewayErrors.push({
                    code: "",
                    data: _availability_result["body"],
                    error: `no flight available for ${_itin.origin} to ${_itin.destination}`,
                    location: this.gatewayCode + " manager -> get Search -> _body[AvailableFlights].length",
                    name: "NoFlightAvailable"
                  });
                  if (++_itin_result_count == item.itineraries.length)
                    getPriceFare();
                }
                else {
                  _body["AvailableFlights"].forEach((_element, _element_index, _element_array) => {
                    //check flight remain seat count
                    let _class_list = _element.ClassesStatus.substr(1).split(" ")
                      .filter((str: string) => str.substr(-1) != "C" && str.substr(-1) != "X" && (str.substr(-1) == "A" ? true : parseInt(str.substr(-1)) >= item.adult + item.child));
                    // if (_class_list.length == 0) {
                    //   // No Flight
                    //   // console.log("NO Flight " + _itin.departDate)
                    // }
                    let class_temp_list = []
                    _class_list.map((_class: string, _class_index, _class_array) => {
                      // console.log(_class)
                      let tempPrice = parseInt(_element.AdultTotalPrices.split(`${_class.slice(0, -1)}:`)[1] ? _element.AdultTotalPrices.split(`${_class.slice(0, -1)}:`)[1].split(' ')[0] : Number.MAX_VALUE);
                      if (!isNaN(tempPrice))
                        class_temp_list.push({
                          ..._element,
                          cabinStatus: cabinCodes.some(el => el.resBookDesigCode && el.resBookDesigCode.indexOf(_class.slice(0, -1)) >= 0) ?
                            cabinCodes.find(el => el.resBookDesigCode && el.resBookDesigCode.indexOf(_class.slice(0, -1)) >= 0).cabinCode : "Y",
                          ClassesStatus: _class,
                          tempPrice: tempPrice,
                          isValid: true
                        })
                    });
                    class_temp_list = _(class_temp_list).orderBy('tempPrice').value();
                    _temp_itineraries[_itin_index] = _temp_itineraries[_itin_index].concat(class_temp_list.filter(el => el.cabinStatus == "Y").slice(0, parseInt(process.env.MAX_ECONOMY_CLASS_COUNT)))
                    _temp_itineraries[_itin_index] = _temp_itineraries[_itin_index].concat(class_temp_list.filter(el => el.cabinStatus == "C").slice(0, parseInt(process.env.MAX_BUSINESS_CLASS_COUNT)))
                  });
                  if (++_itin_result_count == item.itineraries.length)
                    getPriceFare();
                }
              }
              else {
                _gatewayErrors.push({
                  code: "",
                  data: _availability_result["body"],
                  error: "no AvailableFlights field",
                  location: this.gatewayCode + " manager -> get Search -> parse _availability_result[body]",
                  name: "InvalidResponse"
                });
                if (++_itin_result_count == item.itineraries.length)
                  getPriceFare();
              }
            })
            .catch(error => {
              _gatewayErrors.push({
                code: "",
                data: url,
                error: error,
                location: this.gatewayCode + " manager -> get Search -> callApi (availability)",
                name: "InvalidResponse"
              });
              if (++_itin_result_count == item.itineraries.length)
                getPriceFare();
            })
        });

      }

      let getPriceFare = () => {
        if (++_resultCount == _finalSearchItems.length) {
          let totalFlightCount = _temp_itineraries.reduce((a, b) => a + b.length, 0);
          let _fare_result_count = 0;
          if (totalFlightCount == 0) {
            reject({
              code: "",
              data: _gatewayErrors,
              error: `no flight available`,
              location: this.gatewayCode + " manager -> get Search -> _body[AvailableFlights].length",
              name: "NoFlightAvailable"
            });
            return;
          }
          else {
            _gatewayErrors = [];
            _temp_itineraries.map((_itin, _itin_index) => {
              _itin.map((_flg, _flg_ind) => {
                let url = this.fareURL;
                url += `?Airline=${this.airlineCode}`;
                url += `&Route=${_flg.Origin}-${_flg.Destination}`;
                url += `&RBD=${_flg.ClassesStatus.slice(0, -1)}`;
                this.callApi(url)
                  .then(_fare_result => {
                    let _fare_body: any = {};
                    try {
                      _fare_body = JSON.parse(_fare_result["body"]);
                      if (_fare_body.AdultTotalPrice) {
                        _flg.TotalPrice = item.adult * parseFloat(_fare_body.AdultTotalPrice) +
                          item.child * parseFloat(_fare_body.ChildTotalPrice) +
                          item.infant * parseFloat(_fare_body.InfantTotalPrice);
                        _flg.Price = _fare_body;
                      }
                      else {
                        _flg.isValid = false;
                      }
                      if (++_fare_result_count == totalFlightCount)
                        searchCallback();
                    }
                    catch (error) {
                      _flg.isValid = false;
                      _gatewayErrors.push({
                        code: "",
                        data: _fare_result["body"],
                        error: error,
                        location: this.gatewayCode + " manager -> get Search -> getPriceFare -> parse _fare_result[body]",
                        name: "InvalidJSON"
                      })
                      if (++_fare_result_count == totalFlightCount)
                        searchCallback();
                    }
                  })
                  .catch(error => {
                    _flg.isValid = false;
                    _gatewayErrors.push({
                      code: "",
                      data: url,
                      error: error,
                      location: this.gatewayCode + " manager -> get Search -> getPriceFare -> callApi (fare)",
                      name: "InvalidResponse"
                    });
                    if (++_fare_result_count == totalFlightCount)
                      searchCallback();
                  })
              })
            })
          }
        }
      }

      let searchCallback = () => {
        _temp_itineraries = _temp_itineraries.map(_itin => _itin.filter(_flg => _flg.isValid));
        if (item.itineraries.length == 1) {
          let totalFlightCount = _temp_itineraries.reduce((a, b) => a * b.length, 1);
          _temp_itineraries.reverse();
          let timezoneHelper = new IataTimezonesHelper();
          for (let _matrix_index = 0; _matrix_index < totalFlightCount; _matrix_index++) {
            let _flg_result = new searchFlightResult();
            let _temp_index = _matrix_index;
            _flg_result.Currency = "IRR";
            _flg_result.ProviderType = this.provider;
            _flg_result.SequenceNumber = "0";
            _flg_result.CombinationId = _matrix_index.toString();
            _flg_result.ValidatingAirlineCode = this.airlineCode;
            _flg_result.ForceETicket = null;
            _flg_result.E_TicketEligibility = "Eligible";
            _flg_result.ServiceFeeAmount = null;

            let cabin = _temp_itineraries[0][_temp_index % _temp_itineraries[0].length].cabinStatus;
            
            // console.log(this.gatewayCode, cabin)
            // Check dismiss economy when cabin is business and first
            // if((item.cabin === "Business" || item.cabin === "First") && cabin === "Y")
            //     return;

            // Check dismiss business and first when flight is in local and is on economy class
            // if((item.cabin === "Economy" && (item.itineraries[0].originCountryCode !== "IR" || item.itineraries[0].destinationCountryCode !== "IR")) && (cabin === "C" || cabin === "F"))
            //   return;

            for (let _itinerary_index = 0; _itinerary_index < _temp_itineraries.length; _itinerary_index++) {
              let element = _temp_itineraries[_itinerary_index];
              let _index = _temp_index % element.length;
              _temp_index = Math.floor(_temp_index / element.length);
              element = element[_index];
              let _itinerary = new searchFlightItinerary();
              _itinerary.DirectionId = (_temp_itineraries.length - _itinerary_index - 1).toString();
              _itinerary.ElapsedTime =
                // TimeToString.generateTimeStirng(new Date(element.ArrivalDateTime).getTime() - new Date(element.DepartureDateTime).getTime())
                TimeToString.generateTimeStirng(timezoneHelper
                  .setFromDateTimeWithTimezone(element.DepartureDateTime, element.Origin)
                  .setToDateTimeWithTimezone(element.ArrivalDateTime, element.Destination)
                  .calculateTimeDiff()).replace(":", "");
              _itinerary.RefNumber = _index.toString();
              _itinerary.StopCount = 0;
              _itinerary.TotalStopTime = TimeToString.generateTimeStirng(0);

              _flg_result.TotalPrice += parseFloat(element.TotalPrice);

              _flg_result.AdultPrice.BaseFare += parseFloat(element.Price.AdultFare);
              _flg_result.AdultPrice.TotalPrice += parseFloat(element.Price.AdultTotalPrice);
              _flg_result.AdultPrice.Tax = _flg_result.AdultPrice.TotalPrice - _flg_result.AdultPrice.BaseFare;

              _flg_result.ChildPrice.BaseFare += parseFloat(element.Price.ChildFare);
              _flg_result.ChildPrice.TotalPrice += parseFloat(element.Price.ChildTotalPrice);
              _flg_result.ChildPrice.Tax = _flg_result.ChildPrice.TotalPrice - _flg_result.ChildPrice.BaseFare;

              _flg_result.InfantPrice.BaseFare += parseFloat(element.Price.InfantFare);
              _flg_result.InfantPrice.TotalPrice += parseFloat(element.Price.InfantTotalPrice);
              _flg_result.InfantPrice.Tax = _flg_result.InfantPrice.TotalPrice - _flg_result.InfantPrice.BaseFare;

              let _itineraryFlight = new itineraryFlightSegment();
              _itineraryFlight.DepartureDateTime = element.DepartureDateTime.replace(" ", "T");
              _itineraryFlight.ArrivalDateTime = element.ArrivalDateTime.replace(" ", "T")
              _itineraryFlight.FlightNumber = element.FlightNo.toString();
              _itineraryFlight.ResBookDesigCode = element.ClassesStatus.slice(0, -1);
              _itineraryFlight.FlightDuration = TimeToString.generateTimeStirng(timezoneHelper
                .setFromDateTimeWithTimezone(element.DepartureDateTime, element.Origin)
                .setToDateTimeWithTimezone(element.ArrivalDateTime, element.Destination)
                .calculateTimeDiff());
              _itineraryFlight.DepartureAirport.Code = element.Origin;
              _itineraryFlight.DepartureAirport.Terminal = element.Origin == "THR" ? this.thrDepartTerminal : null;
              _itineraryFlight.ArrivalAirport.Code = element.Destination;
              _itineraryFlight.ArrivalAirport.Terminal = element.Destination == "THR" ? this.thrArrivTerminal : null;
              _itineraryFlight.MarketingAirline.Code = this.airlineCode;
              _itineraryFlight.OperatingAirline.Code = this.airlineCode;
              _itineraryFlight.Equipment.Code = element.AircraftTypeCode;
              _itineraryFlight.BookingClassAvails = {
                ResBookDesigCode: element.ClassesStatus.slice(0, -1),
                ResBookDesigQuantity: element.ClassesStatus.substr(-1) == "A" ? "9+" : element.ClassesStatus.substr(-1),
                RPH: "ADT",
                AvailablePTC: "ADT",
                ResBookDesigCabinCode: element.cabinStatus,
                FareBasis: null,
                FareType: null,
                ResBookDesigCabinName: new nameObject()
              }
              _itineraryFlight.Baggage = this.airlineBaggage;
              _itineraryFlight.StopLocation = [];
              _itinerary.Flights[0] = _itineraryFlight;
              _flg_result.Itineraries[_temp_itineraries.length - _itinerary_index - 1] = _itinerary;
            }
            _result.flights.push(_flg_result);
          }
        }
        if (!calendarResultNotRequired) {
          this.getSearchCalendar(item)
            .then(cal_result => {
              _result.calendar = cal_result;
              calculateMarkup(item, _result);
            })
            .catch(error => {
              if (error.name == "searchCalendarMultiLegError")
                calculateMarkup(item, _result);
              else
                reject(error);
            })
        }
        else
          calculateMarkup(item, _result);
      }

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

      this.extractAllOriginDestionationOptions(item)
        .then(result => { _finalSearchItems = result; })
        .finally(() => {
          FlightBookingClassHelper.getAirlineCabins(this.airlineCode)
            .then(result => { cabinCodes = result; })
            .finally(() => {
              _finalSearchItems.forEach((el, ind) => {
                searchProcess(el);
              })
            });
        }) 
      // _finalSearchItems = [item]
      // _finalSearchItems.forEach((el, ind) => {
      //   searchProcess(el);
      // });
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
        item.itineraries.forEach(itinerary => {
          let today = new Date((new Date()).toISOString().split("T")[0] + "T10:00:00");
          let date = new Date(itinerary.departDate + "T10:00:00");
          if (Math.floor(Math.abs(date.getTime() - today.getTime()) / (1000 * 3600 * 24)) < 3) {
            today.setDate(today.getDate() + 3);
            itinerary.departDate = today.toISOString().split("T")[0];
          }
        });
        item.itineraries.forEach((_itin, _itin_index) => {
          for (let dateOffset = -3; dateOffset <= +3; dateOffset++) {
            let date = new Date(_itin.departDate);
            date.setDate(date.getDate() + dateOffset);
            let _modified_item: gatewaySearchInput = {
              ...item
              , itineraries: item.itineraries.map(_temp_itin => { return { ..._temp_itin } })
            }
            _modified_item.itineraries[_itin_index].departDate = date.toISOString().split("T")[0];
            this.getSearch(_modified_item, undefined, true)
              .then(_result => {
                let _flight: searchFlightResult = _(_result.flights).orderBy('TotalPrice').value()[0];
                calendarResult.push({
                  AdultPrice: _flight.AdultPrice.TotalPrice,
                  Currency: _flight.Currency,
                  Date: _flight.Itineraries.map(_itin => _itin.Flights[0].DepartureDateTime.split("T")[0])
                })
                if (++calendarResultCount == totalCalendarResult)
                  resolve(calendarResult);
              })
              .catch(_error => {
                if (++calendarResultCount == totalCalendarResult)
                  resolve(calendarResult);
              })
          }
        })
      }
    })
  };

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
      let resultCount = 0;
      let finalResult = new gatewayBookInternalResult();
      finalResult.session = null;
      booking.flights.itineraries.forEach((el, ind) => {
        booking.passengers.forEach(pas => {
          pas.age = Math.ceil(moment(el.flights[0].departureDateTime).diff(moment(pas.birthDate, 'YYYY-MM-DD'), 'year', true));
        });
        let departdate = moment(el.flights[0].departureDateTime, 'YYYY-MM-DD').format('jMM-jDD');
        let reserveURL = this.bookURL;
        reserveURL += `AirLine=${this.airlineCode}`;
        reserveURL += `&cbSource=${el.flights[0].departureAirport.cityCode}`;
        reserveURL += `&cbTarget=${el.flights[el.flights.length - 1].arrivalAirport.cityCode}`;
        reserveURL += `&FlightClass=${el.flights[0].resBookDesigCode}`;
        reserveURL += `&FlightNo=${el.flights[0].flightNumber}`;
        reserveURL += `&Day=${departdate.split('-')[1]}`;
        reserveURL += `&Month=${departdate.split('-')[0]}`;
        reserveURL += `&No=${booking.passengers.length}`;
        reserveURL += `&${this.generatePassengerList(booking.passengers, booking.flights.isInternational)}`
        if (booking.issuerContactInfo.mobile)
          reserveURL += `&edtContact=${booking.issuerContactInfo.mobile.toString().replace('+', '00')}`
        this.callApi(reserveURL)
          .then((reserveResult: any) => {
            console.log("NIRAAA", reserveResult)
            reserveResult = JSON.parse(reserveResult["body"])
            if (reserveResult.AirReserve[0].Error == "No Err")
              bookingCallback(ind, reserveResult, el.price ? el.price.totalPrice : booking.totalPrice);
            else
              reject({
                code: "",
                data: reserveURL,
                error: reserveResult.AirReserve[0].Error + ` | Segment ${el.flights[0].departureAirport.cityCode} to ${el.flights[el.flights.length - 1].arrivalAirport.cityCode}`,
                location: this.gatewayCode + " manager -> book -> callApi (book) -> + " + ` | Segment ${el.flights[0].departureAirport.cityCode} to ${el.flights[el.flights.length - 1].arrivalAirport.cityCode}`,
                name: "Error in booking"
              });
            return;
          })
          .catch(error => {
            reject({
              code: "",
              data: reserveURL,
              error: error,
              location: this.gatewayCode + " manager -> book -> callApi (book) -> " + ` | Segment ${el.flights[0].departureAirport.cityCode} to ${el.flights[el.flights.length - 1].arrivalAirport.cityCode}`,
              name: "InvalidResponse"
            });
            return;
          })
      })

      let bookingCallback = (index: number, result: any, totalPrice: number) => {
        let ticketTimeLimit = new Date();
        ticketTimeLimit.setMinutes(ticketTimeLimit.getMinutes() + 15);
        finalResult.result.rawData[index] = result;
        finalResult.result.pnr[index] = result.AirReserve[0].PNR;
        finalResult.result.ticketType[index] = "";
        finalResult.result.totalPrice += totalPrice;
        if (finalResult.result.ticketTimeLimit == "" || (new Date(finalResult.result.ticketTimeLimit + "Z") > ticketTimeLimit))
          finalResult.result.ticketTimeLimit = ticketTimeLimit.toISOString().replace('Z', '');
        if (++resultCount == booking.flights.itineraries.length) {
          finalResult.result.bookDate = new Date().toISOString();
          finalResult.result.moneyUnit = booking.moneyUnit.moneyUnit;
          resolve(finalResult)
        }
      }
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
      let resultCount = 0;
      let finalResult = new gatewayTicketInternalResult();
      let ticketTempData = [];
      finalResult.session = null;
      booking.flights.itineraries.forEach((el, ind) => {
        let reserveURL = this.ticketURL;
        reserveURL += `AirLine=${this.airlineCode}`;
        reserveURL += `&PNR=${el.pnr}`;
        reserveURL += `&EMail=${booking.issuerContactInfo.email ? booking.issuerContactInfo.email : process.env.ETICKET_DEFAULT_EMAIL}`;
        this.callApi(reserveURL)
          .then((reserveResult: any) => {
            reserveResult = reserveResult["body"].replace(/\r\n/g, '|@|');
            reserveResult = JSON.parse(reserveResult);
            if (reserveResult.AirNRSTICKETS[0].Tickets != "") {
              reserveResult.AirNRSTICKETS[0].Tickets = reserveResult.AirNRSTICKETS[0].Tickets.split("|@|")
              ticketCallback(ind, reserveResult);
            }
            else
              reject({
                code: "",
                data: reserveURL,
                error: reserveResult.AirReserve[0].Error + ` | Segment ${el.flights[0].departureAirport.cityCode} to ${el.flights[el.flights.length - 1].arrivalAirport.cityCode}`,
                location: this.gatewayCode + " manager -> createTicket -> callApi (createTicket) -> + " + ` | Segment ${el.flights[0].departureAirport.cityCode} to ${el.flights[el.flights.length - 1].arrivalAirport.cityCode}`,
                name: "Error in createTicket"
              });
            return;
          })
          .catch(error => {
            reject({
              code: "",
              data: reserveURL,
              error: error,
              location: this.gatewayCode + " manager -> createTicket -> callApi (createTicket) -> " + ` | Segment ${el.flights[0].departureAirport.cityCode} to ${el.flights[el.flights.length - 1].arrivalAirport.cityCode}`,
              name: "InvalidResponse"
            });
            return;
          })
      })

      let ticketCallback = (index: number, result: any) => {
        ticketTempData[index] = result;
        booking.passengers.forEach(pass => {
          finalResult.result.tickets.push({
            passengerIndex: pass.index,
            flightIndex: index,
            refrenceId: "",
            ticketNumber: result.AirNRSTICKETS[0].Tickets.find(el => el.indexOf(`${pass.lastName.replace(/ /g, "").toUpperCase()}/${pass.firstName.replace(/ /g, "").toUpperCase()}`) >= 0).split("=")[1],
            status: [],
            pnr: booking.flights.itineraries[index].pnr,
            cancelReason: null,
            showTicketType: null,
            callSupport: false
          })
        })
        if (++resultCount == booking.flights.itineraries.length) {
          finalResult.result.data = ticketTempData;
          finalResult.result.callSupport = false;
          resolve(finalResult)
        }
      }
    })
  }

  getPing: () => Promise<string>;

  getCancel: (item: any, callback: (error: any, result: any) => void) => void;

  getAirOrderTicket: (item: any, callback: (error: any, result: any) => void) => void;

  private callApi(url: string) {
    return new Promise((resolve, reject) => {
      url += `&OfficeUser=${this.signitureData.username}`;
      url += `&OfficePass=${this.signitureData.password}`;
      // console.log(this.gatewayCode, url);
      ExternalRequest.syncGetRequest(url, (error, result) => {
        // if(this.airlineCode === "flypersia")
        // console.log(error,result)
        // if(this.gatewayCode == "flypersia")
        // console.log("flypersia",url,result["body"],error)
        if (!error)
          resolve(result);
        else
          reject(error);
      },
        undefined,
        true);
    })
  }

  private extractAllOriginDestionationOptions(item: gatewaySearchInput) {
    return new Promise<gatewaySearchInput[]>((resolve, reject) => {
      let _temp_locations: string[] = [];
      let _result: gatewaySearchInput[] = [item];

      item.itineraries.forEach(_itin => {
        if (_itin.isOriginLocation && _temp_locations.indexOf(_itin.origin) == -1)
          _temp_locations.push(_itin.origin);
        if (_itin.isDestinationLocation && _temp_locations.indexOf(_itin.destination) == -1)
          _temp_locations.push(_itin.destination);
      });

      if (_temp_locations.length == 0)
        resolve(_result);
      else {
        ExternalRequest.syncPostRequest(process.env.MAIN_URL + "airport/location_list", undefined, _temp_locations, undefined)
          .then((airport_result: any) => {
            let _temp_origindestinations: string[][] = [];
            item.itineraries.forEach((el, ind) => {
              if (el.isOriginLocation)
                _temp_origindestinations[2 * ind] = airport_result.payload.data.filter(airport => airport.locationCode == el.origin).map(el => el.iata)
              else
                _temp_origindestinations[2 * ind] = [el.origin]
              if (el.isDestinationLocation)
                _temp_origindestinations[2 * ind + 1] = airport_result.payload.data.filter(airport => airport.locationCode == el.destination).map(el => el.iata)
              else
                _temp_origindestinations[2 * ind + 1] = [el.destination]
            })
            let _temp_total_count = _temp_origindestinations.reduce((a, b) => a * b.length, 1);
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
                  _temp_item.itineraries[_itin_index] = new gatewaySearchInputItinerary();
                _temp_item.itineraries[_itin_index].departDate = item.itineraries[_itin_index].departDate;
                _temp_item.itineraries[_itin_index].isOriginLocation = false;
                _temp_item.itineraries[_itin_index].isDestinationLocation = false;
                _temp_item.itineraries[_itin_index].originCountryCode = item.itineraries[_itin_index].originCountryCode;
                _temp_item.itineraries[_itin_index].destinationCountryCode = item.itineraries[_itin_index].destinationCountryCode;
                if (ind % 2 == 0)
                  _temp_item.itineraries[_itin_index].origin = el[_index];
                else
                  _temp_item.itineraries[_itin_index].destination = el[_index];
              })
              _result.push(_temp_item);
              resolve(_result);
            }
          })
          .catch(err => resolve([item]))
      }
    })
  }

}

Object.seal(NiraSoftManager);