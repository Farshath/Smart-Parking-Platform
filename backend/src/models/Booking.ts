import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export const BOOKING_STATUSES: BookingStatus[] = [
  'pending',
  'confirmed',
  'cancelled',
  'completed',
];

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface IBooking {
  bookingReference: string;
  userId: Types.ObjectId;
  listingId: Types.ObjectId;
  startTime: Date;
  endTime: Date;
  totalAmount: number;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentId?: Types.ObjectId;
  capacityReserved: boolean;
  idempotencyKey?: string;
  vehicleNumber?: string;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BookingDocument extends IBooking, Document {}

const bookingSchema = new Schema<BookingDocument>(
  {
    bookingReference: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    listingId: {
      type: Schema.Types.ObjectId,
      ref: 'ParkingListing',
      required: [true, 'Parking listing ID is required'],
      index: true,
    },
    startTime: {
      type: Date,
      required: [true, 'Booking start time is required'],
      index: true,
    },
    endTime: {
      type: Date,
      required: [true, 'Booking end time is required'],
      validate: {
        validator: function (this: BookingDocument, val: Date) {
          return val > this.startTime;
        },
        message: 'End time must be strictly after start time',
      },
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    status: {
      type: String,
      enum: {
        values: BOOKING_STATUSES,
        message: '{VALUE} is not a valid booking status',
      },
      default: 'confirmed',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
    },
    capacityReserved: {
      type: Boolean,
      default: false,
    },
    idempotencyKey: {
      type: String,
      trim: true,
    },
    vehicleNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Cancellation reason cannot exceed 500 characters'],
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

// Indexes to support booking queries and slot conflict checks
bookingSchema.index({ userId: 1, status: 1 });
bookingSchema.index({ listingId: 1, startTime: 1, endTime: 1 });
bookingSchema.index({ status: 1, createdAt: -1 });
bookingSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

export const Booking: Model<BookingDocument> =
  mongoose.models.Booking || mongoose.model<BookingDocument>('Booking', bookingSchema);
