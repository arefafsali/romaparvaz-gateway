import { Router, Response, NextFunction, Request } from "express";
import { mahanSession, amadeusSession } from "../../Common/Metadata/gatewayLogicInputMetadata";

export class SessionManagement {
  static getGatewaySessions(req: Request, res: Response, next: NextFunction) {
    req["gsessions"] = {
      amadeus: SessionManagement.extractAmadeusSessionIdandTime(req.header('cookie')),
      mahan: SessionManagement.extractMahanSessionIdandTime(req.header('cookie'))
    }
    next();
  }

  static setGatewaySessionCookies(req: Request, res: Response, next: NextFunction) {
    if (res.locals.session) {
      if (res.locals.session.amadeus)
        SessionManagement.createAmadeusSessionCookies(res.locals.session.amadeus, res);
      if (res.locals.session.mahan)
        SessionManagement.createMahanSessionCookies(res.locals.session.mahan, res);
    } next();
  }

  private static extractAmadeusSessionIdandTime: (cookie: any) => amadeusSession = (cookie: any) => {
    let sessionId = null, sessionTime = null;
    sessionId = cookie && cookie.replace(/; /g, ";").split(";").filter((val) => val.indexOf(process.env.AMADEUS_SESSION_ID_COOKIE_NAME) == 0)[0];
    sessionId = sessionId && sessionId.split("=")[1];
    sessionTime = cookie && cookie.replace(/; /g, ";").split(";").filter((val) => val.indexOf(process.env.AMADEUS_SEESION_TIME_COOKIE_NAME) == 0)[0];
    sessionTime = sessionTime && sessionTime.split("=")[1];
    if (sessionId)
      sessionId = SessionManagement.decryptCookieValue(sessionId);
    else
      sessionId = null;
    if (sessionTime)
      sessionTime = SessionManagement.decryptCookieValue(sessionTime);
    else
      sessionTime = null;
    return { sessionId, sessionTime };
  };

  private static createAmadeusSessionCookies = (session: any, res: Response) => {
    if (session)
      if (session.sessionDeleted) {
        res.clearCookie(process.env.AMADEUS_SESSION_ID_COOKIE_NAME).clearCookie(process.env.AMADEUS_SEESION_TIME_COOKIE_NAME)
      }
      else {
        if (session.sessionId)
          res.cookie(process.env.AMADEUS_SESSION_ID_COOKIE_NAME, SessionManagement.encryptCookieValue(session.sessionId), { httpOnly: true, /*sameSite: 'none'*/ });
        if (session.sessionTime)
          res.cookie(process.env.AMADEUS_SEESION_TIME_COOKIE_NAME, SessionManagement.encryptCookieValue(session.sessionTime), { httpOnly: true, /*sameSite: 'none'*/ });
      }
    return res;
  };

  private static extractMahanSessionIdandTime: (cookie: any) => mahanSession = (cookie: any) => {
    let sessionId = null, sessionTime = null, transactionId = null;
    sessionId = cookie && cookie.replace(/; /g, ";").split(";").filter((val) => val.indexOf(process.env.MAHAN_SESSION_ID_COOKIE_NAME) == 0)[0];
    sessionId = sessionId && sessionId.split("=")[1];
    sessionTime = cookie && cookie.replace(/; /g, ";").split(";").filter((val) => val.indexOf(process.env.MAHAN_SEESION_TIME_COOKIE_NAME) == 0)[0];
    sessionTime = sessionTime && sessionTime.split("=")[1];
    transactionId = cookie && cookie.replace(/; /g, ";").split(";").filter((val) => val.indexOf(process.env.MAHAN_SEESION_TRANSID_COOKIE_NAME) == 0)[0];
    transactionId = transactionId && transactionId.split("=")[1];
    if (sessionId)
      sessionId = SessionManagement.decryptCookieValue(sessionId);
    if (sessionTime)
      sessionTime = SessionManagement.decryptCookieValue(sessionTime);
    if (transactionId)
      transactionId = SessionManagement.decryptCookieValue(transactionId);
    return { sessionId, sessionTime, transactionId };
  };

  private static createMahanSessionCookies = (session: any, res: Response) => {
    if (session)
      if (session.sessionDeleted) {
        res.clearCookie(process.env.MAHAN_SESSION_ID_COOKIE_NAME).clearCookie(process.env.MAHAN_SEESION_TIME_COOKIE_NAME).clearCookie(process.env.MAHAN_SEESION_TRANSID_COOKIE_NAME)
      }
      else {
        if (session.sessionId)
          res.cookie(process.env.MAHAN_SESSION_ID_COOKIE_NAME, SessionManagement.encryptCookieValue(session.sessionId), { httpOnly: true,/*sameSite: 'none'*/ });
        if (session.sessionTime)
          res.cookie(process.env.MAHAN_SEESION_TIME_COOKIE_NAME, SessionManagement.encryptCookieValue(session.sessionTime), { httpOnly: true, /*sameSite: 'none'*/ });
        if (session.transactionId)
          res.cookie(process.env.MAHAN_SEESION_TRANSID_COOKIE_NAME, SessionManagement.encryptCookieValue(session.transactionId), { httpOnly: true, /*sameSite: 'none'*/ });
      }
    return res;
  };

  private static encryptCookieValue = (value: string) => {
    if (value)
      return Buffer.from(value, 'utf8').toString('base64');
  };

  private static decryptCookieValue = (value: string) => {
    if (value)
      return Buffer.from(value, 'base64').toString('utf8');
  };

}
