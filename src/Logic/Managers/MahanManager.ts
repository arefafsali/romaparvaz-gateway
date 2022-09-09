import { errorObj } from "../../Common/Metadata/errorObjMetadata";
import { gatewayBookInternalData, gatewayBookInternalResult } from "../../Common/Metadata/gatewayBookResultMetadata";
import { gatewayInputOptions, gatewayLogicOutput, gatewayRuleInput, gatewaySearchInput, gatewaySearchInputItinerary, mahanSession } from "../../Common/Metadata/gatewayLogicInputMetadata";
import { gatewayRulesResult } from "../../Common/Metadata/gatewayRulesResultMetadata";
import { gatewaySearchFlightResult, itineraryFlightSegment, nameObject, priceObject, searchCalendarResult, searchFlightItinerary, searchFlightResult } from "../../Common/Metadata/gatewaySearchResultMetadata";
import { gatewayTicketInternalResult } from "../../Common/Metadata/gatewayTicketResultMetadata";
import { ExternalRequest } from "../../Infrastructure/ExternalRequests";
import { IGatewayImplement } from "../../Repositories/Contracts/IGatewayImplement";
import { CancelingRuleHelper } from "../../Repositories/Utility/CancelingRuleHelper";
import { FlightTypeHelper } from "../../Repositories/Utility/FlightTypeHelper";
import { MarkupHelper } from "../../Repositories/Utility/MarkupHelper";
import { TimeToString } from "../../Repositories/Utility/TimeToString";

const soapRequest = require("easy-soap-request");
const fs = require("fs");
var parseString = require("xml2js").parseString;
const _ = require("lodash");
const sessionMaxTime = parseInt(process.env.MAHAN_MAX_SESSION_TIME);
const sessionMainName = process.env.MAHAN_SESSION_MAIN_COOKIE_NAME + "=";
const terminalId = process.env.MAHAN_TERMINAL_ID;

const baggages = {
  intC: [{
    Index: "1",
    Quantity: "40",
    Type: "ADT",
    Unit: "KG"
  }, {
    Index: "2",
    Quantity: "40",
    Type: "CHD",
    Unit: "KG"
  }, {
    Index: "3",
    Quantity: "10",
    Type: "INF",
    Unit: "KG"
  }],
  int: [{
    Index: "1",
    Quantity: "30",
    Type: "ADT",
    Unit: "KG"
  }, {
    Index: "2",
    Quantity: "30",
    Type: "CHD",
    Unit: "KG"
  }, {
    Index: "3",
    Quantity: "10",
    Type: "INF",
    Unit: "KG"
  }],
  domesticC: [{
    Index: "1",
    Quantity: "25",
    Type: "ADT",
    Unit: "KG"
  }, {
    Index: "2",
    Quantity: "25",
    Type: "CHD",
    Unit: "KG"
  }, {
    Index: "3",
    Quantity: "10",
    Type: "INF",
    Unit: "KG"
  }],
  domestic: [{
    Index: "1",
    Quantity: "20",
    Type: "ADT",
    Unit: "KG"
  }, {
    Index: "2",
    Quantity: "20",
    Type: "CHD",
    Unit: "KG"
  }, {
    Index: "3",
    Quantity: "10",
    Type: "INF",
    Unit: "KG"
  }]
}

export class MahanManager implements IGatewayImplement {

  private signitureData: {
    username: string,
    password: string,
    officeId: string
    uniqueIdType: string,
    bookingChannelType: string
  };

  constructor(signitureData) {
    if (!signitureData)
      signitureData = {
        "username": "Mahan",
        "password": "123456",
        "officeId": "THR572",
        "bookingChannelType": "12",
        "uniqueIdType": "5",
        "moneyUnit": "5c6a7107e8a2a14358df03d3"
      }
    this.signitureData = signitureData;
  }

