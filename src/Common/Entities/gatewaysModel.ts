const gatewayMetadata = {
  fields: {
    name: "text",
    webserviceUrl: "text",
    logo: "text",
    fields: "text",
    _id: {
      type: "uuid",
      default: { $db_function: "uuid()" }
    }
  },
  key: ["_id"]
};
module.exports = gatewayMetadata;
