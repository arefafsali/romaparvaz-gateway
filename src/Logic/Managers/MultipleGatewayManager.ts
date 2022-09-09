import { gatewayMethods } from "../../Common/Metadata/gatewayMethodsMetadata";
import { gatewaySearchInput, gatewaySessionList, gatewaySignitureResult, gatewayInputOptions, gatewayRuleInput } from "../../Common/Metadata/gatewayLogicInputMetadata";
import { gateway } from "../../Common/Metadata/gatewayMetadata";
import { multipleGatewaySearchFlightResult, searchCalendarResult, gatewaySearchFlightResult, searchFlightResult, searchFlightItinerary, itineraryFlightSegment, nameObject, itineraryPrice } from "../../Common/Metadata/gatewaySearchResultMetadata";
import { errorObj } from "../../Common/Metadata/errorObjMetadata";
import { IataTimezonesHelper } from "../../Repositories/Utility/IataTimezonesHelper";
import { TimeToString } from "../../Repositories/Utility/TimeToString";
import { FlightTypeHelper } from "../../Repositories/Utility/FlightTypeHelper";
import { DynamicGatewayFunctionsHelper } from "../../Repositories/Utility/DynamicGatewayFunctionsHelper";
import { gatewayRulesResult } from "../../Common/Metadata/gatewayRulesResultMetadata";
import { CancelingRuleHelper } from "../../Repositories/Utility/CancelingRuleHelper";
import { multipleGatewayBookInternalResult, gatewayBookInternalResult } from "../../Common/Metadata/gatewayBookResultMetadata";
import { multipleGatewayTicketInternalResult, gatewayTicketInternalResult } from "../../Common/Metadata/gatewayTicketResultMetadata";

export class MultipleGatewayManager {

