export type UserRole = 'customer' | 'parking_owner' | 'admin';

export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  role: UserRole;
  phoneNumber?: string;
  createdAt?: string;
}

export type ListingStatus = 'active' | 'inactive' | 'maintenance' | 'full';
export type ParkingType = 'covered' | 'open' | 'underground' | 'garage' | 'valet' | 'rooftop' | 'standard';

export interface OperatingHours {
  open: string;
  close: string;
  is24_7?: boolean;
}

export interface Address {
  street: string;
  city: string;
  state?: string;
  zipCode?: string;
  country: string;
  formattedAddress?: string;
}

export interface Coordinates {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface ParkingListing {
  id: string;
  _id?: string;
  ownerId: string | { id: string; _id?: string; name: string; email: string; role: string; phoneNumber?: string };
  title: string;
  description: string;
  address: Address;
  location?: Coordinates;
  hourlyRate: number;
  dailyRate?: number;
  totalSlots: number;
  availableSlots: number;
  activeReservationsCount?: number;
  parkingType?: ParkingType;
  operatingHours?: OperatingHours;
  images?: string[];
  amenities: string[];
  status: ListingStatus;
  createdAt: string;
  updatedAt: string;
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface Booking {
  id: string;
  _id?: string;
  bookingReference?: string;
  userId: string | { id: string; _id?: string; name: string; email: string; phoneNumber?: string };
  listingId: string | {
    id: string;
    _id?: string;
    title: string;
    address: Address;
    hourlyRate: number;
    dailyRate?: number;
    totalSlots: number;
    availableSlots?: number;
    ownerId?: string | { id: string; _id?: string; name: string; email: string };
  };
  startTime: string;
  endTime: string;
  totalAmount: number;
  status: BookingStatus;
  paymentStatus?: PaymentStatus;
  paymentId?: string;
  capacityReserved?: boolean;
  idempotencyKey?: string;
  vehicleNumber?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod = 'card' | 'upi' | 'wallet' | 'netbanking' | 'simulated_test';
export type PaymentState = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  _id?: string;
  bookingId: string | Booking;
  userId: string | User;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  status: PaymentState;
  transactionId: string;
  gatewayResponse?: Record<string, unknown>;
  paidAt?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminStats {
  users: {
    total: number;
    customers: number;
    owners: number;
    admins: number;
  };
  listings: {
    total: number;
    active: number;
    inactive: number;
  };
  bookings: {
    total: number;
    confirmed: number;
    cancelled: number;
    pending: number;
  };
  revenue: {
    totalRevenue: number;
    currency: string;
    completedPaymentsCount: number;
  };
}

export interface Pagination {
  page: number;
  limit: number;
  totalResults: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}
