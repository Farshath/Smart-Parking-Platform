import {
  ApiResponse,
  Booking,
  Pagination,
  ParkingListing,
  User,
} from '../types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const TOKEN_KEY = 'smartpark_auth_token';

export const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
};

export const setStoredToken = (token: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
  }
};

export const removeStoredToken = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
  }
};

export class ApiError extends Error {
  public statusCode: number;
  public code?: string;
  public details?: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    statusCode: number,
    code?: string,
    details?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(
      'Unable to connect to the Smart Parking API server. Please check your backend is running.',
      0,
      'NETWORK_ERROR'
    );
  }

  let data: ApiResponse<T>;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      `Server returned invalid response (Status ${response.status})`,
      response.status,
      'INVALID_JSON'
    );
  }

  if (!response.ok || !data.success) {
    const errorMsg =
      data.error?.message ||
      data.message ||
      `Request failed with status ${response.status}`;
    throw new ApiError(
      errorMsg,
      response.status,
      data.error?.code,
      data.error?.details
    );
  }

  return (data.data as T) !== undefined ? (data.data as T) : ((data as unknown) as T);
}

/**
 * Normalizes an API response entity so both `id` and `_id` are consistently available.
 */
export function normalizeEntity<T extends Record<string, any>>(doc: T): T {
  if (!doc || typeof doc !== 'object') return doc;
  const rawId = (doc as any).id || (doc as any)._id;
  const idStr = rawId ? rawId.toString() : '';

  const normalized: any = {
    ...doc,
    id: idStr,
    _id: idStr,
  };

  if (normalized.ownerId && typeof normalized.ownerId === 'object') {
    const oId = normalized.ownerId.id || normalized.ownerId._id;
    if (oId) {
      normalized.ownerId = {
        ...normalized.ownerId,
        id: oId.toString(),
        _id: oId.toString(),
      };
    }
  }

  if (normalized.userId && typeof normalized.userId === 'object') {
    const uId = normalized.userId.id || normalized.userId._id;
    if (uId) {
      normalized.userId = {
        ...normalized.userId,
        id: uId.toString(),
        _id: uId.toString(),
      };
    }
  }

  if (normalized.listingId && typeof normalized.listingId === 'object') {
    const lId = normalized.listingId.id || normalized.listingId._id;
    if (lId) {
      normalized.listingId = {
        ...normalized.listingId,
        id: lId.toString(),
        _id: lId.toString(),
      };
    }
  }

  return normalized as T;
}

export function normalizeEntities<T extends Record<string, any>>(docs: T[]): T[] {
  if (!Array.isArray(docs)) return [];
  return docs.map(normalizeEntity);
}