  getSearch(item: gatewaySearchInput, session: mahanSession, calendarResultNotRequired?: boolean, loggedInUser?: any, options?: gatewayInputOptions) {
    return new Promise((resolve: (result: gatewaySearchFlightResult) => void, reject: (error: errorObj) => void) => {
      let _finalSearchItems: gatewaySearchInput[] = [item];
      let _resultCount: number = 0;
      let _finalResult: gatewaySearchFlightResult = new gatewaySearchFlightResult();
      let _gatewayErrors: any[] = [];

      let calculateMarkup = () => {
        MarkupHelper.calculateMarkup(loggedInUser, "mahan", item, _finalResult, options)
          .then((newResult: gatewaySearchFlightResult) => {
            resolve(newResult);
          })
          .catch(err => {
            console.log(err)
            // error on fetch markup
            // return bare result for now
            resolve(_finalResult);
          })
      }

      let priceCallback = () => {
        if (++_resultCount == _finalSearchItems.length * 2)
          if (_finalResult.flights.length > 0)
            // if (item.itineraries.length == 1 || (item.itineraries.length == 2 && FlightTypeHelper.checkRoundTripFlight(item.itineraries)))
            //   this.getSearchCalendar(item)
            //     .then(cal_result => {
            //       _finalResult.calendar = cal_result;
            //       calculateMarkup();
            //     })
            //     .catch(error => {
            //       console.log(error);
            //       if (error.name == "searchCalendarMultiLegError")
            //         calculateMarkup();
            //       else
            //         reject(error);
            //     })
            // else
            calculateMarkup()
          else
            reject(new errorObj("mahanSearchError",
              "",
              "check error data",
              "Mahan Manager -> Search",
              _gatewayErrors))
      };

      let searchCallBack = (modifiedItem: gatewaySearchInput, result: gatewayLogicOutput, businessClass: boolean) => {
        if (result.session)
          _finalResult.session = result.session;
        if (result.body) {
          // Find the body for checking error in it
          let _body = result.body["soap:Envelope"]["soap:Body"][0]["ns1:OTA_AirAvailRS"][0];
          if (_body["ns1:Success"]) {
            let priceCount = 0;
            let matrix: any[] = this.generateFlightItineraries(modifiedItem, _body["ns1:OriginDestinationInformation"]);
            if (matrix.length == 0)
              priceCallback();
            let nextStep = () => {
              if (++priceCount == matrix.length)
                priceCallback();
            };
            //matrix generation for multicity
            matrix.map((flight, ind) => {
              this.callGetPrice(modifiedItem, flight["ns1:OriginDestinationOptions"][0]["ns1:OriginDestinationOption"], <mahanSession>result.session, businessClass)
                .then(priceResult => {
                  let cabin = businessClass ? "C" : "Y";
                  // Check dismiss economy when cabin is business and first
                  // if((item.cabin === "Business" || item.cabin === "First") && cabin === "Y")
                  //   return;

                  // Check dismiss business and first when flight is in local and is on economy class
                  // if((item.cabin === "Economy" && (item.itineraries[0].originCountryCode !== "IR" || item.itineraries[0].destinationCountryCode !== "IR")) && (cabin === "C" || cabin === "F"))
                  //   return;
                  let _priceBody = priceResult.body["soap:Envelope"]["soap:Body"][0]["ns1:OTA_AirPriceRS"][0];
                  if (_priceBody["ns1:Success"]) {
                    _priceBody = _priceBody["ns1:PricedItineraries"][0]["ns1:PricedItinerary"][0];
                    let _flightData = new searchFlightResult();
                    let generatePriceObject = fare => {
                      let _fareResult = new priceObject();
                      if (fare) {
                        _fareResult.BaseFare = parseFloat(fare["ns1:PassengerFare"][0]["ns1:BaseFare"][0].$.Amount);
                        _fareResult.Tax = (fare["ns1:PassengerFare"][0]["ns1:Taxes"][0]["ns1:Tax"] ? fare["ns1:PassengerFare"][0]["ns1:Taxes"][0]["ns1:Tax"].reduce((a, b) => a + parseFloat(b.$.Amount), 0) : 0)
                          + (fare["ns1:PassengerFare"][0]["ns1:Fees"][0]["ns1:Fee"] ? fare["ns1:PassengerFare"][0]["ns1:Fees"][0]["ns1:Fee"].reduce((a, b) => a + parseFloat(b.$.Amount), 0) : 0);
                        _fareResult.TotalPrice = parseFloat(fare["ns1:PassengerFare"][0]["ns1:TotalFare"][0].$.Amount);
                        _fareResult.TicketDesignators = [];
                      }
                      return _fareResult;
                    };

                    _flightData.Currency = "IRR";
                    _flightData.ProviderType = "MahanProvider";
                    _flightData.GatewayData = { transactionId: (<mahanSession>result.session).transactionId, sessionId: (<mahanSession>result.session).sessionId, modifiedItem, businessClass };
                    _flightData.SequenceNumber = ind.toString();
                    _flightData.CombinationId = "0";
                    _flightData.ValidatingAirlineCode = process.env.MAHAN_AIRLINE_CODE;
                    _flightData.ForceETicket = null;
                    _flightData.E_TicketEligibility = "Eligible";
                    _flightData.ServiceFeeAmount = null;
                    _flightData.TotalPrice = parseFloat(_priceBody["ns1:AirItineraryPricingInfo"][0]["ns1:ItinTotalFare"][0]["ns1:TotalFare"][0].$.Amount);
                    _flightData.AdultPrice = generatePriceObject(_priceBody["ns1:AirItineraryPricingInfo"][0]["ns1:PTC_FareBreakdowns"][0]["ns1:PTC_FareBreakdown"]
                      .find(fare => fare["ns1:PassengerTypeQuantity"][0].$.Code == "ADT"));
                    _flightData.ChildPrice = generatePriceObject(_priceBody["ns1:AirItineraryPricingInfo"][0]["ns1:PTC_FareBreakdowns"][0]["ns1:PTC_FareBreakdown"]
                      .find(fare => fare["ns1:PassengerTypeQuantity"][0].$.Code == "CHD"));
                    _flightData.InfantPrice = generatePriceObject(_priceBody["ns1:AirItineraryPricingInfo"][0]["ns1:PTC_FareBreakdowns"][0]["ns1:PTC_FareBreakdown"]
                      .find(fare => fare["ns1:PassengerTypeQuantity"][0].$.Code == "INF"));

                    (Object.keys(flight.groupedData)).forEach((direction) => {
                      let _itinerary = new searchFlightItinerary();
                      _itinerary.DirectionId = direction;
                      _itinerary.ElapsedTime = this.extractJourneyDuration(flight.groupedData[direction]);
                      _itinerary.RefNumber = "";
                      _itinerary.StopCount = flight.groupedData[direction].length - 1;
                      let _tempStopTime = 0;

                      // Save Original Price for booking
                      _itinerary.OriginalPrice = {
                        TotalPrice: _flightData.TotalPrice,
                        AdultPrice: {..._flightData.AdultPrice},
                        ChildPrice: {..._flightData.ChildPrice},
                        InfantPrice: {..._flightData.InfantPrice}
                      }

                      flight.groupedData[direction].forEach((itin, index) => {
                        if (index > 0)
                          _tempStopTime +=
                            new Date(itin["ns1:FlightSegment"][0].$.DepartureDateTime).getTime() - new Date(flight.groupedData[direction][index - 1]["ns1:FlightSegment"][0].$.ArrivalDateTime).getTime();
                        let _itineraryFlight = new itineraryFlightSegment();
                        _itineraryFlight.DepartureDateTime = itin["ns1:FlightSegment"][0].$.DepartureDateTime;
                        _itineraryFlight.ArrivalDateTime = itin["ns1:FlightSegment"][0].$.ArrivalDateTime;
                        _itineraryFlight.FlightNumber = itin["ns1:FlightSegment"][0].$.FlightNumber;
                        _itineraryFlight.GatewayData = JSON.stringify({
                          flightSegment: itin["ns1:FlightSegment"],
                          rules: _priceBody["ns1:AirItineraryPricingInfo"][0]["ns1:PTC_FareBreakdowns"][0]["ns1:PTC_FareBreakdown"]
                            .find(fare => fare["ns1:PassengerTypeQuantity"][0].$.Code == "ADT")["ns1:FareInfo"]
                            .find(fare => fare.$.SegmentCode.indexOf(_itineraryFlight.DepartureAirport.Code + "/" + _itineraryFlight.ArrivalAirport.Code) >= 0)["ns1:FareRuleReference"][0]
                        });
                        _itineraryFlight.FlightDuration = this.extractJourneyDuration([itin]);
                        _itineraryFlight.DepartureAirport.Code = itin["ns1:FlightSegment"][0]["ns1:DepartureAirport"][0].$.LocationCode;
                        _itineraryFlight.DepartureAirport.Terminal = itin["ns1:FlightSegment"][0]["ns1:DepartureAirport"][0].$.Terminal; // TODO : Result must be checked
                        _itineraryFlight.ArrivalAirport.Code = itin["ns1:FlightSegment"][0]["ns1:ArrivalAirport"][0].$.LocationCode;
                        _itineraryFlight.ArrivalAirport.Terminal = itin["ns1:FlightSegment"][0]["ns1:ArrivalAirport"][0].$.Terminal;
                        _itineraryFlight.MarketingAirline.Code = process.env.MAHAN_AIRLINE_CODE;
                        _itineraryFlight.OperatingAirline.Code = process.env.MAHAN_AIRLINE_CODE;
                        _itineraryFlight.Equipment.Code = "";
                        _itineraryFlight.Baggage = businessClass ? (FlightTypeHelper.checkInternationalItinarary(modifiedItem.itineraries[parseInt(direction)]) ? baggages.intC : baggages.domesticC)
                          : (FlightTypeHelper.checkInternationalItinarary(modifiedItem.itineraries[parseInt(direction)]) ? baggages.int : baggages.domestic);
                        _itineraryFlight.StopLocation = [];

                        let bookingClass = _priceBody["ns1:AirItineraryPricingInfo"][0]["ns1:PTC_FareBreakdowns"][0]["ns1:PTC_FareBreakdown"]
                          .find(fare => fare["ns1:PassengerTypeQuantity"][0].$.Code == "ADT")["ns1:FareInfo"]
                          .find(fare => fare.$.SegmentCode.indexOf(_itineraryFlight.DepartureAirport.Code + "/" + _itineraryFlight.ArrivalAirport.Code) >= 0).$;

                        _itineraryFlight.ResBookDesigCode = bookingClass.ResBookDesigCode;
                        _itineraryFlight.BookingClassAvails = {
                          ResBookDesigCode: bookingClass.ResBookDesigCode,
                          ResBookDesigQuantity: "", // TODO
                          RPH: "ADT",
                          AvailablePTC: "ADT",
                          ResBookDesigCabinCode: businessClass ? "C" : "Y",
                          FareBasis: bookingClass.FareBasisCode,
                          FareType: bookingClass.FareRuleInfo,
                          ResBookDesigCabinName: new nameObject()
                        };
                        _itinerary.Flights.push(_itineraryFlight);
                      })
                      _itinerary.TotalStopTime = TimeToString.generateTimeStirng(_tempStopTime);
                      _itinerary.ElapsedTime = this.addStopTimeToElapsedTime(_itinerary.ElapsedTime, _itinerary.TotalStopTime);
                      _flightData.Itineraries[parseInt(direction)] = _itinerary;
                    })
                    _finalResult.flights.push(_flightData);
                  }
                  nextStep();
                })
                .catch(err => { console.log(err); nextStep(); })
            })
          }
          else if (_body["ns1:Errors"][0]["ns1:Error"] && _body["ns1:Errors"][0]["ns1:Error"][0] && _body["ns1:Errors"][0]["ns1:Error"][0].$) {
            _gatewayErrors.push(_body["ns1:Errors"][0]["ns1:Error"][0].$.ShortText)
            priceCallback();
          }
          else
            priceCallback();
        }
        else
          priceCallback();
      };

      let callSearch = () => {
        _finalSearchItems.forEach((el, ind) => {
          this.callSearchApi(el, session, false)
            .then(result => searchCallBack(el, result, false))
            .catch(error => searchCallBack(el, new gatewayLogicOutput(), false))
          this.callSearchApi(el, session, true)
            .then(result => searchCallBack(el, result, true))
            .catch(error => searchCallBack(el, new gatewayLogicOutput(), true))
        })
      };

      this.extractAllOriginDestionationOptions(item)
        .then(result => {
          _finalSearchItems = result;
          callSearch();
        })
        .catch(err => callSearch())

    })
  }

