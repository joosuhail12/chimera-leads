export async function register() {
  // Only run worker bootstrap in the Node.js runtime (Edge builds cannot use BullMQ)
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const shouldEnableWorkersExplicitly = process.env.ENABLE_APOLLO_WORKERS === 'true';
  const isHostedServerless = process.env.VERCEL === '1';
  const shouldEnableByDefault = process.env.NODE_ENV === 'development' && !isHostedServerless;
  const shouldInitializeWorkers = shouldEnableWorkersExplicitly || shouldEnableByDefault;

  if (!shouldInitializeWorkers) {
    console.log(
      'ℹ️ Skipping Apollo worker initialization (set ENABLE_APOLLO_WORKERS=true to override).'
    );
    return;
  }

  const { initializeWorkers } = await import('@/lib/queue/worker-manager');

  // Avoid re-initializing workers during local dev hot reloads
  if (process.env.NODE_ENV === 'development') {
    const isInitialized = global.__apolloWorkersInitialized;
    if (isInitialized) {
      console.log('⚡ Apollo workers already initialized (development mode)');
      return;
    }
    global.__apolloWorkersInitialized = true;
  }

  if (!process.env.REDIS_HOST) {
    console.warn('⚠️ Redis not configured. Apollo queue workers will not be initialized.');
    console.warn('Set REDIS_HOST in your environment variables to enable queue processing.');
    return;
  }

  if (!process.env.APOLLO_API_KEY) {
    console.warn('⚠️ Apollo API key not configured. Queue workers will run in mock mode.');
  }

  try {
    console.log('🔧 Initializing Apollo queue workers...');

    const organizationId = process.env.CLERK_ALLOWED_ORG_ID;
    await initializeWorkers(organizationId);

    console.log('✅ Apollo queue workers initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Apollo queue workers:', error);

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Fatal: Cannot start without queue workers in production');
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __apolloWorkersInitialized: boolean | undefined;
}