// Typed API Client
export const api = {
  auth: {
    register: async (payload: {
      name: string;
      email: string;
      password: string;
      phoneNumber?: string;
      role?: 'customer' | 'parking_owner';
    }): Promise<{ token: string; user: User }> => {
      return request<{ token: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    login: async (payload: {
      email: string;
      password: string;
    }): Promise<{ token: string; user: User }> => {
      return request<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    getMe: async (): Promise<{ user: User }> => {
      return request<{ user: User }>('/auth/me', {
        method: 'GET',
      });
    },

    updateProfile: async (payload: {
      name?: string;
      phoneNumber?: string;
    }): Promise<{ user: User }> => {
      return request<{ user: User }>('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    },

    changePassword: async (payload: {
      currentPassword: string;
      newPassword: string;
    }): Promise<{ message: string }> => {
      return request<{ message: string }>('/auth/change-password', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    },
  },

  listings: {
    getAll: async (params: {
      page?: number;
      limit?: number;
      search?: string;
      city?: string;
      minRate?: number;
      maxRate?: number;
      status?: string;
      amenities?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}): Promise<{ listings: ParkingListing[]; pagination: Pagination }> => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.limit) searchParams.set('limit', params.limit.toString());
      if (params.search) searchParams.set('search', params.search);
      if (params.city) searchParams.set('city', params.city);
      if (params.minRate !== undefined) searchParams.set('minRate', params.minRate.toString());
      if (params.maxRate !== undefined) searchParams.set('maxRate', params.maxRate.toString());
      if (params.status) searchParams.set('status', params.status);
      if (params.amenities) searchParams.set('amenities', params.amenities);
      if (params.sortBy) searchParams.set('sortBy', params.sortBy);
      if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

      const queryStr = searchParams.toString();
      const res = await request<{ listings: ParkingListing[]; pagination: Pagination }>(
        `/listings${queryStr ? `?${queryStr}` : ''}`,
        { method: 'GET' }
      );
      return {
        listings: normalizeEntities(res.listings || []),
        pagination: res.pagination,
      };
    },

    getById: async (id: string): Promise<{ listing: ParkingListing }> => {
      if (!id || id === 'undefined' || id === 'null') {
        throw new ApiError('Invalid parking listing identifier provided.', 400, 'INVALID_IDENTIFIER');
      }
      const res = await request<{ listing: ParkingListing }>(`/listings/${id}`, {
        method: 'GET',
      });
      return { listing: normalizeEntity(res.listing) };
    },

    getMyListings: async (params: { status?: string } = {}): Promise<{ listings: ParkingListing[] }> => {
      const searchParams = new URLSearchParams();
      if (params.status) searchParams.set('status', params.status);
      const queryStr = searchParams.toString();
      const res = await request<{ listings: ParkingListing[] }>(
        `/listings/my-listings${queryStr ? `?${queryStr}` : ''}`,
        { method: 'GET' }
      );
      return { listings: normalizeEntities(res.listings || []) };
    },

    create: async (payload: Partial<ParkingListing>): Promise<{ listing: ParkingListing }> => {
      const res = await request<{ listing: ParkingListing }>('/listings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return { listing: normalizeEntity(res.listing) };
    },

    update: async (id: string, payload: Partial<ParkingListing>): Promise<{ listing: ParkingListing }> => {
      if (!id || id === 'undefined' || id === 'null') {
        throw new ApiError('Invalid parking listing identifier provided.', 400, 'INVALID_IDENTIFIER');
      }
      const res = await request<{ listing: ParkingListing }>(`/listings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      return { listing: normalizeEntity(res.listing) };
    },

    delete: async (id: string): Promise<{ message: string }> => {
      if (!id || id === 'undefined' || id === 'null') {
        throw new ApiError('Invalid parking listing identifier provided.', 400, 'INVALID_IDENTIFIER');
      }
      return request<{ message: string }>(`/listings/${id}`, {
        method: 'DELETE',
      });
    },

    getOwnerAnalytics: async (): Promise<{
      summary: {
        totalListings: number;
        activeListings: number;
        totalSlots: number;
        availableSlots: number;
        totalBookings: number;
        confirmedBookings: number;
        pendingBookings: number;
        cancelledBookings: number;
        totalRevenue: number;
      };
      recentBookings: Booking[];
    }> => {
      const res = await request<{
        summary: {
          totalListings: number;
          activeListings: number;
          totalSlots: number;
          availableSlots: number;
          totalBookings: number;
          confirmedBookings: number;
          pendingBookings: number;
          cancelledBookings: number;
          totalRevenue: number;
        };
        recentBookings: Booking[];
      }>('/listings/analytics/owner', {
        method: 'GET',
      });
      return {
        summary: res.summary,
        recentBookings: normalizeEntities(res.recentBookings || []),
      };
    },
  },

  bookings: {
    create: async (payload: {
      listingId: string;
      startTime: string;
      endTime: string;
      vehicleNumber?: string;
      idempotencyKey?: string;
    }): Promise<{
      booking: Booking;
      listingAvailability?: { listingId: string; totalSlots: number; availableSlots: number };
    }> => {
      const res = await request<{
        booking: Booking;
        listingAvailability?: { listingId: string; totalSlots: number; availableSlots: number };
      }>('/bookings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return {
        booking: normalizeEntity(res.booking),
        listingAvailability: res.listingAvailability,
      };
    },

    getMyBookings: async (params: {
      page?: number;
      limit?: number;
      status?: string;
      roleView?: 'owner' | 'customer';
    } = {}): Promise<{ bookings: Booking[]; pagination: Pagination }> => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.limit) searchParams.set('limit', params.limit.toString());
      if (params.status) searchParams.set('status', params.status);
      if (params.roleView) searchParams.set('roleView', params.roleView);

      const queryStr = searchParams.toString();
      const res = await request<{ bookings: Booking[]; pagination: Pagination }>(
        `/bookings/my-bookings${queryStr ? `?${queryStr}` : ''}`,
        { method: 'GET' }
      );
      return {
        bookings: normalizeEntities(res.bookings || []),
        pagination: res.pagination,
      };
    },

    getById: async (id: string): Promise<{ booking: Booking }> => {
      if (!id || id === 'undefined' || id === 'null') {
        throw new ApiError('Invalid booking identifier provided.', 400, 'INVALID_IDENTIFIER');
      }
      const res = await request<{ booking: Booking }>(`/bookings/${id}`, {
        method: 'GET',
      });
      return { booking: normalizeEntity(res.booking) };
    },

    cancel: async (
      id: string,
      reason?: string
    ): Promise<{ booking: Booking }> => {
      if (!id || id === 'undefined' || id === 'null') {
        throw new ApiError('Invalid booking identifier provided.', 400, 'INVALID_IDENTIFIER');
      }
      const res = await request<{ booking: Booking }>(`/bookings/${id}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      });
      return { booking: normalizeEntity(res.booking) };
    },

    updateStatus: async (
      id: string,
      status: 'pending' | 'confirmed' | 'cancelled' | 'completed',
      reason?: string
    ): Promise<{ booking: Booking }> => {
      if (!id || id === 'undefined' || id === 'null') {
        throw new ApiError('Invalid booking identifier provided.', 400, 'INVALID_IDENTIFIER');
      }
      const res = await request<{ booking: Booking }>(`/bookings/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason }),
      });
      return { booking: normalizeEntity(res.booking) };
    },
  },

  payments: {
    process: async (payload: {
      bookingId: string;
      paymentMethod?: 'card' | 'upi' | 'wallet' | 'netbanking' | 'simulated_test';
      simulateFailure?: boolean;
    }): Promise<{ payment: import('../types').Payment; booking: Booking }> => {
      const res = await request<{ payment: import('../types').Payment; booking: Booking }>('/payments/process', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return {
        payment: normalizeEntity(res.payment),
        booking: normalizeEntity(res.booking),
      };
    },

    getMyPayments: async (params: {
      page?: number;
      limit?: number;
      status?: string;
    } = {}): Promise<{ payments: import('../types').Payment[]; pagination: Pagination }> => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.limit) searchParams.set('limit', params.limit.toString());
      if (params.status) searchParams.set('status', params.status);

      const queryStr = searchParams.toString();
      const res = await request<{ payments: import('../types').Payment[]; pagination: Pagination }>(
        `/payments/my-payments${queryStr ? `?${queryStr}` : ''}`,
        { method: 'GET' }
      );
      return {
        payments: normalizeEntities(res.payments || []),
        pagination: res.pagination,
      };
    },

    getById: async (id: string): Promise<{ payment: import('../types').Payment }> => {
      if (!id || id === 'undefined' || id === 'null') {
        throw new ApiError('Invalid payment identifier provided.', 400, 'INVALID_IDENTIFIER');
      }
      const res = await request<{ payment: import('../types').Payment }>(`/payments/${id}`, {
        method: 'GET',
      });
      return { payment: normalizeEntity(res.payment) };
    },
  },

  admin: {
    getStats: async (): Promise<{ stats: import('../types').AdminStats; recentUsers: User[]; recentBookings: Booking[] }> => {
      const res = await request<{ stats: import('../types').AdminStats; recentUsers: User[]; recentBookings: Booking[] }>('/admin/stats', {
        method: 'GET',
      });
      return {
        stats: res.stats,
        recentUsers: normalizeEntities(res.recentUsers || []),
        recentBookings: normalizeEntities(res.recentBookings || []),
      };
    },

    getUsers: async (params: { page?: number; limit?: number; role?: string; search?: string } = {}): Promise<{ users: User[]; pagination: Pagination }> => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.limit) searchParams.set('limit', params.limit.toString());
      if (params.role) searchParams.set('role', params.role);
      if (params.search) searchParams.set('search', params.search);

      const queryStr = searchParams.toString();
      const res = await request<{ users: User[]; pagination: Pagination }>(`/admin/users${queryStr ? `?${queryStr}` : ''}`, {
        method: 'GET',
      });
      return {
        users: normalizeEntities(res.users || []),
        pagination: res.pagination,
      };
    },

    updateUserRole: async (id: string, role: string): Promise<{ user: User }> => {
      const res = await request<{ user: User }>(`/admin/users/${id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      return { user: normalizeEntity(res.user) };
    },

    deleteUser: async (id: string): Promise<{ message: string }> => {
      return request<{ message: string }>(`/admin/users/${id}`, {
        method: 'DELETE',
      });
    },

    getListings: async (params: { page?: number; limit?: number; status?: string; search?: string } = {}): Promise<{ listings: ParkingListing[]; pagination: Pagination }> => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.limit) searchParams.set('limit', params.limit.toString());
      if (params.status) searchParams.set('status', params.status);
      if (params.search) searchParams.set('search', params.search);

      const queryStr = searchParams.toString();
      const res = await request<{ listings: ParkingListing[]; pagination: Pagination }>(`/admin/listings${queryStr ? `?${queryStr}` : ''}`, {
        method: 'GET',
      });
      return {
        listings: normalizeEntities(res.listings || []),
        pagination: res.pagination,
      };
    },

    updateListingStatus: async (id: string, status: string): Promise<{ listing: ParkingListing }> => {
      const res = await request<{ listing: ParkingListing }>(`/admin/listings/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      return { listing: normalizeEntity(res.listing) };
    },

    getBookings: async (params: { page?: number; limit?: number; status?: string } = {}): Promise<{ bookings: Booking[]; pagination: Pagination }> => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.limit) searchParams.set('limit', params.limit.toString());
      if (params.status) searchParams.set('status', params.status);

      const queryStr = searchParams.toString();
      const res = await request<{ bookings: Booking[]; pagination: Pagination }>(`/admin/bookings${queryStr ? `?${queryStr}` : ''}`, {
        method: 'GET',
      });
      return {
        bookings: normalizeEntities(res.bookings || []),
        pagination: res.pagination,
      };
    },
  },
};