  getSearchCalendar(item: gatewaySearchInput, loggedInUser?: any, options?: gatewayInputOptions) {
    return new Promise((resolve: (result: searchCalendarResult[]) => void, reject: (error: errorObj) => void) => {
      let modifiedItem = JSON.parse(JSON.stringify(item));
      modifiedItem.itineraries.forEach(itinerary => {
        let today = new Date((new Date()).toISOString().split("T")[0] + "T10:00:00");
        let date = new Date(itinerary.departDate);
        if (Math.floor(Math.abs(date.getTime() - today.getTime()) / (1000 * 3600 * 24)) < 3) {
          today.setDate(today.getDate() + 3);
          date = new Date(today.toISOString().split("T")[0]);
          itinerary.departDate = today.toISOString().split("T")[0];
        }
      });
      let _finalSearchItems: gatewaySearchInput[] = [modifiedItem];
      let _resultCount = 0;
      let _calResult: searchCalendarResult[] = [];
      let _gatewayErrors = [];

      let calculateMarkup = () => {
        // MarkupHelper.calculateCalendarMarkup(loggedInUser, "amadeus", item, result, options)
        //   .then((newResult: searchCalendarResult[]) => {
        resolve(_calResult);
        // })
        // .catch(err => {
        //   // error on fetch markup
        //   // return bare result for now
        //   resolve(result);
        // })
      }

      let calendarCallback = (result: searchCalendarResult[]) => {
        _calResult = _calResult.concat(result);
        if (++_resultCount == _finalSearchItems.length)
          calculateMarkup();
      }

      let callSearchCalendar = (item: gatewaySearchInput) => {
        return new Promise((resolve: (result: searchCalendarResult[]) => void, reject: (error: errorObj) => void) => {
          let _searchCount = 0;
          let _totalSearchCount = item.itineraries.reduce(a => a * 7, 1);
          let _tempCalResult: searchCalendarResult[] = [];
          let searchCallback = () => {
            if (++_searchCount == _totalSearchCount)
              resolve(_tempCalResult)
          }

          item.itineraries.forEach((_itin, _itin_index) => {
            for (let dateOffset = -3; dateOffset <= +3; dateOffset++) {
              let date = new Date(_itin.departDate);
              date.setDate(date.getDate() + dateOffset);
              let _modified_item: gatewaySearchInput = JSON.parse(JSON.stringify(item));
              _modified_item.itineraries[_itin_index].departDate = date.toISOString().split("T")[0];
              this.callSearchApi(_modified_item, new mahanSession(), false)
                .then(searchResult => {
                  if (searchResult.body) {
                    // Find the body for checking error in it
                    let _body = searchResult.body["soap:Envelope"]["soap:Body"][0]["ns1:OTA_AirAvailRS"][0];
                    if (_body["ns1:Success"]) {
                      //matrix generation for multicity
                      _tempCalResult.push({
                        AdultPrice: parseFloat(_body["ns1:AAAirAvailRSExt"][0]["ns1:PricedItineraries"][0]["ns1:PricedItinerary"][0]["ns1:AirItineraryPricingInfo"][0]
                        ["ns1:ItinTotalFare"][0]["ns1:TotalFare"][0].$.Amount),
                        Currency: _body["ns1:AAAirAvailRSExt"][0]["ns1:PricedItineraries"][0]["ns1:PricedItinerary"][0]["ns1:AirItineraryPricingInfo"][0]
                        ["ns1:ItinTotalFare"][0]["ns1:TotalFare"][0].$.CurrencyCode,
                        Date: _modified_item.itineraries.map(el => el.departDate + "T10:00:00")
                      })
                      searchCallback();
                    }
                    else if (_body["ns1:Errors"][0]["ns1:Error"] && _body["ns1:Errors"][0]["ns1:Error"][0] && _body["ns1:Errors"][0]["ns1:Error"][0].$) {
                      searchCallback();
                    }
                  }
                  else
                    searchCallback();
                })
                .catch(err => {
                  searchCallback();
                })
            }
          })
        })
      }

      let createCalendarCalls = () => {
        _finalSearchItems.forEach(item => {
          callSearchCalendar(item)
            .then(result => calendarCallback(result))
            .catch(error => { _gatewayErrors.push(error); calendarCallback([]); })
        })

      }

      if (item.itineraries.length > 2 || (item.itineraries.length == 2 && !FlightTypeHelper.checkRoundTripFlight(item.itineraries))) {
        reject(new errorObj("searchCalendarMultiLegError",
          "",
          "SearchFlightCalendar method is not allowed with MultiLeg",
          "Mahan Manager -> Search Calendar"))
      }
      else {
        this.extractAllOriginDestionationOptions(modifiedItem)
          .then(result => {
            _finalSearchItems = result;
            createCalendarCalls();
          })
          .catch(err => createCalendarCalls())
      }
    })
  }

