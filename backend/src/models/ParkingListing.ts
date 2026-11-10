import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type ListingStatus = 'active' | 'inactive' | 'maintenance' | 'full';

export const LISTING_STATUSES: ListingStatus[] = [
  'active',
  'inactive',
  'maintenance',
  'full',
];

export type ParkingType = 'covered' | 'open' | 'underground' | 'garage' | 'valet' | 'rooftop' | 'standard';

export const PARKING_TYPES: ParkingType[] = [
  'covered',
  'open',
  'underground',
  'garage',
  'valet',
  'rooftop',
  'standard',
];

export interface IOperatingHours {
  open: string;
  close: string;
  is24_7?: boolean;
}

export interface IAddress {
  street: string;
  city: string;
  state?: string;
  zipCode?: string;
  country: string;
  formattedAddress?: string;
}

export interface ICoordinates {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude] in GeoJSON format
}

export interface IParkingListing {
  ownerId: Types.ObjectId;
  title: string;
  description: string;
  address: IAddress;
  location?: ICoordinates;
  hourlyRate: number;
  dailyRate?: number;
  totalSlots: number;
  availableSlots: number;
  parkingType?: ParkingType;
  operatingHours?: IOperatingHours;
  images?: string[];
  amenities: string[];
  status: ListingStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParkingListingDocument extends IParkingListing, Document {}

const addressSchema = new Schema<IAddress>(
  {
    street: { type: String, required: [true, 'Street address is required'], trim: true },
    city: { type: String, required: [true, 'City is required'], trim: true, index: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    country: { type: String, required: [true, 'Country is required'], default: 'India', trim: true },
    formattedAddress: { type: String, trim: true },
  },
  { _id: false }
);

const pointSchema = new Schema<ICoordinates>(
  {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: true,
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      validate: {
        validator: function (val: number[]) {
          return (
            Array.isArray(val) &&
            val.length === 2 &&
            val[0] >= -180 &&
            val[0] <= 180 && // Longitude: -180 to 180
            val[1] >= -90 &&
            val[1] <= 90 // Latitude: -90 to 90
          );
        },
        message: 'Coordinates must be valid [longitude (-180..180), latitude (-90..90)]',
      },
    },
  },
  { _id: false }
);

const parkingListingSchema = new Schema<ParkingListingDocument>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Listing title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    address: {
      type: addressSchema,
      required: [true, 'Address information is required'],
    },
    location: {
      type: pointSchema,
      required: false,
    },
    hourlyRate: {
      type: Number,
      required: [true, 'Hourly rate is required'],
      min: [0, 'Hourly rate cannot be negative'],
    },
    dailyRate: {
      type: Number,
      min: [0, 'Daily rate cannot be negative'],
    },
    parkingType: {
      type: String,
      enum: PARKING_TYPES,
      default: 'standard',
    },
    operatingHours: {
      open: { type: String, default: '06:00' },
      close: { type: String, default: '23:00' },
      is24_7: { type: Boolean, default: false },
    },
    images: {
      type: [String],
      default: [],
    },
    totalSlots: {
      type: Number,
      required: [true, 'Total parking slots count is required'],
      min: [1, 'Total slots must be at least 1'],
    },
    availableSlots: {
      type: Number,
      required: [true, 'Available slots count is required'],
      min: [0, 'Available slots cannot be negative'],
      validate: {
        validator: function (this: ParkingListingDocument, val: number) {
          // If totalSlots is defined, ensure availableSlots <= totalSlots
          return typeof this.totalSlots !== 'number' || val <= this.totalSlots;
        },
        message: 'Available slots cannot exceed total slots',
      },
    },
    amenities: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: {
        values: LISTING_STATUSES,
        message: '{VALUE} is not a valid listing status',
      },
      default: 'active',
      index: true,
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

// Compound and search indexes
parkingListingSchema.index({ status: 1, 'address.city': 1, hourlyRate: 1 });
parkingListingSchema.index({ status: 1, availableSlots: 1 });
parkingListingSchema.index({ location: '2dsphere' }, { sparse: true });
parkingListingSchema.index(
  {
    title: 'text',
    description: 'text',
    'address.street': 'text',
    'address.city': 'text',
  },
  {
    weights: {
      title: 10,
      'address.city': 5,
      'address.street': 3,
      description: 1,
    },
    name: 'listing_text_search',
  }
);

export const ParkingListing: Model<ParkingListingDocument> =
  mongoose.models.ParkingListing ||
  mongoose.model<ParkingListingDocument>('ParkingListing', parkingListingSchema);
