import { Request } from "express";
import { BaseRepository } from "../../Repositories/Base/BaseRepository";
import { gateway } from "../../Common/Metadata/gatewayMetadata";
import { ExternalRequest } from "../../Infrastructure/ExternalRequests";
import { SignituresManager } from "../Managers/SignituresManager"
import { AmadeusManager } from "../Managers/AmadeusManager";
import { gatewayLogicOutput, gatewaySession, gatewaySessionList, gatewaySearchInput, gatewayInputOptions, amadeusSession, gatewaySignitureResult, gatewayRuleInput } from "../../Common/Metadata/gatewayLogicInputMetadata";
import { gatewaySearchResult, multipleGatewaySearchFlightResult, searchFlightResult, gatewaySearchFlightResult, gatewaySearchFullResult, searchCalendarResult, itineraryFlightSegmentAirline, searchAirlineResult, searchAirportResult, searchBaggageResult, searchStopCountResult, nameObject, searchCabinResult, itineraryFlightSEgmentCabin } from "../../Common/Metadata/gatewaySearchResultMetadata";
import { gatewayMethods } from "../../Common/Metadata/gatewayMethodsMetadata";
import { resolve } from "url";
import { errorObj } from "../../Common/Metadata/errorObjMetadata";
import { CaspianManager } from "./CaspianManager";
import { MultipleGatewayManager } from "./MultipleGatewayManager";
import { ZagrosManager } from "./ZagrosManager";
import { FlightTypeHelper } from "../../Repositories/Utility/FlightTypeHelper";
import { DynamicGatewayFunctionsHelper } from "../../Repositories/Utility/DynamicGatewayFunctionsHelper";
import { gatewayBookInternalData, gatewayBookData, gatewayBookFinalResult, gatewayBookInternalResult, multipleGatewayBookInternalResult } from "../../Common/Metadata/gatewayBookResultMetadata";
import { gatewayRulesResult } from "../../Common/Metadata/gatewayRulesResultMetadata";
import { MarkupHelper } from "../../Repositories/Utility/MarkupHelper";
import { paymentResponse } from "../../Common/Metadata/paymentResponseMetadata";
import { gatewayTicketInternalResult, gatewayTicketFinalResult, multipleGatewayTicketInternalResult } from "../../Common/Metadata/gatewayTicketResultMetadata";
import { calendarHelper } from "../../Repositories/Utility/calendarHeper";
import { generateMatrix } from "../../Repositories/Utility/matrixGenerator";
const _ = require("lodash");
const bookingThreshold = parseInt(process.env.BOOKINGTIME_THRESHOLD);
var ObjectId = require("mongodb").ObjectID;
import { writeFile } from "fs";

export class GatewaysManager extends BaseRepository<gateway> {
  constructor() {
    super("gateways");
    DynamicGatewayFunctionsHelper.init();
  }

  getEnabledImportPNR() {
    return new Promise((resolve, reject) => {
      this.find({ importPNREnabled: true }, (err, result) => {
        if (err)
          reject(err);
        else
          resolve(result);
      })
    })
  }

  getByCode(internalcode: string) {
    return new Promise((resolve, reject) => {
      this.find({ internalCode: internalcode }, (err, result) => {
        if (err)
          reject(err);
        else
          resolve(result[0]);
      })
    })
  }

  getByCodeList(internalcodeList: string[]) {
    return new Promise((resolve, reject) => {
      this.find({ internalCode: { $in: internalcodeList } }, (err, result) => {
        if (err)
          reject(err);
        else
          resolve(result);
      })
    })
  }

  getByIdsList(id_list: any, callback: (error: any, result: any) => void) {
    let myObj = [];
    id_list.forEach(element => {
      if (element != null) {
        try {
          myObj.push(ObjectId(element));
        } catch { }
      }
    });
    this.find({ _id: { $in: myObj } }, callback);
  }

