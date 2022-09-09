export class paymentResponse {
  public token: string = "";
  public merchantId: string = "";
  public resultCode: string = "";
  public paymentId: string = "";
  public requestId: string = "";
  public InvoiceNumber: string = "";
  public hashedCardNo: string = "";
  public referenceId: string = "";
  public amount: string = "";
  public cno: string = "";
  public cardNo: string = "";
  public verifiedAmount: number = 0;
  public creditPayment: { id: number, amount: number } = { id: 0, amount: 0 }
  public walletPayment: { id: number, amount: number } = { id: 0, amount: 0 }
  public pointPayment: { id: number, amount: number } = { id: 0, amount: 0 }
}