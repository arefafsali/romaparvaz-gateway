import { Request, Response, NextFunction } from "express";
import { AmadeusManager } from "../Logic/Managers/AmadeusManager";
import { BaseRouter } from "../Repositories/Utility/BaseRouter";
const sessionMaxTime = parseInt(process.env.AMADEUS_MAX_SESSION_TIME);

export class AmadeusController extends BaseRouter {
  manager: AmadeusManager;
  constructor() {
    super(AmadeusManager);
    this.init();
  }

  init() {
    // super.init();
    // this.router.post("/search", this.getSearch);
    // this.router.post("/search_original", this.getOriginal);
    // this.router.post("/search_calendar", this.getSearchCalendar);
    // this.router.post("/cancel_book", this.postCancelBook)
    // this.router.get("/ping", this.getPing);
    // this.router.get("/apis_rules", this.getAPISRules);
    // this.router.get("/check_eticket", this.getCheckETicket);
    // // this.router.post("/flight_rules", this.getFlightRules);
    // // this.router.post("/create_ticket", this.createTicket);

    // // For development use
    // this.router.get("/sessionid", this.getSessionId);
    // this.router.get("/nextflight", this.getNextFlight);
    // this.router.post("/signout", this.postSignOut);
    this.router.get(
      "/clear_console",
      (req: Request, res: Response, next: NextFunction) => {
        console.log("\x1Bc");
        console.clear();
        // console.log('\x1B[2J');
        res.locals.send("done", next);
      }
    );
  }

  getSearch = (req: Request, res: Response, next: NextFunction) => {
    // let session = req["gsessions"].amadeus;
    // this.manager.getSearch({ body: req.body, sessionId: session.sessionId, sessionTime: session.sessionTime }, (err, result, session) => {
    //   this.createSessionCookies(session, res);
    //   if (err) res.status(500).locals.send({ error: err }, next);
    //   else res.locals.send(result, next);
    // });
  };

  getSearchAllTypes = (req: Request, res: Response, next: NextFunction) => {};

  getOriginal = (req: Request, res: Response, next: NextFunction) => {
    let session = req["gsessions"].amadeus;
    this.manager.getOriginal(
      {
        body: req.body,
        sessionId: session.sessionId,
        sessionTime: session.sessionTime,
      },
      (err, result, session) => {
        this.createSessionCookies(session, res);
        if (err) res.status(500).send({ error: err });
        else res.send(result);
      },
      { ...req.query, requestUUID: req["guuid"],    
    }
    );
  };

  getSearchCalendar = (req: Request, res: Response, next: NextFunction) => {
    // this.manager.getSearchCalendar(req.body, (err, result) => {
    //   if (err) res.status(500).send({ error: err });
    //   else res.send(result);
    // });
  };

  postCancelBook = (req: Request, res: Response, next: NextFunction) => {
    let sessionId = null;
    if (req.header("cookie"))
      sessionId = req
        .header("cookie")
        .split("; ")
        .filter((val) => val.indexOf("amdsid") >= 0)[0];
    this.manager.postCancelBook(
      { body: req.body, sessionId: sessionId },
      (err, result, sessionId) => {
        if (sessionId) res.setHeader("set-cookie", sessionId);
        if (err) res.status(500).send({ error: err });
        else res.send(result);
      },
      { ...req.query, requestUUID: req["guuid"] }
    );
  };

  getPing = (req: Request, res: Response, next: NextFunction) => {
    this.manager
      .getPing({ ...req.query, requestUUID: req["guuid"] })
      .then((result) => {
        res.send(result);
      })
      .catch((err) => res.status(500).locals.send({ error: err }, next));
  };

  getAPISRules = (req: Request, res: Response, next: NextFunction) => {
    let session = req["gsessions"].amadeus;
    this.manager.getAPISRules(
      { body: req.query, session },
      (err, result, session) => {
        this.createSessionCookies(session, res);
        if (err) res.status(500).send({ error: err });
        else res.send(result);
      },
      { ...req.query, requestUUID: req["guuid"] }
    );
  };

  getCheckETicket = (req: Request, res: Response, next: NextFunction) => {
    let session = req["gsessions"].amadeus;
    this.manager.getCheckETicket(
      { body: req.query, session },
      (err, result, session) => {
        this.createSessionCookies(session, res);
        if (err) res.status(500).send({ error: err });
        else res.send(result);
      },
      { ...req.query, requestUUID: req["guuid"] }
    );
  };

  getFlightRules = (req: Request, res: Response, next: NextFunction) => {
    // let session = req["gsessions"].amadeus;
    // this.manager.getFlightRules({ body: req.body, session }, (err, result, session) => {
    //   this.createSessionCookies(session, res);
    //   if (err) res.status(500).send({ error: err });
    //   else res.send(result);
    // });
  };

  createTicket = (req: Request, res: Response, next: NextFunction) => {
    // this.manager.createTicket({ body: req.body }, (err, result) => {
    //   if (err) res.status(500).send({ error: err });
    //   else res.send(result);
    // });
  };

  getSessionId = (req: Request, res: Response, next: NextFunction) => {
    let session = req["gsessions"].amadeus;
    res.locals.send({
      ...session,
      sessionRemainingTime:
        sessionMaxTime -
        (new Date().getTime() - new Date(session.sessionTime).getTime()),
    });
    next();
  };

  getNextFlight = (req: Request, res: Response, next: NextFunction) => {
    let session = req["gsessions"].amadeus;
    this.manager.getNextFlight(
      { sessionId: session.sessionId, sessionTime: session.sessionTime },
      (err, result, session) => {
        this.createSessionCookies(session, res);
        if (err) res.status(500).send({ error: err });
        else res.send(result);
      },
      { ...req.query, requestUUID: req["guuid"] }
    );
  };

  postSignOut = (req: Request, res: Response, next: NextFunction) => {
    let session = req["gsessions"].amadeus;
    if (session.sessionId) {
      console.log(session.sessionId);
      // this.manager.postSignOut(session.sessionId, (err, result) => {
      //   if (err) res.status(500).send({ error: err });
      //   else res.clearCookie(process.env.AMADEUS_SESSION_ID_COOKIE_NAME).clearCookie(process.env.AMADEUS_SEESION_TIME_COOKIE_NAME).send(result);
      // })
    }
  };

  createSessionCookies = (session: any, res: Response) => {
    if (session)
      if (session.sessionDeleted) {
        res
          .clearCookie(process.env.AMADEUS_SESSION_ID_COOKIE_NAME)
          .clearCookie(process.env.AMADEUS_SEESION_TIME_COOKIE_NAME);
      } else {
        if (session.sessionId)
          res.cookie(
            process.env.AMADEUS_SESSION_ID_COOKIE_NAME,
            this.encryptCookieValue(session.sessionId),
            { httpOnly: true }
          );
        res.cookie(
          process.env.AMADEUS_SEESION_TIME_COOKIE_NAME,
          this.encryptCookieValue(session.sessionTime),
          { httpOnly: true }
        );
      }
    return res;
  };

  encryptCookieValue = (value: string) => {
    if (value) return Buffer.from(value, "utf8").toString("base64");
  };
}
const amadeusController = new AmadeusController();

export default amadeusController.router;
