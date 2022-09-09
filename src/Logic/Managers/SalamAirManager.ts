import { errorObj } from "../../Common/Metadata/errorObjMetadata";
import { gatewayBookInternalData, gatewayBookInternalResult } from "../../Common/Metadata/gatewayBookResultMetadata";
import { gatewayInputOptions, gatewayLogicOutput, gatewayRuleInput, gatewaySearchInput, gatewaySearchInputItinerary, gatewaySession } from "../../Common/Metadata/gatewayLogicInputMetadata";
import { gatewayRulesResult } from "../../Common/Metadata/gatewayRulesResultMetadata";
import { gatewaySearchFlightResult, itineraryFlightSegment, nameObject, priceObject, searchCalendarResult, searchFlightItinerary, searchFlightResult } from "../../Common/Metadata/gatewaySearchResultMetadata";
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
//var parser = new xml2js.Parser();
import { writeFile } from "fs";

const soapRequest = require("easy-soap-request");
const fs = require("fs");
var parseString = require("xml2js").parseString;
const _ = require("lodash");
const environment = "Test";


const adult_code = 1; // codes used in salam documents
const child_code = 6;
const infant_code = 5;

export class SalamAirManager implements IGatewayImplement {

  private signitureData: any;

  constructor(signitureData) {

    this.signitureData = signitureData;
  }

