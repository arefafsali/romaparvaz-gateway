
export class BookFlight{
    constructor() {}
    
    public SessionId: string = "";              //Required
    public FareSourceCode: string = "";         //Required
    public ClientUniqueId: string = "R123456";
    public MarkupForAdult: number = 15480000;
    public MarkupForChild: number = 0.0;
    public MarkupForInfant: number = 0.0;
    // public TravelerInfo: object[]=[             //Required
    //     {
    //         PhoneNumber: "00442081234287",
    //         Email: "Sales@Partocrs.com"
    //         //AirTravelers: [{
    //         //    "DateOfBirth": "1990-11-01T00:00:00",
    //         //    "Gender": 0,
    //         //}]
    //     }
    // ]
}