  search(gatewayList: gatewaySignitureResult[], searchObj: gatewaySearchInput, session: gatewaySessionList, loggedInUser: any, options: gatewayInputOptions, exchangeRate: number) {
    return new Promise((resolve: (result: multipleGatewaySearchFlightResult) => void, reject: (error: errorObj) => void) => {
      let gatewayResultCount: number[] = searchObj.itineraries.map(() => 0);
      let tempCalendarResult: searchCalendarResult[][] = searchObj.itineraries.map(() => []);
      let _temp_result: gatewaySearchFlightResult[] = searchObj.itineraries.map(() => new gatewaySearchFlightResult());
      let _result: multipleGatewaySearchFlightResult = new multipleGatewaySearchFlightResult();

      if (gatewayList.length) {
        searchObj.itineraries.forEach((_itin, _itin_index) => {
          for (let index = 0; index < gatewayList.length; index++) {
            const element = gatewayList[index];
            if (element.internalCode && DynamicGatewayFunctionsHelper[element.internalCode]) {
              let gatewayManager: gatewayMethods = DynamicGatewayFunctionsHelper[element.internalCode];
              let _modified_search_object: gatewaySearchInput = {
                adult: searchObj.adult,
                child: searchObj.child,
                infant: searchObj.infant,
                citizen: searchObj.citizen,
                student: searchObj.student,
                cabin: searchObj.cabin,
                itineraries: [_itin]
              }
              // console.log("STARTED", gatewayList.map(gw => gw.internalCode).join("-"), element.internalCode, _itin_index)
              // if(element.internalCode == "sepehran")
                // console.log(element.internalCode)
              gatewayManager.search(element.signiture, _modified_search_object, session[element.internalCode], loggedInUser, options, exchangeRate)
                .then((res: any) => {
                  // console.log("FINISHED", gatewayList.map(gw => gw.internalCode).join("-"), element.internalCode, _itin_index)
                  // if(element.internalCode == "sepehran")
                    // console.log(element.internalCode)
                  searchCallback(res, element, _itin_index);
                })
                .catch(error => {
                  // if(element.internalCode == "sepehran")
                    // console.log(element.internalCode)
                  if (element.internalCode == "mahan")
                    console.log("ERROR", gatewayList.map(gw => gw.internalCode).join("-"), element.internalCode, _itin_index, error)
                  
                  searchCallback(new gatewaySearchFlightResult(), element, _itin_index);
                  // else
                  //   reject({
                  //     code: "",
                  // method: "search",
                  //     data: null,
                  //     error: `no flight available for ${_itin.origin} to ${_itin.destination}`,
                  //     location: "Multiple Gateways manager -> get Search -> _body[AvailableFlights].length",
                  //     name: "NoFlightAvailable"
                  //   });

                });
            }
            else {
              console.log("Gateway Not in Roudtrip:", element.internalCode)
              reject({
                code: "",
                data: {},
                error: "internal code is not defined for gateway " + element.name,
                location: "Multiple Gateways Manager -> Search",
                name: "noProperGateway"
              })
            }
          }
        })
      }
      else
        reject({
          code: "",
          data: {},
          error: "No gateway match given conditions",
          location: "Multiple Gateways Manager -> Search",
          name: "noProperGateway"
        })

      // callback function which is called on gateway response
      let searchCallback = (gatewayResult: gatewaySearchFlightResult, gateway: gatewaySignitureResult, itinIndex: number) => {
        gatewayResult.flights.forEach(flg => {
          flg.Itineraries.forEach(itin => {
            itin.Gateway.id = gateway._id;
            itin.Gateway.Code = gateway.internalCode;
          })
        })

        if (gatewayResult.session)
          _result.sessionList[gateway.internalCode] = gatewayResult.session;

        _temp_result[itinIndex].flights = _temp_result[itinIndex].flights.concat(gatewayResult.flights);
        tempCalendarResult[itinIndex] = tempCalendarResult[itinIndex].concat(gatewayResult.calendar);

        // gatewayResult.calendar.map(calResult => {
        //   let _tempCal = tempCalendarResult[itinIndex].find(cal => cal.Date[0] == calResult.Date[0] && cal.Date[1] == calResult.Date[1]);
        //   if (_tempCal) {
        //     if (calResult.AdultPrice && _tempCal.AdultPrice > calResult.AdultPrice)
        //       _tempCal.AdultPrice = calResult.AdultPrice;
        //   }
        //   else
        //     tempCalendarResult[itinIndex].push(calResult);
        // })
        // console.log("Count: ",_temp_result[itinIndex].flights.length)
        if (++gatewayResultCount[itinIndex] == gatewayList.length && gatewayResultCount.every(c => c == gatewayList.length)) {
          let totalFlightCount = _temp_result.reduce((a, b) => a * b.flights.length, 1);
          // console.log("totalFlightCount: ", totalFlightCount)
          if (totalFlightCount == 0) {
            reject({
              code: "",
              data: null,
              error: `no flight available`,
              location: "Multiple Gateway manager -> get Search -> Matrix generation",
              name: "NoFlightAvailable"
            });
            return;
          }
          _temp_result.reverse();
          let timezoneHelper = new IataTimezonesHelper();

          // TODO: check same day flight times
          for (let _matrix_index = 0; _matrix_index < totalFlightCount; _matrix_index++) {
            let _flg_result = new searchFlightResult();
            let _temp_index = _matrix_index;
            _flg_result.GatewayData = {};
            _flg_result.Currency = "IRR"; // TODO: check currency
            _flg_result.ProviderType = "MultipleProviders";
            _flg_result.SequenceNumber = "0";
            _flg_result.CombinationId = _matrix_index.toString();
            _flg_result.ValidatingAirlineCode = ""; // TODO: validation airline code
            _flg_result.ForceETicket = null;
            _flg_result.E_TicketEligibility = "Eligible";
            _flg_result.ServiceFeeAmount = null;

            for (let _itinerary_index = 0; _itinerary_index < _temp_result.length; _itinerary_index++) {
              let itin = _temp_result[_itinerary_index];
              let _index = _temp_index % itin.flights.length;
              _temp_index = Math.floor(_temp_index / itin.flights.length);
              let itin_element = itin.flights[_index];

              _flg_result.GatewayData[_temp_result.length - _itinerary_index - 1] = itin_element.GatewayData;

              _flg_result.TotalPrice += itin_element.TotalPrice;
              _flg_result.Derik += itin_element.Derik;
              _flg_result.Commission = (_flg_result.Commission || itin_element.Commission) ? (_flg_result.Commission ? _flg_result.Commission : 0) + (itin_element.Commission ? itin_element.Commission : 0) : undefined;
              
              
              _flg_result.AdultPrice.BaseFare += itin_element.AdultPrice.BaseFare;
              _flg_result.AdultPrice.Tax += itin_element.AdultPrice.Tax;
              _flg_result.AdultPrice.TotalPrice += itin_element.AdultPrice.TotalPrice;
              _flg_result.AdultPrice.Commission += itin_element.AdultPrice.Commission;

              _flg_result.FinalPrice = itin_element.AdultPrice.TotalPrice + (itin_element.AdultPrice.Commission ? itin_element.AdultPrice.Commission : 0);
              
              _flg_result.ChildPrice.BaseFare += itin_element.ChildPrice.BaseFare;
              _flg_result.ChildPrice.Tax += itin_element.ChildPrice.Tax;
              _flg_result.ChildPrice.TotalPrice += itin_element.ChildPrice.TotalPrice;
              _flg_result.ChildPrice.Commission += itin_element.ChildPrice.Commission;

              _flg_result.InfantPrice.BaseFare += itin_element.InfantPrice.BaseFare;
              _flg_result.InfantPrice.Tax += itin_element.InfantPrice.Tax;
              _flg_result.InfantPrice.TotalPrice += itin_element.InfantPrice.TotalPrice;
              _flg_result.InfantPrice.Commission += itin_element.InfantPrice.Commission;

              let element = itin_element.Itineraries[0];
              let _itinerary = new searchFlightItinerary();

              _itinerary.Price = new itineraryPrice();
              _itinerary.Price.TotalPrice = itin_element.TotalPrice;
              _itinerary.Price.Derik = itin_element.Derik;
              _itinerary.Price.Commission = itin_element.Commission;
              _itinerary.Price.AdultPrice = itin_element.AdultPrice;
              _itinerary.Price.ChildPrice = itin_element.ChildPrice;
              _itinerary.Price.InfantPrice = itin_element.InfantPrice;
              _itinerary.OriginalPrice = itin_element.Itineraries[0].OriginalPrice;

              _itinerary.DirectionId = (_temp_result.length - _itinerary_index - 1).toString();
              let _elapsedTime = timezoneHelper
                .setFromDateTimeWithTimezone(element.Flights[0].DepartureDateTime, element.Flights[0].DepartureAirport.Code)
                .setToDateTimeWithTimezone(element.Flights[element.Flights.length - 1].ArrivalDateTime,
                  element.Flights[element.Flights.length - 1].ArrivalAirport.Code)
                .calculateTimeDiff();
              _itinerary.ElapsedTime = TimeToString.generateTimeStirng(_elapsedTime).replace(":", "");
              _itinerary.RefNumber = _index.toString();
              _itinerary.StopCount = element.Flights.length - 1;
              _itinerary.TotalStopTime = TimeToString.generateTimeStirng(_elapsedTime - element.Flights.reduce((stopTime, flight) => {
                return stopTime + timezoneHelper
                  .setFromDateTimeWithTimezone(flight.DepartureDateTime, flight.DepartureAirport.Code)
                  .setToDateTimeWithTimezone(flight.ArrivalDateTime, flight.ArrivalAirport.Code)
                  .calculateTimeDiff();
              }, 0));
              _itinerary.Flights = element.Flights;
              _itinerary.Gateway = element.Gateway;
              _itinerary.isCharter = element.isCharter;
              _flg_result.Itineraries[_temp_result.length - _itinerary_index - 1] = _itinerary;
            }
            if (this.checkValidFlight(_flg_result))
              _result.flights.push(_flg_result);
          }

          if (searchObj.itineraries.length == 1 || FlightTypeHelper.checkRoundTripFlight(searchObj.itineraries)) {
            tempCalendarResult.forEach((_itin_cal, _itin_index_cal) => {
              _itin_cal.forEach((_cal) => {
                let _tempCal = _temp_result[_itin_index_cal].calendar.find(cal => cal.Date[0] == _cal.Date[0]);
                if (_tempCal) {
                  if (_cal.AdultPrice && _tempCal.AdultPrice > _cal.AdultPrice)
                    _tempCal.AdultPrice = _cal.AdultPrice;
                }
                else
                  _temp_result[_itin_index_cal].calendar.push(_cal);
              })
            });
            // console.log("TCL: MultipleGatewayManager -> searchCallback -> _temp_result", _temp_result)
            if (searchObj.itineraries.length == 1) {
              _result.calendar = _temp_result[0].calendar;
            }
            else {
              _temp_result[0].calendar.forEach(_first_cal => {
                _temp_result[1].calendar.forEach(_second_cal => {
                  if (new Date(_second_cal.Date[0]) > new Date(_first_cal.Date[0]))
                    _result.calendar.push({
                      AdultPrice: _first_cal.AdultPrice + _second_cal.AdultPrice,
                      Currency: _first_cal.Currency,
                      Date: [_first_cal.Date[0].split('T')[0], _second_cal.Date[0].split('T')[0]]
                    });
                });
              });
            }
          }
          // console.log("SASANNNNNNN")
          // console.log("TCL: MultipleGatewayManager -> searchCallback -> _result", _result)
          resolve(_result)
        }
      };

    })
  }