  getSearch(item: gatewaySearchInput, session?: gatewaySession, calendarResultNotRequired?: boolean, loggedInUser?: any, options?: gatewayInputOptions) {
    return new Promise((resolve: (result: any) => void, reject: (error: errorObj) => void) => {
      let _result = new gatewaySearchFlightResult();
      let _temp_itineraries = [];
      let _finalSearchItems: gatewaySearchInput[] = [item];
      let _resultCount: number = 0;
      let _gatewayErrors: any[] = [];
      let _bookingClasses: any[] = [];
      let _token = "";
      let searchProcess = (item: gatewaySearchInput) => {
        this.Login()
          .then((token: any) => {
            _token = token;
            let url = process.env.SALAMAIR_PRICING_WEBSERVICE_URL
            let xml_flight = ""
            item.itineraries.map((flight) => {
              let xml_p = fs.readFileSync("src/Assets/SalamAirRequestTemplates/FareQuote_Detail_Passenger.xml", "utf-8");
              let xml_p_adult = "";
              let xml_p_child = "";
              let xml_p_infant = "";
              if (item.adult > 0) {
                xml_p_adult = xml_p
                  .replace(/{{PassengerTypeID}}/g, adult_code)
                  .replace(/{{Passenger_COUNT}}/g, item.adult)
              }
              if (item.child > 0) {
                xml_p_child = xml_p
                  .replace(/{{PassengerTypeID}}/g, child_code)
                  .replace(/{{Passenger_COUNT}}/g, item.child)
              }
              if (item.infant > 0) {
                xml_p_infant = xml_p
                  .replace(/{{PassengerTypeID}}/g, infant_code)
                  .replace(/{{Passenger_COUNT}}/g, item.adult)
              }
              let xml_f = fs.readFileSync("src/Assets/SalamAirRequestTemplates/FareQuote_Detail.xml", "utf-8");
              xml_f = xml_f
                .replace(/{{DepartureDateTime}}/g, flight.departDate)
                .replace(/{{OriginCode}}/g, flight.origin)
                .replace(/{{DestinationCode}}/g, flight.destination)
                .replace(/{{ADULT_COUNT}}/g, xml_p_adult)
                .replace(/{{CHILD_COUNT}}/g, xml_p_child)
                .replace(/{{INFANT_COUNT}}/g, xml_p_infant)

              xml_flight += xml_f
            })
            let xml = fs.readFileSync("src/Assets/SalamAirRequestTemplates/FareQuote.xml", "utf-8");
            xml = xml
              .replace(/{{TOKEN}}/g, token)
              .replace(/{{TA_NUMBER}}/g, this.signitureData._TA_NUMBER)
              .replace(/{{USERNAME_}}/g, this.signitureData._USERNAME)
              .replace(/{{FareQuoteDetails}}/g, xml_flight)
              .replace(/<!--[\s\S]*?-->/g, "")
              .replace(/\n/g, "")
              .replace(/\r/g, "")
              .replace(/ +(?= )/g, '')
            let headers = {
              'SOAPAction': process.env.SALAMAIR_FAREQUOTE_SOAP_ACTION,
              'Content-Type': 'text/xml',
            }

           let  identifier = Date.now();
        writeFile("C:\\salamErrors\\" + identifier + "_00_Search_fareXML.txt", JSON.stringify(xml), (err) => { })


            this.callApi(url, xml, headers)
              .then((_availability_result: any) => {
                
                let  identifier = Date.now();
                writeFile("C:\\salamErrors\\" + identifier + "_01_Search_fareXMLResponce.txt", JSON.stringify(_availability_result), (err) => { })
        
                parseString(_availability_result, (err, result: any) => {
                  if (err) {
                    _gatewayErrors.push({
                      code: "",
                      data: err,
                      error: "gateway Error",
                      location: "SalamAir manager -> get Search parsing -> callApi (availability)",
                      name: "InvalidResponse"
                    });
                    allSearchCallback();
                  }
                  else {
                    result = result["s:Envelope"]["s:Body"][0]["RetrieveFareQuoteResponse"][0]["RetrieveFareQuoteResult"][0];

                    let exception = result["a:Exceptions"][0]["b:ExceptionInformation.Exception"][0];
                    if (exception["b:ExceptionCode"][0] != "0") {
                      console.log("err SalamAir FareQuote: " + exception["b:ExceptionDescription"]);
                      _gatewayErrors.push({
                        code: "",
                        data: exception["b:ExceptionDescription"],
                        error: "gateway Error",
                        location: "SalamAir manager -> get Search  -> callApi (availability)",
                        name: "InvalidResponse"
                      });
                      allSearchCallback();
                    }
                    else {
                      let salam_result = result["a:FlightSegments"][0]["a:FlightSegment"].map(FlightSegment => {
                        return {
                          fareTypes: FlightSegment["a:FareTypes"][0]["a:FareType"],
                          ...FlightSegment,
                          SegmentDetails: result["a:SegmentDetails"][0]["a:SegmentDetail"].find(detail => detail["a:LFID"][0] === FlightSegment["a:LFID"][0]),
                          FlightLegDetails: FlightSegment["a:FlightLegDetails"][0]["a:FlightLegDetail"].map(detail => {
                            return result["a:LegDetails"][0]["a:LegDetail"].find(leg => leg["a:PFID"][0] === detail["a:PFID"][0])
                          }),
                        }
                      }
                      );
                      salam_result = _.flatMap(salam_result.map(segment => {
                        return segment.fareTypes.map(fareType => ({
                          fareType,
                          ...segment,
                        }))
                      }));

                      // let identifier = Date.now();
                      // writeFile("C:\\salamErrors\\" + identifier + "_0_salam_result.txt", JSON.stringify(salam_result), (err) => { })


                      if (salam_result.length === 0) {
                        _gatewayErrors.push({
                          code: "",
                          data: salam_result,
                          error: `no flight available for ${item.itineraries[0].origin} to ${item.itineraries[0].destination}`,
                          location: "SalamAir manager -> get Search -> _body[AvailableFlights].length=0",
                          name: "NoFlightAvailable"
                        });
                        allSearchCallback();
                      }
                      else {
                        _temp_itineraries = _temp_itineraries.concat(salam_result)
                        allSearchCallback();
                      }
                    }
                  }
                })
              }).catch(error => {
                // if(this.gatewayCode === "toptours")
                // console.log("SASAN TOP TOURS ERRORRR", error)
                _gatewayErrors.push({
                  code: "",
                  data: error,
                  error: "gateway Error",
                  location: "SalamAir manager -> get Search -> callApi (availability)",
                  name: "InvalidResponse"
                });
                allSearchCallback();
              });
          })
      }

      let allSearchCallback = () => {
        // HERE in stop flights
        // let identifier = Date.now();
        // writeFile("C:\\salamErrors\\" + identifier + "_1_allSearch_Count.txt", JSON.stringify({ _resultCount, _finalSearchItems: _finalSearchItems.length, _temp_itineraries: _temp_itineraries.length }), (err) => { })

        if (++_resultCount == _finalSearchItems.length) {

          // let identifier = Date.now();
          // writeFile("C:\\salamErrors\\" + identifier + "_2_allSearchCallback.txt", JSON.stringify(_temp_itineraries), (err) => { })

          if (_temp_itineraries.length == 0) {
            reject({
              code: "",
              data: _gatewayErrors,
              error: `no flight available`,
              location: "SalamAir manager -> get Search -> _body[AvailableFlights].length",
              name: "NoFlightAvailable"
            });
            return;
          }
          else {
            // let identifier = Date.now();
            // writeFile("C:\\salamErrors\\" + identifier + "_3_else_searchCallback.txt", JSON.stringify(_temp_itineraries), (err) => { })

            searchCallback();
          }
        }
      }

      let searchCallback = () => {
        let totalFlightCount = _temp_itineraries.length;
        let timezoneHelper = new IataTimezonesHelper();

        // let identifier = Date.now();
        // writeFile("C:\\salamErrors\\" + identifier + "_4_searchCallback.txt", JSON.stringify(_temp_itineraries), (err) => { })

        _temp_itineraries.forEach((travel, ind) => {
          let obj_AdultPrice =
          {
            TotalPrice: 0,
            BaseFare: 0,
            Tax: 0,
            Commission: 0,
            TicketDesignators: []
          }
          let obj_ChildPrice =
          {
            TotalPrice: 0,
            BaseFare: 0,
            Tax: 0,
            Commission: 0,
            TicketDesignators: []
          };
          let obj_InfantPrice =
          {
            TotalPrice: 0,
            BaseFare: 0,
            Tax: 0,
            Commission: 0,
            TicketDesignators: []
          }
          travel["fareType"]["a:FareInfos"][0]["a:FareInfo"].map(info => {
            if (info["a:PTCID"] == adult_code) {
              obj_AdultPrice.TotalPrice += info["a:BaseFareAmtInclTax"] * 1
              obj_AdultPrice.BaseFare += info["a:BaseFareAmtNoTaxes"] * 1
              obj_AdultPrice.Tax += (info["a:BaseFareAmtInclTax"] - info["a:BaseFareAmtNoTaxes"])
            }
            if (info["a:PTCID"] == child_code) {
              obj_ChildPrice.TotalPrice += info["a:BaseFareAmtInclTax"] * 1
              obj_ChildPrice.BaseFare += info["a:BaseFareAmtNoTaxes"] * 1
              obj_ChildPrice.Tax += (info["a:BaseFareAmtInclTax"] - info["a:BaseFareAmtNoTaxes"])
            }
            if (info["a:PTCID"] == infant_code) {
              obj_InfantPrice.TotalPrice += info["a:BaseFareAmtInclTax"] * 1
              obj_InfantPrice.BaseFare += info["a:BaseFareAmtNoTaxes"] * 1
              obj_InfantPrice.Tax += (info["a:BaseFareAmtInclTax"] - info["a:BaseFareAmtNoTaxes"])
            }
          });

          let loggage = 0;
          let fareTypeName = travel["fareType"]["a:FareTypeName"][0].toLowerCase()
          if (fareTypeName.includes('value'))
            loggage = 30;
          else if (fareTypeName.includes('plus'))
            loggage = 40;
          else if (fareTypeName.includes('friendly'))
            loggage = 20;
          else if (fareTypeName.includes('benefit'))
            loggage = 30;
          else if (fareTypeName.includes('light'))
            loggage = 0;
          else
            loggage = 20;

          let _flg_result = new searchFlightResult();
          _flg_result.GatewayData = _token
          _flg_result.Currency = travel["fareType"]["a:FareInfos"][0]["a:FareInfo"][0]["a:OriginalCurrency"][0];
          _flg_result.ProviderType = "SalamAirProvider"; // TODO: sasan ?
          _flg_result.SequenceNumber = null; // TODO: sasan ?
          _flg_result.CombinationId = "0";
          _flg_result.ValidatingAirlineCode = null;
          _flg_result.ForceETicket = null;
          _flg_result.E_TicketEligibility = "Eligible";
          _flg_result.ServiceFeeAmount = null;
          _flg_result.TotalPrice = obj_AdultPrice.TotalPrice * item.adult + obj_ChildPrice.TotalPrice * item.child + obj_InfantPrice.TotalPrice * item.infant;

          _flg_result.AdultPrice = obj_AdultPrice;
          _flg_result.ChildPrice = obj_ChildPrice;
          _flg_result.InfantPrice = obj_InfantPrice;

          let _itinerary = new searchFlightItinerary();
          _itinerary.DirectionId = "0";
          _itinerary.ElapsedTime = TimeToString.generateTimeStirng(timezoneHelper
            .setFromDateTimeWithTimezone(travel.FlightLegDetails[0]["a:DepartureDate"][0], travel.FlightLegDetails[0]["a:Origin"][0])
            .setToDateTimeWithTimezone(travel.FlightLegDetails[travel.FlightLegDetails.length - 1]["a:ArrivalDate"][0], travel.FlightLegDetails[travel.FlightLegDetails.length - 1]["a:Destination"][0])
            .calculateTimeDiff()).replace(":", "");
          _itinerary.RefNumber = ind.toString();
          _itinerary.StopCount = travel.FlightLegDetails.length - 1;
          _itinerary.isCharter = false;
          _itinerary.TotalStopTime = '00:00';
          _itinerary.Flights = travel.FlightLegDetails.map(fl => {

            let _itineraryFlight = new itineraryFlightSegment();
            _itineraryFlight.GatewayData = travel.fareType["a:FareInfos"][0]["a:FareInfo"][0]["a:FareID"][0];
            _itineraryFlight.DepartureDateTime = fl["a:DepartureDate"][0];
            _itineraryFlight.ArrivalDateTime = fl["a:ArrivalDate"][0];
            _itineraryFlight.FlightNumber = fl["a:FlightNum"][0];
            _itineraryFlight.ResBookDesigCode = travel.fareType["a:FareInfos"][0]["a:FareInfo"][0]["a:FCCode"][0];
            _itineraryFlight.FlightDuration = fl["a:FlightTime"][0];
            _itineraryFlight.DepartureAirport.Code = fl["a:Origin"][0];
            _itineraryFlight.DepartureAirport.Terminal = "";
            _itineraryFlight.ArrivalAirport.Code = fl["a:Destination"][0];
            _itineraryFlight.ArrivalAirport.Terminal = "";
            _itineraryFlight.MarketingAirline.Code = travel["SegmentDetails"]["a:SellingCarrier"][0];
            _itineraryFlight.OperatingAirline.Code = fl["a:OperatingCarrier"][0];
            _itineraryFlight.Equipment.Code = fl["a:AircraftType"][0];
            _itineraryFlight.Equipment.Name.en = null;
            _itineraryFlight.Equipment.Name.fa = null;
            _itineraryFlight.BookingClassAvails = {
              ResBookDesigCode: travel.fareType["a:FareInfos"][0]["a:FareInfo"][0]["a:FCCode"][0],
              ResBookDesigQuantity: travel.fareType["a:FareInfos"][0]["a:FareInfo"][0]["a:SeatsAvailable"][0],
              RPH: travel.fareType["a:FareInfos"][0]["a:FareInfo"].find(info => info["a:PTCID"][0] == adult_code)["a:BundleCode"][0], // a bundle code of an adult, is need for retriving SSR code in booking before calling SummaryPNR
              AvailablePTC: "ADT",
              ResBookDesigCabinCode: travel.fareType["a:FareInfos"][0]["a:FareInfo"][0]["a:Cabin"][0] == 'ECONOMY' ? "Y" : "C",
              //in fareBasis , we user FBCode-LFID (due to lack of empty fields, it is used for keeping both values)
              FareBasis: travel.fareType["a:FareInfos"][0]["a:FareInfo"][0]["a:FBCode"][0]
                + "-" + travel["a:LFID"][0],
              FareType: travel.fareType["a:FareTypeName"][0],
              ResBookDesigCabinName: {
                en: travel.fareType["a:FareInfos"][0]["a:FareInfo"][0]["a:Cabin"][0],
                fa: ""
              }
            };
            _itineraryFlight.Baggage = [ // TODO :?
              {
                Index: "0",
                Quantity: loggage.toString(),
                Type: "ADT",
                Unit: "KG",
              },

            ];
            _itineraryFlight.StopLocation = [];


            return _itineraryFlight
          })
          //_itinerary.Flights[0] = _itineraryFlight;

          _flg_result.Itineraries[0] = _itinerary;
          _result.flights.push(_flg_result);
        })
        // identifier = Date.now();
        // writeFile("C:\\salamErrors\\" + identifier + "_5_afterForeach.txt", JSON.stringify(_result), (err) => { })


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
        MarkupHelper.calculateMarkup(loggedInUser, 'salamair', item, result, options)
          .then((newResult: gatewaySearchFlightResult) => {
            resolve(newResult);
          })
          .catch(err => {
            // error on fetch markup
            // return bare result for now
            resolve(result);
          })
      }

      // console.log("salamAir ITEM", item)
      this.extractAllOriginDestionationOptions(item)
        .then(result => { _finalSearchItems = result; })
        .catch(err => { })
        .finally(() => {
          _finalSearchItems.forEach((el, ind) => {
            // console.log("salamAir", el)
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
          "SalamAir Manager -> Search Calendar"))
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
    let identifier = Date.now();
    writeFile("C:\\salamErrors\\" + identifier + "book_01_booking.txt", JSON.stringify(booking), (err) => { })

    return new Promise<gatewayBookInternalResult>((resolve, reject) => {
      let resultCount = 0;
      let finalResult = new gatewayBookInternalResult();
      finalResult.session = null;

      let url = process.env.SALAMAIR_RESERVATION_WEBSERVICE_URL
      let url_pricing = process.env.SALAMAIR_PRICING_WEBSERVICE_URL
      let xml_traveler = "";
      let xml_segments = "";
      let xml_bundles = "";
      let xml_special = "";
      let _bundle = booking.flights.itineraries[0].flights[0].RPH

      xml_bundles = fs.readFileSync("src/Assets/SalamAirRequestTemplates/Bundle_Details.xml", "utf-8");
      xml_bundles = xml_bundles
        .replace(/{{BUNDLE}}/g, _bundle ? _bundle : "")
        .replace(/{{SecurityGUID_FAREID}}/g, booking.flights.gatewayData)
        .replace(/{{USERNAME_}}/g, process.env.SALAMAIR_USERNAME)
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/\n/g, "")
        .replace(/\r/g, "")
        .replace(/\t/g, "")
        .replace(/ +(?= )/g, '')
      let headers = {
        'SOAPAction': process.env.SALAMAIR_BUNDLEDETAILS_SOAP_ACTION,
        'Content-Type': 'text/xml',
      }

      this.callApi(url_pricing, xml_bundles, headers)
        .then((response_bundle: any) => {
          parseString(response_bundle, (err_bundle, result_bundle: any) => {
            if (err_bundle) {
              reject({
                code: "",
                data: response_bundle,
                error: err_bundle,
                location: "SalamAir manager -> book -> callApi (BundleDetails) -> parseString ",
                name: "Error in booking"
              });
              return;
            }

            let identifier = Date.now();
            writeFile("C:\\salamErrors\\" + identifier + "book_02_bundle.txt", JSON.stringify(result_bundle), (err) => { })


            result_bundle = result_bundle["s:Envelope"]["s:Body"][0]["RetrieveFareBundleDetailsResponse"][0]["RetrieveFareBundleDetailsResult"][0]
            if (result_bundle["a:BundleId"][0] == "0") {
              // no bundle , special services tag is needed
              xml_special = "0"
            }

            booking.passengers.map((passenger, index) => {
              let xml_t = fs.readFileSync("src/Assets/SalamAirRequestTemplates/Summary_Passengers.xml", "utf-8");
              xml_t = xml_t
                .replace(/{{PersonOrgID}}/g, -1 * (index + 1))
                .replace(/{{FirstName}}/g, passenger.firstName)
                .replace(/{{LastName}}/g, passenger.lastName)
                .replace(/{{WBCID}}/g, index + 1)
                .replace(/{{DOB}}/g, passenger.birthDate)
                .replace(/{{Gender}}/g, passenger.isMale ? "Male" : "Female")
                .replace(/{{Title}}/g, passenger.isMale ? (passenger.type == 'adult' ? "Mr" : "Mstr") : (passenger.type == 'adult' ? "MRS" : "MS"))
                .replace(/{{PTCID}}/g, passenger.type == 'adult' ? adult_code : (passenger.type == 'child' ? child_code : infant_code))
                .replace(/{{PTC}}/g, passenger.type == 'adult' ? 'ADT' : (passenger.type == 'child' ? 'CHD' : 'INF'))
                .replace(/{{Passport}}/g, passenger.passportNo)
                .replace(/{{Nationality}}/g, passenger.nationality.code)
                .replace(/{{PhoneNumber}}/g, booking.issuerContactInfo.mobile)
                .replace(/{{TravelsWithPersonOrgID}}/g, passenger.type == 'infant' ? "-1" : "-2147483648")
                ;

              xml_traveler += xml_t

              if (xml_special !== "0" && passenger.type != 'infant') {
                let xml_spe = fs.readFileSync("src/Assets/SalamAirRequestTemplates/Summary_Segments_SpecialServices.xml", "utf-8");
                xml_spe = xml_spe
                  .replace(/{{CodeType}}/g, result_bundle["a:BundleServiceDetails"][0]["a:BundleServiceDetail"][0]["a:GlCode"][0])
                  .replace(/{{ServiceID}}/g, result_bundle["a:BundleServiceDetails"][0]["a:BundleServiceDetail"][0]["a:ServiceID"][0])
                  .replace(/{{SSRCategory}}/g, result_bundle["a:BundleServiceDetails"][0]["a:BundleServiceDetail"][0]["a:CategoryID"][0])
                  .replace(/{{LogicalFlightID}}/g, booking.flights.itineraries[0].flights[0].fareBasis.split("-")[1])
                  .replace(/{{DepartureDate}}/g, booking.flights.itineraries[0].flights[0].departureDateTime)
                  .replace(/{{Currency}}/g, booking.moneyUnit.moneyUnit)
                  .replace(/{{PersonOrgID}}/g, -1 * (index + 1))
                xml_special += xml_spe
              }
            })

            if (xml_special === "0") {
              xml_special = ""
            }

            xml_segments = fs.readFileSync("src/Assets/SalamAirRequestTemplates/Summary_Segments.xml", "utf-8");
            xml_segments = xml_segments
              .replace(/{{FareInformationID}}/g, booking.flights.itineraries[0].flights[0].gatewayData)
              .replace(/{{SpecialServices}}/g, xml_special);

            let xml = fs.readFileSync("src/Assets/SalamAirRequestTemplates/Summary.xml", "utf-8");
            xml = xml
              .replace(/{{SecurityGUID_FAREID}}/g, booking.flights.gatewayData)
              .replace(/{{Currency}}/g, booking.moneyUnit.moneyUnit)
              .replace(/{{Passengers}}/g, xml_traveler)
              .replace(/{{Segments}}/g, xml_segments)
              .replace(/{{ContactInfo_PhoneNumber}}/g, booking.issuerContactInfo.mobile)
              .replace(/{{ContactInfo_Email}}/g, booking.issuerContactInfo.email)
              .replace(/{{TA_NUMBER}}/g, this.signitureData._TA_NUMBER)
              .replace(/{{USERNAME_}}/g, this.signitureData._USERNAME)
              .replace(/<!--[\s\S]*?-->/g, "")
              .replace(/\n/g, "")
              .replace(/\r/g, "")
              .replace(/\t/g, "")
              .replace(/ +(?= )/g, '')
            headers = {
              'SOAPAction': process.env.SALAMAIR_SUMMARY_SOAP_ACTION,
              'Content-Type': 'text/xml',
            }


            identifier = Date.now();
            writeFile("C:\\salamErrors\\" + identifier + "book_022_xmlSummary.txt", JSON.stringify(xml), (err) => { })


            this.callApi(url, xml, headers)
              .then(response => {

                let identifier = Date.now();
                writeFile("C:\\salamErrors\\" + identifier + "book_03_SUMMARY.txt", JSON.stringify(response), (err) => { })


                xml = fs.readFileSync("src/Assets/SalamAirRequestTemplates/CreatePNR.xml", "utf-8");
                xml = xml
                  .replace(/{{SecurityGUID_FAREID}}/g, booking.flights.gatewayData)
                  .replace(/{{USERNAME_}}/g, this.signitureData._USERNAME)
                  .replace(/<!--[\s\S]*?-->/g, "")
                  .replace(/\n/g, "")
                  .replace(/\r/g, "")
                  .replace(/ +(?= )/g, '')
                headers = {
                  'SOAPAction': process.env.SALAMAIR_CREATEPNR_SOAP_ACTION,
                  'Content-Type': 'text/xml',
                }

                this.callApi(url, xml, headers)
                  .then((response_createPNR: any) => {
                    parseString(response_createPNR, (err, result: any) => {
                      if (err) {
                        reject({
                          code: "",
                          data: response_createPNR,
                          error: err,
                          location: "SalamAir manager -> book -> callApi (CreatePNR) -> parseString ",
                          name: "Error in booking"
                        });
                        return;
                      }
                      let exeption = result["s:Envelope"]["s:Body"][0]["CreatePNRResponse"][0]["CreatePNRResult"][0]["a:Exceptions"][0]["b:ExceptionInformation.Exception"][0]
                      let identifier = Date.now();
                      writeFile("C:\\salamErrors\\" + identifier + "book_04_createPNR.txt", JSON.stringify(result), (err) => { })


                      if (exeption["b:ExceptionCode"][0] != "0") {
                        reject({
                          code: "",
                          data: exeption,
                          error: exeption["b:ExceptionDescription"][0],
                          location: "SalamAir manager -> book -> callApi (CreatePNR) -> exeption ",
                          name: "Error in booking"
                        });
                        return;
                      }

                      let totalpayment = result["s:Envelope"]["s:Body"][0]["CreatePNRResponse"][0]["CreatePNRResult"][0]["a:ReservationBalance"][0]
                      let confirmation = result["s:Envelope"]["s:Body"][0]["CreatePNRResponse"][0]["CreatePNRResult"][0]["a:ConfirmationNumber"][0]

                      bookingCallback(/*_flg_ind*/0, { totalpayment, confirmation });

                      return;
                    })
                  })
                  .catch(error => {
                    reject({
                      code: "",
                      data: xml,
                      error: error,
                      location: "SalamAir manager -> book -> callApi (CREATEPNR) ",
                      name: "InvalidResponse"
                    });
                    return;
                  })

              })
              .catch(error => {
                reject({
                  code: "",
                  data: xml,
                  error: error,
                  location: "SalamAir manager -> book -> callApi (SUMMARY)  ",
                  name: "InvalidResponse"
                });
                return;
              })

          })
        })
        .catch(error => {
          console.log("SalamAir manager -> book ->  Calling BUNDLEDETAILS :: ", error)
          reject({
            code: "",
            data: xml_bundles,
            error: error,
            location: "SalamAir manager -> book ->  Calling BUNDLEDETAILS",
            name: "InvalidResponse"
          });
          return;
        })

      let bookingCallback = (index: number, result: any) => {

        let identifier = Date.now();
        writeFile("C:\\salamErrors\\" + identifier + "book_05_bookingCallback.txt", JSON.stringify(result), (err) => { })

        let ticketTimeLimit = new Date();
        ticketTimeLimit.setMinutes(ticketTimeLimit.getMinutes() + 10);
        finalResult.result.rawData[index] = result;
        finalResult.result.pnr[index] = result.confirmation ? result.confirmation : "SalamAir";
        finalResult.result.ticketType[index] = "";
        if (finalResult.result.ticketTimeLimit == "" || (new Date(finalResult.result.ticketTimeLimit + "Z") > ticketTimeLimit))
          finalResult.result.ticketTimeLimit = ticketTimeLimit.toISOString().replace('Z', '');
        if (++resultCount == booking.flights.itineraries.length) {
          finalResult.result.pnr = [finalResult.result.pnr.join("|")]
          finalResult.result.rawData = [finalResult.result.rawData]
          finalResult.result.totalPrice = result.totalpayment * 1;
          finalResult.result.bookDate = new Date().toISOString();
          finalResult.result.moneyUnit = booking.moneyUnit.moneyUnit;


          identifier = Date.now();
          writeFile("C:\\salamErrors\\" + identifier + "book_06_finalResult.txt", JSON.stringify(finalResult), (err) => { })

          resolve(finalResult)
        }
      }




      // booking.flights.itineraries[0].flights.forEach((flight, _flg_ind) => {


      //   let ticketTimeLimit = new Date();
      //   ticketTimeLimit.setMinutes(ticketTimeLimit.getMinutes() + 10);
      //   finalResult.result.rawData[_flg_ind] = "";//result;
      //   finalResult.result.pnr[_flg_ind] = "iranair"//result["BookingReferenceID"].ID;
      //   finalResult.result.ticketType[_flg_ind] = "";
      //   if (finalResult.result.ticketTimeLimit == "" || (new Date(finalResult.result.ticketTimeLimit + "Z") > ticketTimeLimit))
      //     finalResult.result.ticketTimeLimit = ticketTimeLimit.toISOString().replace('Z', '');
      //   if (++_flg_ind == booking.flights.itineraries.length) {
      //     finalResult.result.pnr = [finalResult.result.pnr.join("|")]
      //     finalResult.result.rawData = [finalResult.result.rawData]
      //     finalResult.result.totalPrice = booking.flights.itineraries[0].price ? booking.flights.itineraries[0].price.totalPrice : booking.totalPrice;
      //     finalResult.result.bookDate = new Date().toISOString();
      //     finalResult.result.moneyUnit = booking.moneyUnit.moneyUnit;
      //     resolve(finalResult)
      //   }
      // })




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
    let identifier = Date.now();
    writeFile("C:\\salamErrors\\" + identifier + "_issueingInput.txt", JSON.stringify(booking), (err) => { })

    return new Promise<gatewayTicketInternalResult>((resolve, reject) => {
      let resultCount = 0;
      let finalResult = new gatewayTicketInternalResult();
      let ticketTempData = [];
      finalResult.session = null;


      let flight = booking.flights.itineraries[0].flights[0]
      let _flg_ind = 0
      // booking.flights.itineraries[0].flights.forEach((flight, _flg_ind) => {
      let url = process.env.SALAMAIR_FULFILLMENT_WEBSERVICE_URL
      let xml = fs.readFileSync("src/Assets/SalamAirRequestTemplates/Payment.xml", "utf-8");
      xml = xml
        .replace(/{{SecurityGUID_FAREID}}/g, booking.flights.gatewayData)
        .replace(/{{TA_NUMBER}}/g, this.signitureData._TA_NUMBER)
        .replace(/{{USERNAME_}}/g, this.signitureData._USERNAME)
        .replace(/{{ConfirmationNumber}}/g, booking.flights.itineraries[0].pnr)
        .replace(/{{Amount}}/g, booking.totalPrice)
        .replace(/{{Currency}}/g, booking.moneyUnit.moneyUnit)
        .replace(/{{DatePaid}}/g, new Date().toISOString().split('T')[0])
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/\n/g, "")
        .replace(/\r/g, "")
        .replace(/ +(?= )/g, '')
      let headers = {
        'SOAPAction': process.env.SALAMAIR_PAYMENT_SOAP_ACTION,
        'Content-Type': 'text/xml',
      }
      this.callApi(url, xml, headers)
        .then((reserveResult: any) => {
          parseString(reserveResult, (err, result: any) => {
            if (err) {
              reject({
                code: "",
                data: result,
                error: err,
                location: "SalamAir manager -> create ticket -> callApi (payment) -> parseString ",
                name: "Error in createTicket"
              });
            }


            let identifier = Date.now();
            writeFile("C:\\salamErrors\\" + identifier + "_issueing_payment.txt", JSON.stringify([result]), (err) => { })


            let exeption = result["s:Envelope"]["s:Body"][0]["ProcessPNRPaymentResponse"][0]["ProcessPNRPaymentResult"][0]["a:Exceptions"][0]["b:ExceptionInformation.Exception"][0]
            if (exeption["b:ExceptionCode"][0] != "0")
              reject({
                code: "",
                data: exeption,
                error: exeption["b:ExceptionDescription"][0] + ` | Segment ${flight.flights[0].departureAirport.cityCode} to ${flight.flights[flight.flights.length - 1].arrivalAirport.cityCode}`,
                location: "SalamAir manager -> createTicket -> callApi (createTicket) -> + " + ` | Segment ${flight.flights[0].departureAirport.cityCode} to ${flight.flights[flight.flights.length - 1].arrivalAirport.cityCode}`,
                name: "Error in createTicket"
              });
            url = process.env.SALAMAIR_RESERVATION_WEBSERVICE_URL
            xml = fs.readFileSync("src/Assets/SalamAirRequestTemplates/SaveReserve.xml", "utf-8");
            xml = xml
              .replace(/{{SecurityGUID_FAREID}}/g, booking.flights.gatewayData)
              .replace(/{{USERNAME_}}/g, process.env.SALAMAIR_USERNAME)
              .replace(/{{ConfirmationNumber}}/g, booking.flights.itineraries[0].pnr)
              .replace(/<!--[\s\S]*?-->/g, "")
              .replace(/\n/g, "")
              .replace(/\r/g, "")
              .replace(/ +(?= )/g, '')
            headers = {
              'SOAPAction': process.env.SALAMAIR_CREATEPNR_SOAP_ACTION,
              'Content-Type': 'text/xml',
            }
            this.callApi(url, xml, headers)
              .then((response_save: any) => {
                parseString(response_save, (err, result_save: any) => {
                  if (err) {
                    reject({
                      code: "",
                      data: response_save,
                      error: err,
                      location: "SalamAir manager -> create ticket -> callApi (save reservation) -> parseString ",
                      name: "Error in createTicket"
                    });
                  }
                  let exeption = result_save["s:Envelope"]["s:Body"][0]["CreatePNRResponse"][0]["CreatePNRResult"][0]["a:Exceptions"][0]["b:ExceptionInformation.Exception"][0]
                  if (exeption["b:ExceptionCode"][0] != "0") {
                    reject({
                      code: "",
                      data: exeption,
                      error: exeption["b:ExceptionDescription"][0] + ` | Segment ${flight.flights[0].departureAirport.cityCode} to ${flight.flights[flight.flights.length - 1].arrivalAirport.cityCode}`,
                      location: "SalamAir manager -> createTicket -> callApi (save reserve) -> + " + ` | Segment ${flight.flights[0].departureAirport.cityCode} to ${flight.flights[flight.flights.length - 1].arrivalAirport.cityCode}`,
                      name: "Error in createTicket"
                    });
                  }
                  let identifier = Date.now();
                  writeFile("C:\\salamErrors\\" + identifier + "_issueing_save.txt", JSON.stringify(result_save), (err) => { })

                  let final: any = {}
                  ticketCallback(_flg_ind, result);
                })
              })
          })
        })
        .catch(error => {
          reject({
            code: "",
            data: process.env.SALAMAIR_CREATEPNR_SOAP_ACTION,
            error: error,
            location: "SalamAir manager -> createTicket -> callApi (Payment) -> " + ` | Segment ${flight.flights[0].departureAirport.cityCode} to ${flight.flights[flight.flights.length - 1].arrivalAirport.cityCode}`,
            name: "InvalidResponse"
          });
          return;
        })
      // })








      let ticketCallback = (index: number, result: any) => {
        ticketTempData[index] = result;
        booking.passengers.forEach((pass, pass_index) => {
          finalResult.result.tickets.push({
            passengerIndex: pass.index,
            flightIndex: index,
            refrenceId: "",
            ticketNumber: booking.flights.itineraries[0].pnr, // TODO: Sasan put ticketNumber
            status: [],
            pnr: booking.flights.itineraries[0].pnr,
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

  getPing() {
    return new Promise((resolve, reject) => {
      let xml = fs.readFileSync("src/Assets/IranAirRequestTemplates/Ping.xml", "utf-8");
      xml = xml
        .replace(/{{Agent_ID}}/g, process.env.IRANAIR_AgentID)
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/\n/g, "")
        .replace(/ +(?= )/g, '')
      let headers = {
        "Content-Type": "application/xml",
      }
      this.callApi(process.env.IRANAIR_PING, xml, headers)
        .then((response: any) => {
          resolve(response)
        }, (error) => {
          console.log(error)
          reject({
            status: '500 ExternalRequest',
            message: error.message,
          })
        })
        .catch(err => reject(err))
    })
  };

  getCancel: (item: any, callback: (error: any, result: any) => void) => void;

  getAirOrderTicket: (item: any, callback: (error: any, result: any) => void) => void;

  private callApi(url: string, body: any, header: any) {
    return new Promise((resolve, reject) => {
      ExternalRequest.syncPostRequest(url,
        undefined, body, undefined, undefined, undefined, undefined, header)
        .then((salamResult: any) => {
          resolve(salamResult);
        }).catch((error) => {
          console.log("ERRORRR in calling SalamAir Api")
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

  private GetToken = () => {
    return new Promise((resolve, reject) => {
      let xml = fs.readFileSync("src/Assets/SalamAirRequestTemplates/Token.xml", "utf-8");
      xml = xml
        .replace(/{{USERNAME_}}/g, this.signitureData._USERNAME_API)
        .replace(/{{PASSWORD_}}/g, this.signitureData._PASSWORD_API)
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/\r/g, "")
        .replace(/\n/g, "")
        .replace(/ +(?= )/g, '')

      let headers = {
        'SOAPAction': process.env.SALAMAIR_TOKEN_SOAP_ACTION,
        'Content-Type': 'text/xml',
      }
      this.callApi(process.env.SALAMAIR_SECURITY_WEBSERVICE_URL, xml, headers)
        .then((response: any) => {
          parseString(response, (err, result: any) => {
            if (err) {
              console.log("err in parsing Salam Token" + err);
              reject(err)
            }
            let token = result["s:Envelope"]["s:Body"][0]["RetrieveSecurityTokenResponse"][0]["RetrieveSecurityTokenResult"][0]["a:SecurityToken"][0]
            resolve(token)
          })
        })
        .catch((error) => {
          console.log("error in Salam GetToken" + error);
          reject(error)
        });
    })
  }

  private Login = () => {
    return new Promise((resolve, reject) => {
      let url = process.env.SALAMAIR_TRAVELAGENT_WEBSERVICE_URL
      this.GetToken()
        .then((token: any) => {
          let xml = fs.readFileSync("src/Assets/SalamAirRequestTemplates/Login.xml", "utf-8");
          xml = xml
            .replace(/{{TOKEN}}/g, token)
            .replace(/{{TA_NUMBER}}/g, this.signitureData._TA_NUMBER)
            .replace(/{{USERNAME_}}/g, this.signitureData._USERNAME)
            .replace(/{{PASSWORD_}}/g, this.signitureData._PASSWORD)
            .replace(/<!--[\s\S]*?-->/g, "")
            .replace(/\r/g, "")
            .replace(/\n/g, "")
            .replace(/ +(?= )/g, '')
          let headers = {
            'SOAPAction': process.env.SALAMAIR_LOGIN_SOAP_ACTION,
            'Content-Type': 'text/xml',
          }
          // console.log('SALAMMM login XML REQ =', xml)
          this.callApi(url, xml, headers)
            .then((response: any) => {
              parseString(response, (err, result: any) => {
                if (err) {
                  console.log("err in parsing Salam Loging " + err);
                  reject(err)
                }
                let login = result["s:Envelope"]["s:Body"][0]["LoginTravelAgentResponse"][0]["LoginTravelAgentResult"][0]["a:LoggedIn"][0]
                if (login)
                  resolve(token)
                else
                  reject(false)
              })
            })
            .catch((error) => {
              console.log("error in calling Salam Loging Api" + error);
              reject(error)
            });
        })
        .catch(err => {
          console.log("error in calling Salam Loging Api" + err);
          reject(err)
        })
    })


  }
}
Object.seal(SalamAirManager);
