import { ExternalRequest, RequestTemplate } from "../../Infrastructure/ExternalRequests";
import { flattenDeep, reverse } from 'lodash';

const CryptoJS = require("crypto-js");
const crypto = require("crypto");
const axios = require("axios");

export class HotelBedsManager {
  constructor() { }

  getSearch(item: any) {
    // console.log(
    //   "\x1b[36m%s\x1b[0m",
    //   "Hotel Gallery API Entries" + " " + new Date().toLocaleTimeString()
    // );
    return new Promise(
      (resolve: (result: any) => void, reject: (error: any) => void) => {
        try {
          //This api calling hotel/locationv2 api from booking/Hotels Controller
          ExternalRequest.syncPostRequest(
            process.env.MAIN_URL + "hotel/locationv2/0/1000",
            undefined,
            { locationCode: item.locationCode },
            (error, hotelsList) => {
              if (hotelsList.status === 200 && hotelsList.payload.data.hotels) {
                // console.log(
                //   "\x1b[36m%s\x1b[0m",
                //   "Hotel Gallery Hotel Location External Request Success" +
                //   " " +
                //   new Date().toLocaleTimeString()
                // );
                let hotelCodes = hotelsList.payload.data.hotels.map(hotel => hotel.code);
                let hotelAvalibilityApiParams = {
                  stay: {
                    checkIn: item.checkinDate,
                    checkOut: item.checkoutDate
                  },
                  occupancies: item.occupancies,
                  hotels: {
                    hotel: hotelCodes
                  }
                };
                ExternalRequest.syncPostRequest(
                  process.env.HotelBedsEndPoint +
                  process.env.HotelBedsSearchByHotelCode,
                  undefined,
                  hotelAvalibilityApiParams,
                  (error, hotelSearchApiResult) => {
                    if (error) {
                      console.log(
                        "\x1b[33m%s\x1b[0m",
                        "Hotel Gallery API HotelBedsSearchByHotelCode External Request Error : " +
                        error +
                        " " +
                        new Date().toLocaleTimeString()
                      );
                      return resolve({ hotels: [], filters: {} });
                    }
                    if (hotelSearchApiResult) {
                      // console.log(
                      //   "\x1b[36m%s\x1b[0m",
                      //   "Hotel Gallery HotelBedsSearchByHotelCode External Request Success" +
                      //   " " +
                      //   new Date().toLocaleTimeString()
                      // );
                      let finalResult = hotelSearchApiResult.hotels.hotels.map(
                        hotel => ({
                          ...hotelsList.payload.data.hotels.filter(
                            htl => htl.code == hotel.code
                          )[0],
                          minRate: hotel.minRate,
                          maxRate: hotel.maxRate,
                          currency: hotel.currency
                        })
                      );
                      delete hotelsList.payload.data.hotels;
                      resolve({
                        hotels: finalResult,
                        filters: { ...hotelsList.payload.data }
                      });
                    } else {
                      console.log(
                        "\x1b[33m%s\x1b[0m",
                        "Hotel Gallery API External Request HotelBedsSearchByHotelCode Empty Result" +
                        " " +
                        new Date().toLocaleTimeString()
                      );
                      return resolve({ hotels: [], filters: {} });
                    }
                  },
                  undefined,
                  undefined,
                  undefined,
                  {
                    "Api-key": process.env.HotelBedsAPIKey,
                    "X-Signature": this.keyGenerator(),
                    Accept: "application/json"
                  }
                );
              } else {
                console.log(
                  "\x1b[33m%s\x1b[0m",
                  "Hotel Gallery API Hotel Location External Request Empty Result" +
                  " " +
                  new Date().toLocaleTimeString()
                );
                return resolve({ hotels: [], filters: {} });
              }
            },
            undefined,
            undefined,
            undefined,
            undefined
          );
        } catch (error) {
          console.log(
            "\x1b[33m%s\x1b[0m",
            "Hotel Gallery API Catch " +
            error +
            " " +
            new Date().toLocaleTimeString()
          );
          reject(error);
        }
      }
    );
  }