  searchCalendar(gatewayList: gatewaySignitureResult[], searchObj: gatewaySearchInput, loggedInUser: any, options: gatewayInputOptions, exchangeRate: number) {
    return new Promise((resolve: (result: searchCalendarResult[]) => void, reject: (error: errorObj) => void) => {
      let gatewayResultCount: number[] = searchObj.itineraries.map(() => 0);
      let tempCalendarResult: searchCalendarResult[][] = searchObj.itineraries.map(() => []);
      let _temp_result: searchCalendarResult[][] = searchObj.itineraries.map(() => []);
      let _result: searchCalendarResult[] = [];

      if (gatewayList.length) {
        searchObj.itineraries.forEach((_itin, _itin_index) => {
          for (let index = 0; index < gatewayList.length; index++) {
            const element = gatewayList[index];
            if (element.internalCode) {
              let gatewayManager: gatewayMethods = DynamicGatewayFunctionsHelper[element.internalCode];
              let _modified_search_object: gatewaySearchInput = {
                adult: searchObj.adult,
                child: searchObj.child,
                infant: searchObj.infant,
                citizen: searchObj.citizen,
                student: searchObj.student,
                cabin: searchObj.cabin,
                itineraries: [_itin]
              }
              gatewayManager.searchCalendar(element.signiture, _modified_search_object, loggedInUser, options, exchangeRate)
                .then((res) => {
                  searchCallback(res, _itin_index);
                })
                .catch(error => {
                  if (++gatewayResultCount[_itin_index] == gatewayList.length && gatewayResultCount.every(c => c == gatewayList.length))
                    resolve(_result)

                });
            }
            else {
              reject({
                code: "",
                data: {},
                error: "internal code is not defined for gateway " + element.name,
                location: "Multiple Gateways Manager -> Search",
                name: "noProperGateway"
              })
            }
          }
        })
      }
      else
        reject({
          code: "",
          data: {},
          error: "No gateway match given conditions",
          location: "Multiple Gateways Manager -> Search",
          name: "noProperGateway"
        })

      // callback function which is called on gateway response
      let searchCallback = (gatewayResult: searchCalendarResult[], itinIndex: number) => {
        tempCalendarResult[itinIndex] = tempCalendarResult[itinIndex].concat(gatewayResult);

        if (++gatewayResultCount[itinIndex] == gatewayList.length && gatewayResultCount.every(c => c == gatewayList.length)) {

          if (searchObj.itineraries.length == 1 || FlightTypeHelper.checkRoundTripFlight(searchObj.itineraries)) {
            tempCalendarResult.forEach((_itin_cal, _itin_index_cal) => {
              _itin_cal.forEach((_cal) => {
                let _tempCal = _temp_result[_itin_index_cal].find(cal => cal.Date[0] == _cal.Date[0]);
                if (_tempCal) {
                  if (_cal.AdultPrice && _tempCal.AdultPrice > _cal.AdultPrice)
                    _tempCal.AdultPrice = _cal.AdultPrice;
                }
                else
                  _temp_result[_itin_index_cal].push(_cal);
              })
            });

            if (searchObj.itineraries.length == 1) {
              _result = _temp_result[0];
            }
            else {
              _temp_result[0].forEach(_first_cal => {
                _temp_result[1].forEach(_second_cal => {
                  if (new Date(_second_cal.Date[0]) > new Date(_first_cal.Date[0]))
                    _result.push({
                      AdultPrice: _first_cal.AdultPrice + _second_cal.AdultPrice,
                      Currency: _first_cal.Currency,
                      Date: [_first_cal.Date[0].split('T')[0], _second_cal.Date[0].split('T')[0]]
                    });
                });
              });
            }
          }

          resolve(_result)
        }
      };

    })
  }

