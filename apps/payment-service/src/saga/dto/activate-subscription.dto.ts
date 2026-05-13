export class ActivateSubscriptionDto {
  userId: string;
  plan: string;
  durationDays: number;
  paymentId: string;
  paymentType: string;
  previousPlan?: string;
}