  // Get ping result for checking the connection and number of request
  getPing() {
    return new Promise<any>((resolve, reject) => {
      var header = {
        "Content-Type": "text/xml; charset=utf-8",
        soapAction: process.env.MAHAN_PING_SOAP_ACTION
      };
      var xml = fs.readFileSync("src/Assets/MahanRequestTemplates/Ping.xml", "utf-8");

      this.gatewaySoapRequest(process.env.MAHAN_WEBSERVICE_URL, header, xml, 10000000)
        .then(res => {
          const { headers, body, statusCode } = res.response;
          let sessionId = null;
          if (headers["set-cookie"] && headers["set-cookie"].length > 0) {
            sessionId = headers["set-cookie"].filter(
              val => val.indexOf("ASP.NET_SessionId") == 0
            )[0];
            sessionId = sessionId && sessionId.split(";")[0];
            sessionId = sessionId && sessionId.split("=")[1];
          }
          if (statusCode == 200)
            parseString(body, (error, data) => {
              // resolve(data["soap:Envelope"]["soap:Body"]["ns1:OTA_PingRS"]["ns1:EchoData"]);
              resolve({ data, session: sessionId });
            });
          else reject("Response Error");
        }).catch(err => {
          reject(err);
        });
    })
  }

  getFlightRules(item: gatewayRuleInput, session: mahanSession) {
    return new Promise<gatewayRulesResult[]>((resolve, reject) => {
      let result: gatewayRulesResult[] = [];
      result = item.itineraryFlights.map(el => { return { cancelingRuleText: JSON.parse(el.gatewayData).rules, cancelingRule: [], flightRule: null } })
      let successCount = 0;
      item.itineraryFlights.forEach((el, ind) => {
        CancelingRuleHelper.getCancelingRule(el.airlineCode, el.resBookDesigCode)
          .then(helperResult => callback(helperResult, ind))
          .catch(err => callback([], ind))
      })
      let callback = (helperResult, ind) => {
        result[ind].cancelingRule = helperResult;
        if (++successCount == item.itineraryFlights.length)
          resolve(result)
      }
    })
  }

  book(booking: any, session: mahanSession, options?: gatewayInputOptions) {
    return new Promise<gatewayBookInternalResult>((resolve, reject) => {
      if (session.sessionId && session.sessionTime && session.transactionId) {
        if (new Date().getTime() - new Date(session.sessionTime).getTime() > sessionMaxTime) {
          reject(new errorObj("expiredSession", "",
            "Your session is expired. Try to search for flights first", "Mahan Manager -> book", { session: { sessionDeleted: true } }))
        } else {
          let flight = booking.flights.itineraries.map(el => el.flights.map(el => { return { "ns1:FlightSegment": JSON.parse(el.gatewayData).flightSegment } }));
          flight = flight.reduce((a, b) => {
            return a.concat(b)
          }, [])
          let priceSession: mahanSession = {
            sessionId: booking.flights.gatewayData.sessionId,
            transactionId: booking.flights.gatewayData.transactionId,
            sessionTime: new Date().toISOString()
          }
          this.callGetPrice(booking.flights.gatewayData.modifiedItem, flight, priceSession, booking.flights.gatewayData.businessClass)
            .then(priceResult => {
              let _priceBody = priceResult.body["soap:Envelope"]["soap:Body"][0]["ns1:OTA_AirPriceRS"][0];
              if (_priceBody["ns1:Success"]) {
                _priceBody = _priceBody["ns1:PricedItineraries"][0]["ns1:PricedItinerary"][0];
                if (booking.flights.itineraries[0].originalPrice.totalPrice == parseFloat(_priceBody["ns1:AirItineraryPricingInfo"][0]["ns1:ItinTotalFare"][0]["ns1:TotalFare"][0].$.Amount)) {
                  let ticketTimeLimit = new Date();
                  ticketTimeLimit.setMinutes(ticketTimeLimit.getMinutes() + 15);
                  let _result: gatewayBookInternalData = {
                    ticketTimeLimit: ticketTimeLimit.toISOString().replace('Z', ''),
                    ticketType: booking.flights.itineraries.map(el => ""),
                    pnr: booking.flights.itineraries.map(el => "MAHAN"),
                    totalPrice: parseFloat(_priceBody["ns1:AirItineraryPricingInfo"][0]["ns1:ItinTotalFare"][0]["ns1:TotalFare"][0].$.Amount),
                    moneyUnit: booking.moneyUnit.moneyUnit,
                    bookDate: new Date().toISOString(),
                    rawData: [_priceBody]
                  }
                  session.sessionTime = new Date().toISOString();
                  resolve({
                    result: _result,
                    session: { ...session }
                  })
                }
                else reject(new errorObj("bookResponseError", "", "Price changed", "Mahan Manager -> book", { session }))
              }
              else reject(new errorObj("bookResponseError", "", "Error in price response", "Mahan Manager -> book", { session }))
            })
            .catch(err => reject(new errorObj("bookResponseError", "", "Error in price response", "Mahan Manager -> book", { err, session })))
        }
      } else {
        reject(new errorObj("noExistingSession", "",
          "There is no existing session. Try to search for flights first.", "Mahan Manager -> book", { session: { sessionDeleted: true } }))
      }
    })
  }

