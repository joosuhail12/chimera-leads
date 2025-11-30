import { initializeWorkers } from '@/lib/queue/worker-manager';

export async function register() {
  // Only initialize workers in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Skip worker initialization in development if already initialized
    if (process.env.NODE_ENV === 'development') {
      const isInitialized = global.__apolloWorkersInitialized;
      if (isInitialized) {
        console.log('⚡ Apollo workers already initialized (development mode)');
        return;
      }
      global.__apolloWorkersInitialized = true;
    }

    // Check if Redis is configured
    if (!process.env.REDIS_HOST) {
      console.warn('⚠️ Redis not configured. Apollo queue workers will not be initialized.');
      console.warn('Set REDIS_HOST in your environment variables to enable queue processing.');
      return;
    }

    // Check if Apollo API key is configured
    if (!process.env.APOLLO_API_KEY) {
      console.warn('⚠️ Apollo API key not configured. Queue workers will run in mock mode.');
    }

    try {
      console.log('🔧 Initializing Apollo queue workers...');

      // Get organization ID from environment or use default
      const organizationId = process.env.CLERK_ALLOWED_ORG_ID;

      // Initialize workers
      await initializeWorkers(organizationId);

      console.log('✅ Apollo queue workers initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Apollo queue workers:', error);

      // In production, you might want to exit the process
      if (process.env.NODE_ENV === 'production') {
        console.error('Fatal: Cannot start without queue workers in production');
        process.exit(1);
      }
    }
  }
}

// TypeScript declaration for global variable
declare global {
  var __apolloWorkersInitialized: boolean | undefined;
}