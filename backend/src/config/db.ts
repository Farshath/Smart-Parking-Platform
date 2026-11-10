import mongoose from 'mongoose';
import { env } from './env';

const readyStates: Record<number, 'disconnected' | 'connected' | 'connecting' | 'disconnecting'> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

export const connectDatabase = async (): Promise<boolean> => {
  if (!env.MONGODB_URI) {
    console.warn('[Database] MONGODB_URI environment variable is not defined. Running without active MongoDB connection.');
    return false;
  }

  try {
    mongoose.connection.on('connected', () => {
      console.log('[Database] MongoDB connection established successfully.');
    });

    mongoose.connection.on('error', (err) => {
      console.error('[Database] MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[Database] MongoDB disconnected.');
    });

    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: env.NODE_ENV !== 'production',
    });

    return true;
  } catch (error) {
    console.error('[Database] Failed to connect to MongoDB:', error instanceof Error ? error.message : error);
    return false;
  }
};

export const getDatabaseStatus = () => {
  if (!env.MONGODB_URI) {
    return {
      status: 'unconfigured',
      connected: false,
      message: 'MONGODB_URI is not set in environment variables',
    };
  }

  const stateCode = mongoose.connection.readyState;
  const state = readyStates[stateCode] || 'disconnected';
  const isConnected = stateCode === 1;

  return {
    status: state,
    connected: isConnected,
    host: isConnected ? mongoose.connection.host : undefined,
    database: isConnected ? mongoose.connection.name : undefined,
  };
};

export const disconnectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('[Database] MongoDB connection closed.');
  }
};