  getDetail(item: any) {
    // console.log(
    //   "\x1b[36m%s\x1b[0m",
    //   "Hotel Detail API Entries" + " " + new Date().toLocaleTimeString()
    // );
    // console.log(item);
    return new Promise(
      (resolve: (result: any) => void, reject: (error: any) => void) => {
        try {
          //Get Hotel Info From DB
          ExternalRequest.syncPostRequest(
            process.env.MAIN_URL + "hotel/code",
            undefined,
            { code: item.code },
            (error, hotel) => {
              if (hotel.status === 200 && hotel.payload.data) {
                // console.log(
                //   "\x1b[36m%s\x1b[0m",
                //   "Hotel Detail API Hotel Code External Request Success" +
                //   " " +
                //   new Date().toLocaleTimeString()
                // );
                let hotelAvalibilityApiParams = {
                  stay: {
                    checkIn: item.checkinDate,
                    checkOut: item.checkoutDate
                  },
                  occupancies: item.occupancies,
                  hotels: {
                    hotel: [hotel.payload.data.hotel.code]
                  }
                };
                //Get Hotel Info From Avalibility API By Hotel Code From DB
                ExternalRequest.syncPostRequest(
                  process.env.HotelBedsEndPoint +
                  process.env.HotelBedsSearchByHotelCode,
                  undefined,
                  hotelAvalibilityApiParams,
                  (error, hotelSearchApiResult) => {
                    if (error) {
                      console.log(
                        "\x1b[33m%s\x1b[0m",
                        "Hotel Detail API HotelBedsSearchByHotelCode External Request Error :" +
                        error +
                        " " +
                        new Date().toLocaleTimeString()
                      );
                      return resolve([]);
                    }
                    //Get Hotel Detail From API
                    //This api calling hotel/locationv2 api from booking/Hotels Controller
                    ExternalRequest.syncGetRequest(
                      process.env.HotelBedsEndPoint +
                      process.env.HotelBedsHotelDetailAPIPart1 +
                      hotel.payload.data.hotel.code +
                      process.env.HotelBedsHotelDetailAPIPart2,
                      (detailApiError, detailApiResult) => {
                        if (detailApiError) {
                          console.log(
                            "\x1b[33m%s\x1b[0m",
                            "Hotel Detail API HotelBedsHotelDetailAPIPart1 External Request Error :" +
                            detailApiError +
                            " " +
                            new Date().toLocaleTimeString()
                          );
                          return resolve([]);
                        }
                        console.log(
                          "\x1b[36m%s\x1b[0m",
                          "Hotel Detail API HotelBedsHotelDetailAPIPart1 External Request Success" +
                          " " +
                          new Date().toLocaleTimeString()
                        );
                        console.log(
                          "hotelSearchApiResult.hotels",
                          hotelSearchApiResult.hotels
                        );
                        let roomsFromAvalibility =
                          hotelSearchApiResult.hotels.hotels[0].rooms; //code
                        let roomsFromFromHotelDetail =
                          detailApiResult.hotel.rooms; //roomCode
                        // let rateCommentIds = hotelSearchApiResult.hotels.hotels[0].rooms.map(
                        //   comm => comm.rateCommentsId
                        // );
                        roomsFromAvalibility.map(item => ({
                          ...item,
                          ...roomsFromFromHotelDetail.find(
                            x => x.roomCode == item.code
                          )
                        }));

                        /**
                         * This section we are creating secret key for every rooms
                         * Because the information of all rooms send to front and for more secure preventing changed data by user
                         * We are create hash data from hotel rooms
                         * After creating hash , We are sending this hash key for every rooms to front
                         * When user calling payment api , We compare secret key of every rooms from front with private key on the server
                         * If data compare return true , Data was not change by user and its ok , But if data was changed we can not handle process 
                         */
                        roomsFromAvalibility.forEach(element => {
                          element.rates.forEach(rate => {
                            let rateStringedFormat =
                              process.env.HotelSecretKey + JSON.stringify(rate);
                            rate.hotelSecret = crypto
                              .createHash("sha256")
                              .update(rateStringedFormat)
                              .digest("base64");
                          });
                        });
                        hotel.payload.data.hotel.rooms = roomsFromAvalibility;
                        hotel.payload.data.hotel.images = detailApiResult.hotel.images.sort(
                          this.compareValues("visualOrder")
                        );
                        hotel.payload.data.hotel.price = {
                          minRate:
                            hotelSearchApiResult.hotels.hotels[0].minRate,
                          maxRate:
                            hotelSearchApiResult.hotels.hotels[0].maxRate,
                          currency:
                            hotelSearchApiResult.hotels.hotels[0].currency
                        };
                        resolve(hotel.payload.data);
                      },
                      undefined,
                      undefined,
                      {
                        "Api-key": process.env.HotelBedsAPIKey,
                        "X-Signature": this.keyGenerator(),
                        Accept: "application/json"
                      }
                    );
                  },
                  undefined,
                  undefined,
                  undefined,
                  {
                    "Api-key": process.env.HotelBedsAPIKey,
                    "X-Signature": this.keyGenerator(),
                    Accept: "application/json"
                  }
                );
              } else {
                console.log(
                  "\x1b[33m%s\x1b[0m",
                  "Hotel Detail API Empty Result" +
                  " " +
                  new Date().toLocaleTimeString()
                );
                return resolve([]);
              }
            },
            undefined,
            undefined,
            undefined,
            undefined
          );
        } catch (error) {
          console.log(
            "\x1b[33m%s\x1b[0m",
            "Hotel Detail API Catch : " +
            error +
            " " +
            new Date().toLocaleTimeString()
          );
          reject(error);
        }
      }
    );
  }