  search(searchObj: gatewaySearchInput, session: gatewaySessionList, loggedInUser: any, options: gatewayInputOptions = new gatewayInputOptions()) {
    return new Promise((resolve: (result: gatewaySearchFullResult) => void, reject: (error: errorObj) => void) => {
      this.getLastUSDIRRExchangeRate()
        .then(exchangeRate => {
          let totalGatewayCount: number = 0;
          let gatewayResultCount: number = 0;
          let availableGatewayHasFlight: any[][] = [];
          let totalGeneralDataCount: number = 4;
          let generalDataCount: number = 0;
          let tempCalendarResult: searchCalendarResult[] = [];
          let tempAirlineList: itineraryFlightSegmentAirline[][] = [];
          let tempAirportList: string[][] = [];
          let tempAirplaneList: { Name: nameObject; Code: string; }[] = [];
          let tempBaggagesIndexList: string[] = [];
          let tempCabinList: itineraryFlightSEgmentCabin[][] = [];
          let _result: gatewaySearchFullResult = new gatewaySearchFullResult();
          let removeFlightsForCabinClass = [];

          if (searchObj.itineraries.length == 1 || FlightTypeHelper.checkRoundTripFlight(searchObj.itineraries)) {
            tempCalendarResult = generateMatrix(searchObj.itineraries.map(calendarHelper.generateCalendarDates)).map(el => {
              return { AdultPrice: 0, Currency: "IRR", Date: el }
            });
          }

          this.getSignitures()
            .then(gwy_result => {
              gwy_result = gwy_result.filter(el => el.internalCode && this.checkGatewayDevMode(options, el.internalCode));

              let gatewayGroupCodes = [];
              let gwy_result_individual = [];

              if (searchObj.itineraries.length > 1) {
                gatewayGroupCodes = Array.from(new Set(gwy_result.filter(el => el.groupCode).map(el => el.groupCode)));
                gwy_result_individual = gwy_result.filter(el => el.isCalledIndividually);
              }
              else
                gwy_result_individual = gwy_result;
              totalGatewayCount = gwy_result_individual.length + gatewayGroupCodes.length;
              
              if (totalGatewayCount) {
                for (let index = 0; index < gatewayGroupCodes.length; index++) {
                  let gateways = gwy_result.filter(el => el.groupCode == gatewayGroupCodes[index]);
                  DynamicGatewayFunctionsHelper.multiGateway.search(gateways, searchObj, session, loggedInUser, options, exchangeRate)
                    .then((res) => {
                      if (res.sessionList) {
                        Object.keys(res.sessionList).forEach(gateway => {
                          if (res.sessionList[gateway])
                            _result.session[gateway] = res.sessionList[gateway];
                        })
                      }
                      searchCallback({ calendar: res.calendar, flights: res.flights, session: null });
                    })
                    .catch(error => {
                      if (options.devMode) {
                        reject(error);
                      } else
                        searchCallback(new gatewaySearchFlightResult());
                    });
                }
                for (let index = 0; index < gwy_result_individual.length; index++) {
                  const element = gwy_result_individual[index];
                  if (element.internalCode == "amadeus" && !options.devMode && searchObj.itineraries.some(_itin => _itin.destinationCountryCode == "IR" && _itin.originCountryCode == "IR")) {
                    console.log("AMADEUS DISMISSED");
                    searchCallback(new gatewaySearchFlightResult());
                  }
                  else if (element.internalCode != "amadeus_global" && !options.devMode && searchObj.itineraries.some(_itin => _itin.destinationCountryCode != "IR" && _itin.originCountryCode != "IR")) {
                    // console.log("SOTO DISMISSED");
                    searchCallback(new gatewaySearchFlightResult());
                  }
                  //TODO: Amadeus Global Dismiss for now
                  // else if (element.internalCode == "amadeus_global" && options.devMode) {
                  //   console.log("AMADEUS GLOBAL DISMISSED");
                  //   searchCallback(new gatewaySearchFlightResult());
                  // }
                  else if (element.internalCode == "amadeus_global" && !options.devMode && searchObj.itineraries.some(_itin => _itin.destinationCountryCode == "IR" && _itin.originCountryCode == "IR")) {
                    console.log("AMADEUS GLOBAL DISMISSED");
                    searchCallback(new gatewaySearchFlightResult());
                  }
                  else {
                    if (DynamicGatewayFunctionsHelper[element.internalCode]) {
                      DynamicGatewayFunctionsHelper[element.internalCode].search(element.signiture, searchObj, session[element.internalCode], loggedInUser, options, exchangeRate)
                        .then((res) => {
                          res.flights.forEach(flg => {
                            flg.Itineraries.forEach(itin => {
                              itin.Gateway.id = element._id;
                              itin.Gateway.Code = element.internalCode;
                              itin.Gateway.Name = element.name;
                            })
                          })
                          if (res.session)
                            _result.session[element.internalCode] = res.session;
                          searchCallback(res);
                        })
                        .catch(error => {
                          if (options.devMode) {
                            if (error.data && error.data.session)
                              error.data.session = { [element.internalCode]: error.data.session };
                            reject(error);
                          } else
                            searchCallback(new gatewaySearchFlightResult());
                        });
                    }
                    else
                      searchCallback(new gatewaySearchFlightResult());
                  }
                }
              }
              else
                reject(
                  new errorObj("noProperGateway",
                    "",
                    "No gateway match given conditions",
                    "Gateways Manager -> Search",
                    {}));
            })
            .catch(error => reject(error));

          // callback function which is called on gateway response
          let searchCallback = (gatewayResult: gatewaySearchFlightResult) => {
            _result.result.flights = _result.result.flights.concat(gatewayResult.flights);
            gatewayResult.calendar.forEach(el => el.Date = el.Date.map(date => date.split("T")[0])) // TODO: must be removed

            gatewayResult.calendar.map(calResult => {
              let _tempCal = tempCalendarResult.find(cal => cal.Date[0] == calResult.Date[0] && cal.Date[1] == calResult.Date[1]);
              if (_tempCal && calResult.AdultPrice && (_tempCal.AdultPrice > calResult.AdultPrice || _tempCal.AdultPrice == 0))
                _tempCal.AdultPrice = calResult.AdultPrice;
            })

            if (++gatewayResultCount == totalGatewayCount) {
              if (_result.result.flights.length == 0)
                reject({
                  code: "",
                  data: null,
                  error: `no flight available`,
                  location: "Gateways manager -> get Search -> _body[AvailableFlights].length",
                  name: "NoFlightAvailable"
                });

              //    let identifier = Date.now();
              // writeFile("C:\\salamErrors\\" + identifier + "_1_GateWay.txt", JSON.stringify(_result), (err) => { })


              if (searchObj.itineraries.length == 1 || FlightTypeHelper.checkRoundTripFlight(searchObj.itineraries)) {
                let dateSortArray = searchObj.itineraries.map((el, ind) => (o => o.Date[ind]))
                _result.result.calendar = _(tempCalendarResult).orderBy(dateSortArray).value();
              }
              else
                _result.result.calendar = [];

              _result.result.stopCount = searchObj.itineraries.map(el => []);
              _result.result.charter = searchObj.itineraries.map(el => []);
              tempAirlineList = searchObj.itineraries.map(el => []);
              availableGatewayHasFlight = searchObj.itineraries.map(el => []);
              tempAirportList = searchObj.itineraries.map(el => []);
              tempCabinList = searchObj.itineraries.map(el => []);
              _result.result.cabins = searchObj.itineraries.map(el => []);
              _result.result.baggages = searchObj.itineraries.map(el => []);


              // let identifier = Date.now();
              // writeFile("C:\\salamErrors\\" + identifier + "_2_GateWay.txt", JSON.stringify(_result.result), (err) => { })



              _result.result.flights.map((_flg, _flg_index) => {
                _flg.FinalPrice = _flg.AdultPrice.TotalPrice + (_flg.AdultPrice.Commission ? _flg.AdultPrice.Commission : 0);
                _flg.Itineraries.map((_itin, _itinIndex) => {
                  // Check dismiss economy when cabin is business and first
                  if((searchObj.cabin === "Business" || searchObj.cabin === "First") && _itin.Flights[0].BookingClassAvails.ResBookDesigCabinCode === "Y")
                  {
                    removeFlightsForCabinClass.push(_flg_index);
                    return;
                  }
                  
                  // Check dismiss business and first when flight is in local and is on economy class
                  if((searchObj.cabin === "Economy" && (searchObj.itineraries[0].originCountryCode !== "IR" || searchObj.itineraries[0].destinationCountryCode !== "IR")) && (_itin.Flights[0].BookingClassAvails.ResBookDesigCabinCode === "C" || _itin.Flights[0].BookingClassAvails.ResBookDesigCabinCode === "F"))
                  {
                    removeFlightsForCabinClass.push(_flg_index);
                    return;
                  }

                  let authorized_airlines = ["TK", "QR", "LH", "OS", "FZ", "EK", "KU", "WY"];
                  if(_itin.Gateway.Code==="amadeus" && _itin.Flights.filter(flg=> !authorized_airlines.includes(flg.MarketingAirline.Code)).length>0)
                  {
                    // console.log(_itin.Flights.find(flg=> !authorized_airlines.includes(flg.MarketingAirline.Code) && !authorized_airlines.includes(flg.OperatingAirline.Code)))
                    removeFlightsForCabinClass.push(_flg_index);
                    return;
                  }

                  // Stop Count
                  if (_result.result.stopCount[_itinIndex].some(v => v.count == _itin.StopCount)) {
                    let stopCount = _result.result.stopCount[_itinIndex].find(v => v.count == _itin.StopCount);
                    if (stopCount.minPrice > _flg.AdultPrice.TotalPrice)
                      stopCount.minPrice = _flg.AdultPrice.TotalPrice;
                  }
                  else
                    _result.result.stopCount[_itinIndex].push({ count: _itin.StopCount, minPrice: _flg.AdultPrice.TotalPrice });

                  if (_result.result.charter[_itinIndex].some(c => c.isCharter == _itin.isCharter)) {
                    let charter = _result.result.charter[_itinIndex].find(c => c.isCharter == _itin.isCharter);
                    if (charter.minPrice > _flg.AdultPrice.TotalPrice)
                      charter.minPrice = _flg.AdultPrice.TotalPrice;
                  }
                  else
                    _result.result.charter[_itinIndex].push({ isCharter: _itin.isCharter, minPrice: _flg.AdultPrice.TotalPrice });

                  // Gateway Filters
                  if(availableGatewayHasFlight[_itinIndex].findIndex(gtw => gtw.Code===_itin.Gateway.Code) == -1)
                    availableGatewayHasFlight[_itinIndex].push({
                      id: _itin.Gateway.id,
                      Code: _itin.Gateway.Code,
                      Name: ""
                    });
                  _itin.Flights.map(_itinFlg => {
                    //gather airline code in an array to fetch data
                    // if (_itinFlg.MarketingAirline && _itinFlg.MarketingAirline.Code)
                    tempAirlineList[_itinIndex].push(_itinFlg.MarketingAirline)
                    // if (_itinFlg.OperatingAirline && _itinFlg.OperatingAirline.Code)
                    tempAirlineList[_itinIndex].push(_itinFlg.OperatingAirline)

                    //gather airport and location code in an array to fetch data
                    // if (_itinFlg.ArrivalAirport && _itinFlg.ArrivalAirport.Code)
                    tempAirportList[_itinIndex].push(_itinFlg.ArrivalAirport.Code)
                    // if (_itinFlg.DepartureAirport && _itinFlg.DepartureAirport.Code)
                    tempAirportList[_itinIndex].push(_itinFlg.DepartureAirport.Code)
                    if (_itinFlg.StopLocation)
                      _itinFlg.StopLocation.forEach(_sl => {
                        if (_sl.LocationCode)
                          tempAirportList[_itinIndex].push(_sl.LocationCode);
                      })

                    // gather airplane codes
                    if (_itinFlg.Equipment.Code)
                      tempAirplaneList.push(_itinFlg.Equipment);

                    // gather cabin type objects
                    tempCabinList[_itinIndex].push(_itinFlg.BookingClassAvails);

                    // Reindex baggages and fill filter object
                    _itinFlg.Baggage.map(_itinFlgBag => {
                      let baggageName = `${_itinIndex}${_itinFlgBag.Type}${_itinFlgBag.Quantity}${_itinFlgBag.Unit}`;
                      let baggageIndex = tempBaggagesIndexList.indexOf(baggageName);
                      if (baggageIndex < 0) {
                        baggageIndex = tempBaggagesIndexList.push(baggageName) - 1;
                        let _bag: searchBaggageResult = new searchBaggageResult();
                        _bag.Index = baggageIndex.toString();
                        _bag.Quantity = _itinFlgBag.Quantity;
                        _bag.Type = _itinFlgBag.Type;
                        _bag.Unit = _itinFlgBag.Unit;
                        _bag.minPrice = _flg.AdultPrice.TotalPrice;
                        _result.result.baggages[_itinIndex].push(_bag);
                      }
                      else {
                        let _bag = _result.result.baggages[_itinIndex].find(bag => bag.Index == baggageIndex.toString());
                        if (_bag.minPrice > _flg.AdultPrice.TotalPrice)
                          _bag.minPrice = _flg.AdultPrice.TotalPrice
                      }
                      _itinFlgBag.Index = baggageIndex.toString();
                    })
                  })
                })
              })

              // Sort stop counts
              _result.result.stopCount.forEach((_itinStops, _itinStopsIndex) => {
                _result.result.stopCount[_itinStopsIndex] = _(_itinStops).orderBy('count').value();
              })
              // Sort baggages
              _result.result.baggages = [..._result.result.baggages.map(bag => [
                ...bag.filter(bg => bg.Type == "ADT" && bg.Quantity == "0" && bg.Unit.toLowerCase() == "pc"),
                ...bag.filter(bg => bg.Type == "ADT" && bg.Unit.toLowerCase() == "kg").sort((a, b) => parseInt(a.Quantity) - parseInt(b.Quantity)),
                ...bag.filter(bg => bg.Type == "ADT" && bg.Quantity != "0" && bg.Unit.toLowerCase() == "pc").sort((a, b) => parseInt(a.Quantity) - parseInt(b.Quantity)),
                ...bag.filter(bg => bg.Type == "ADT" && bg.Unit.toLowerCase() != "pc" && bg.Unit.toLowerCase() != "kg").sort((a, b) => parseInt(a.Quantity) - parseInt(b.Quantity)),
                ...bag.filter(bg => bg.Type != "ADT" && bg.Unit.toLowerCase() != "pc" && bg.Unit.toLowerCase() != "kg").sort((a, b) => parseInt(a.Quantity) - parseInt(b.Quantity))
              ])]

              ExternalRequest.syncPostRequest(
                process.env.MAIN_URL + "airline/codes_list",
                null,
                Array.from(new Set(tempAirlineList.reduce((acc, val) => acc.concat(val), []).map(_airline => _airline.Code))),
                (err, result) => {
                  generalCallback("airline", result.payload.data);
                }
              );
              ExternalRequest.syncPostRequest(
                process.env.MAIN_URL + "airport/codes_list",
                null,
                Array.from(new Set(tempAirportList.reduce((acc, val) => acc.concat(val), []))),
                (err, result) => {
                  generalCallback("airport", result.payload.data);
                }
              );
              ExternalRequest.syncPostRequest(
                process.env.MAIN_URL + "airplane/codes_list",
                null,
                Array.from(new Set(tempAirplaneList.map(_airplane => _airplane.Code))),
                (err, result) => {
                  generalCallback("airplane", result.payload.data);
                }
              );
              ExternalRequest.syncPostRequest(
                process.env.MAIN_URL + "general_item/type",
                null,
                { type: "CabinClasses" },
                (err, result) => {
                  generalCallback("cabin", result.payload.data);
                }
              );
            }
          };

          // callback function which is called on additional data requests
          let generalCallback = (type: string, data: any[]) => {
            if (type == "airline") {
              tempAirlineList.forEach((tmp_air_itinary, tmp_air_index) => {
                _result.result.airlines[tmp_air_index] = [];
                // console.log("tmp_air_itinary", tmp_air_itinary.length)
                data.filter(_airline => tmp_air_itinary.some(_temp => _temp.Code == _airline.code)).forEach(_airline => {
                  let airlineData: searchAirlineResult = new searchAirlineResult();
                  airlineData.active = _airline.active;
                  airlineData.code = _airline.code;
                  airlineData.countryCode = _airline.countryCode;
                  airlineData.name = _airline.name;
                  airlineData.providerType = _airline.providerType;
                  tmp_air_itinary.filter(_temp => _temp.Code == _airline.code).forEach(_temp => _temp.Name = _airline.name);
                  _result.result.airlines[tmp_air_index].push(airlineData);
                })
              });
            }
            else if (type == "airport") {
              tempAirportList.forEach((tmp_air_itinary, tmp_air_index) => {
                _result.result.airports[tmp_air_index] = [];
                // console.log("tmp_air_itinary", tmp_air_itinary.length)
                data.filter(_airport => tmp_air_itinary.some(_temp => _temp == _airport.iata)).forEach(_airport => {
                  let airportData: searchAirportResult = new searchAirportResult();
                  airportData.country = delete _airport.country._id && _airport.country;
                  airportData.countryCode = _airport.countryCode;
                  airportData.iata = _airport.iata;
                  airportData.isActive = _airport.isActive;
                  airportData.location = delete _airport.location[0]._id && _airport.location[0];
                  airportData.locationCode = _airport.locationCode;
                  airportData.name = _airport.name;
                  airportData.type = _airport.type;
                  _result.result.airports[tmp_air_index].push(airportData);
                })
              });
            }
            else if (type == "airplane") {
              data.forEach(_airplane => {
                tempAirplaneList.filter(_temp => _temp.Code == _airplane.code).forEach(_temp => _temp.Name = _airplane.name);
              })
            }
            else if (type == "cabin") {
              data.forEach(_cabin => {
                tempCabinList.map((_itincabin, _itinindex) => {
                  _itincabin.filter(_temp => _temp.ResBookDesigCabinCode == _cabin.code).forEach(_temp => {
                    let cabinData: searchCabinResult = new searchCabinResult();
                    cabinData.code = _cabin.code;
                    cabinData.name = _cabin.name;
                    if (!_result.result.cabins[_itinindex].some(_tcabin => _tcabin.code == _cabin.code))
                      _result.result.cabins[_itinindex].push(cabinData);
                    _temp.ResBookDesigCabinName = _cabin.name
                  });
                })
              })
            }
            if (++generalDataCount == totalGeneralDataCount) {
              _result.result.flights.forEach(_flg => {
                _flg.Itineraries.forEach((_itin, _itinIndex) => {
                  _itin.Flights.forEach((_itinFlg, _itinFlgIndex) => {
                    // Calculate airline min price
                    _result.result.airlines.map(_airline_itin =>
                      _airline_itin.filter(_airline => _airline.code == _itinFlg.MarketingAirline.Code || _airline.code == _itinFlg.OperatingAirline.Code)
                        .forEach(_airline => {
                          _airline.minPrice = _airline.minPrice && _airline.minPrice <= _flg.AdultPrice.TotalPrice ?
                            _airline.minPrice : _flg.AdultPrice.TotalPrice;
                        }));

                    // find departure arrival and stop airports
                    // update airports name object in flight response
                    _result.result.airports[_itinIndex]
                      .filter(_airport => _airport.iata == _itinFlg.DepartureAirport.Code || _airport.iata == _itinFlg.ArrivalAirport.Code
                        || _itinFlg.StopLocation.map(_sl => _sl.LocationCode).indexOf(_airport.iata) >= 0)
                      .forEach(_airport => {
                        if (_airport.iata == _itinFlg.DepartureAirport.Code) {
                          _itinFlg.DepartureAirport.Name = _airport.name;
                          _itinFlg.DepartureAirport.CityName = _airport.location.name;
                          _itinFlg.DepartureAirport.CityCode = _airport.locationCode;
                          if (_itinFlgIndex == 0)
                            _airport.isDepartureAirport = true;
                          else
                            _airport.isUsedForStop = true;
                        }
                        if (_airport.iata == _itinFlg.ArrivalAirport.Code) {
                          _itinFlg.ArrivalAirport.Name = _airport.name;
                          _itinFlg.ArrivalAirport.CityName = _airport.location.name;
                          _itinFlg.ArrivalAirport.CityCode = _airport.locationCode;
                          if (_itinFlgIndex == _itin.Flights.length - 1)
                            _airport.isArrivalAirport = true;
                          else
                            _airport.isUsedForStop = true;
                        }
                        let slIndex = _itinFlg.StopLocation.map(_sl => _sl.LocationCode).indexOf(_airport.iata);
                        if (slIndex >= 0) {
                          _itinFlg.StopLocation[slIndex].Name = _airport.name;
                          _airport.isUsedForStop = true;
                        }
                      });

                    _result.result.cabins[_itinIndex]
                      .filter(_cabin => _cabin.code == _itinFlg.BookingClassAvails.ResBookDesigCabinCode)
                      .forEach(_cabin => {
                        _cabin.minPrice = _cabin.minPrice && _cabin.minPrice <= _flg.AdultPrice.TotalPrice ?
                          _cabin.minPrice : _flg.AdultPrice.TotalPrice;
                      });
                  })
                })
              })
              _result.result.currency = _result.result.flights[0] ? _result.result.flights[0].Currency : "IRR";
              _result.result.gateways = availableGatewayHasFlight;
              removeFlightsForCabinClass = [...new Set(removeFlightsForCabinClass)];
              removeFlightsForCabinClass.forEach((element,index) => 
                _result.result.flights.splice(element-index, 1)
              )
              resolve(_result);
            }
          }
        });
    })
  }