  getFlightRules(gatewayList: gatewaySignitureResult[], item: gatewayRuleInput, session: gatewaySessionList, options: gatewayInputOptions, exchangeRate: number) {
    return new Promise<gatewayRulesResult[]>((resolve, reject) => {
      let result: gatewayRulesResult[] = [];
      let successCount = 0;
      item.itineraryFlights.forEach((el, ind) => {
        result[ind] = new gatewayRulesResult();
        let tempItem: gatewayRuleInput = {
          combinationId: item.combinationId,
          gatewayData: item.gatewayData[ind],
          itineraryFlights: [el],
          providerType: item.providerType,
          sequenceNumber: item.sequenceNumber
        }
        DynamicGatewayFunctionsHelper[el.gatewayCode].getRules(gatewayList.find(gwy => gwy.internalCode == el.gatewayCode).signiture, tempItem, session[el.gatewayCode], options, exchangeRate)
          .then(dynamicResult => callback(dynamicResult, ind))
          .catch(err => {
            err.data.session = { [el.gatewayCode]: err.data.session };
            reject(err)
          })
      })
      let callback = (helperResult, ind) => {
        result[ind] = helperResult[0];
        if (++successCount == item.itineraryFlights.length)
          resolve(result)
      }
    })
  }

  book(gatewayList: gatewaySignitureResult[], flightBooking: any, session: gatewaySessionList, options: gatewayInputOptions, exchangeRate: number) {
    return new Promise<multipleGatewayBookInternalResult>((resolve, reject) => {
      let result: multipleGatewayBookInternalResult = new multipleGatewayBookInternalResult();
      let successCount = 0;
      let pnr = [];
      let rawData = [];
      let ticketType = [];
      let tempFlightBooking = JSON.parse(JSON.stringify(flightBooking));

      let bookGateway = (ind) => {
        let el = flightBooking.flights.itineraries[ind]
        let gatewayCode = el.gateway.code;
        let gatewayFunctions: gatewayMethods = DynamicGatewayFunctionsHelper[gatewayCode];
        tempFlightBooking.totalPrice = el.price.totalPrice;
        tempFlightBooking.flights.itineraries = [el]
        tempFlightBooking.flights.gatewayData = flightBooking.flights.gatewayData[ind];
        gatewayFunctions.book(gatewayList.find(gwy => gwy.internalCode == gatewayCode).signiture, tempFlightBooking, session[gatewayCode], options, exchangeRate)
          .then(bookResult => {
            callback(bookResult, gatewayCode, ind)
          })
          .catch(err => {
            if (err.data && err.data.session) err.data.session = { [gatewayCode]: err.data.session };
            reject(err)
          })
      }

      bookGateway(0);

      let callback = (bookResult: gatewayBookInternalResult, gatewayCode: string, ind) => {
        if (bookResult.session) result.session[gatewayCode] = bookResult.session;
        pnr[ind] = bookResult.result.pnr;
        rawData[ind] = bookResult.result.rawData;
        ticketType[ind] = bookResult.result.ticketType;
        result.result.totalPrice += bookResult.result.totalPrice;
        result.result.moneyUnit = bookResult.result.moneyUnit;
        if (result.result.ticketTimeLimit == "" || (new Date(result.result.ticketTimeLimit + "Z") > (new Date(bookResult.result.ticketTimeLimit + "Z"))))
          result.result.ticketTimeLimit = bookResult.result.ticketTimeLimit;
        if (result.result.bookDate == "" || (new Date(result.result.bookDate + "Z") < (new Date(bookResult.result.bookDate + "Z"))))
          result.result.bookDate = bookResult.result.bookDate;
        if (++successCount == flightBooking.flights.itineraries.length) {
          result.result.pnr = pnr.reduce((val, el) => val.concat(el))
          result.result.rawData = rawData.reduce((val, el) => val.concat(el))
          result.result.ticketType = ticketType.reduce((val, el) => val.concat(el))
          resolve(result)
        }
        else
          bookGateway(ind + 1)
      }
    })
  }