  book(item: any, loggedInUser: any) {
    console.log('PROFILEID', loggedInUser);
    console.log("\x1b[36m%s\x1b[0m", "Hotel Book API Entries" + " " + new Date().toLocaleTimeString());
    console.log(item);
    console.log("URL : ", process.env.HotelBedsEndPoint + process.env.HotelBedsHotelCheckRate);
    return new Promise(
      (resolve: (result: any) => void, reject: (error: any) => void) => {
        try {
          //Step 1 - Validation - Check rooms data is changed or not
          this.checkValidityOfRoomsRates(item.rooms).then(rateResult => {

            console.log("\x1b[36m%s\x1b[0m", "Step 1 - Hotel Rooms Validation " + "(" + rateResult + ")" + new Date().toLocaleTimeString());

            if (rateResult) {

              let paymentType = item.rooms[0].paymentType;
              console.log("\x1b[36m%s\x1b[0m", "Step 2 Hotel Payment Type " + "(" + paymentType + ")" + new Date().toLocaleTimeString());

              //Check Rate is required to update price
              this.updateRoomsPrice(item.rooms, item.paymentSecret).then(updateRoomsPriceResult => {
                console.log('updateRoomsPriceResult', updateRoomsPriceResult);

                //Check Update Price Is Successfully
                if (updateRoomsPriceResult.Message === 'ok') {

                  //Check Price of rooms was changed
                  if (updateRoomsPriceResult.IsPriceChanged === false) {
                    console.log("\x1b[36m%s\x1b[0m", "Step 3 Price does not changed " + "(" + updateRoomsPriceResult.IsPriceChanged + ")" + new Date().toLocaleTimeString());
                    //Insert into db with pre booking status
                    this.insertBooking(item, {}).then(insertBookingResult => {
                      console.log("\x1b[36m%s\x1b[0m", "Step 4 Insert Booking Result " + "(" + insertBookingResult + ")" + new Date().toLocaleTimeString());
                      // return resolve(insertBookingResult);
                      if (insertBookingResult.message === 'ok') {

                        //Create booking object for Hotel Beds API
                        this.createBookInputObject(item).then(bookingObj => {
                          console.log("\x1b[36m%s\x1b[0m", "Step 5 Create Payment Object Structure " + "(" + bookingObj + ")" + new Date().toLocaleTimeString());

                          //Calling hotel beds booking api
                          this.hotelBedsBooking(bookingObj.data).then(hotelBedsBookResult => {
                            console.log("\x1b[36m%s\x1b[0m", "Step 6 Hotel Beds Booking Result " + "(" + hotelBedsBookResult + ")" + new Date().toLocaleTimeString());
                            console.log('hotelBedsBookResult.message', hotelBedsBookResult.message);
                            //Check hotel beds booking result
                            if (hotelBedsBookResult.message === 'ok') {

                              //List of all cancellation rooms
                              let roomsDates = flattenDeep(item.rooms.map(t => t.cancellationPolicies).map(x => x.map(y => y.from)));
                              let cancellationPlicies = flattenDeep(item.rooms.map(t => t.cancellationPolicies));
                              roomsDates.forEach(function (part, index, theArray) {
                                theArray[index] = new Date(theArray[index]);
                              });
                              //Minimum of cancellation date
                              let minDateOfFree = new Date(roomsDates.reduce(function (a, b) { return a < b ? a : b; }));

                              //Update booking info with after booking status
                              this.updateBooking(loggedInUser, insertBookingResult.result.ops[0], item, hotelBedsBookResult, minDateOfFree, cancellationPlicies, paymentType).then(updateBookingResult => {
                                console.log("\x1b[36m%s\x1b[0m", "Step 7 Update Booking Result " + "(" + updateBookingResult + ")" + new Date().toLocaleTimeString());
                                if (updateBookingResult.message === 'ok') {
                                  //Check isPayLater if true , Just booking for user and alert to user for cancellation before free of charge 
                                  if (item.isPayLater === false) {

                                    //Step 8 - Check Payment type
                                    //AT_WEB - Payment Data Is Not Required
                                    //Calling 
                                    if (paymentType.toLowerCase() === 'at_web') {

                                      //Check pay - In this section you must calling bank gateway api.
                                      console.log("\x1b[36m%s\x1b[0m", "Step 3 Hotel Payment Type " + "(" + item.isPayLater + ")" + new Date().toLocaleTimeString());
                                    }

                                    //Step 8 - Online Payment Not Required -  Check Payment type - Don't need to pay later section
                                    //AT_HOTEL - Payment Data is required
                                    if (paymentType.toLowerCase() === 'at_hotel') {
                                      return resolve({ bookingResult: updateBookingResult });
                                    }
                                  }

                                  //isPayLater is true , All booking operation was performed and notify to user for until time payment
                                  else {
                                    return resolve({ bookingResult: updateBookingResult });
                                  }
                                }
                                else {
                                  //# Update Booking has error
                                  reject({
                                    error: "07",
                                    message: "update booking has error",
                                    data: []
                                  });
                                }
                              });//# End Insert into db with after booking status 
                            }

                            //# Hotel beds booking api error
                            else {
                              //# Insert Booking has error
                              reject({
                                error: "06",
                                message: "booking api has error",
                                data: []
                              });
                            }
                          });//# End Hotel beds booking api

                        });//# End Create booking object for Hotel Beds API

                      }

                      //# Insert booking has error
                      else {
                        //# Insert Booking has error
                        reject({
                          error: "04",
                          message: "booking register has error",
                          data: []
                        });
                      }
                    });//# End Insert into db with pre booking status
                  }
                  else {
                    //Price Was changed 
                    reject({
                      error: "03",
                      message: "Price was changed",
                      data: []
                    });
                  }
                }
                else {
                  //Update Price Error
                  reject({
                    error: "02",
                    message: "Update price error",
                    data: []
                  });
                }
              });//# End Update price
            }
            else {
              //Rate keys is changed by user
              reject({
                error: "01",
                message: "Rate key was changed",
                data: []
              });
            }
          });//# End Check validity
        } catch (error) {
          console.log("\x1b[33m%s\x1b[0m", "Hotel Book API Catch " + error + " " + new Date().toLocaleTimeString()
          );
          reject({
            error: "05",
            message: error,
            data: []
          });
        }
      }
    );
  }