  searchCalendar(searchObj: gatewaySearchInput, loggedInUser: any, options: gatewayInputOptions = new gatewayInputOptions()) {
    return new Promise((resolve: (result: searchCalendarResult[]) => void, reject: (error: errorObj) => void) => {
      if (searchObj.itineraries.length != 1 && !FlightTypeHelper.checkRoundTripFlight(searchObj.itineraries))
        reject(new errorObj("searchCalendarMultiLegError",
          "",
          "SearchFlightCalendar method is not allowed with MultiLeg",
          "Caspian Manager -> Search Calendar"))
      else {
        this.getLastUSDIRRExchangeRate()
          .then(exchangeRate => {

            let totalGatewayCount: number = 0;
            let gatewayResultCount: number = 0;
            let tempCalendarResult: searchCalendarResult[] = [];
            let _result: searchCalendarResult[] = [];

            tempCalendarResult = generateMatrix(searchObj.itineraries.map(calendarHelper.generateCalendarDates)).map(el => {
              return { AdultPrice: 0, Currency: "IRR", Date: el }
            });

            this.getSignitures()
              .then(gwy_result => {
                gwy_result = gwy_result.filter(el => el.internalCode && this.checkGatewayDevMode(options, el.internalCode));
                let gatewayGroupCodes = [];
                let gwy_result_individual: gatewaySignitureResult[] = [];
                if (searchObj.itineraries.length > 1) {
                  gatewayGroupCodes = Array.from(new Set(gwy_result.filter(el => el.groupCode).map(el => el.groupCode)));
                  gwy_result_individual = gwy_result.filter(el => el.isCalledIndividually);
                }
                else
                  gwy_result_individual = gwy_result;
                totalGatewayCount = gwy_result_individual.length + gatewayGroupCodes.length;
                if (totalGatewayCount) {
                  for (let index = 0; index < gatewayGroupCodes.length; index++) {
                    let gateways = gwy_result.filter(el => el.groupCode == gatewayGroupCodes[index]);
                    DynamicGatewayFunctionsHelper.multiGateway.searchCalendar(gateways, searchObj, loggedInUser, options, exchangeRate)
                      .then((res) => {
                        searchCallback(res);
                      })
                      .catch(error => {
                        if (options.devMode) {
                          reject(error);
                        } else
                          if (++gatewayResultCount == totalGatewayCount)
                            searchCallback([]);
                      });
                  }
                  for (let index = 0; index < gwy_result_individual.length; index++) {
                    const element = gwy_result_individual[index];
                    if (DynamicGatewayFunctionsHelper[element.internalCode]) {
                      DynamicGatewayFunctionsHelper[element.internalCode].searchCalendar(element.signiture, searchObj, loggedInUser, options, exchangeRate)
                        .then((res) => {
                          searchCallback(res);
                        })
                        .catch(error => {
                          if (options.devMode) {
                            if (error.data && error.data.session) {
                              let temp = error.data.session;
                              error.data.session = {};
                              error.data.session[element.internalCode] = temp;
                            }
                            reject(error);
                          } else
                            if (++gatewayResultCount == totalGatewayCount)
                              searchCallback([]);
                        });
                    }
                    else
                      searchCallback([]);
                  }
                }
                else
                  reject({
                    code: "",
                    data: {},
                    error: "No gateway match given conditions",
                    location: "Gateways Manager -> Search Calendar",
                    name: "noProperGateway"
                  })
              })
              .catch(error => reject(error));

            // callback function which is called on gateway response
            let searchCallback = (gatewayResult: searchCalendarResult[]) => {
              gatewayResult.forEach(el => el.Date = el.Date.map(date => date.split("T")[0]))
              gatewayResult.map(calResult => {
                let _tempCal = tempCalendarResult.find(cal => cal.Date[0] == calResult.Date[0] && cal.Date[1] == calResult.Date[1]);
                if (_tempCal && calResult.AdultPrice && (_tempCal.AdultPrice > calResult.AdultPrice || _tempCal.AdultPrice == 0))
                  _tempCal.AdultPrice = calResult.AdultPrice;
              })

              if (++gatewayResultCount == totalGatewayCount) {
                let dateSortArray = searchObj.itineraries.map((el, ind) => (o => o.Date[ind]))
                // console.log("tempCalendarResult", tempCalendarResult);
                _result = _(tempCalendarResult).orderBy(dateSortArray).value();
                resolve(_result)
              }
            };

          })
      }
    });
  }

