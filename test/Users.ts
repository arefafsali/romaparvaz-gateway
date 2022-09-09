
let chaiSas = require("chai");
let chaiHttp = require("chai-http");
let server = require("../src/index");
let should = chaiSas.should();

chaiSas.use(chaiHttp);

describe("/GET users", () => {
  it("it should GET all the users", done => {
    chaiSas
      .request(server)
      .get("/users")
      .end((err, res) => {
        // console.log(res);
        res.should.have.status(200);
        res.body.should.be.a("array");
        // res.body.length.should.be.eql(3);
        done();
      });
  });
});