  multipleRequest(moneyUnit: string, statusCode: string) {
    console.log("\x1b[36m%s\x1b[0m", "Multiple Request Entries " + "(" + moneyUnit + ")" + new Date().toLocaleTimeString());

    console.log(`${process.env.MAIN_URL}money_unit/code/${moneyUnit}`);
    console.log(`${process.env.MAIN_URL}service_type/code/2`);
    console.log(`${process.env.MAIN_URL}gateway/code/hotelbeds`);
    console.log(`${process.env.MAIN_URL}general_item/code/01/BookingStatus`);

    return new Promise(
      (resolve: (result: any) => void, reject: (error: any) => void) => {
        let request_templates = [];

        //Money Unit
        request_templates.push(
          new RequestTemplate(
            `${process.env.MAIN_URL}money_unit/code/${moneyUnit}`,
            {},
            "GET"
          )
        );

        //Service Type -> Hotel
        request_templates.push(
          new RequestTemplate(
            `${process.env.MAIN_URL}service_type/code/2`,
            {},
            "GET"
          )
        );

        //Gateway -> HotelBeds
        request_templates.push(
          new RequestTemplate(
            `${process.env.MAIN_URL}gateway/code/hotelbeds`,
            {},
            "GET"
          )
        );

        //Status -> HotelBeds
        request_templates.push(
          new RequestTemplate(
            `${process.env.MAIN_URL}general_item/code/${statusCode}/BookingStatus`,
            {},
            "GET"
          )
        );

        ExternalRequest.callMultipleRequest(
          request_templates).then((req_result: any) => {
            console.log("\x1b[36m%s\x1b[0m", "Multiple Request Result " + "(" + req_result[0] + ")" + new Date().toLocaleTimeString());
            req_result[2] = { payload: { data: req_result[2] } };
            return resolve(req_result.map(el => el.payload.data));
          });
      });
  }