  createTicket(booking: any, session: mahanSession, options?: gatewayInputOptions) {
    return new Promise<gatewayTicketInternalResult>((resolve, reject) => {
      if (session.sessionId && session.sessionTime && session.transactionId) {
        if (new Date().getTime() - new Date(session.sessionTime).getTime() > sessionMaxTime) {
          reject(new errorObj("expiredSession", "",
            "Your session is expired. Try to search for flights first", "Mahan Manager -> createTicket", { session: { sessionDeleted: true } }))
        } else {
          let flight = booking.flights.itineraries.map(el => el.flights.map(el => { return { "ns1:FlightSegment": JSON.parse(el.gatewayData).flightSegment } }));
          flight = flight.reduce((a, b) => {
            return a.concat(b)
          }, [])
          let priceSession: mahanSession = {
            sessionId: booking.flights.gatewayData.sessionId,
            transactionId: booking.flights.gatewayData.transactionId,
            sessionTime: new Date().toISOString()
          };
          this.callGetPrice(booking.flights.gatewayData.modifiedItem, flight, priceSession, booking.flights.gatewayData.businessClass)
            .then(priceResult => {
              let _priceBody = priceResult.body["soap:Envelope"]["soap:Body"][0]["ns1:OTA_AirPriceRS"][0];
              if (_priceBody["ns1:Success"]) {
                _priceBody = _priceBody["ns1:PricedItineraries"][0]["ns1:PricedItinerary"][0];
                if (booking.flights.itineraries[0].originalPrice.totalPrice == parseFloat(_priceBody["ns1:AirItineraryPricingInfo"][0]["ns1:ItinTotalFare"][0]["ns1:TotalFare"][0].$.Amount)) {
                  let extractTravelerRPH = fare => {
                    if (fare)
                      return fare["ns1:TravelerRefNumber"].map(el => el.$.RPH);
                    return [];
                  }
                  let travelerRefNumberRPH = {
                    adult: extractTravelerRPH(_priceBody["ns1:AirItineraryPricingInfo"][0]["ns1:PTC_FareBreakdowns"][0]["ns1:PTC_FareBreakdown"]
                      .find(fare => fare["ns1:PassengerTypeQuantity"][0].$.Code == "ADT")),
                    child: extractTravelerRPH(_priceBody["ns1:AirItineraryPricingInfo"][0]["ns1:PTC_FareBreakdowns"][0]["ns1:PTC_FareBreakdown"]
                      .find(fare => fare["ns1:PassengerTypeQuantity"][0].$.Code == "CHD")),
                    infant: extractTravelerRPH(_priceBody["ns1:AirItineraryPricingInfo"][0]["ns1:PTC_FareBreakdowns"][0]["ns1:PTC_FareBreakdown"]
                      .find(fare => fare["ns1:PassengerTypeQuantity"][0].$.Code == "INF"))
                  }
                  this.callCreateEticket(booking, flight, travelerRefNumberRPH)
                    .then((ticketResult: any) => {
                      let _ticketBody = ticketResult.body["soap:Envelope"]["soap:Body"][0]["ns1:OTA_AirBookRS"][0]
                      if (_ticketBody["ns1:Success"]) {
                        let needsFurtherActions = false;
                        //   let needsFurtherActions = (ticketResult.data["soap:Envelope"]["soap:Body"][0].CreateTicketResponse[0].OTA_AirBookRS[0].Warnings &&
                        //     ticketResult.data["soap:Envelope"]["soap:Body"][0].CreateTicketResponse[0].OTA_AirBookRS[0].Warnings[0] &&
                        //     ticketResult.data["soap:Envelope"]["soap:Body"][0].CreateTicketResponse[0].OTA_AirBookRS[0].Warnings[0].Warning &&
                        //     ticketResult.data["soap:Envelope"]["soap:Body"][0].CreateTicketResponse[0].OTA_AirBookRS[0].Warnings[0].Warning[0] &&
                        //     ticketResult.data["soap:Envelope"]["soap:Body"][0].CreateTicketResponse[0].OTA_AirBookRS[0].Warnings[0].Warning[0].$.Status == "ETICKET_ERROR") ? true : false
                        let finalResult: gatewayTicketInternalResult = new gatewayTicketInternalResult();
                        finalResult.session.sessionDeleted = true;
                        finalResult.result = {
                          data: _ticketBody,
                          callSupport: needsFurtherActions,
                          tickets: []
                        }
                        booking.flights.itineraries.forEach(itin => {
                          booking.passengers.forEach(pass => {
                            finalResult.result.tickets.push({
                              passengerIndex: pass.index,
                              flightIndex: itin.index,
                              refrenceId: _ticketBody["ns1:AirReservation"][0]["ns1:TravelerInfo"][0]["ns1:AirTraveler"]
                                .find(el => el["ns1:TravelerRefNumber"][0].$.RPH.indexOf("|" + pass.travelerRefNumberRPH + "$") >= 0)["ns1:TravelerRefNumber"][0].$.RPH,
                              ticketNumber: _ticketBody["ns1:AirReservation"][0]["ns1:TravelerInfo"][0]["ns1:AirTraveler"]
                                .find(el => el["ns1:TravelerRefNumber"][0].$.RPH.indexOf("|" + pass.travelerRefNumberRPH + "$") >= 0)["ns1:ETicketInfo"][0]["ns1:ETicketInfomation"][0].$.eTicketNo,
                              status: [],
                              pnr: _ticketBody["ns1:AirReservation"][0]["ns1:BookingReferenceID"][0].$.ID,
                              cancelReason: null,
                              showTicketType: null,
                              callSupport: needsFurtherActions
                            })
                          })
                        })
                        resolve(finalResult);
                      }
                      else if (_ticketBody["ns1:Errors"][0]["ns1:Error"][0].$.ShortText.indexOf("Transaction invalid or expired") >= 0)
                        reject(new errorObj("expiredSession", "",
                          "Your session is expired. Try to search for flights first", "Mahan Manager -> createTicket", { session: { sessionDeleted: true } }))
                      else {
                        console.log("MahanManager -> createTicket -> ticketResult", JSON.stringify(ticketResult));
                        reject(new errorObj("issueTicketError", "", "Error in issuing ticket", "Mahan Manager -> createTicket", _ticketBody["ns1:Errors"][0]["ns1:Error"][0].$.ShortText));
                      }

                    })
                    .catch(err => { console.log(err); reject(err) })
                }
                else reject(new errorObj("ticketResponseError", "", "Price changed", "Mahan Manager -> createTicket", { session }))
              }
              else if (_priceBody["ns1:Errors"][0]["ns1:Error"][0].$.ShortText.indexOf("Transaction invalid or expired") >= 0)
                reject(new errorObj("expiredSession", "",
                  "Your session is expired. Try to search for flights first", "Mahan Manager -> createTicket", { session: { sessionDeleted: true } }))
              else reject(new errorObj("ticketResponseError", "", "Error in price response", "Mahan Manager -> createTicket", { session }))
            })
            .catch((err: any) => reject(new errorObj("tikcetResponseError", "", "Error in price response", "Mahan Manager -> createTicket", { err, session })))
        }
      } else {
        reject(new errorObj("noExistingSession", "",
          "There is no existing session. Try to search for flights first.", "Mahan Manager -> createTicket", { session: { sessionDeleted: true } }))
      }
    })
  }