  getRules(flightInfo: gatewayRuleInput, session: gatewaySessionList, options: gatewayInputOptions = new gatewayInputOptions()) {
    return new Promise<gatewayRulesResult[]>((resolve, reject) => {
      this.getLastUSDIRRExchangeRate()
        .then(exchangeRate => {
          if (flightInfo.providerType == "MultipleProviders") {
            this.getSignitureByCodeList(flightInfo.itineraryFlights.map(el => el.gatewayCode))
              .then(gwy_result => {
                DynamicGatewayFunctionsHelper.multiGateway.getRules(gwy_result, flightInfo, session, options, exchangeRate)
                  .then(result => resolve(result))
                  .catch(err => reject(err))
              })
              .catch(err => reject(err))
          }
          else {
            let internalCode = flightInfo.itineraryFlights[0].gatewayCode;
            this.getSignitureByCode(internalCode)
              .then(gwy => {
                DynamicGatewayFunctionsHelper[internalCode].getRules(gwy.signiture, flightInfo, session[internalCode], options, exchangeRate)
                  .then(result => resolve(result))
                  .catch(err => {
                    if (err.data && err.data.session)
                      err.data.session = { [internalCode]: err.data.session };
                    reject(err)
                  })
              })
              .catch(err => reject(err));

          }
        })
    })
  }