  //registerBookingInDB
  insertBooking(item: any, hotelBedsResponse: any) {
    console.log("\x1b[36m%s\x1b[0m", "insertBooking Method Entries " + new Date().toLocaleTimeString());

    return new Promise(
      (resolve: (result: any) => void, reject: (error: any) => void) => {
        let currency = hotelBedsResponse && hotelBedsResponse.booking && hotelBedsResponse.booking.currency ? hotelBedsResponse.booking.currency : 'none';
        this.multipleRequest(currency, '01').then(req_result => {
          //Money Unit -> req_result[0] - Service Type -> req_result[1] - Gateway -> req_result[2] - Status -> req_result[3]
          this.createBookingDBObject(req_result, {}, item, {}).then(result => {
            console.log("\x1b[33m%s\x1b[0m", "External Request Booking " + new Date().toLocaleTimeString());

            ExternalRequest.syncPostRequest(
              `${process.env.MAIN_URL}booking`,
              undefined,
              result,
              (error, insertBookResult) => {
                if (error) {
                  console.log("\x1b[33m%s\x1b[0m", "Hotel Beds Book API External Request Error : " + error + " " + new Date().toLocaleTimeString());
                  return resolve({ result: {}, message: 'nok' })
                }
                return resolve({ result: insertBookResult.payload.data, message: 'ok' })
              },
              undefined,
              undefined,
              undefined,
              {
                "Api-key": process.env.HotelBedsAPIKey,
                "X-Signature": this.keyGenerator(),
                Accept: "application/json"
              }
            );
          });
        });
      });
  }

