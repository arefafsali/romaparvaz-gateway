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
import { RandomNumberGenerator } from "../../Repositories/Utility/RandomNumberGenerator";
const soapRequest = require("easy-soap-request");
const fs = require("fs");
var parseString = require("xml2js").parseString;
const _ = require("lodash");

export class SepehranManager implements IGatewayImplement {

  private signitureData: any;
  private gatewayCode: string;

  public static sessionId: string = "";
  constructor(_signitureData, _gatewayCode: string) {
    //  "user": process.env.SEPEHRAN_USERNAME,
    //"password": process.env.SEPEHRAN_PASSWORD,
    this.gatewayCode = _gatewayCode;
    this.signitureData = {
      ..._signitureData,
      "Language": "fa",
      "Content-Type": "application/json",
    };
  }

  getSearch(item: gatewaySearchInput, session?: gatewaySession, calendarResultNotRequired?: boolean, loggedInUser?: any, options?: gatewayInputOptions) {
    return new Promise((resolve: (result: any) => void, reject: (error: errorObj) => void) => {
      let _result = new gatewaySearchFlightResult();
      let _temp_itineraries = [];
      let _finalSearchItems: gatewaySearchInput[] = [item];
      let _resultCount: number = 0;
      let _gatewayErrors: any[] = [];

      let searchProcess = (item: gatewaySearchInput) => {
        let searchObj: any = {
          "outbound": {
            "date": item.itineraries[0].departDate,
            "departure": item.itineraries[0].origin,
            "arrival": item.itineraries[0].destination
          },

          "adult": item.adult,
          "child": item.child,
          "inf": item.infant
        };
        // if (item.itineraries[1]) {
        //   searchObj = {
        //     ...searchObj,
        //     "return": {
        //       "date": item.itineraries[1].departDate,
        //       "departure": item.itineraries[1].origin,
        //       "arrival": item.itineraries[1].destination
        //     },
        //   }
        // }
        this.callApi(process.env.URL_SEPEHRAN_LOWFARESEARCH, searchObj)
          .then((_availability_result: any) => {
            let _body: any = _availability_result;

            if (_body.status != "success") {
              _gatewayErrors.push({
                code: "",
                data: _body.err[0].msg,
                error: "gateway Error",
                location: `${this.gatewayCode} manager -> get Search -> callApi (availability)`,
                name: "InvalidResponse"
              });
              allSearchCallback();
            }
            else {
              if (_body.outbound.length === 0) {
                _gatewayErrors.push({
                  code: "",
                  data: _body,
                  error: `no flight available for ${item.itineraries[0].origin} to ${item.itineraries[0].destination}`,
                  location: `${this.gatewayCode} manager -> get Search -> _body[AvailableFlights].length`,
                  name: "NoFlightAvailable"
                });
                allSearchCallback();
              }
              else {
                _temp_itineraries = _temp_itineraries.concat(_body.outbound) // TODO: sasan: _body.return ????
                allSearchCallback();
              }
            }
          })
          .catch(error => {
            _gatewayErrors.push({
              code: "",
              data: error,
              error: "gateway Error",
              location: `${this.gatewayCode} manager -> get Search -> callApi (availability)`,
              name: "InvalidResponse"
            });
            allSearchCallback();
          })

      }

      let allSearchCallback = () => {
        if (++_resultCount == _finalSearchItems.length) {
          if (_temp_itineraries.length == 0) {
            reject({
              code: "",
              data: _gatewayErrors,
              error: `no flight available`,
              location: `${this.gatewayCode} manager -> get Search -> _body[AvailableFlights].length`,
              name: "NoFlightAvailable"
            });
            return;
          }
          else {
            searchCallback();
          }
        }
      }

      let searchCallback = () => {
        let totalFlightCount = _temp_itineraries.length;
        let timezoneHelper = new IataTimezonesHelper();

        _temp_itineraries.forEach((flight) => {
          let _flg_result = new searchFlightResult();
          _flg_result.Currency = flight.currency_code
          _flg_result.ProviderType = `${this.gatewayCode}Provider`; // ?
          _flg_result.SequenceNumber = null; // ?
          _flg_result.CombinationId = "0";
          _flg_result.ValidatingAirlineCode = "B9";
          _flg_result.ForceETicket = null;
          _flg_result.E_TicketEligibility = "Eligible";
          _flg_result.ServiceFeeAmount = null;

          _flg_result.TotalPrice = (item.adult * (flight.passenger_fare.adult.fare + (flight.passenger_fare.adult.tax || 0)))
            + (item.child * (flight.passenger_fare.child.fare + (flight.passenger_fare.child.tax || 0)))
            + (item.infant * (flight.passenger_fare.infant.fare + (flight.passenger_fare.infant.tax || 0)));
           // _flg_result.TotalPrice =  flight.price;

          _flg_result.Derik = 0;

          _flg_result.AdultPrice.TotalPrice = flight.passenger_fare.adult.fare + (flight.passenger_fare.adult.tax || 0);
          _flg_result.AdultPrice.BaseFare = flight.passenger_fare.adult.fare;
          _flg_result.AdultPrice.Tax = flight.passenger_fare.adult.tax || 0; //?

          _flg_result.ChildPrice.TotalPrice = flight.passenger_fare.child.fare + (flight.passenger_fare.child.tax || 0)
          _flg_result.ChildPrice.BaseFare = flight.passenger_fare.child.fare;
          _flg_result.ChildPrice.Tax = flight.passenger_fare.child.tax || 0; //?

          _flg_result.InfantPrice.TotalPrice = flight.passenger_fare.infant.fare + (flight.passenger_fare.infant.tax || 0);
          _flg_result.InfantPrice.BaseFare = flight.passenger_fare.infant.fare;
          _flg_result.InfantPrice.Tax = flight.passenger_fare.infant.tax || 0; //?

          let _itinerary = new searchFlightItinerary();
          _itinerary.DirectionId = "0";
          _itinerary.ElapsedTime = flight.duration.slice(0, 5).replace(":", "");
          _itinerary.RefNumber = null;
          _itinerary.StopCount = 0;
          _itinerary.isCharter = false;
          //  TODO: StopTime   for "direction", "connection" ?
          _itinerary.TotalStopTime = (flight.flight_type == "Nonstop" ? TimeToString.generateTimeStirng(0) : TimeToString.generateTimeStirng(0))

          // Save Original Price for booking
          _itinerary.OriginalPrice = {
            TotalPrice: _flg_result.TotalPrice,
            AdultPrice: {..._flg_result.AdultPrice},
            ChildPrice: {..._flg_result.ChildPrice},
            InfantPrice: {..._flg_result.InfantPrice}
          }

          let _itineraryFlight = new itineraryFlightSegment();
          // console.log("KJBEFKUBKUEFKE",flight.ref_number,flight.passenger_fare.adult)
          _itineraryFlight.GatewayData = flight.ref_number;
          _itineraryFlight.DepartureDateTime = `${flight.departure.date}T${flight.departure.time}.000Z`;
          _itineraryFlight.ArrivalDateTime = `${flight.arrival.date}T${flight.arrival.time}.000Z`;
          _itineraryFlight.FlightNumber = flight.flight_details.flight_number;
          _itineraryFlight.ResBookDesigCode = flight.flight_details.class.toUpperCase(); // TODO : ask Ali is it correct?
          _itineraryFlight.FlightDuration = flight.duration
          _itineraryFlight.DepartureAirport.Code = flight.departure.location_code;
          _itineraryFlight.DepartureAirport.Terminal = (flight.departure.terminal ? flight.departure.terminal.toString() : null);
          _itineraryFlight.ArrivalAirport.Code = flight.arrival.location_code;
          _itineraryFlight.ArrivalAirport.Terminal = (flight.arrival.terminal ? flight.arrival.terminal.toString() : null);
          _itineraryFlight.MarketingAirline.Code = flight.flight_details.airline;
          _itineraryFlight.OperatingAirline.Code = flight.flight_details.airline_operating || flight.flight_details.airline;
          _itineraryFlight.Equipment.Code = ""; // ? 
          _itineraryFlight.Equipment.Name.en = flight.flight_details.airplane.toUpperCase();
          _itineraryFlight.Equipment.Name.fa = flight.flight_details.airplane.toUpperCase();
          _itineraryFlight.BookingClassAvails = {
            ResBookDesigCode: flight.flight_details.class.toUpperCase(),
            ResBookDesigQuantity: flight.capacity,
            RPH: flight.flight_details.class.toUpperCase(),
            AvailablePTC: "ADT",
            ResBookDesigCabinCode: flight.flight_details.cabin.toUpperCase(),
            FareBasis: null,
            FareType: null,
            ResBookDesigCabinName: new nameObject()
          }
          _itineraryFlight.Baggage = [
            {
              Index: "0",
              Quantity: "20",
              Type: "ADT",
              Unit: "KG"
            },
            {
              Index: "1",
              Quantity: "20",
              Type: "CHD",
              Unit: "KG"
            },
            {
              Index: "2",
              Quantity: "10",
              Type: "INF",
              Unit: "KG"
            }
          ]; //TODO
          _itineraryFlight.StopLocation = [];
          _itinerary.Flights[0] = _itineraryFlight;
          _flg_result.Itineraries[0] = _itinerary;
          _result.flights.push(_flg_result);
        })
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
      // console.log("Sepehran ITEM ::", item)
      this.extractAllOriginDestionationOptions(item)
        .then(result => { _finalSearchItems = result; })
        .catch(err => { })
        .finally(() => {
          _finalSearchItems.forEach((el, ind) => {
            // console.log("ُSepehran", el)
            searchProcess(el);
          })
        })

    })
  };

  book(booking: any, session?: gatewaySession, options?: gatewayInputOptions) {
    return new Promise<gatewayBookInternalResult>((resolve, reject) => {
      let resultCount = 0;
      let finalResult = new gatewayBookInternalResult();
      finalResult.session = null;
      booking.flights.itineraries[0].flights.forEach((_flg, _flg_ind) => {
        let refNumber = _flg.gatewayData;
        
        let requestValues = {
          outbound: {
            "ref_number": refNumber,
            "departure": _flg.departureAirport.code,
            "arrival": _flg.arrivalAirport.code,
            "date": _flg.departureDateTime.replace(".000Z","")
          },
          price: {
            "currency_code": booking.moneyUnit.moneyUnit,
            "total": booking.flights.itineraries[0].originalPrice.totalPrice
          },
          passengers: booking.passengers.map(passenger => ({
            type: (passenger.type == "adult" ? "ADT" : (passenger.type == "child" ? "CHD" : "INF")),
            "gender": (passenger.isMale ? "M" : "F"),
            "accompanied_by_infant": false,
            "given_name": passenger.firstName,
            "surname": passenger.lastName,
            "birthdate": passenger.birthDate,
            "telephone": booking.issuerContactInfo.mobile,
            "email": booking.issuerContactInfo.email,
            "nationality": passenger.nationality.code,
            "national_id": passenger.nationalCode,
            "passport": {
              "id": passenger.passportNo,
              "expire_date": passenger.passportExpireDate,
              "doc_issue_country": passenger.passportCountry
            },
          }))
        };
        //  the number of adults, accompanied_by_infant= true should be the same as infants number 
        let infant_num = booking.flights.infantCount;
        requestValues.passengers.map(passenger => {
          if (passenger.type == "ADT" && infant_num > 0) {
            passenger.accompanied_by_infant = true;
            infant_num--;
          }
        })
        this.callApi(process.env.URL_SEPEHRAN_BOOK, requestValues)
          .then((reserveResult: any) => {
            console.log(reserveResult)
            if (reserveResult.status == "success")
              bookingCallback(_flg_ind, reserveResult);
            else
              reject({
                code: "",
                data: reserveResult,
                error: reserveResult.err[0]["msg"] + ` | Segment ${_flg.departureAirport
                  .cityCode} to ${_flg.arrivalAirport.cityCode}`,
                location: `${this.gatewayCode} manager -> book -> callApi (book) -> + ` + ` | Segment ${_flg.departureAirport.cityCode} to ${_flg.arrivalAirport.cityCode}`,
                name: "Error in booking"
              });
            return;
          })
          .catch(error => {
            reject({
              code: "",
              data: requestValues,
              error: error.stack,
              location: `${this.gatewayCode} manager -> book -> callApi (book) -> ` + ` | Segment ${_flg.departureAirport.cityCode} to ${_flg.arrivalAirport.cityCode}`,
              name: "InvalidResponse"
            });
            return;
          })

      });
      // Here
      let bookingCallback = (index: number, result: any) => {
        let ticketTimeLimit = new Date();
        ticketTimeLimit.setMinutes(ticketTimeLimit.getMinutes() + 10);
        finalResult.result.rawData[index] = result;
        finalResult.result.pnr[index] = result.refrence_id;
        finalResult.result.ticketType[index] = "";
        if (finalResult.result.ticketTimeLimit == "" || (new Date(finalResult.result.ticketTimeLimit + "Z") > ticketTimeLimit))
          finalResult.result.ticketTimeLimit = ticketTimeLimit.toISOString().replace('Z', '');
        if (++resultCount == booking.flights.itineraries.length) {
          finalResult.result.pnr = [finalResult.result.pnr.join("|")]
          finalResult.result.rawData = [finalResult.result.rawData]
          finalResult.result.totalPrice = booking.flights.itineraries[0].price ? booking.flights.itineraries[0].price.totalPrice : booking.totalPrice;
          finalResult.result.bookDate = new Date().toISOString();
          finalResult.result.moneyUnit = booking.moneyUnit.moneyUnit;
          resolve(finalResult)
        }
      }
    })
  }

  createTicket(booking: any, session?: gatewaySession, options?: gatewayInputOptions) {
    return new Promise<gatewayTicketInternalResult>((resolve, reject) => {
      //console.log({ booking_SEPEHRAN_PNR: booking.flights.itineraries[0].pnr })
      let resultCount = 0;
      let finalResult = new gatewayTicketInternalResult();
      let ticketTempData = [];
      finalResult.session = null;
      booking.flights.itineraries.forEach((el, ind) => {
        let refID = booking.flights.itineraries[0].pnr;
        const requestValues = { "reference": refID };
        this.callApi(process.env.URL_SEPEHRAN_CONFIRM, requestValues).then((reserveResult_Confirm: any) => {
          // console.log({ reserveResult_Confirm })
          this.callApi(process.env.URL_SEPEHRAN_AIRDEMAND, requestValues)
            .then((reserveResult: any) => {
              //console.log({ SEPEHRAN_TICKET_RESULT: reserveResult })
              if (reserveResult.status == "success") {
                ticketCallback(ind, reserveResult);
              }
              else
                reject({
                  code: "",
                  data: process.env.URL_SEPEHRAN_AIRDEMAND,
                  error: reserveResult.AirReserve[0].Error + ` | Segment ${el.flights[0].departureAirport.cityCode} to ${el.flights[el.flights.length - 1].arrivalAirport.cityCode}`,
                  location: `${this.gatewayCode} manager -> createTicket -> callApi (createTicket) -> ` + ` | Segment ${el.flights[0].departureAirport.cityCode} to ${el.flights[el.flights.length - 1].arrivalAirport.cityCode}`,
                  name: "Error in createTicket"
                });
              return;
            })
            .catch(error => {
              reject({
                code: "",
                data: process.env.URL_SEPEHRAN_AIRDEMAND,
                error: error,
                location: `${this.gatewayCode} manager -> createTicket -> callApi (createTicket) -> ` + ` | Segment ${el.flights[0].departureAirport.cityCode} to ${el.flights[el.flights.length - 1].arrivalAirport.cityCode}`,
                name: "InvalidResponse"
              });
              return;
            })
        }).catch(error => {
          reject({
            code: "",
            data: process.env.URL_SEPEHRAN_AIRDEMAND,
            error: error,
            location: `${this.gatewayCode} manager -> createTicket -> callApi (createTicket) -> ` + ` | Segment ${el.flights[0].departureAirport.cityCode} to ${el.flights[el.flights.length - 1].arrivalAirport.cityCode}`,
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
            ticketNumber: result.tickets.find(el => el.national_id == pass.nationalCode).ticket_number,
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



  private callApi(url: string, body: any) {
    return new Promise((resolve, reject) => {
      // for all Apis we need to retrieve a token first
      ExternalRequest.syncPostRequest(process.env.URL_SEPEHRAN_GETTOKEN, undefined, undefined, undefined, undefined, undefined, undefined, this.signitureData)
        .then((result_token: any) => {
          let headersValues = {
            "Client-Token": result_token.client_token,
            "Content-Type": "application/json",
          }
          ExternalRequest.syncPostRequest(url, undefined, body, undefined, undefined, undefined, undefined, headersValues)
            .then((sepehranResult: any) => {
              // if the called Api is for Low Fare searching , it needs to call another Api with returned "request_id" from the first api
              if (url == process.env.URL_SEPEHRAN_LOWFARESEARCH) {
                if (sepehranResult.status == "error") {
                  // console.log("error Sepehran calling api", sepehranResult.err[0]["msg"])
                  reject(sepehranResult.err[0]["msg"]);
                }
                let requestValues_id = {
                  "request_id": sepehranResult.request_code
                }
                ExternalRequest.syncPostRequest(process.env.URL_SEPEHRAN_FARESEARCHRESULT, undefined, requestValues_id, undefined, undefined, undefined, undefined, headersValues)
                  .then((sepehran_Result: any) => {
                    resolve(sepehran_Result);
                  })
              }
              else resolve(sepehranResult);
            })
            .catch((error) => {
              // console.log("error Sepehran calling api", error)
              reject(error);
            });
        })
        .catch((error) => {
          // console.log("error Sepehran token", error)
          reject(error);
        });
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




  getSearchCalendar(item: gatewaySearchInput, loggedInUser?: any, options?: gatewayInputOptions) {
    return new Promise((resolve: (result: searchCalendarResult[]) => void, reject: (error: errorObj) => void) => {
      // let calendarResultCount = 0;
      // let totalCalendarResult = item.itineraries.length * 7;
      // let calendarResult: searchCalendarResult[] = [];
      // if (item.itineraries.length > 2 || (item.itineraries.length == 2 && !FlightTypeHelper.checkRoundTripFlight(item.itineraries))) {
      reject(new errorObj("searchCalendarMultiLegError",
        "",
        "SearchFlightCalendar method is not allowed with MultiLeg",
        "IranAirTour Manager -> Search Calendar"))
      // }
      // else {
      //   item.itineraries.forEach(itinerary => {
      //     let today = new Date((new Date()).toISOString().split("T")[0] + "T10:00:00");
      //     let date = new Date(itinerary.departDate + "T10:00:00");
      //     if (Math.floor(Math.abs(date.getTime() - today.getTime()) / (1000 * 3600 * 24)) < 3) {
      //       today.setDate(today.getDate() + 3);
      //       itinerary.departDate = today.toISOString().split("T")[0];
      //     }
      //   });
      //   item.itineraries.forEach((_itin, _itin_index) => {
      //     for (let dateOffset = -3; dateOffset <= +3; dateOffset++) {
      //       let date = new Date(_itin.departDate);
      //       date.setDate(date.getDate() + dateOffset);
      //       let _modified_item: gatewaySearchInput = {
      //         ...item
      //         , itineraries: item.itineraries.map(_temp_itin => { return { ..._temp_itin } })
      //       }
      //       _modified_item.itineraries[_itin_index].departDate = date.toISOString().split("T")[0];
      //       this.getSearch(_modified_item, undefined, true)
      //         .then(_result => {
      //           let _flight: searchFlightResult = _(_result.flights).orderBy('TotalPrice').value()[0];
      //           calendarResult.push({
      //             AdultPrice: _flight.AdultPrice.TotalPrice,
      //             Currency: _flight.Currency,
      //             Date: _flight.Itineraries.map(_itin => _itin.Flights[0].DepartureDateTime.split("T")[0])
      //           })
      //           if (++calendarResultCount == totalCalendarResult)
      //             resolve(calendarResult);
      //         })
      //         .catch(_error => {
      //           if (++calendarResultCount == totalCalendarResult)
      //             resolve(calendarResult);
      //         })
      //     }
      //   })
      // }
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

  private generatePassengerList(passengers: any[], issuerContactInfo: any, isInternational: boolean) {
    let infantCount = passengers.filter(pas => pas.type == "infant").length;
    return passengers.map(pass => {
      return {
        AccompaniedByInfantInd: infantCount-- > 0,
        BirthDate: pass.birthDate,
        Gender: pass.isMale ? 0 : 1, // Male:0 ,Female:1 
        PassengerTypeCode: this.convertPassengerType(pass.type),
        PersonName: {
          // NamePrefix: null,
          GivenName: pass.firstName,
          Surname: pass.lastName
        },
        Telephone: {
          // CountryAccessCode: null,
          // AreaCityCode: null,
          PhoneNumber: issuerContactInfo.mobile
        },
        Email: {
          Value: issuerContactInfo.email ? issuerContactInfo.email : process.env.ETICKET_DEFAULT_EMAIL
        },
        Document: {
          DocHolderNationality: pass.nationality.code,
          ExpireDate: isInternational ? pass.passportExpireDate : null,
          DocIssueCountry: pass.passportCountry,
          DocType: isInternational ? 2 : 5, // Passport: 2, ID card: 5
          DocID: isInternational ? pass.passportNo : pass.nationalCode,
          // BirthCountry: null,
        }
      }
    })
  }

  getPing: () => Promise<string>;

  getCancel: (item: any, callback: (error: any, result: any) => void) => void;

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

Object.seal(SepehranManager);