  createTicket(gatewayList: gatewaySignitureResult[], flightBooking: any, session: gatewaySessionList, options: gatewayInputOptions, exchangeRate: number) {
    return new Promise<multipleGatewayTicketInternalResult>((resolve, reject) => {
      let result: multipleGatewayTicketInternalResult = new multipleGatewayTicketInternalResult();
      let successCount = 0;
      let callSupport = false;
      let rawData = [];
      let tempFlightBooking = JSON.parse(JSON.stringify(flightBooking));

      let createTicketGateway = (ind) => {
        let el = flightBooking.flights.itineraries[ind]
        let gatewayCode = el.gateway.code;
        let gatewayFunctions: gatewayMethods = DynamicGatewayFunctionsHelper[gatewayCode];
        tempFlightBooking.totalPrice = el.price.totalPrice;
        tempFlightBooking.flights.itineraries = [el]
        tempFlightBooking.flights.gatewayData = flightBooking.flights.gatewayData[ind];
        gatewayFunctions.createTicket(gatewayList.find(gwy => gwy.internalCode == gatewayCode).signiture, tempFlightBooking, session[gatewayCode], options, exchangeRate)
          .then(ticketResult => {
            ticketResult.result.tickets.forEach(el => el.flightIndex = ind);
            callback(ticketResult, gatewayCode, ind)
          })
          .catch(err => {
            if (err.data && err.data.session) err.data.session = { [gatewayCode]: err.data.session };
            // reject(err)
            console.log(err);
            let result: gatewayTicketInternalResult = new gatewayTicketInternalResult();
            result.session = null;
            result.result.callSupport = true;
            result.result.data = [err];
            callback(result, gatewayCode, ind);
          })
      }

      createTicketGateway(0);

      let callback = (ticketResult: gatewayTicketInternalResult, gatewayCode: string, ind) => {
        if (ticketResult.session) result.session[gatewayCode] = ticketResult.session;
        rawData[ind] = ticketResult.result.data;
        result.result.tickets = result.result.tickets.concat(ticketResult.result.tickets);
        result.result.callSupport = (result.result.callSupport || callSupport || ticketResult.result.callSupport);
        if (++successCount == flightBooking.flights.itineraries.length) {
          result.result.data = rawData.reduce((val, el) => val.concat(el))
          resolve(result)
        }
        else
          createTicketGateway(ind + 1)
      }

    })
  }

  private checkValidFlight(flight: searchFlightResult): boolean {
    if (flight.Itineraries.some((el, index, itins) => index != 0 && (new Date(el.Flights[0].DepartureDateTime).getTime() - new Date(itins[index - 1].Flights[0].ArrivalDateTime).getTime()) < 3 * 60 * 60 * 1000)) {
      return false;
    }
    else
      return true;
  }
}