  //Update booking Information , For example status
  updateBooking(loggedInUser: any, bookingObj: any, item: any, hotelBedsResponse: any, minDateOfFree: any, cancellationPolicies: any, paymentType: string) {
    return new Promise(
      (resolve: (result: any) => void, reject: (error: any) => void) => {
        this.multipleRequest(hotelBedsResponse.booking.currency, '02').then(req_result => {
          bookingObj.status.push(Array.isArray(req_result[3]) ? req_result[3][0] : req_result[3]);
          bookingObj.totalPrice = hotelBedsResponse.booking.totalNet;
          bookingObj.moneyUnit = Array.isArray(req_result[0]) ? (req_result[0].length > 0 ? req_result[0][0] : {}) : req_result[0];
          bookingObj.status = reverse(bookingObj.status);
          bookingObj.paymentInfo = {};
          //Keep hotel beds api response
          bookingObj.hotel = hotelBedsResponse.booking.hotel;
          bookingObj.hotel.paymentType = paymentType;
          bookingObj.hotel.reference = hotelBedsResponse.booking.reference;
          bookingObj.hotel.clientReference = hotelBedsResponse.booking.clientReference;
          bookingObj.hotel.creationDate = hotelBedsResponse.booking.creationDate;
          bookingObj.hotel.hotelStatus = hotelBedsResponse.booking.status;
          bookingObj.hotel.modificationPolicies = hotelBedsResponse.booking.modificationPolicies;
          bookingObj.hotel.creationUser = hotelBedsResponse.booking.creationUser;
          bookingObj.hotel.holder = hotelBedsResponse.booking.holder;
          bookingObj.hotel.remark = hotelBedsResponse.booking.remark;
          bookingObj.hotel.invoiceCompany = hotelBedsResponse.booking.invoiceCompany;
          bookingObj.hotel.creationUser = hotelBedsResponse.booking.creationUser;
          bookingObj.hotel.isPayLater = item.isPayLater;
          //
          bookingObj.hotel.minDateOfFree = minDateOfFree;
          bookingObj.hotel.cancellationPolicies = cancellationPolicies;
          ExternalRequest.syncGetRequest(
            process.env.MAIN_URL + "profile/id/" + loggedInUser.profileId,
            (profileErr, profileResult) => {
              bookingObj.individualProfile = profileResult.payload.data[0];
              ExternalRequest.syncPostRequest(
                `${process.env.MAIN_URL}booking`,
                undefined,
                bookingObj,
                (error, updateBookResult) => {
                  if (error) {
                    console.log("\x1b[33m%s\x1b[0m", "Hotel Beds Book API External Request Error : " + error + " " + new Date().toLocaleTimeString());
                    return resolve({ result: {}, message: 'nok' })
                  }
                  return resolve({ result: bookingObj, message: 'ok' });
                },
                'PUT',
                undefined,
                undefined,
                {
                  "Api-key": process.env.HotelBedsAPIKey,
                  "X-Signature": this.keyGenerator(),
                  Accept: "application/json"
                }
              );
            });
        });
      });
  }

  //Create booking object for insert or update in db
  createBookingDBObject(req_result: any, status: {}, item: any, hotelBedsResponse: any) {
    console.log("\x1b[36m%s\x1b[0m", "Creating Booking Object " + "(" + + ")" + new Date().toLocaleTimeString());
    const arraySum = arr => arr.reduce((a, b) => a + b, 0);
    let passenger = {
      "_id": "",
      "index": 0,
      "isPrimary": true,
      "price": [
        {
          "totalPrice": 0,
          "baseFare": 0,
          "tax": 0,
          "ticketDesignators": [],
          "msps": [
            {}
          ] //profileid:share value
        }
      ],
      "type": "adult",
      "birthDate": "",
      "avatar": "",
      "lastName": "",
      "firstName": "",
      "isMale": null,
      "nationality": {}, //Country
      "parentProfileId": 0,
      "passportCountry": "",
      "nationalCode": "",
      "passportNo": "",
      "passportExpireDate": ""
    };
    let passengers = [];

    for (let index = 0; index < item.roomHolders.length; index++) {
      passenger.firstName = item.roomHolders[index].paxes[0].name;
      passenger.lastName = item.roomHolders[index].paxes[0].surname;
      passengers.push(passenger);
    }
    console.log("\x1b[36m%s\x1b[0m", "passengers " + "(" + passengers[0] + ")" + new Date().toLocaleTimeString());
    return new Promise(
      (resolve: (result: any) => void, reject: (error: any) => void) => {
        let book = {
          "_id": "5e26bcd4902bbb44ec9d604c",
          "orderDate": new Date(),
          "individualProfile": {},
          "onBehalfProfile": null,
          "totalPrice": (hotelBedsResponse && hotelBedsResponse.booking && hotelBedsResponse.booking.totalNet) ? hotelBedsResponse.booking.totalNet : arraySum(item.rooms.map(t => t.net)),
          "moneyUnit": Array.isArray(req_result[0]) ? (req_result[0].length > 0 ? req_result[0][0] : {}) : req_result[0],
          "serviceType": Array.isArray(req_result[1]) ? req_result[1][0] : req_result[1],
          "attachments": [
            {
              "name": "",
              "type": ""
            }
          ],
          "bookDate": "2020-01-21T08:56:51.321Z",
          "gateways": [
            Array.isArray(req_result[2]) ? req_result[2][0] : req_result[2]
          ],
          "invoiceNo": Math.floor(Math.random() * 1000000000),
          "issuerContactInfo": {
            "address": null,
            "email": item.bookingResponsible.email,
            "mobile": item.bookingResponsible.phoneNumber,
            "firstName": item.holder.name,
            "lastName": item.holder.surname
          },
          "paymentInfo": {
            "type": "",
            "cardNumber": "",
            "merchantId": "",
            "refrenceID": ""
          },
          "status": [
            Array.isArray(req_result[3]) ? req_result[3][0] : req_result[3]
          ],
          "passengers": passengers,
          "flight": {},
          "hotel": hotelBedsResponse ? hotelBedsResponse : {}
        }
        console.log("\x1b[36m%s\x1b[0m", "Book Created " + "(" + book + ")" + new Date().toLocaleTimeString());
        return resolve(book);
      });
  }

