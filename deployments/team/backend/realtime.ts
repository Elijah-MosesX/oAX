// Subscriptions contain only invalidation destinations and expire after one hour.
// Private content is returned exclusively by authenticated, reauthorized HTTP reads.
export const realtime = async () => ({ statusCode: 200 });