  private callSearchApi(item: gatewaySearchInput, session: mahanSession = new mahanSession(), businessClassSearch: boolean) {
    return new Promise((resolve: (response: gatewayLogicOutput) => void, reject: (error: errorObj) => void) => {
      let header = {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: process.env.MAHAN_SEARCHFLIGHT_WEBSERVICE_ACTION
      };
      // if (session.sessionId)
      //   header["Cookie"] = `${sessionMainName}${session.sessionId};`;

      // Read template XML file for send to mahan webservice
      var xml = fs.readFileSync(
        "src/Assets/MahanRequestTemplates/SearchFlight.xml",
        "utf-8"
      );
      // Replacing list of passengers in XML template
      var passengers = "";
      if (item.adult > 0)
        passengers += `<ns2:PassengerTypeQuantity Code="ADT" Quantity="${item.adult}"/>`;
      if (item.child > 0)
        passengers += `<ns2:PassengerTypeQuantity Code="CHD" Quantity="${item.child}"/>`;
      if (item.infant > 0)
        passengers += `<ns2:PassengerTypeQuantity Code="INF" Quantity="${item.infant}"/>`;
      xml = xml
        .replace(/{{Passengers}}/g, passengers)
        .replace(/{{OriginDestinationInformation}}/g, this.generateXMLOriginDestinationInformation(item.itineraries, businessClassSearch));
      this.gatewaySoapRequest(process.env.MAHAN_WEBSERVICE_URL, header, xml, 10000000)
        .then(response => {
          // console.log("ASASSAS", JSON.stringify(response.response))
          const { headers, body, statusCode } = response.response;
          if (headers["set-cookie"] && headers["set-cookie"].length > 0 && headers["set-cookie"].some(val => val.indexOf(sessionMainName) == 0) > 0) {
            session.sessionId = headers["set-cookie"].filter(val => val.indexOf(sessionMainName) == 0)[0].split(";")[0].split("=")[1];
          }
          session.sessionTime = new Date().toISOString();
          if (statusCode == 200)
            parseString(body, (error, data) => {
              if (error)
                reject({
                  error: error,
                  location: "Mahan manager -> callSearchApi -> soapRequest -> parseString",
                  code: "",
                  name: "xmlNotValid",
                  data: {
                    body: body,
                    session: session
                  }
                });
              else {
                if (data["soap:Envelope"]["soap:Body"][0]["ns1:OTA_AirAvailRS"][0].$.TransactionIdentifier)
                  session.transactionId = data["soap:Envelope"]["soap:Body"][0]["ns1:OTA_AirAvailRS"][0].$.TransactionIdentifier;
                resolve({
                  body: data,
                  session: session
                });
              }
            })
          else
            reject({
              error: body,
              location: "Mahan manager -> callSearchApi -> soapRequest -> statusCode is not 200",
              code: "",
              name: "statusNotOK",
              data: body
            });
        })
        .catch(error => {
          reject({
            error: error,
            location: "Mahan manager -> callSearchApi -> soapRequest",
            code: "",
            name: "soapRequestError",
            data: null
          })
        })
    })
  }

  private callGetPrice(item: gatewaySearchInput, flight: any, session: mahanSession, businessClass: boolean) {
    return new Promise<gatewayLogicOutput>((resolve, reject) => {
      let header = {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: process.env.MAHAN_PRICE_WEBSERVICE_ACTION,
        Cookie: `${sessionMainName}${session.sessionId};`
      };

      // Read template XML file for send to mahan webservice
      let xml = fs.readFileSync("src/Assets/MahanRequestTemplates/PriceQuote.xml", "utf-8");
      // Replacing list of passengers in XML template
      let passengers = "";
      if (item.adult > 0)
        passengers += `<ns2:PassengerTypeQuantity Code="ADT" Quantity="${item.adult}"/>`;
      if (item.child > 0)
        passengers += `<ns2:PassengerTypeQuantity Code="CHD" Quantity="${item.child}"/>`;
      if (item.infant > 0)
        passengers += `<ns2:PassengerTypeQuantity Code="INF" Quantity="${item.infant}"/>`;

      let directionInd = "MultiCity";
      if (item.itineraries.length == 1)
        directionInd = "OneWay";
      else if (FlightTypeHelper.checkRoundTripFlight(item.itineraries))
        directionInd = "Return";

      xml = xml
        .replace(/{{TransactionID}}/g, session.transactionId)
        .replace(/{{DirectionInd}}/g, directionInd)
        .replace(/{{Passengers}}/g, passengers)
        .replace(/{{OriginDestinationOption}}/g, this.generateXMLOriginDestinationOption(flight, businessClass));
      this.gatewaySoapRequest(process.env.MAHAN_WEBSERVICE_URL, header, xml, 10000000)
        .then(response => {
          const { headers, body, statusCode } = response.response;
          session.sessionTime = new Date().toISOString();
          if (statusCode == 200)
            parseString(body, (error, data) => {
              if (error)
                reject({
                  error: error,
                  location: "Mahan manager -> callGetPrice -> soapRequest -> parseString",
                  code: "",
                  name: "xmlNotValid",
                  data: {
                    body: body,
                    session: session
                  }
                });
              else {
                resolve({
                  body: data,
                  session: session
                });
              }
            })
          else
            reject({
              error: body,
              location: "Mahan manager -> callGetPrice -> soapRequest -> statusCode is not 200",
              code: "",
              name: "statusNotOK",
              data: body
            });
        })
        .catch(error => {
          reject({
            error: error.Error,
            location: "Mahan manager -> callGetPrice -> soapRequest",
            code: "",
            name: "soapRequestError",
            data: null
          })
        })
    })
  }

