var request = require("request");
var axios = require("axios");

export class ExternalRequest {
  static syncPostRequest(
    url: string,
    cookie: string,
    body: any,
    callback: (error: any, result: any) => void,
    method?: string,
    contentType?: string,
    requireResponseObject?: boolean,
    header?: any
  ) {
    return new Promise((fullFill, eject) => {
      if (method == undefined) method = "POST";
      if (contentType == undefined) contentType = "application/json";
      if (requireResponseObject == undefined) requireResponseObject = false;
      var headers = {
        "Content-Type": contentType
      };
      if (header) headers = { ...headers, ...header };
      if (url.indexOf(process.env.MAIN_URL) >= 0) headers["internalauth"] = process.env.INTERNAL_SECRET;
      if (cookie) headers["Cookie"] = cookie;
      axios({
        method: method,
        url: url,
        data: body,
        headers: headers
      }).then(
        function (response) {
          if (!requireResponseObject) {
            fullFill(response.data);
            if (callback) callback(null, response.data);
          } else {
            fullFill(response);
            if (callback) callback(null, response);
          }
        },
        function (error) {
          if (callback) callback(error, null);
          if (!callback) eject(error);
        }
      );
    });
  }

  static syncGetRequest(
    url: string,
    callback: (error: any, result: any) => void,
    contentType?: string,
    requireResponseObject?: boolean,
    header?: any,
    requirePlainBody?: boolean
  ) {
    return new Promise((fullFill, eject) => {
      if (contentType == undefined) contentType = "application/json";
      if (requireResponseObject == undefined) requireResponseObject = false;
      if (requirePlainBody == undefined) requirePlainBody = false;
      var headers = {
        "Content-Type": contentType
      };
      if (header) headers = { ...headers, ...header };
      if (url.indexOf(process.env.MAIN_URL) >= 0) headers["internalauth"] = process.env.INTERNAL_SECRET;
      var options = {
        url: url,
        method: "GET",
        headers: headers
      };
      request(options, function (error, response, body) {
        // if (!requirePlainBody) {
        //   try { JSON.parse(body) }
        //   catch (ex) { console.log("BODY JSON PARSE REQUEST", body) }
        // }
        if (!error && response.statusCode == 200) {
          try {
            fullFill(requireResponseObject ? response : (requirePlainBody ? body : JSON.parse(body)));
          }
          catch {
            fullFill(requireResponseObject ? response : (requirePlainBody ? body : body));
          }
        } else {
          // console.log(error);
          try {
            fullFill(requireResponseObject ? response : (requirePlainBody ? body : JSON.parse(body)));
          }
          catch {
            fullFill(requireResponseObject ? response : (requirePlainBody ? body : body));
          }
        }
        if (callback) callback(error, requireResponseObject ? response : (requirePlainBody ? body : JSON.parse(body)));
      });
    });
  }

  static callMultipleRequest(requestTemplates: RequestTemplate[]) {
    return new Promise((resolve, eject) => {
      try {
        let request_results = [];
        let callback_index = 0;
        var request_callback = (index, result) => {
          callback_index++;
          request_results[index] = result;
          if (callback_index == requestTemplates.length) {
            resolve(request_results);
          }
        };

        for (
          let request_index = 0;
          request_index < requestTemplates.length;
          request_index++
        ) {
          if (
            requestTemplates[request_index].method == "" ||
            requestTemplates[request_index].method.toLowerCase() == "get"
          ) {
            ExternalRequest.syncGetRequest(
              requestTemplates[request_index].url,
              (err, result) => request_callback(request_index, result),
              requestTemplates[request_index].contentType
            )
          } else {
            ExternalRequest.syncPostRequest(
              requestTemplates[request_index].url,
              requestTemplates[request_index].body,
              requestTemplates[request_index].method,
              (err, result) => request_callback(request_index, result),
              requestTemplates[request_index].contentType
            )
          }
        }
      } catch (error) {

      }
    });
  }
}

export class RequestTemplate {
  constructor(
    _url: string,
    _body: any,
    _method?: string,
    _contentType?: string
  ) {
    this.url = _url;
    this.body = _body;
    this.method = _method;
    this.contentType = _contentType;
  }
  public url: string = "";
  public body: any = null;
  public method: string = "";
  public contentType: string = "";
}
