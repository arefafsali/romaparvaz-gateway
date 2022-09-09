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

export class IranAirTourManager implements IGatewayImplement {

  private signitureData: any;

  public static sessionId: string = "";
  constructor(_signitureData) {
    this.signitureData = _signitureData;
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
          POS: {
            ...this.signitureData
          },
          OriginDestinationInformation: [
            {
              DepartureDateTime: item.itineraries[0].departDate,
              OriginLocation: {
                LocationCode: item.itineraries[0].origin
              },
              DestinationLocation: {
                LocationCode: item.itineraries[0].destination
              }
            }
          ],
          TravelerInfoSummary: {
            AirTravelerAvail: [
              {
                Code: "ADT",
                Quantity: item.adult
              },
              {
                Code: "CHD",
                Quantity: item.child
              },
              {
                Code: "INF",
                Quantity: item.infant
              }
            ]
          },
          SequenceNmbr: 0,
          TimeStamp: item.itineraries[0].departDate,
          Version: 0,
          Cabin: "", //??
        };

        this.callApi(process.env.URL_IRANAIRTOUR_AIRAVAILABLE, searchObj)
          .then(_availability_result => {
            let _body: any = _availability_result;
            if (_body.length === 0) {
              _gatewayErrors.push({
                code: "",
                data: _body,
                error: `no flight available for ${item.itineraries[0].origin} to ${item.itineraries[0].destination}`,
                location: "IranAirTour manager -> get Search -> _body[AvailableFlights].length",
                name: "NoFlightAvailable"
              });
              allSearchCallback();
            }
            else
              if (_body["PricedItineraries"]) {
                if (_body["PricedItineraries"]["PricedItinerary"].length == 0) {
                  _gatewayErrors.push({
                    code: "",
                    data: _availability_result["body"],
                    error: `no flight available for ${item.itineraries[0].origin} to ${item.itineraries[0].destination}`,
                    location: "IranAirTour manager -> get Search -> _body[AvailableFlights].length",
                    name: "NoFlightAvailable"
                  });
                  allSearchCallback();
                }
                else {
                  _temp_itineraries = _temp_itineraries.concat(_body["PricedItineraries"]["PricedItinerary"])
                  allSearchCallback();
                }
              }
              else {
                _gatewayErrors.push({
                  code: "",
                  data: _body,
                  error: "no AvailableFlights field",
                  location: "IranAirTour manager -> get Search -> parse _availability_result[body]",
                  name: "InvalidResponse"
                });
                allSearchCallback();
              }
          })
          .catch(error => {
            _gatewayErrors.push({
              code: "",
              data: error,
              error: "gateway Error",
              location: "IranAirTour manager -> get Search -> callApi (availability)",
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
              location: "IranAirTour manager -> get Search -> _body[AvailableFlights].length",
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
          let flight_Seg =
            flight.AirItinerary.OriginDestinationOptions[0].FlightSegment[0];
          // Check dismiss economy when cabin is business and first
          if((item.cabin === "Business" || item.cabin === "First") && flight_Seg.BookingClassAvails[0].ResBookDesigCabinCode === "Y")
            return;

          // Check dismiss business and first when flight is in local and is on economy class
          if((item.cabin === "Economy" && (item.itineraries[0].originCountryCode !== "IR" || item.itineraries[0].destinationCountryCode !== "IR")) && (flight_Seg.BookingClassAvails[0].ResBookDesigCabinCode === "C" || flight_Seg.BookingClassAvails[0].ResBookDesigCabinCode === "F"))
            return;
          let adultObj = flight.AirItineraryPricingInfo.PTC_FareBreakdowns.find(
            (item) => item.PassengerTypeQuantity.Code == "ADL"
          );
          let childObj = flight.AirItineraryPricingInfo.PTC_FareBreakdowns.find(
            (item) => item.PassengerTypeQuantity.Code == "CHD"
          );
          let infantObj = flight.AirItineraryPricingInfo.PTC_FareBreakdowns.find(
            (item) => item.PassengerTypeQuantity.Code == "INF"
          );
          let _flg_result = new searchFlightResult();
          _flg_result.Currency = flight.Currency
          _flg_result.ProviderType = "IranAirTourProvider";
          _flg_result.SequenceNumber = flight.SequenceNumber;
          _flg_result.CombinationId = "0";
          _flg_result.ValidatingAirlineCode = "B9";
          _flg_result.ForceETicket = null;
          _flg_result.E_TicketEligibility = "Eligible";
          _flg_result.ServiceFeeAmount = null;

          _flg_result.TotalPrice = flight.AirItineraryPricingInfo.ItinTotalFare.TotalFare.Amount;

          _flg_result.AdultPrice.BaseFare = adultObj.PassengerFare.BaseFare.Amount;
          _flg_result.AdultPrice.TotalPrice = adultObj.PassengerFare.TotalFare.Amount;
          _flg_result.AdultPrice.Tax = adultObj.PassengerFare.Taxes.Tax.reduce((a, b) => {
            return a + b.Amount;
          }, 0);

          _flg_result.ChildPrice.BaseFare = childObj.PassengerFare.BaseFare.Amount;
          _flg_result.ChildPrice.TotalPrice = childObj.PassengerFare.TotalFare.Amount
          _flg_result.ChildPrice.Tax = childObj.PassengerFare.Taxes.Tax.reduce((a, b) => {
            return a + b.Amount;
          }, 0);

          _flg_result.InfantPrice.BaseFare = infantObj.PassengerFare.BaseFare.Amount;
          _flg_result.InfantPrice.TotalPrice = infantObj.PassengerFare.TotalFare.Amount;
          _flg_result.InfantPrice.Tax = infantObj.PassengerFare.Taxes.Tax.reduce((a, b) => {
            return a + b.Amount;
          }, 0);

          let _itinerary = new searchFlightItinerary();
          _itinerary.DirectionId = "0";
          _itinerary.ElapsedTime = flight_Seg.FlightDuration.replace(":", "");
          _itinerary.RefNumber = flight.AirItinerary.OriginDestinationOptions[0].RefNumber;
          _itinerary.StopCount = 0;
          _itinerary.isCharter = false
          _itinerary.TotalStopTime = TimeToString.generateTimeStirng(0);          

          // Save Original Price for booking
          _itinerary.OriginalPrice = {
            TotalPrice: _flg_result.TotalPrice,
            AdultPrice: {..._flg_result.AdultPrice},
            ChildPrice: {..._flg_result.ChildPrice},
            InfantPrice: {..._flg_result.InfantPrice}
          }

          let _itineraryFlight = new itineraryFlightSegment();
          _itineraryFlight.GatewayData = flight.AirItinerary.OriginDestinationOptions[0].RefNumber
          _itineraryFlight.DepartureDateTime = `${flight_Seg.DepartureDate}T${flight_Seg.DepartureTime}:00.000Z`;
          _itineraryFlight.ArrivalDateTime = `${flight_Seg.ArrivalDate}T${flight_Seg.ArrivalTime}:00.000Z`;
          _itineraryFlight.FlightNumber = flight_Seg.FlightNumber;
          _itineraryFlight.ResBookDesigCode = flight_Seg.ResBookDesigCode; // TODO : ask Ali is it correct?
          _itineraryFlight.FlightDuration = flight_Seg.FlightDuration;
          _itineraryFlight.DepartureAirport.Code = flight_Seg.DepartureAirport.LocationCode;
          _itineraryFlight.DepartureAirport.Terminal = flight_Seg.DepartureAirport.Terminal;
          _itineraryFlight.ArrivalAirport.Code = flight_Seg.ArrivalAirport.LocationCode;
          _itineraryFlight.ArrivalAirport.Terminal = flight_Seg.ArrivalAirport.Terminal;
          _itineraryFlight.MarketingAirline.Code = flight_Seg.MarketingAirline.Code;
          _itineraryFlight.OperatingAirline.Code = flight_Seg.OperatingAirline.Code;
          _itineraryFlight.Equipment.Code = flight_Seg.Equipment.AirEquipType;
          _itineraryFlight.Equipment.Name.en = flight_Seg.Equipment.AirEquipType;
          _itineraryFlight.Equipment.Name.fa = flight_Seg.Equipment.AirEquipType;
          _itineraryFlight.BookingClassAvails = {
            ResBookDesigCode: flight_Seg.BookingClassAvails[0].ResBookDesigCode, // TODO : ask Ali is it correct?
            ResBookDesigQuantity: flight_Seg.BookingClassAvails[0].ResBookDesigQuantity,
            RPH: flight_Seg.BookingClassAvails[0].RPH,
            AvailablePTC: "ADT",
            ResBookDesigCabinCode: flight_Seg.BookingClassAvails[0].ResBookDesigCabinCode,
            FareBasis: flight_Seg.BookingClassAvails[0].FareBasis,
            FareType: null,
            ResBookDesigCabinName: new nameObject()
          }
          _itineraryFlight.Baggage = [
            {
              Index: "0",
              Quantity: flight_Seg.FreeBaggages[0].Quantity,
              Type: flight_Seg.FreeBaggages[0].PassengerType !== "ADL" || "ADT",
              Unit: flight_Seg.FreeBaggages[0].Unit,
            },
            {
              Index: "1",
              Quantity: flight_Seg.FreeBaggages[1].Quantity,
              Type: flight_Seg.FreeBaggages[1].PassengerType,
              Unit: flight_Seg.FreeBaggages[1].Unit,
            },
            {
              Index: "2",
              Quantity: flight_Seg.FreeBaggages[2].Quantity,
              Type: flight_Seg.FreeBaggages[2].PassengerType,
              Unit: flight_Seg.FreeBaggages[2].Unit,
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
        MarkupHelper.calculateMarkup(loggedInUser, 'iranairtour', item, result, options)
          .then((newResult: gatewaySearchFlightResult) => {
            resolve(newResult);
          })
          .catch(err => {
            // error on fetch markup
            // return bare result for now
            resolve(result);
          })
      }

      // console.log("IranAir Tour ITEM", item)
      this.extractAllOriginDestionationOptions(item)
        .then(result => { _finalSearchItems = result; })
        .catch(err => { })
        .finally(() => {
          _finalSearchItems.forEach((el, ind) => {
            // console.log("IranAir Tour", el)
            searchProcess(el);
          })
        })

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
          "IranAirTour Manager -> Search Calendar"))
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
      let price_Break = [];
      if (booking.flights.adultCount > 0)
        price_Break.push({
          PassengerTypeQuantity: {
            Code: "ADL",
            Quantity: booking.flights.adultCount,
          },
          PassengerFare: {
            TotalFare: {
              Amount: 0,
            },
          },
        });
      if (booking.flights.childCount > 0)
        price_Break.push({
          PassengerTypeQuantity: {
            Code: "CHD",
            Quantity: booking.flights.childCount,
          },
          PassengerFare: {
            TotalFare: {
              Amount: 0,
            },
          },
        });
      if (booking.flights.infantCount > 0)
        price_Break.push({
          PassengerTypeQuantity: {
            Code: "INF",
            Quantity: booking.flights.infantCount,
          },
          PassengerFare: {
            TotalFare: {
              Amount: 0,
            },
          },
        });
      booking.flights.itineraries[0].flights.forEach((_flg, _flg_ind) => {
        let requestValues = {
          POS: {
            ...this.signitureData
          },
          AirItinerary: {
            OriginDestinationOptions: [
              {
                FlightSegment: [
                  {
                    DepartureAirport: {
                      LocationCode:
                        _flg.departureAirport
                          .code,
                    },
                    ArrivalAirport: {
                      LocationCode:
                        _flg.arrivalAirport
                          .code,
                    },
                    BookingClassAvails: [
                      {
                        ResBookDesigCode:
                          _flg
                            .resBookDesigCode, // TODO:ask sasan در دو جا استفاده شده آیا متفاوتند؟
                        ResBookDesigQuantity: 5, //TODO:  ? نداریم. این فیلدها اجباری هستند
                        RPH: _flg.RPH, //TODO:  ? نداریم
                        AvailablePTC: null,
                        ResBookDesigCabinCode:
                          _flg
                            .resBookDesigCabinCode,
                        FareBasis: null,
                      },
                    ],
                    DepartureDateTime:
                      _flg.departureDateTime.replace("T", " ").replace(".000Z", ""),
                    ArrivalDateTime:
                      _flg.arrivalDateTime.replace("T", " ").replace(".000Z", ""),
                    FlightNumber:
                      _flg.flightNumber,
                    ResBookDesigCode:
                      _flg.resBookDesigCode,
                    RPH: _flg.RPH,
                  },
                ],
                RefNumber: booking.ref_number,
              },
            ],
          },

          TravelerInfo: booking.passengers.map((passenger) => {
            let doc: any = {};
            if (passenger.nationalCode || passenger.nationalCode != "")
              doc = {
                DocType: "N",
                DocID: passenger.nationalCode,
              };
            else if (passenger.passportNo || passenger.passportNo != "") {
              doc = {
                DocType: "P",
                DocID: passenger.passportNo,
                DocIssueCountry: passenger.passportCountry,
                ExpireDate: passenger.passportExpireDate,
                Nationality: passenger.nationality.code
              };
            }
            if (passenger.type == "adult") {
              price_Break.find(
                (item) => item.PassengerTypeQuantity.Code == "ADL"
              ).PassengerFare.TotalFare.Amount += booking.flights.itineraries[0].originalPrice.adultPrice.totalPrice;
            }
            if (passenger.type == "child") {
              price_Break.find(
                (item) => item.PassengerTypeQuantity.Code == "CHD"
              ).PassengerFare.TotalFare.Amount += booking.flights.itineraries[0].originalPrice.childPrice.totalPrice;
            }
            if (passenger.type == "infant") {
              price_Break.find(
                (item) => item.PassengerTypeQuantity.Code == "INF"
              ).PassengerFare.TotalFare.Amount += booking.flights.itineraries[0].originalPrice.infantPrice.totalPrice;
            }
            return {
              PersonName: {
                GivenName: passenger.firstName,
                Surname: passenger.lastName,
                NameTitle: passenger.isMale ? "MR" : "MS",
              },
              ContactInfo: {
                Mobile: {
                  PhoneNumber: booking.issuerContactInfo.mobile,
                  CountryCode: "",
                  AreaCode: "",
                },
                Email: booking.issuerContactInfo.email,
              },
              Document: doc,
              BirthDate: passenger.birthDate,
              PassengerTypeCode:
                passenger.type == "adult"
                  ? "ADL"
                  : passenger.type == "child"
                    ? "CHD"
                    : "INF",
              Gender: passenger.isMale ? "Female" : "F",
            };
          }),
          PriceInfo: {
            PTC_FareBreakdowns: price_Break,
          },
        };
        
        // console.log("Booking: ", booking);
        // console.log("requestValues: ", requestValues);
        this.callApi(process.env.URL_IRANAIRTOUR_BOOK, requestValues)
          .then((reserveResult: any) => {
            // console.log("Heloo", JSON.stringify(reserveResult))
            if (reserveResult.Success)
              bookingCallback(_flg_ind, reserveResult);
            else{
              console.log("AirTour Error2", reserveResult)
              reject({
                code: "",
                data: reserveResult,
                error: reserveResult.Error + ` | Segment ${_flg.departureAirport
                  .cityCode} to ${_flg.arrivalAirport.cityCode}`,
                location: "IranAirTour manager -> book -> callApi (book) -> + " + ` | Segment ${_flg.departureAirport.cityCode} to ${_flg.arrivalAirport.cityCode}`,
                name: "Error in booking"
              });
            }
            return;
          })
          .catch(error => {
            console.log("AirTour Error", error)
            reject({
              code: "",
              data: requestValues,
              error: error.stack,
              location: "IranAirTout manager -> book -> callApi (book) -> " + ` | Segment ${_flg.departureAirport.cityCode} to ${_flg.arrivalAirport.cityCode}`,
              name: "InvalidResponse"
            });
            return;
          })

      });

      let bookingCallback = (index: number, result: any) => {
        let ticketTimeLimit = new Date();
        ticketTimeLimit.setMinutes(ticketTimeLimit.getMinutes() + 10);
        finalResult.result.rawData[index] = result;
        finalResult.result.pnr[index] = result.AirReservation.bookingReferenceID ? result.AirReservation.bookingReferenceID.Id : "IranAirTour";
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

  createTicket(booking: any, session?: gatewaySession, options?: gatewayInputOptions) {
    return new Promise<gatewayTicketInternalResult>((resolve, reject) => {
      let resultCount = 0;
      let finalResult = new gatewayTicketInternalResult();
      let ticketTempData = [];
      finalResult.session = null;
      booking.flights.itineraries.forEach((el, ind) => {
        const requestValues = {
          POS: {
            ...this.signitureData
          },
          OTA_DemandTicketRQ: {
            PNR: el.pnr,
          },
        };
        this.callApi(process.env.URL_IRANAIRTOUR_ISSUE, requestValues)
          .then((reserveResult: any) => {
            console.log("SASANNNNNN", reserveResult)
            if (reserveResult.Success) {
              ticketCallback(ind, reserveResult);
            }
            else{
              console.log("ISSUE ERRORRR",reserveResult)
              reject({
                code: "",
                data: process.env.URL_IRANAIRTOUR_ISSUE,
                error: reserveResult.AirReserve[0].Error + ` | Segment ${el.flights[0].departureAirport.cityCode} to ${el.flights[el.flights.length - 1].arrivalAirport.cityCode}`,
                location: "IranAirTour manager -> createTicket -> callApi (createTicket) -> + " + ` | Segment ${el.flights[0].departureAirport.cityCode} to ${el.flights[el.flights.length - 1].arrivalAirport.cityCode}`,
                name: "Error in createTicket"
              });
            }
            return;
          })
          .catch(error => {
            console.log("ISSUE ERRORRR",error)
            reject({
              code: "",
              data: process.env.URL_IRANAIRTOUR_ISSUE,
              error: error,
              location: "IranAirTour manager -> createTicket -> callApi (createTicket) -> " + ` | Segment ${el.flights[0].departureAirport.cityCode} to ${el.flights[el.flights.length - 1].arrivalAirport.cityCode}`,
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
            ticketNumber: result.AirReservation.TravelerInfo.find(el => el.Document.DocID == pass.nationalCode).ETicketInfos[0].ETicketNo,
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

  private callApi(url: string, body: any) {
    return new Promise((resolve, reject) => {
      // console.log("SDKJNKSD", JSON.stringify(body))
      ExternalRequest.syncPostRequest(url, undefined, body, undefined)
        .then((iranAirResult: any) => {
          resolve(iranAirResult);
        }).catch((error) => {
          console.log(error)
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

Object.seal(IranAirTourManager);