  bookFlight(paymentType: string, bookingId: any, session: gatewaySessionList, options: gatewayInputOptions = new gatewayInputOptions()) {
    return new Promise((resolve: (result: gatewayBookFinalResult) => void, reject: (error: errorObj) => void) => {
      if (paymentType.indexOf('c') >= 0 && paymentType.indexOf('w') >= 0)
        reject(new errorObj("invalidPaymentType",
          "",
          "Cannot pay from both credit and wallet",
          "Gateways Manager -> bookFlight",
          null));
      else
        this.getLastUSDIRRExchangeRate()
          .then(exchangeRate => {
            this.getBooking(bookingId)
              .then((_flightBooking) => {
                let result = new gatewayBookData();
                if (_flightBooking.status)
                  switch (_flightBooking.status.code) {
                    //Book flight and send to payment page
                    case "01":
                      // reserveFlight
                      this.updateBookingFlightRules(_flightBooking, session, options)
                        .then(updateResult => {
                          if (_flightBooking.flights.providerType == "MultipleProviders") {
                            this.getSignitureByCodeList(_flightBooking.flights.itineraries.map(el => el.gateway.code))
                              .then(gwy_result => {
                                DynamicGatewayFunctionsHelper.multiGateway.book(gwy_result, _flightBooking, session, options, exchangeRate)
                                  .then(bookResult => bookingSuccessCallback(bookResult))
                                  .catch(err => reject(err))
                              })
                              .catch(err => reject(err))
                          }
                          else {
                            let gatewayCode = _flightBooking.flights.itineraries[0].gateway.code;
                            this.getSignitureByCode(gatewayCode)
                              .then(gwy => {
                                let gatewayFunctions: gatewayMethods = DynamicGatewayFunctionsHelper[gatewayCode];
                                gatewayFunctions.book(gwy.signiture, _flightBooking, session[gatewayCode], options, exchangeRate)
                                  .then(bookResult => {
                                    let finalBookResult = new multipleGatewayBookInternalResult;
                                    finalBookResult.result = bookResult.result;
                                    finalBookResult.session[gatewayCode] = bookResult.session;
                                    bookingSuccessCallback(finalBookResult)
                                  })
                                  .catch(err => {
                                    if (err.data && err.data.session) err.data.session = { [gatewayCode]: err.data.session };
                                    reject(err)
                                  })
                              })
                              .catch(err => reject(err));
                          }
                          let bookingSuccessCallback = (bookResult: multipleGatewayBookInternalResult) => {
                            console.log("bookingSuccessCallback -> bookResult", JSON.stringify(bookResult))
                            _flightBooking.totalPrice = bookResult.result.totalPrice;
                            _flightBooking.moneyUnit.moneyUnit = bookResult.result.moneyUnit;
                            _flightBooking.bookDate = bookResult.result.bookDate;
                            _flightBooking.flights.ticketTimeLimit = bookResult.result.ticketTimeLimit;
                            _flightBooking.flights.rawBookingData = JSON.stringify(bookResult.result.rawData);
                            _flightBooking.flights.itineraries.forEach((el, ind) => {
                              el.pnr = bookResult.result.pnr[ind];
                              el.ticketType = bookResult.result.ticketType[ind];
                            })
                            // Calculate markup and commissions before payment gateway call
                            MarkupHelper.calculatePaymentTotalPrice(_flightBooking)
                              .then(paymentTotalPrice => {
                                _flightBooking.totalPriceToPayment = paymentTotalPrice;
                                this.updateFlightBookingStatus(_flightBooking, "02")
                                  .then(updateResult => {
                                    result = {
                                      bookingId,
                                      invoiceNo: _flightBooking.invoiceNo,
                                      pnr: bookResult.result.pnr,
                                      profileId: _flightBooking.onBehalfProfile ? _flightBooking.onBehalfProfile.id : _flightBooking.individualProfile.id,
                                      totalPrice: _flightBooking.totalPriceToPayment,
                                      userId: _flightBooking.individualProfile.userId,
                                      currencyId: _flightBooking.moneyUnit._id
                                    }
                                    resolve({ result, session: bookResult.session })
                                  })
                                  .catch(err => reject(err))
                              })
                              .catch(err => reject(err))
                          }
                        })
                        .catch(err => reject(err));
                      break;
                    case "02":
                    case "03":
                      console.log("CASE 2 or 3")
                      if ((new Date(_flightBooking.flights.ticketTimeLimit + "Z").getTime() - new Date().getTime()) > bookingThreshold) {
                        result = {
                          bookingId: bookingId,
                          invoiceNo: _flightBooking.invoiceNo,
                          pnr: _flightBooking.flights.itineraries.map(el => el.pnr),
                          profileId: _flightBooking.onBehalfProfile ? _flightBooking.onBehalfProfile.id : _flightBooking.individualProfile.id,
                          totalPrice: _flightBooking.totalPriceToPayment,
                          userId: _flightBooking.individualProfile.userId,
                          currencyId: _flightBooking.moneyUnit._id
                        };
                        resolve({
                          result,
                          session: null
                        });
                      } else {
                        this.updateFlightBookingStatus({ _id: _flightBooking._id }, "06")
                          .then(result => {
                            reject(new errorObj("expiredBooking",
                              "",
                              "Booking is expired",
                              "Gateways Manager -> bookFlight",
                              _flightBooking.ticketTimeLimit));
                          })
                          .catch(err => {
                            reject(new errorObj("expiredBookingUpdateStatusError",
                              "",
                              "Booking is expired",
                              "Gateways Manager -> bookFlight -> updateFlightBookingStatus",
                              err));
                          });
                      }
                      break;
                    case "04":
                      // Issue ticket
                      reject(new errorObj("paidBooking",
                        "",
                        "This booking is already paid",
                        "Gateways Manager -> bookFlight",
                        _flightBooking.ticketTimeLimit));
                      break;
                    case "05":
                      // Regenerate ticket
                      reject(new errorObj("issuedTicketBooking",
                        "",
                        "Ticket(s) is already issued",
                        "Gateways Manager -> bookFlight",
                        _flightBooking.ticketTimeLimit));
                      break;
                    case "06":
                      reject(new errorObj("expiredBooking",
                        "",
                        "Booking is expired",
                        "Gateways Manager -> bookFlight",
                        _flightBooking.ticketTimeLimit));
                      break;
                    default:
                      reject(new errorObj("invalidBooking",
                        "",
                        "Flight booking object is not valid",
                        "Gateways Manager -> bookFlight -> getFlightBooking",
                        { bookingId }));
                      break;
                  }
                else
                  reject(new errorObj("invalidBooking",
                    "",
                    "Flight booking object is not valid",
                    "Gateways Manager -> bookFlight -> getFlightBooking",
                    { bookingId }));
              })
              .catch(err => reject(err))
          })
    })
  }