  //Create booking object for hotel beds api input
  createBookInputObject(item: any) {
    return new Promise(
      (resolve: (result: any) => void, reject: (error: any) => void) => {
        try {

          let bookingObject = {
            holder: {
              name: item.holder.name,
              surname: item.holder.surname
            },
            rooms: [],
            clientReference: "IntegrationAgency",
            remark: "Booking remarks are to be written here.",
            tolerance: 2.00,
            paymentData: null
          }
          //Check Payment Type - If payment type us at_web object without credit caed information and if at_hotel must have credit card object
          if (item.paymentData)
            bookingObject.paymentData = item.paymentData;

          for (let index = 0; index < item.rooms.length; index++) {
            bookingObject.rooms.push({ rateKey: item.rooms[index].rateKey, paxes: [] });
            for (let room = 0; room < item.rooms[index].rooms; room++) {
              bookingObject.rooms[index].paxes.push({
                roomId: 1,
                type: "AD",
                name: item.roomHolders.filter(x => x.rateKey === item.rooms[index].rateKey)[0].paxes[0].name,
                surname: item.roomHolders.filter(x => x.rateKey === item.rooms[index].rateKey)[0].paxes[0].surname
              })
            }
          }
          return resolve({ data: bookingObject, message: "ok" });
        } catch (error) {
          return reject({ data: {}, message: "nok" });
        }
      });
  }

  //Gey Rooms and Check rate type was recheck , Update All rooms price
  async updateRoomsPrice(rooms: any, paymentSecret) {
    //Fetch all recheck rate keys , Because rooms with just recheck type must be updated price
    let rateKeys = [];
    let hotelInfo = {};
    let isPriceChange = false;
    for (let element = 0; element < rooms.length; element++) {
      if (rooms[element].rateType.toLowerCase() === 'recheck') {
        let roomsPrice = {
          "rooms": [{ "rateKey": "" }]
        };
        if (rateKeys.indexOf(rooms[element].rateKey) === -1) {
          roomsPrice.rooms[0].rateKey = rooms[element].rateKey;
          try {
            await axios({
              method: 'POST',
              url: process.env.HotelBedsEndPoint + process.env.HotelBedsHotelCheckRate,
              data: roomsPrice,
              headers: {
                "Api-key": process.env.HotelBedsAPIKey,
                "X-Signature": this.keyGenerator(),
                Accept: "application/json"
              }
            }).then(checkRateResult => {
              if (isPriceChange === false) {
                isPriceChange = checkRateResult.data.hotel.rooms[0].rates[0].net == rooms[element].net ? false : true;
              }
              hotelInfo = checkRateResult.data.hotel;
              rateKeys = flattenDeep([rateKeys, checkRateResult.data.hotel.rooms.map(x => x.rates.map(y => y.rateKey))]);
              rooms[element].net = checkRateResult.data.hotel.rooms[0].rates[0].net;
            });
          } catch (error) {
            console.log("\x1b[33m%s\x1b[0m", "Rate API Catch " + error + " " + new Date().toLocaleTimeString());
            return ({ Rooms: [], HotelInfo: {}, IsPriceChanged: false, Message: 'nok' });
          }
        }
      }
    }
    rooms.forEach(element => {
      element.rateType = 'BOOKABLE';
      let rateStringedFormat =
        process.env.HotelSecretKey + JSON.stringify(element.rateKey);
      element.hotelSecret = crypto
        .createHash("sha256")
        .update(rateStringedFormat)
        .digest("base64");
    });
    return ({ Rooms: rooms, HotelInfo: hotelInfo, IsPriceChanged: isPriceChange, Message: 'ok' });
  }