  private callCreateEticket(booking: any, flight: any, travelerRefNumberRPHs: any) {
    parseString
    return new Promise((resolve, reject) => {
      let header = {
        "Content-Type": "text/xml; charset=utf-8",
        soapAction: process.env.MAHAN_BOOKFLIGHT_WEBSERVICE_ACTION,
        Cookie: `${sessionMainName}${booking.flights.gatewayData.sessionId};`
      };
      let xml = fs.readFileSync("src/Assets/MahanRequestTemplates/BookFlight.xml", "utf-8");
      let issuerContactInfo = `<ns1:PersonName>`;
      issuerContactInfo += `<ns1:Title>MR</ns1:Title>`;
      issuerContactInfo += `<ns1:FirstName>${booking.passengers[0].firstName}</ns1:FirstName>`;
      issuerContactInfo += `<ns1:LastName>${booking.passengers[0].lastName}</ns1:LastName>`;
      issuerContactInfo += `</ns1:PersonName>`;
      issuerContactInfo += `<ns1:Telephone>`;
      issuerContactInfo += `<ns1:PhoneNumber>${booking.issuerContactInfo.mobile}</ns1:PhoneNumber>`;
      issuerContactInfo += `</ns1:Telephone>`;
      issuerContactInfo += `<ns1:Mobile>`;
      issuerContactInfo += `<ns1:PhoneNumber>${booking.issuerContactInfo.mobile}</ns1:PhoneNumber>`;
      issuerContactInfo += `</ns1:Mobile>`;
      issuerContactInfo += `<ns1:Email>${booking.issuerContactInfo.email}</ns1:Email>`;
      issuerContactInfo += `<ns1:Address>`;
      issuerContactInfo += `<ns1:CityName>Tehran</ns1:CityName>`;
      issuerContactInfo += `<ns1:CountryName>`;
      issuerContactInfo += `<ns1:CountryName>Iran</ns1:CountryName>`;
      issuerContactInfo += `<ns1:CountryCode>IR</ns1:CountryCode>`;
      issuerContactInfo += `</ns1:CountryName>`;
      issuerContactInfo += `</ns1:Address>`;
      let passengers = this.generateXMLAirTraveler(booking.passengers, travelerRefNumberRPHs, booking.issuerContactInfo.mobile);
      xml = xml
        .replace(/{{TransactionID}}/g, booking.flights.gatewayData.transactionId)
        .replace(/{{OriginDestinationOption}}/g, this.generateXMLOriginDestinationOption(flight, booking.flights.gatewayData.businessClass))
        .replace(/{{TotalPrice}}/g, booking.totalPrice.toFixed(2))
        .replace(/{{IssuerContactInfo}}/g, issuerContactInfo)
        .replace(/{{passengers}}/g, passengers.passengers)
        .replace(/{{TravelerAdditionalInfo}}/g, passengers.travelerAdditionalInfo)
      this.gatewaySoapRequest(process.env.MAHAN_WEBSERVICE_URL, header, xml, 10000000)
        .then(response => {
          const { headers, body, statusCode } = response.response;
          if (statusCode == 200)
            parseString(body, (error, data) => {
              // console.log("SASABSAVSVA",error,data);
              if (error)
                reject({
                  error: error,
                  location: "Mahan manager -> callCreateEticket -> soapRequest -> parseString",
                  code: "",
                  name: "xmlNotValid",
                  data: {
                    body: body
                  }
                });
              else {
                resolve({
                  body: data
                });
              }
            })
          else
            reject({
              error: body,
              location: "Mahan manager -> callCreateEticket -> soapRequest -> statusCode is not 200",
              code: "",
              name: "statusNotOK",
              data: body
            });
        })
        .catch(error => {
          reject({
            error: error.Error,
            location: "Mahan manager -> callCreateEticket -> soapRequest",
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

  private generatePassengerNameTitle(passengerType: string, isMale: boolean): string {
    if (passengerType == "infant")
      if (isMale)
        return "MSTR";
      else
        return "MISS";
    else
      if (isMale)
        return "MR";
      else
        return "MS";
  }

  private generateXMLAirTraveler(passengers: any[], travelerRefNumberRPHs: any, phoneNumber: string) {
    let passengersString = "";
    let travelerAdditionalInfoString = "";
    for (const ptype of Object.keys(travelerRefNumberRPHs)) {
      travelerRefNumberRPHs[ptype].forEach((rph, ind) => {
        let pass = passengers.filter(el => el.type == ptype)[ind];
        pass.travelerRefNumberRPH = rph;
        if (pass) {
          passengersString += `<ns2:AirTraveler BirthDate="${pass.birthDate}T00:00:00" PassengerTypeCode="${this.convertPassengerType(pass.type)}">`;
          passengersString += `<ns2:PersonName>`;
          passengersString += `<ns2:GivenName>${pass.firstName}</ns2:GivenName>`;
          passengersString += `<ns2:Surname>${pass.lastName}</ns2:Surname>`;
          passengersString += `<ns2:NameTitle>${this.generatePassengerNameTitle(pass.type, pass.isMale)}</ns2:NameTitle>`;
          passengersString += `</ns2:PersonName>`;
          passengersString += `<ns2:Telephone PhoneNumber="${phoneNumber}" />`;
          if (pass.passportNo)
            passengersString += `<ns2:Document DocHolderNationality="${pass.passportCountry}" DocType="PSPT" DocID="${pass.passportNo}" DocIssueCountry="${pass.passportCountry}" ExpireDate="${pass.passportExpireDate}T00:00:00"/>`;
          else
            passengersString += `<ns2:Document DocHolderNationality="${pass.passportCountry}" />`;
          passengersString += `<ns2:TravelerRefNumber RPH="${rph}" />`;
          passengersString += `</ns2:AirTraveler>
            `;
          travelerAdditionalInfoString += `<ns1:AAAirTravelersType>`;
          travelerAdditionalInfoString += `<ns1:TravelerRefNumberRPH>${rph}</ns1:TravelerRefNumberRPH>`;
          if (pass.nationalCode)
            travelerAdditionalInfoString += `<ns1:NationalIDNo>${pass.nationalCode}</ns1:NationalIDNo>`;
          travelerAdditionalInfoString += `</ns1:AAAirTravelersType>
            `;
        }
      })
    }
    return { passengers: passengersString, travelerAdditionalInfo: travelerAdditionalInfoString };
  }

  private generateXMLOriginDestinationInformation(itineraries: gatewaySearchInputItinerary[], businessClass: boolean) {
    let _result = "";
    itineraries.forEach(element => {
      _result += `<ns2:OriginDestinationInformation>`;
      _result += `<ns2:DepartureDateTime>${element.departDate}T00:00:00</ns2:DepartureDateTime>`;
      _result += `<ns2:OriginLocation LocationCode="${element.origin}" />`;
      _result += `<ns2:DestinationLocation LocationCode="${element.destination}" />`;
      if (businessClass)
        _result += `<ns2:TravelPreferences><ns2:CabinPref PreferLevel="Preferred" Cabin="C"/></ns2:TravelPreferences>`;
      _result += `</ns2:OriginDestinationInformation>`;
    });
    return _result;
  }

  private generateXMLOriginDestinationOption(flight: any, businessClass: boolean) {
    let _result = "";
    flight.forEach(element => {
      _result += `<ns2:OriginDestinationOption>`;
      _result += `<ns2:FlightSegment ArrivalDateTime="${element["ns1:FlightSegment"][0].$.ArrivalDateTime}" 
        DepartureDateTime="${element["ns1:FlightSegment"][0].$.DepartureDateTime}" 
        FlightNumber="${element["ns1:FlightSegment"][0].$.FlightNumber}" 
        JourneyDuration="${element["ns1:FlightSegment"][0].$.JourneyDuration}" 
        RPH="${element["ns1:FlightSegment"][0].$.RPH}" 
        ${businessClass ? 'ResCabinClass="C"' : ""}>`;
      _result += `<ns2:DepartureAirport LocationCode="${element["ns1:FlightSegment"][0]["ns1:DepartureAirport"][0].$.LocationCode}" 
        ${element["ns1:FlightSegment"][0]["ns1:DepartureAirport"][0].$.Terminal ? ('Terminal="' + element["ns1:FlightSegment"][0]["ns1:DepartureAirport"][0].$.Terminal + '"') : ""}/>`;
      _result += `<ns2:ArrivalAirport LocationCode="${element["ns1:FlightSegment"][0]["ns1:ArrivalAirport"][0].$.LocationCode}" 
        ${element["ns1:FlightSegment"][0]["ns1:ArrivalAirport"][0].$.Terminal ? ('Terminal="' + element["ns1:FlightSegment"][0]["ns1:ArrivalAirport"][0].$.Terminal + '"') : ""}/>`;
      _result += `</ns2:FlightSegment>`;
      _result += `</ns2:OriginDestinationOption>`;
    });
    return _result;
  }

  private gatewaySoapRequest(url: string, header: any, xml: string, timeout: number) {
    xml = xml
      .replace(/{{Username}}/g, this.signitureData.username)
      .replace(/{{Password}}/g, this.signitureData.password)
      .replace(/{{OfficeID}}/g, this.signitureData.officeId)
      .replace(/{{UniqueIDType}}/g, this.signitureData.uniqueIdType)
      .replace(/{{TerminalID}}/g, terminalId)
      .replace(/{{BookingChannelType}}/g, this.signitureData.bookingChannelType);
    return soapRequest(url, header, xml, 10000)
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

  private extractJourneyDuration(OriginDestinationOptions: any[]) {
    let hour = 0;
    let minute = 0;

    OriginDestinationOptions.forEach(el => {
      let str = el["ns1:FlightSegment"][0].$.JourneyDuration;
      str = str.replace(/PT/g, '');
      hour += parseInt(str.split('H')[0])
      str = str.split('H')[1];
      minute += parseInt(str.split('M')[0])
    })

    hour += Math.floor(minute / 60);
    minute = minute % 60;

    let hourstr = hour.toString();
    let minutestr = minute.toString();

    if (hourstr.length < 2) hourstr = "0" + hourstr;
    if (minutestr.length < 2) minutestr = "0" + minutestr;
    return hourstr + ":" + minutestr;
  }

  private addStopTimeToElapsedTime(elapsedTime: string, totalStopTime: string): string {
    let hour = parseInt(elapsedTime.split(":")[0]) + parseInt(totalStopTime.split(":")[0]);
    let minute = parseInt(elapsedTime.split(":")[1]) + parseInt(totalStopTime.split(":")[1]);
    hour += Math.floor(minute / 60);
    minute = minute % 60;
    let hourstr = hour.toString();
    let minutestr = minute.toString();
    if (hourstr.length < 2) hourstr = "0" + hourstr;
    if (minutestr.length < 2) minutestr = "0" + minutestr;
    return hourstr + minutestr;
  }

  private generateFlightItineraries(item: gatewaySearchInput, originDestinationInfo: any[]) {
    let result = [];
    let multicityFlag = true;
    if (item.itineraries.length == 1 || FlightTypeHelper.checkRoundTripFlight(item.itineraries))
      multicityFlag = false;

    if (multicityFlag) {
      let tempOptions: any[][] = [];
      item.itineraries.forEach((itin, itinIndex) => {
        tempOptions[itinIndex] = originDestinationInfo.filter(info => info["ns1:OriginLocation"][0].$.LocationCode == itin.origin
          && info["ns1:DestinationLocation"][0].$.LocationCode == itin.destination)
      })
      let totalCount = tempOptions.reduce((a, b) => a * b.length, 1);
      for (let index = 0; index < totalCount; index++) {
        let _temp_index = index;
        let tempResult = { "ns1:OriginDestinationOptions": [{ "ns1:OriginDestinationOption": [] }] }
        tempOptions.forEach((option, optInd) => {
          let _index = _temp_index % option.length;
          _temp_index = Math.floor(_temp_index / option.length);
          tempResult["ns1:OriginDestinationOptions"][0]["ns1:OriginDestinationOption"] =
            tempResult["ns1:OriginDestinationOptions"][0]["ns1:OriginDestinationOption"].concat(option[index]["ns1:OriginDestinationOptions"][0]["ns1:OriginDestinationOption"])
        });
        result.push(tempResult);
      }
    }
    else
      result = JSON.parse(JSON.stringify(originDestinationInfo));

    result.forEach(el => {
      let directionId = 0;
      el["ns1:OriginDestinationOptions"][0]["ns1:OriginDestinationOption"].forEach(el => {
        el.directionId = directionId.toString();
        if (el["ns1:FlightSegment"][0]["ns1:ArrivalAirport"][0].$.LocationCode == item.itineraries[directionId].destination)
          directionId++;
      })

      el.groupedData = el["ns1:OriginDestinationOptions"][0]["ns1:OriginDestinationOption"].reduce((a, b) => {
        a[b.directionId] = a[b.directionId] || [];
        a[b.directionId].push(b);
        return a;
      }, {})
    })
    return result;
  }
}
Object.seal(MahanManager);