  bookingPaymentFailed(bookingId: string, paymentData: paymentResponse) {
    return new Promise((resolve, reject) => {
      this.getBooking(bookingId)
        .then((result: any) => {
          if (result.invoiceNo == (paymentData.InvoiceNumber ? paymentData.InvoiceNumber : paymentData.requestId) && (result.status.code == "02" || result.status.code == "03"))
            this.updateFlightBookingStatus({ _id: bookingId }, "03")
              .then((res: any) => {
                console.log("update result", res);
                resolve(res);
              })
              .catch(err => reject(err))
          else
            reject("This booking payment status cannot be changed");
        })
        .catch(error => reject(error))
    })
  }

  bookingPaymentSuccess(bookingId: string, paymentData: paymentResponse) {
    return new Promise((resolve, reject) => {
      this.checkFlightBookingPaymentRefId(paymentData.referenceId)
        .then(refIdResult => {
          if (!refIdResult)
            return this.getBooking(bookingId);
          else
            reject("Payment Ref ID already used");
        })
        .then((booking: any) => {
          //insert income
          ExternalRequest.syncPostRequest(process.env.MAIN_URL + "income", undefined, {
            amount: paymentData.verifiedAmount + paymentData.creditPayment.amount + paymentData.walletPayment.amount + paymentData.pointPayment.amount,
            bookingFlightId: bookingId,
            serviceTypeCode: 1,
            walletId: paymentData.walletPayment.id ? paymentData.walletPayment.id : null,
            creditExpenseId: paymentData.creditPayment.id ? paymentData.creditPayment.id : null,
            profilePointId: paymentData.pointPayment.id ? paymentData.pointPayment.id : null
          }, (income_err, income_result) => {
            if (booking.invoiceNo == paymentData.InvoiceNumber && (booking.status.code == "02" || booking.status.code == "03"))// && result.totalPriceToPayment == paymentData.verifiedAmount + paymentData.creditPayment.amount + paymentData.walletPayment.amount + paymentData.pointPayment.amount)
            {
              //calculate msps object
              MarkupHelper.calculateMSPS(booking)
                .then((mspsResult: any[]) => {
                  console.log("bookingPaymentSuccess -> mspsResult", JSON.stringify(mspsResult))
                  mspsResult.forEach(msps => {
                    if (msps.isPoint)
                      ExternalRequest.syncPostRequest(process.env.MAIN_URL + "profile_point", undefined, {
                        pointRuleId: null,
                        pointTypeId: 3,
                        bookingId: bookingId,
                        point: msps.value / (parseInt(process.env.DERIK_VALUE)),
                        profileId: msps.profileId
                      }, undefined, "POST")
                    ExternalRequest.syncPostRequest(process.env.MAIN_URL + "point_of_sale", undefined, {
                      incomeId: income_result.payload.data.id,
                      gatewayId: msps.gateway ? msps.gateway.id : null,
                      amount: msps.value,
                      profileId: msps.profileId
                    }, undefined, "POST")
                  })
                  let bookingToUpdate = {
                    _id: bookingId,
                    paymentInfo: {
                      amount: paymentData.verifiedAmount,
                      type: (paymentData.verifiedAmount > 0 ? "b" : "") + (paymentData.creditPayment.amount ? "c" : "") + (paymentData.walletPayment.amount ? "w" : "") + (paymentData.pointPayment.amount ? "p" : ""),
                      cardNumber: paymentData.cardNo,
                      merchantId: paymentData.merchantId,
                      referenceID: paymentData.referenceId,
                      wallet: paymentData.walletPayment,
                      credit: paymentData.creditPayment,
                      point: paymentData.pointPayment
                    },
                    msps: mspsResult
                  };
                  this.updateFlightBookingStatus(bookingToUpdate, "04")
                    .then((res: any) => {
                      resolve({ payment: "done", booking })
                    })
                    .catch(err => {
                      reject(err)
                    })
                })
                .catch(err => reject(err))
            }
            else
              reject("This method is not applicable to this booking");
          }, "POST")
        })
        .catch(error => {
          reject(error);
        })
    })
  }

  issueTicket(bookingId: string, session: gatewaySessionList, options: gatewayInputOptions = new gatewayInputOptions()) {
    return new Promise<gatewayTicketFinalResult>((resolve, reject) => {
      this.getBooking(bookingId)
        .then((booking: any) => {
          if (booking.status.code == "04" && (new Date(booking.flights.ticketTimeLimit + "Z").getTime() - new Date().getTime()) > 10000)
            this.getLastUSDIRRExchangeRate()
              .then(exchangeRate => {
                if (booking.flights.providerType == "MultipleProviders") {
                  this.getSignitureByCodeList(booking.flights.itineraries.map(el => el.gateway.code))
                    .then(gwy_result => {
                      DynamicGatewayFunctionsHelper.multiGateway.createTicket(gwy_result, booking, session, options, exchangeRate)
                        .then(bookResult => ticketSuccessCallback(bookResult))
                        .catch(err => reject(err))
                    })
                    .catch(err => reject(err))
                }
                else {
                  let gatewayCode = booking.flights.itineraries[0].gateway.code;
                  this.getSignitureByCode(gatewayCode)
                    .then(gwy => {
                      let gatewayFunctions: gatewayMethods = DynamicGatewayFunctionsHelper[gatewayCode];
                      gatewayFunctions.createTicket(gwy.signiture, booking, session[gatewayCode], options, exchangeRate)
                        .then(ticketResult => {
                          let finalTicketResult = new multipleGatewayTicketInternalResult;
                          finalTicketResult.result = ticketResult.result;
                          finalTicketResult.session[gatewayCode] = ticketResult.session;
                          ticketSuccessCallback(finalTicketResult)
                        })
                        .catch(err => {
                          if (err.data && err.data.session) err.data.session = { [gatewayCode]: err.data.session };
                          reject(err)
                        })
                    })
                    .catch(err => reject(err));
                }
              })
          else if (booking.status.code == "05")
            resolve({
              result: {
                bookingId: bookingId,
                callSupport: booking.tickets.some(el => el.callSupport),
                moneyUnit: booking.moneyUnit,
                invoiceNo: booking.invoiceNo,
                pnr: booking.tickets[0].pnr
              }, session: null
            })
          else
            reject(new errorObj("expiredOrNotPaidBooking", "", "Issue Ticket is not done due to expired or not paid booking"));

          let ticketSuccessCallback = (ticketResult: multipleGatewayTicketInternalResult) => {
            ExternalRequest.syncPostRequest(
              process.env.MAIN_URL + "general_item/type",
              null,
              { type: "FlightTicketStatus", code: "5" },
              (gt_err, ticketStatus) => {
                ExternalRequest.syncPostRequest(
                  process.env.MAIN_URL + "general_item/type",
                  null,
                  { type: "ShowTicketType", code: "1" },
                  (gt_err, ticketType) => {
                    ticketResult.result.tickets.forEach(ticket => {
                      ticket.status[0] = ticketStatus.payload.data[0];
                      ticket.showTicketType = ticketType.payload.data[0];
                      ticket.callSupport = ticketResult.result.callSupport
                    })
                    booking.flights.rawTicketingData = JSON.stringify(ticketResult.result.data);
                    booking.tickets = ticketResult.result.tickets;
                    this.updateFlightBookingStatus(booking, "05")
                      .then(updateResult => {
                        resolve({
                          result: {
                            bookingId: bookingId,
                            callSupport: ticketResult.result.callSupport,
                            moneyUnit: booking.moneyUnit,
                            invoiceNo: booking.invoiceNo,
                            pnr: booking.tickets[0].pnr
                          }, session: ticketResult.session
                        })
                      })
                      .catch(err => reject(err))
                  }
                );
              }
            );
          }
        })
        .catch(error => {
          reject(error);
        })
    })

  }