  //Api function for calling hotel beds book api
  hotelBedsBooking(item: any) {
    console.log("\x1b[36m%s\x1b[0m", "Hotel Beds Book API Entries" + " " + new Date().toLocaleTimeString());
    console.log(item);
    return new Promise(
      (resolve: (result: any) => void, reject: (error: any) => void) => {
        try {
          ExternalRequest.syncPostRequest(
            process.env.HotelBedsEndPoint + process.env.HotelBedsBookingAPI,
            undefined,
            item,
            (error, bookResult) => {
              if (error) {
                console.log("\x1b[33m%s\x1b[0m", "Hotel Beds Book API External Request Error : " + error + " " + new Date().toLocaleTimeString());
                return resolve({ booking: {} });
              }
              if (bookResult.status && bookResult.payload.data.booking) {
                console.log("\x1b[36m%s\x1b[0m", "Hotel Book External Request Success" + " " + new Date().toLocaleTimeString());
                return resolve({ booking: bookResult.booking, message: 'ok' });
              } else {
                console.log("\x1b[33m%s\x1b[0m", "Hotel Beds Book API External Request Empty Result" + " " + new Date().toLocaleTimeString());
                return resolve({ booking: {}, message: 'nok' });
              }
            },
            undefined,
            undefined,
            undefined,
            {
              "Api-key": process.env.HotelBedsAPIKey,
              "X-Signature": this.keyGenerator(),
              Accept: "application/json"
            }
          );
        } catch (error) {
          console.log("\x1b[33m%s\x1b[0m", "Hotel Beds Book API Catch " + error + " " + new Date().toLocaleTimeString());
          reject({
            error: "05",
            message: error,
            data: []
          });
        }
      }
    );
  }

  //Check rooms rates for recheck or bookable and check book information does not change
  checkValidityOfRoomsRates(item: any) {
    return new Promise(
      (resolve: (result: any) => void, reject: (error: any) => void) => {
        try {
          item.forEach(element => {
            let hotelSecret = element.hotelSecret;
            delete element.hotelSecret;
            let stringFormatRateSecret = crypto
              .createHash("sha256")
              .update(process.env.HotelSecretKey + JSON.stringify(element))
              .digest("base64");
            if (hotelSecret != stringFormatRateSecret)
              resolve(false);
          });
          resolve(true);
        } catch (e) { }
      }
    );
  }

  //This method used for create hash  - Used in hotel detail api
  keyGenerator() {
    var utcDate = Math.floor(new Date().getTime() / 1000);

    var assemble =
      process.env.HotelBedsAPIKey +
      process.env.HotelBedsSecret +
      utcDate.toString();

    return CryptoJS.SHA256(assemble).toString();
  }

  compareValues(key, order = "asc") {
    return function (a, b) {
      if (!a.hasOwnProperty(key) || !b.hasOwnProperty(key)) {
        // property doesn't exist on either object
        return 0;
      }

      const varA = typeof a[key] === "string" ? a[key].toUpperCase() : a[key];
      const varB = typeof b[key] === "string" ? b[key].toUpperCase() : b[key];

      let comparison = 0;
      if (varA > varB) {
        comparison = 1;
      } else if (varA < varB) {
        comparison = -1;
      }
      return order == "desc" ? comparison * -1 : comparison;
    };
  }
}
Object.seal(HotelBedsManager);
