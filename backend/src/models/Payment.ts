import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type PaymentMethod = 'card' | 'upi' | 'wallet' | 'netbanking' | 'simulated_test';
export type PaymentState = 'pending' | 'completed' | 'failed' | 'refunded';

export interface IPayment {
  bookingId: Types.ObjectId;
  userId: Types.ObjectId;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  status: PaymentState;
  transactionId: string;
  gatewayResponse?: Record<string, unknown>;
  paidAt?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentDocument extends IPayment, Document {}

const paymentSchema = new Schema<PaymentDocument>(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking ID is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: ['card', 'upi', 'wallet', 'netbanking', 'simulated_test'],
      default: 'simulated_test',
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    gatewayResponse: {
      type: Schema.Types.Mixed,
      default: {},
    },
    paidAt: {
      type: Date,
    },
    failureReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        const id = ret._id?.toString() || ret.id?.toString();
        ret.id = id;
        ret._id = id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });

export const Payment: Model<PaymentDocument> =
  mongoose.models.Payment || mongoose.model<PaymentDocument>('Payment', paymentSchema);