  importPNR(gatewayCode: string, pnr: string, pnrFields: any, loggedInUser: any, options: gatewayInputOptions = new gatewayInputOptions()) {
    return new Promise((resolve, reject) => {
      this.getSignitureByCode(gatewayCode)
        .then(gwy => {
          let gatewayFunctions: gatewayMethods = DynamicGatewayFunctionsHelper[gatewayCode];
          if (gatewayFunctions)
            // TODO
            gatewayFunctions.importPNR(gwy.signiture, pnr, pnrFields, options, 1)
              .then(pnrResult => {
                pnrResult.serviceType = {
                  code: "1"
                };
                pnrResult.attachments = [];
                pnrResult.individualProfile = { id: loggedInUser.profileId, userId: loggedInUser.userId };
                pnrResult.onBehalfProfile = { id: loggedInUser.activeProfileId };
                pnrResult.passengers.forEach(el => el.parentProfileId = loggedInUser.activeProfileId);
                pnrResult.flights.itineraries.forEach(el => el.gateway = { id: gwy._id, code: gatewayCode });
                pnrResult.gateways = pnrResult.flights.itineraries.map(el => el.gateway);
                let airportList = [];
                let airlineList = [];
                let equipmentList = [];
                let countryList = [];
                pnrResult.flights.itineraries.forEach(itin => {
                  itin.flights.forEach(flg => {
                    airportList.push(flg.departureAirport.code);
                    airportList.push(flg.arrivalAirport.code);
                    airlineList.push(flg.marketingAirline.code);
                    airlineList.push(flg.operatingAirline.code);
                    equipmentList.push(flg.equipment.code);
                  })
                });
                countryList = pnrResult.passengers.map(el => el.nationality ? el.nationality.code : null).filter(el => el != null);

                ExternalRequest.syncPostRequest(process.env.MAIN_URL + "airport/codes_list", null, Array.from(new Set(airportList)), undefined)
                  .then((airport_result: any) => {
                    pnrResult.flights.itineraries.forEach(itin => {
                      itin.flights.forEach(flg => {
                        flg.departureAirport = {
                          ...flg.departureAirport,
                          cityCode: airport_result.payload.data.find(_airport => flg.departureAirport.code == _airport.iata).locationCode,
                          name: airport_result.payload.data.find(_airport => flg.departureAirport.code == _airport.iata).name,
                          cityName: airport_result.payload.data.find(_airport => flg.departureAirport.code == _airport.iata).location[0].name
                        }
                        flg.arrivalAirport = {
                          ...flg.arrivalAirport,
                          cityCode: airport_result.payload.data.find(_airport => flg.arrivalAirport.code == _airport.iata).locationCode,
                          name: airport_result.payload.data.find(_airport => flg.arrivalAirport.code == _airport.iata).name,
                          cityName: airport_result.payload.data.find(_airport => flg.arrivalAirport.code == _airport.iata).location[0].name
                        }
                      })
                    });
                    pnrResult.flights.isInternational = Array.from(new Set(airport_result.payload.data.map(el => el.countryCode))).length == 1 ? false : true;
                    if (pnrResult.flights.itineraries.length == 1)
                      pnrResult.flights.flightType = "onewaytrip";
                    else if (pnrResult.flights.itineraries.length == 2 &&
                      pnrResult.flights.itineraries[0].flights[0].departureAirport.cityCode ==
                      pnrResult.flights.itineraries[1].flights[pnrResult.flights.itineraries[1].flights.length - 1].arrivalAirport.cityCode &&
                      pnrResult.flights.itineraries[1].flights[0].departureAirport.cityCode ==
                      pnrResult.flights.itineraries[0].flights[pnrResult.flights.itineraries[0].flights.length - 1].arrivalAirport.cityCode)
                      pnrResult.flights.flightType = "roundtrip";
                    else
                      pnrResult.flights.flightType = "multicity";
                    return ExternalRequest.syncPostRequest(process.env.MAIN_URL + "airline/codes_list", null, Array.from(new Set(airlineList)), undefined)
                  })
                  .then((airline_result: any) => {
                    pnrResult.flights.itineraries.forEach(itin => {
                      itin.flights.forEach(flg => {
                        flg.marketingAirline = {
                          ...flg.marketingAirline,
                          name: airline_result.payload.data.find(_airline => flg.marketingAirline.code == _airline.code).name
                        }
                        flg.operatingAirline = {
                          ...flg.operatingAirline,
                          name: airline_result.payload.data.find(_airline => flg.operatingAirline.code == _airline.code).name
                        }
                      })
                    });
                    return ExternalRequest.syncPostRequest(process.env.MAIN_URL + "airplane/codes_list", null, Array.from(new Set(equipmentList)), undefined)
                  })
                  .then((airplane_result: any) => {
                    pnrResult.flights.itineraries.forEach(itin => {
                      itin.flights.forEach(flg => {
                        flg.equipment = {
                          ...flg.equipment,
                          name: airplane_result.payload.data.find(_airplane => flg.equipment.code == _airplane.code).name
                        }
                      })
                    });
                    return ExternalRequest.syncPostRequest(process.env.MAIN_URL + "general_item/type", null, { type: "CabinClasses" }, undefined)
                  })
                  .then((cabinClass_result: any) => {
                    pnrResult.flights.itineraries.forEach(itin => {
                      itin.flights.forEach(flg => {
                        if (flg.resBookDesigCabinCode)
                          flg.resBookDesigCabinName = cabinClass_result.payload.data.find(_cabin => flg.resBookDesigCabinCode == _cabin.code) ? cabinClass_result.payload.data.find(_cabin => flg.resBookDesigCabinCode == _cabin.code).name : null;
                      })
                    });
                    return ExternalRequest.syncPostRequest(process.env.MAIN_URL + "country/list", null, Array.from(new Set(countryList)), undefined)
                  })
                  .then((country_result: any) => {
                    pnrResult.passengers.forEach(el => {
                      if (el.nationality)
                        el.nationality = country_result.payload.data.find(con => con.code == el.nationality.code)
                    })
                    return MarkupHelper.calculatePaymentTotalPrice(pnrResult)
                  })
                  .then(paymentTotalPrice => {
                    pnrResult.totalPriceToPayment = paymentTotalPrice;
                    return ExternalRequest.syncPostRequest(process.env.MAIN_URL + "general_item/type", null, { type: "BookingStatus", code: "02" }, undefined)
                  })
                  .then((gt_result: any) => {
                    pnrResult.status = gt_result.payload.data[0];
                    return ExternalRequest.syncPostRequest(process.env.MAIN_URL + "booking/insert_from_pnr", null, pnrResult, undefined)
                  })
                  .then(booking_result => resolve(booking_result))
                  .catch(err => err.response && err.response.data ? reject(err.response.data) : reject(err))

              })
              .catch(err => {
                if (err.data && err.data.session) err.data.session = { [gatewayCode]: err.data.session };
                reject(err)
              })
          else
            reject(new errorObj("noGatewayFound", "", "No gateway found!"))
        })
        .catch(err => reject(err));
    })
  }

  private checkGatewayDevMode(options: gatewayInputOptions, gatewayCode: string): boolean {
    if (options.devMode) {
      if (gatewayCode && options.gatewayList && (typeof (options.gatewayList) == "string" ? options.gatewayList == gatewayCode : options.gatewayList.indexOf(gatewayCode) != -1))
        return true;
      else
        return false;
    }
    else
      return true;
  }

  private getSignitures() {
    return new Promise((resolve: (result: gatewaySignitureResult[]) => void, reject: (error: errorObj) => void) => {
      let sgnManager = new SignituresManager();
      const profileId = 240;

      // Get signitures of donyaro profile (profile id is 240)
      sgnManager.getByProfile(profileId, (signitureList_err, signitureList_result) => {
        if (!signitureList_err)
          // Get gateway for each signiture based on its gateway Id
          this.getByIdsList(signitureList_result.map(sgn => sgn.gatewayId), (gatewayList_err, gatewayList_result) => {
            if (!gatewayList_err) {
              let _result: gatewaySignitureResult[] = gatewayList_result.map(
                gwy => Object.assign(gwy, { signiture: { ...signitureList_result.filter(sgn => sgn.gatewayId.toString() == gwy._id.toString())[0].signiture, gatewayId: gwy._id } })
              )
              resolve(_result);
            }
            else
              reject(new errorObj("getGatewayListError", "", gatewayList_err, "Gateways Manager -> getSignitures"));
          })
        else
          reject(new errorObj("getGatewayListError", "", signitureList_err, "Gateways Manager -> getSignitures"));
      })
    })
  }

  private getSignitureByCode(code: string) {
    return new Promise((resolve: (result: gatewaySignitureResult) => void, reject: (error: errorObj) => void) => {
      let sgnManager = new SignituresManager();
      const profileId = 240;

      this.getByCode(code)
        .then((gwy: any) => {
          sgnManager.find({ profileId, gatewayId: gwy._id.toString() }, (signiture_err, signiture_result) => {
            if (!signiture_err) {
              let _result: gatewaySignitureResult = Object.assign(gwy, { signiture: { ...signiture_result.filter(sgn => sgn.gatewayId.toString() == gwy._id.toString())[0].signiture, gatewayId: gwy._id } })
              resolve(_result);
            }
            else
              reject(new errorObj("getGatewayByCodeError", "", signiture_err, "Gateways Manager -> getSignitureByCode"));
          })
        })
        .catch(gateway_err => reject(new errorObj("getGatewayByCodeError", "", gateway_err, "Gateways Manager -> getSignitureByCode")))
    })
  }

  private getSignitureByCodeList(codeList: string[]) {
    return new Promise((resolve: (result: gatewaySignitureResult[]) => void, reject: (error: errorObj) => void) => {
      let sgnManager = new SignituresManager();
      const profileId = 240;

      this.getByCodeList(codeList)
        .then((gwys: any) => {
          sgnManager.find({ profileId, gatewayId: { $in: gwys.map(gwy => gwy._id.toString()) } }, (signiture_err, signiture_result) => {
            if (!signiture_err) {
              let _result: gatewaySignitureResult[] = [];
              gwys.forEach((gwy, ind) => {
                _result[ind] = Object.assign(gwy, { signiture: { ...signiture_result.filter(sgn => sgn.gatewayId.toString() == gwy._id.toString())[0].signiture, gatewayId: gwy._id } })
              })
              resolve(_result);
            }
            else
              reject(new errorObj("getGatewayByCodeError", "", signiture_err, "Gateways Manager -> getSignitureByCode"));
          })
        })
        .catch(gateway_err => reject(new errorObj("getGatewayByCodeError", "", gateway_err, "Gateways Manager -> getSignitureByCode")))
    })
  }

  //#region flightbooking apis
  private updateFlightBookingStatus(flightBooking: any, statusCode: string) {
    return new Promise((resolve, reject) => {
      ExternalRequest.syncPostRequest(
        process.env.MAIN_URL + "general_item/type",
        null,
        { type: "BookingStatus", code: statusCode },
        (gt_err, gt_result) => {
          flightBooking.status = gt_result.payload.data[0];
          this.updateFlightBooking(flightBooking)
            .then(result => resolve(result))
            .catch(err => reject(err))
        }
      );
    });
  };

  private getBooking(flightBookingId: string) {
    return new Promise((resolve: (val: any) => void, reject) => {
      ExternalRequest.syncGetRequest(process.env.MAIN_URL + `booking/id/${flightBookingId}`, (err, _flightBooking) => {
        if (!err)
          resolve(_flightBooking.payload.data)
        else
          reject(err)
      })
    })
  }

  private checkFlightBookingPaymentRefId(paymentRefrenceID: string) {
    return new Promise((resolve: (val: any) => void, reject) => {
      if (paymentRefrenceID)
        ExternalRequest.syncGetRequest(process.env.MAIN_URL + `booking/check_payment_refid/${paymentRefrenceID}`, (err, existanceResult) => {
          if (!err)
            resolve(existanceResult.payload.data)
          else
            reject(err)
        })
      else
        resolve(false)
    })
  }

  private updateBookingFlightRules(booking: any, session: gatewaySessionList, options: gatewayInputOptions) {
    return new Promise((resolve, reject) => {
      let getRulesInput = new gatewayRuleInput();
      getRulesInput.combinationId = booking.flights.combinationId;
      getRulesInput.gatewayData = booking.flights.gatewayData;
      getRulesInput.providerType = booking.flights.providerType;
      getRulesInput.sequenceNumber = booking.flights.sequenceNumber;
      booking.flights.itineraries.forEach(itin => itin.flights.forEach(flg => {
        getRulesInput.itineraryFlights.push({
          airlineCode: flg.marketingAirline.code,
          gatewayCode: itin.gateway.code,
          gatewayData: flg.gatewayData,
          resBookDesigCode: flg.resBookDesigCode
        });
      }));
      this.getRules(getRulesInput, session, options)
        .then(rulesResult => {
          booking.flights.rules = rulesResult;
          this.updateFlightBooking(booking)
            .then(result => resolve(result))
            .catch(err => reject(err))
        })
        .catch(err => reject(err))
    })
  }

  private updateFlightBooking(booking: any) {
    return ExternalRequest.syncPostRequest(process.env.MAIN_URL + "booking", null, booking, undefined, "PUT")
  }

  private getLastUSDIRRExchangeRate() {
    return new Promise<number>((resolve, reject) => {
      ExternalRequest.syncGetRequest(process.env.MAIN_URL + "currency_exchange/last/USD/IRR", undefined)
        .then((result: any) => {
          if (result.payload.data)
            resolve(result.payload.data)
          else
            resolve(1)
        })
        .catch(err => resolve(1))
    })
  }

  //#endregion
}
Object.seal(GatewaysManager);
